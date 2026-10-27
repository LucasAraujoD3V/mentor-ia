import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublicKey, verify as verifySignature } from 'node:crypto';
import { db, getUser, findEmail, publicUser, cleanup } from './db.mjs';
import { random, digest, otp, passwordError, hashPassword, verifyPassword, text, email, fail } from './security.mjs';
import { production, realMail, mailbox, sendMail, clearMailbox } from './mail.mjs';
import { estudos } from './estudos.mjs'; // Fase 3

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const origin = process.env.APP_ORIGIN || `http://127.0.0.1:${port}`;
if (new URL(origin).origin !== origin) throw new Error('APP_ORIGIN deve conter apenas protocolo e domínio, sem barra final.');
if (production && (!origin.startsWith('https://') || !realMail)) throw new Error('Produção exige APP_ORIGIN HTTPS, RESEND_API_KEY e MAIL_FROM.');
if (!production && !['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('Modo de desenvolvimento só pode escutar em loopback.');
const google = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const dummyHash = await hashPassword(random());
const limits = new Map();
function rate(key, max, windowMs = 900000) {
  const now = Date.now();
  let record = limits.get(key);
  if (!record || record.until < now) { record = { count: 0, until: now + windowMs }; limits.set(key, record); }
  if (++record.count > max) fail('Muitas tentativas. Aguarde 15 minutos e tente novamente.', 429);
}
function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(x => x.trim().split('=')));
}
function cookie(res, name, value, age) {
  res.setHeader('Set-Cookie', `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${production ? '; Secure' : ''}`);
}
function json(res, value, status = 200) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); }
function redirect(res, target) { res.writeHead(302, { Location: target }); res.end(); }
function auth(req) {
  const session = db.prepare('SELECT user_id FROM sessions WHERE id=? AND expires>?').get(digest(cookies(req).mentor_session || ''), Date.now());
  if (!session) fail('Entre novamente para continuar.', 401);
  const user = getUser(session.user_id);
  if (!user?.verified) fail('Confirme seu e-mail para continuar.', 401);
  return user;
}
function newSession(req, res, user) {
  db.prepare('DELETE FROM sessions WHERE id=?').run(digest(cookies(req).mentor_session || ''));
  const token = random();
  db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(digest(token), user.id, Date.now() + 86400000);
  cookie(res, 'mentor_session', token, 86400);
}
async function challenge(user, purpose) {
  rate(`mail:${user.id}`, 6);
  const id = random(), code = otp();
  const names = { verify: 'Confirmar cadastro', login: 'Confirmar acesso', reset: 'Recuperar senha', password: 'Alterar senha', delete: 'Excluir conta' };
  await sendMail(user.email, `Mentor IA — ${names[purpose]}`, `Seu código para ${names[purpose].toLowerCase()} é: ${code}\n\nExpira em 10 minutos e pode ser usado uma única vez. Não compartilhe este código. Se não foi você, ignore esta mensagem. A equipe nunca pede sua senha.`);
  db.prepare('DELETE FROM challenges WHERE user_id=? AND purpose=?').run(user.id, purpose);
  db.prepare('INSERT INTO challenges (id,user_id,purpose,hash,expires) VALUES (?,?,?,?,?)').run(id, user.id, purpose, digest(id + ':' + code), Date.now() + 600000);
  return id;
}
function consume(id, code, purpose, userId) {
  if (typeof id !== 'string' || typeof code !== 'string' || !/^\d{6}$/.test(code)) fail('Informe o código de seis dígitos.');
  const c = db.prepare('SELECT * FROM challenges WHERE id=? AND purpose=?').get(id, purpose);
  if (!c || c.expires < Date.now() || c.attempts >= 5 || (userId && c.user_id !== userId)) fail('Código inválido, expirado ou bloqueado. Solicite um novo.');
  db.prepare('UPDATE challenges SET attempts=attempts+1 WHERE id=?').run(id);
  if (c.hash !== digest(id + ':' + code)) fail('Código incorreto. Após cinco tentativas, solicite um novo.');
  db.prepare('DELETE FROM challenges WHERE id=?').run(id);
  return getUser(c.user_id);
}
function revoke(userId) { db.prepare('DELETE FROM sessions WHERE user_id=?').run(userId); db.prepare('DELETE FROM challenges WHERE user_id=?').run(userId); }
function nextDue(prefs) {
  const now = new Date();
  if (prefs.frequency === 'daily') return Date.now() + 86400000;
  const [hh, mm] = prefs.time.split(':').map(Number);
  // Use São Paulo clock explicitly, independently of server timezone (UTC-3).
  const local = new Date(Date.now() - 3 * 3600000);
  const due = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), hh + 3, mm);
  return due > now.getTime() ? due : due + 86400000;
}
async function event(user, message) {
  const prefs = JSON.parse(user.prefs);
  if (prefs.channel === 'none') return;
  if (prefs.frequency !== 'event') {
    const batch = db.prepare('SELECT MIN(due) AS due FROM deliveries WHERE user_id=? AND due>? AND attempts=0').get(user.id, Date.now());
    db.prepare('INSERT INTO deliveries VALUES (?,?,?,?,0)').run(random(), user.id, message, batch?.due || nextDue(prefs));
  } else if (prefs.channel === 'app') {
    db.prepare('INSERT INTO notices VALUES (?,?,?,?)').run(random(), user.id, message, Date.now());
  } else {
    // Queue for reliable retries; security codes are separate and always immediate.
    db.prepare('INSERT INTO deliveries VALUES (?,?,?,?,0)').run(random(), user.id, message, Date.now());
  }
}
let delivering = false;
async function processNotifications() {
  if (delivering) return;
  delivering = true;
  try {
    const due = db.prepare('SELECT DISTINCT user_id FROM deliveries WHERE due<=? AND attempts<5').all(Date.now());
    for (const { user_id } of due) {
      const user = getUser(user_id); if (!user) continue;
      const prefs = JSON.parse(user.prefs);
      const rows = db.prepare('SELECT * FROM deliveries WHERE user_id=? AND due<=? AND attempts<5').all(user_id, Date.now());
      try {
        if (prefs.channel === 'email') await sendMail(user.email, 'Mentor IA — atualizações da conta', rows.map(x => x.message).join('\n'));
        if (prefs.channel === 'app') for (const row of rows) db.prepare('INSERT INTO notices VALUES (?,?,?,?)').run(random(), user.id, row.message, Date.now());
        for (const row of rows) db.prepare('DELETE FROM deliveries WHERE id=?').run(row.id);
      } catch {
        for (const row of rows) db.prepare('UPDATE deliveries SET attempts=attempts+1,due=? WHERE id=?').run(Date.now() + 300000, row.id);
        console.error('Falha no envio de notificações; nova tentativa agendada.');
      }
    }
  } finally { delivering = false; }
}
async function readBody(req) {
  let size = 0, chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > 800000) fail('Arquivo ou formulário muito grande.', 413); chunks.push(chunk); }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Formulário inválido.');
    return body;
  } catch { fail('Formulário inválido.'); }
}
async function api(req, res, url) {
  const route = url.pathname, method = req.method;
  if (route.startsWith('/api/estudos/')) return estudos(req, res, url, { auth, json, readBody, rate, origin }); // Fase 3
  if (method === 'GET' && route === '/api/config') return json(res, { version: '0.2.0', google, development: !production, localMailbox: !production && !realMail, realMail, legalVersion: '2026-10-19-academica' });
  if (method === 'GET' && route === '/api/dev/mail') {
    if (production || realMail || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) fail('Página não encontrada.', 404);
    return json(res, { messages: [...mailbox].reverse() });
  }
  if (method === 'GET' && route === '/api/google/start') return startGoogle(req, res);
  if (method === 'GET' && route === '/api/google/callback') return finishGoogle(req, res, url);
  if (method === 'GET' && route === '/api/me') return json(res, { user: publicUser(auth(req)) });
  if (method === 'GET' && route === '/api/notices') { const u = auth(req); return json(res, { notices: db.prepare('SELECT id,message,created FROM notices WHERE user_id=? ORDER BY created DESC LIMIT 30').all(u.id) }); }
  if (method === 'GET' && route === '/api/review') { const u = auth(req); return json(res, { review: db.prepare('SELECT stars,comment,updated FROM reviews WHERE user_id=?').get(u.id) || null }); }
  if (method === 'GET' && route === '/api/export') {
    const u = auth(req);
    res.setHeader('Content-Disposition', 'attachment; filename="mentor-ia-meus-dados.json"');
    return json(res, { user: publicUser(u), review: db.prepare('SELECT stars,comment,updated FROM reviews WHERE user_id=?').get(u.id) || null, notifications: db.prepare('SELECT message,created FROM notices WHERE user_id=?').all(u.id), acceptedVersion: u.accepted_version });
  }
  if (method !== 'POST') fail('Página não encontrada.', 404);
  // No cross-origin API use. Origin and custom header prevent form/CSRF attacks.
  if (req.headers.origin !== origin || req.headers['x-mentor-request'] !== '1' || !req.headers['content-type']?.startsWith('application/json')) fail('Solicitação não autorizada.', 403);
  rate(`ip:${req.socket.remoteAddress}`, 100);
  const body = await readBody(req);
  if (route === '/api/register') {
    const e = email(body.email), name = text(body.name, 80);
    if (name.length < 2) fail('Informe seu nome com pelo menos dois caracteres.');
    if (passwordError(body.password)) fail(passwordError(body.password));
    if (body.accept !== true) fail('Leia e aceite os termos e a política para cadastrar-se.');
    rate('register:' + digest(e), 5);
    let u = findEmail(e);
    if (u) {
      // Do not replace someone else's unverified password or leak registration state.
      return json(res, { challenge: random(), message: 'Se o cadastro puder ser confirmado, você receberá um código. Se já possui conta, entre ou recupere sua senha.' });
    }
    const id = random();
    db.prepare('INSERT INTO users (id,email,name,password,created) VALUES (?,?,?,?,?)').run(id, e, name, await hashPassword(body.password), Date.now());
    u = getUser(id);
    try { return json(res, { challenge: await challenge(u, 'verify'), message: 'Confira seu e-mail para confirmar o cadastro.' }); }
    catch (err) { db.prepare('DELETE FROM users WHERE id=?').run(id); throw err; }
  }
  if (route === '/api/login') {
    const e = email(body.email); rate('login:' + digest(e), 8);
    const u = findEmail(e);
    const ok = await verifyPassword(body.password, u?.password || dummyHash);
    if (!u || !ok) fail('E-mail ou senha incorretos.', 401);
    const purpose = u.verified ? 'login' : 'verify';
    return json(res, { challenge: await challenge(u, purpose), purpose, message: 'Confirme o código enviado ao seu e-mail.' });
  }
  if (route === '/api/verify') {
    if (!['verify', 'login'].includes(body.purpose)) fail('Operação inválida.');
    const c = db.prepare('SELECT user_id FROM challenges WHERE id=? AND purpose=?').get(String(body.challenge), body.purpose);
    const pendingUser = c ? getUser(c.user_id) : null;
    if (pendingUser && !pendingUser.accepted_version && body.accept !== true) fail('Leia e aceite os documentos da versão acadêmica.');
    const u = consume(body.challenge, body.code, body.purpose);
    db.prepare('UPDATE users SET verified=1,accepted_version=? WHERE id=?').run('2026-10-19-academica', u.id);
    newSession(req, res, u);
    await event(getUser(u.id), body.purpose === 'verify' ? 'Sua conta foi confirmada. Bem-vindo ao Mentor IA!' : 'Um novo acesso à sua conta foi confirmado.');
    return json(res, { user: publicUser(getUser(u.id)) });
  }
  if (route === '/api/resend') {
    if (!['verify', 'login', 'reset'].includes(body.purpose)) fail('Operação inválida.');
    const c = db.prepare('SELECT * FROM challenges WHERE id=? AND purpose=?').get(String(body.challenge), body.purpose);
    if (!c) return json(res, { challenge: random(), message: 'Se aplicável, um novo código foi enviado.' });
    const u = getUser(c.user_id);
    return json(res, { challenge: await challenge(u, body.purpose), message: 'Um novo código foi enviado. O anterior não funciona mais.' });
  }
  if (route === '/api/recover') {
    const e = email(body.email); rate('recover:' + digest(e), 5);
    const u = findEmail(e);
    const id = u?.verified && u.password ? await challenge(u, 'reset') : random();
    return json(res, { challenge: id, message: 'Se houver uma conta com senha para esse e-mail, um código foi enviado.' });
  }
  if (route === '/api/reset') {
    if (passwordError(body.password)) fail(passwordError(body.password));
    const u = consume(body.challenge, body.code, 'reset');
    db.prepare('UPDATE users SET password=? WHERE id=?').run(await hashPassword(body.password), u.id);
    revoke(u.id); await event(u, 'Sua senha foi redefinida. Todas as sessões foram encerradas.');
    return json(res, { message: 'Senha atualizada. Entre com a nova senha.' });
  }
  const u = auth(req);
  if (route === '/api/logout') {
    db.prepare('DELETE FROM sessions WHERE id=?').run(digest(cookies(req).mentor_session || ''));
    cookie(res, 'mentor_session', '', 0); return json(res, { message: 'Você saiu da conta.' });
  }
  if (route === '/api/profile') {
    // Reject critical identifiers even if a modified client sends them.
    if (Object.hasOwn(body, 'email') || Object.hasOwn(body, 'cpf') || Object.hasOwn(body, 'id')) fail('Dados de identificação não podem ser alterados.');
    const name = text(body.name, 80), school = text(body.school, 120), grade = text(body.grade, 40), bio = text(body.bio, 500);
    if (name.length < 2) fail('Informe um nome com pelo menos dois caracteres.');
    if (grade && !['1º ano', '2º ano', '3º ano', 'Professor', 'Outro'].includes(grade)) fail('Selecione uma etapa válida.');
    db.prepare('UPDATE users SET name=?,school=?,grade=?,bio=? WHERE id=?').run(name, school, grade, bio, u.id);
    await event(u, 'Seu perfil foi atualizado.'); return json(res, { user: publicUser(getUser(u.id)), message: 'Perfil salvo.' });
  }
  if (route === '/api/avatar') {
    const avatar = body.avatar;
    if (avatar !== '') {
      if (typeof avatar !== 'string' || avatar.length > 700000 || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(avatar)) fail('Use uma imagem PNG ou JPEG de até 500 KB.');
      const bytes = Buffer.from(avatar.split(',')[1], 'base64');
      const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      if (bytes.length > 512000 || (avatar.startsWith('data:image/png') ? !png : !jpg)) fail('Imagem inválida. Use PNG ou JPEG de até 500 KB.');
    }
    db.prepare('UPDATE users SET avatar=? WHERE id=?').run(avatar, u.id);
    return json(res, { user: publicUser(getUser(u.id)), message: 'Foto atualizada.' });
  }
  if (route === '/api/preferences') {
    const { channel, frequency, time, theme, font } = body;
    if (!['app', 'email', 'none'].includes(channel) || !['event', 'daily', 'scheduled'].includes(frequency) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !['light', 'dark'].includes(theme) || ![100, 112, 125].includes(font)) fail('Preferências inválidas.');
    db.prepare('UPDATE users SET prefs=? WHERE id=?').run(JSON.stringify({ channel, frequency, time, theme, font }), u.id);
    // Pending notifications now use the chosen timing. Turning off clears pending queue.
    if (channel === 'none') db.prepare('DELETE FROM deliveries WHERE user_id=?').run(u.id);
    else db.prepare('UPDATE deliveries SET due=?,attempts=0 WHERE user_id=?').run(frequency === 'event' ? Date.now() : nextDue(body), u.id);
    return json(res, { user: publicUser(getUser(u.id)), message: 'Preferências salvas. Códigos de segurança continuam imediatos por e-mail.' });
  }
  if (route === '/api/security/request') {
    rate('security:' + u.id, 8);
    if (!['password', 'delete'].includes(body.purpose)) fail('Operação inválida.');
    if (u.password && !await verifyPassword(body.password, u.password)) fail('Senha atual incorreta.', 401);
    return json(res, { challenge: await challenge(u, body.purpose), message: 'Código de confirmação enviado ao seu e-mail.' });
  }
  if (route === '/api/security/password') {
    if (passwordError(body.password)) fail(passwordError(body.password));
    consume(body.challenge, body.code, 'password', u.id);
    db.prepare('UPDATE users SET password=? WHERE id=?').run(await hashPassword(body.password), u.id);
    revoke(u.id); newSession(req, res, u);
    await event(u, 'Sua senha foi alterada. As outras sessões foram encerradas.');
    return json(res, { user: publicUser(getUser(u.id)), message: 'Senha alterada com segurança.' });
  }
  if (route === '/api/security/delete') {
    if (body.confirm !== 'EXCLUIR') fail('Digite EXCLUIR para confirmar.');
    consume(body.challenge, body.code, 'delete', u.id);
    db.prepare('DELETE FROM users WHERE id=?').run(u.id); clearMailbox(u.email);
    cookie(res, 'mentor_session', '', 0);
    return json(res, { message: 'Conta e dados associados excluídos da base ativa.' });
  }
  if (route === '/api/review') {
    const stars = Number(body.stars), comment = text(body.comment, 1000);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) fail('Escolha de uma a cinco estrelas.');
    db.prepare('INSERT INTO reviews VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET stars=excluded.stars,comment=excluded.comment,updated=excluded.updated').run(u.id, stars, comment, Date.now());
    return json(res, { message: 'Avaliação salva. Você pode editar ou excluir a qualquer momento.' });
  }
  if (route === '/api/review/delete') { db.prepare('DELETE FROM reviews WHERE user_id=?').run(u.id); return json(res, { message: 'Avaliação excluída.' }); }
  if (route === '/api/notices/clear') { db.prepare('DELETE FROM notices WHERE user_id=?').run(u.id); return json(res, { message: 'Notificações removidas.' }); }
  fail('Página não encontrada.', 404);
}

