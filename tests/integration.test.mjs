import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:net';
import { digest } from '../server/security.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
test('Fluxos reais de acesso, perfil, configurações e exclusão', { timeout: 60000 }, async t => {
  const tmp = mkdtempSync(join(tmpdir(), 'mentor-ia-test-'));
  const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(r => probe.close(r));
  const origin = `http://127.0.0.1:${port}`, dbPath = join(tmp, 'test.sqlite');
  const child = spawn(process.execPath, ['server/index.mjs'], { cwd: resolve(import.meta.dirname, '..'), env: { ...process.env, NODE_ENV: 'development', PORT: String(port), HOST: '127.0.0.1', APP_ORIGIN: origin, DATABASE_PATH: dbPath, RESEND_API_KEY: '', MAIL_FROM: '', GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = ''; child.stderr.on('data', d => { logs += d; });
  let database;
  t.after(async () => { database?.close(); const exited = once(child, 'exit'); child.kill(); await Promise.race([exited, wait(2000)]); if (tmp.startsWith(join(tmpdir(), 'mentor-ia-test-'))) rmSync(tmp, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 }); });
  for (let i = 0; i < 80; i++) { try { if ((await fetch(origin + '/api/config')).ok) break; } catch {} if (i === 79) throw Error('Servidor não iniciou: ' + logs); await wait(50); }
  database = new DatabaseSync(dbPath);
  let cookie = '';
  async function call(route, data, opts = {}) {
    const headers = { ...(data === undefined ? {} : { Origin: origin, 'X-Mentor-Request': '1', 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}), ...opts.headers };
    const response = await fetch(origin + '/api/' + route, { method: data === undefined ? 'GET' : 'POST', headers, body: data === undefined ? undefined : JSON.stringify(data), redirect: 'manual' });
    if (response.headers.has('set-cookie') && !opts.noCookie) cookie = response.headers.get('set-cookie').split(';')[0];
    const result = await response.json();
    return { status: response.status, result, response };
  }
  async function code(to) { const m = (await call('dev/mail')).result.messages.find(m => m.to === to && /Seu código/.test(m.message)); assert.ok(m); return m.message.match(/é: (\d{6})/)[1]; }
  const account = { name: 'Aluna Teste', email: 'aluna@example.com', password: 'SenhaForte!2026', accept: true };
  let challenge, passwordChallenge, resetChallenge;
  await t.test('Cadastro exige política, termos e confirmação; OTP não é exposto na resposta', async () => {
    assert.equal((await call('register', { ...account, password: 'fraca' })).status, 400);
    assert.equal((await call('register', { ...account, accept: false })).status, 400);
    const reg = await call('register', account); assert.equal(reg.status, 200); challenge = reg.result.challenge;
    assert.equal(reg.result.code, undefined); assert.equal((await call('me')).status, 401);
    const stored = database.prepare('SELECT * FROM users WHERE email=?').get(account.email);
    assert.match(stored.password, /^scrypt\$/); assert.equal(stored.verified, 0);
    const otp = await code(account.email);
    assert.equal((await call('verify', { challenge, purpose: 'verify', code: otp })).status, 200);
    assert.equal((await call('verify', { challenge, purpose: 'verify', code: otp })).status, 400);
    assert.equal((await call('me')).result.user.email, account.email);
  });
  await t.test('Perfil salva e protege identificadores; rejeita foto adulterada', async () => {
    assert.equal((await call('profile', { name: 'Outro', email: 'outro@example.com', school: '', grade: '', bio: '' })).status, 400);
    assert.equal((await call('profile', { name: 'Aluna Atualizada', school: 'Escola teste', grade: '2º ano', bio: '<script>alert(1)</script>' })).status, 200);
    assert.equal((await call('me')).result.user.school, 'Escola teste');
    assert.equal((await call('avatar', { avatar: 'data:image/png;base64,' + Buffer.from('arquivo falso').toString('base64') })).status, 400);
    const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
    assert.equal((await call('avatar', { avatar: image })).status, 200);
    assert.equal((await call('me')).result.user.avatar, image);
    assert.equal((await call('avatar', { avatar: '' })).status, 200);
  });
  await t.test('Preferências, fila programada, avisos internos e avaliação gerenciável', async () => {
    const prefs = { channel: 'app', frequency: 'scheduled', time: '18:30', theme: 'dark', font: 125 };
    assert.equal((await call('preferences', { ...prefs, channel: 'whatsapp' })).status, 400);
    assert.equal((await call('preferences', prefs)).status, 200);
    assert.deepEqual((await call('me')).result.user.prefs, prefs);
    await call('profile', { name: 'Aluna Atualizada', school: 'Escola teste', grade: '2º ano', bio: '' });
    const queued = database.prepare('SELECT * FROM deliveries LIMIT 1').get(); assert.ok(queued.due > Date.now());
    await call('preferences', { ...prefs, frequency: 'daily' });
    for (let n = 0; n < 2; n++) await call('profile', { name: 'Aluna Atualizada', school: 'Escola teste', grade: '2º ano', bio: 'Evento ' + n });
    assert.equal(database.prepare('SELECT COUNT(DISTINCT due) AS n FROM deliveries').get().n, 1, 'Resumo diário agrupa os eventos em um único horário');
    database.prepare('UPDATE deliveries SET due=?').run(Date.now() - 1);
    for (let i = 0; i < 36; i++) { if (!database.prepare('SELECT id FROM deliveries LIMIT 1').get()) break; await wait(500); }
    assert.equal(database.prepare('SELECT COUNT(*) AS n FROM deliveries').get().n, 0);
    assert.ok((await call('notices')).result.notices.some(x => x.message.includes('perfil')));
    assert.equal((await call('review', { stars: 6, comment: 'Inválida' })).status, 400);
    assert.equal((await call('review', { stars: 4, comment: 'Bom começo.' })).status, 200);
    assert.equal((await call('review', { stars: 5, comment: 'Atualizado.' })).status, 200);
    assert.equal((await call('review')).result.review.stars, 5);
    await call('review/delete', {}); assert.equal((await call('review')).result.review, null);
    assert.equal((await call('export')).result.user.email, account.email);
  });
  await t.test('Logout invalida sessão, login exige a segunda etapa e códigos expiram', async () => {
    const oldCookie = cookie; await call('logout', {});
    assert.equal((await call('me', undefined, { headers: { Cookie: oldCookie } })).status, 401);
    assert.equal((await call('login', { email: account.email, password: 'Errada!2026' })).status, 401);
    const login = await call('login', account); assert.equal(login.status, 200);
    assert.equal((await call('me')).status, 401);
    const goodCode = await code(account.email);
    database.prepare('UPDATE challenges SET expires=? WHERE id=?').run(Date.now() - 1, login.result.challenge);
    assert.equal((await call('verify', { challenge: login.result.challenge, purpose: 'login', code: goodCode })).status, 400);
    const resend = await call('resend', { challenge: login.result.challenge, purpose: 'login' });
    assert.equal(resend.status, 200);
    assert.equal((await call('verify', { challenge: resend.result.challenge, purpose: 'login', code: await code(account.email) })).status, 200);
  });
  await t.test('Troca segura revoga sessão antiga e exige código vinculado à conta', async () => {
    const oldCookie = cookie;
    assert.equal((await call('security/request', { purpose: 'password', password: 'errada' })).status, 401);
    const request = await call('security/request', { purpose: 'password', password: account.password }); passwordChallenge = request.result.challenge;
    const change = await call('security/password', { challenge: passwordChallenge, code: await code(account.email), password: 'NovaSenhaForte!2026' }); assert.equal(change.status, 200);
    assert.equal((await call('me', undefined, { headers: { Cookie: oldCookie } })).status, 401);
  });
  await t.test('Recuperação redefine senha e encerra sessões', async () => {
    const unknown = await call('recover', { email: 'naoexiste@example.com' }); assert.equal(unknown.status, 200);
    const request = await call('recover', { email: account.email }); resetChallenge = request.result.challenge;
    assert.equal((await call('reset', { challenge: resetChallenge, code: await code(account.email), password: 'TerceiraSenha!2026' })).status, 200);
    assert.equal((await call('me')).status, 401);
    assert.equal((await call('login', { email: account.email, password: 'NovaSenhaForte!2026' })).status, 401);
  });
  await t.test('OTP bloqueia após cinco erros; conta não confirmada pode solicitar outro com senha', async () => {
    const b = { ...account, email: 'outro@example.com' };
    const request = await call('register', b), correctCode = await code(b.email);
    const wrong = correctCode === '111111' ? '222222' : '111111';
    for (let i = 0; i < 5; i++) assert.equal((await call('verify', { purpose: 'verify', challenge: request.result.challenge, code: wrong })).status, 400);
    assert.equal((await call('verify', { purpose: 'verify', challenge: request.result.challenge, code: correctCode })).status, 400);
    const login = await call('login', b);
    assert.equal((await call('verify', { purpose: 'verify', challenge: login.result.challenge, code: await code(b.email) })).status, 200);
    // A different account cannot use a valid deletion code tied to the first user.
    const a = database.prepare('SELECT * FROM users WHERE email=?').get(account.email);
    const foreignId = 'foreign-test-challenge';
    database.prepare('INSERT INTO challenges (id,user_id,purpose,hash,expires) VALUES (?,?,?,?,?)').run(foreignId, a.id, 'delete', digest(foreignId + ':123456'), Date.now() + 60000);
    assert.equal((await call('security/delete', { challenge: foreignId, code: '123456', confirm: 'EXCLUIR' })).status, 400);
  });
  await t.test('Exclusão remove dados associados e revoga todos os acessos', async () => {
    const b = database.prepare('SELECT * FROM users WHERE email=?').get('outro@example.com');
    await call('review', { stars: 5, comment: 'Remover na exclusão' });
    const request = await call('security/request', { purpose: 'delete', password: account.password });
    const codeValue = await code('outro@example.com');
    assert.equal((await call('security/delete', { challenge: request.result.challenge, code: codeValue, confirm: 'cancelar' })).status, 400);
    assert.equal((await call('security/delete', { challenge: request.result.challenge, code: codeValue, confirm: 'EXCLUIR' })).status, 200);
    assert.equal((await call('me')).status, 401);
    assert.equal(database.prepare('SELECT * FROM users WHERE id=?').get(b.id), undefined);
    for (const table of ['reviews','sessions','challenges','notices','deliveries']) assert.equal(database.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id=?`).get(b.id).n, 0);
  });
  await t.test('Bloqueia CSRF, arquivos privados e Google sem credenciais; serve recursos estáticos', async () => {
    assert.equal((await call('login', account, { headers: { Origin: 'https://site-malicioso.example' } })).status, 403);
    assert.equal((await call('login', account, { headers: { 'X-Mentor-Request': '' } })).status, 403);
    assert.equal((await call('login', null)).status, 400);
    assert.equal((await call('login', [])).status, 400);
    assert.equal((await call('google/start')).status, 503);
    for (const path of ['/server/index.mjs','/package.json','/.env','/data/mentor.sqlite','/tests/integration.test.mjs']) assert.equal((await fetch(origin + path)).status, 404);
    for (const path of ['/', '/login/', '/login/app.js', '/login/app.css', '/login/fonts/inter-latin.woff2', '/login/fonts/poppins-semibold.woff2']) assert.equal((await fetch(origin + path)).status, 200);
    const html = await fetch(origin + '/login/'); assert.ok(html.headers.get('content-security-policy').includes("script-src 'self'"));
    for (let n = 0; n < 8; n++) assert.equal((await call('login', { email: 'bloqueio@example.com', password: 'Errada!2026' })).status, 401);
    assert.equal((await call('login', { email: 'bloqueio@example.com', password: 'Errada!2026' })).status, 429);
  });
});