async function startGoogle(req, res) {
  if (!google) fail('Acesso com Google ainda não configurado.', 503);
  rate('google:' + req.socket.remoteAddress, 10);
  const state = random(), verifier = random(), nonce = random();
  db.prepare('INSERT INTO oauth VALUES (?,?,?,?)').run(digest(state), verifier, nonce, Date.now() + 600000);
  cookie(res, 'mentor_oauth', state, 600);
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  const params = { client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: origin + '/api/google/callback', response_type: 'code', scope: 'openid email profile', state, nonce, code_challenge: Buffer.from(digest(verifier), 'hex').toString('base64url'), code_challenge_method: 'S256' };
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  redirect(res, url.toString());
}
async function finishGoogle(req, res, url) {
  try {
    if (!google) fail('Google indisponível.');
    const state = url.searchParams.get('state');
    if (!state || cookies(req).mentor_oauth !== state) fail('Solicitação inválida.');
    const flow = db.prepare('SELECT * FROM oauth WHERE state=?').get(digest(state));
    db.prepare('DELETE FROM oauth WHERE state=?').run(digest(state));
    cookie(res, 'mentor_oauth', '', 0);
    if (!flow || flow.expires < Date.now() || url.searchParams.has('error')) fail('Acesso cancelado ou expirado.');
    const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: url.searchParams.get('code') || '', client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: origin + '/api/google/callback', grant_type: 'authorization_code', code_verifier: flow.verifier }), signal: AbortSignal.timeout(15000) });
    if (!response.ok) fail('Falha no Google.');
    const token = await response.json();
    const [header64, payload64, signature64] = String(token.id_token).split('.');
    const header = JSON.parse(Buffer.from(header64, 'base64url')), claims = JSON.parse(Buffer.from(payload64, 'base64url'));
    if (header.alg !== 'RS256' || !header.kid) fail('Token inválido.');
    const jwksResponse = await fetch('https://www.googleapis.com/oauth2/v3/certs', { signal: AbortSignal.timeout(10000) });
    if (!jwksResponse.ok) fail('Verificação indisponível.');
    const keys = await jwksResponse.json(), key = keys.keys.find(k => k.kid === header.kid);
    if (!key || !verifySignature('RSA-SHA256', Buffer.from(header64 + '.' + payload64), createPublicKey({ key, format: 'jwk' }), Buffer.from(signature64, 'base64url'))) fail('Assinatura inválida.');
    if (!['https://accounts.google.com', 'accounts.google.com'].includes(claims.iss) || claims.aud !== process.env.GOOGLE_CLIENT_ID || (claims.azp && claims.azp !== process.env.GOOGLE_CLIENT_ID) || !Number.isFinite(claims.exp) || !Number.isFinite(claims.iat) || claims.exp * 1000 <= Date.now() || claims.iat * 1000 > Date.now() + 60000 || claims.nonce !== flow.nonce || typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 255 || claims.email_verified !== true) fail('Identidade inválida.');
    let user = db.prepare('SELECT * FROM users WHERE google_sub=?').get(claims.sub);
    if (!user) {
      const e = email(claims.email);
      // No silent linking of an existing password account by email alone.
      if (findEmail(e)) return redirect(res, '/login/#login?error=google-existing');
      // Google callback does not accept Terms for the user. Hold consent behind OTP completion.
      const id = random();
      db.prepare('INSERT INTO users (id,email,name,google_sub,created,accepted_version) VALUES (?,?,?,?,?,?)').run(id, e, text(claims.name || 'Estudante', 80), claims.sub, Date.now(), '');
      user = getUser(id);
    }
    const id = await challenge(user, 'login');
    redirect(res, '/login/#google-confirm?' + new URLSearchParams({ challenge: id, consent: user.verified ? '0' : '1' }));
  } catch { redirect(res, '/login/#login?error=google'); }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cache-Control', 'no-store');
  if (production) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  let url;
  try { url = new URL(req.url, origin); } catch { return json(res, { message: 'Endereço inválido.' }, 400); }
  try {
    if (req.headers.host !== new URL(origin).host) fail('Host não autorizado.', 403);
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (!['GET', 'HEAD'].includes(req.method)) fail('Método não permitido.', 405);
    if (url.pathname === '/login') return redirect(res, '/login/');
    let p = resolve(root, '.' + decodeURIComponent(url.pathname));
    const relative = p.slice(root.length + 1).replaceAll('\\', '/');
    if (!p.startsWith(root + sep) && p !== root) fail('Página não encontrada.', 404);
    // Explicit public file allowlist: never serve server source, data, docs or env.
    if (!(p === root || ['index.html', 'styles.css', 'script.js', 'brandbook.html', '20260922_223141000_iOS.jpg'].includes(relative) || relative === 'login' || /^login\/(index\.html|app\.js|app\.css|css\/estudos\.css|js\/(?:estudos|graficos)\.js|fonts\/[a-z0-9.-]+\.woff2)$/.test(relative) || /^assets\/[a-z0-9_.-]+\.(jpg|png|svg|webp)$/.test(relative))) fail('Página não encontrada.', 404);
    if ((await stat(p)).isDirectory()) p = resolve(p, 'index.html');
    const content = await readFile(p);
    if (p.includes(sep + 'login' + sep)) res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' })[extname(p)] || 'application/octet-stream');
    res.writeHead(200); res.end(req.method === 'HEAD' ? undefined : content);
  } catch (err) {
    const status = err.status || (err.code === 'ENOENT' ? 404 : 500);
    if (status === 500) console.error('Falha interna na operação:', url.pathname); // Never log bodies, passwords or codes.
    if (!res.headersSent) json(res, { message: status === 500 ? 'Não foi possível concluir. Tente novamente; se persistir, contate o suporte.' : err.message }, status);
    else res.end();
  }
});
cleanup();
setInterval(() => { cleanup(); for (const [k, v] of limits) if (v.until < Date.now()) limits.delete(k); }, 60000).unref();
setInterval(() => processNotifications().catch(() => console.error('Falha no processamento de notificações.')), 15000).unref();
server.listen(port, host, () => console.log(`Mentor IA: ${origin}/login/\n${!production && !realMail ? 'E-mails de teste: botão Caixa local na tela de acesso. Uso apenas local com dados fictícios.' : 'Envio de e-mails configurado.'}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
