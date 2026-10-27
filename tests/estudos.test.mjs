import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:net';
import { lerZip, lerPdf } from './leitores.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const somar = (dia, n) => new Date(Date.parse(dia + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

test('Fase 3: cadastros, relacionamentos, consultas, painel e relatórios', { timeout: 90000 }, async t => {
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

  function cliente() {
    let cookie = '';
    async function call(route, data, opts = {}) {
      const headers = { ...(data === undefined ? {} : { Origin: origin, 'X-Mentor-Request': '1', 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}), ...opts.headers };
      const response = await fetch(origin + '/api/' + route, { method: data === undefined ? 'GET' : 'POST', headers, body: data === undefined ? undefined : JSON.stringify(data) });
      if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
      const json = (response.headers.get('content-type') || '').includes('application/json');
      return { status: response.status, result: json ? await response.json() : Buffer.from(await response.arrayBuffer()), response };
    }
    return { call };
  }
  async function conta(email) {
    const c = cliente(), password = 'SenhaForte!2026';
    const reg = await c.call('register', { name: 'Estudante Teste', email, password, accept: true });
    const m = (await c.call('dev/mail')).result.messages.find(x => x.to === email);
    assert.equal((await c.call('verify', { challenge: reg.result.challenge, purpose: 'verify', code: m.message.match(/é: (\d{6})/)[1] })).status, 200);
    return Object.assign(c, { email, password });
  }
  const a = await conta('fase3-a@example.com'), b = await conta('fase3-b@example.com');
  const dia = hoje();
  let mat, fis, sessao, duvida;

  await t.test('Disciplinas: CRUD com validação, nome único (sem acento/maiúscula) e busca', async () => {
    assert.equal((await a.call('estudos/disciplinas/salvar', { name: 'M', color: 1, weekly_goal: 120, description: '' })).status, 400);
    assert.equal((await a.call('estudos/disciplinas/salvar', { name: 'Matemática', color: 9, weekly_goal: 120, description: '' })).status, 400);
    assert.equal((await a.call('estudos/disciplinas/salvar', { name: 'Matemática', color: 1, weekly_goal: -5, description: '' })).status, 400);
    const criada = await a.call('estudos/disciplinas/salvar', { name: 'Matemática', color: 1, weekly_goal: 120, description: 'Funções' });
    assert.equal(criada.status, 200); mat = criada.result.item;
    assert.equal((await a.call('estudos/disciplinas/salvar', { name: '  MATEMATICA ', color: 2, weekly_goal: 60, description: '' })).status, 409);
    fis = (await a.call('estudos/disciplinas/salvar', { name: 'Física', color: 3, weekly_goal: 90, description: 'Cinemática' })).result.item;
    const editada = await a.call('estudos/disciplinas/salvar', { id: mat.id, name: 'Matemática', color: 1, weekly_goal: 150, description: 'Funções e geometria' });
    assert.equal(editada.result.item.weekly_goal, 150);
    const busca = await a.call('estudos/disciplinas?q=matematica');
    assert.equal(busca.result.total, 1); assert.equal(busca.result.items[0].name, 'Matemática');
    assert.equal((await a.call('estudos/disciplinas?ordem=meta&dir=asc')).result.items[0].name, 'Física');
    assert.equal((await a.call('estudos/disciplinas/999999')).status, 404);
  });

  await t.test('Sessões: regras de negócio, filtros, ordenação e paginação', async () => {
    const base = { subject_id: mat.id, day: dia, minutes: 60, topic: 'Função afim', status: 'concluida', performance: 4, notes: '' };
    assert.equal((await a.call('estudos/sessoes/salvar', { ...base, performance: '' })).status, 400, 'concluída exige desempenho');
    assert.equal((await a.call('estudos/sessoes/salvar', { ...base, day: somar(dia, 2) })).status, 400, 'concluída não pode ser futura');
    assert.equal((await a.call('estudos/sessoes/salvar', { ...base, minutes: 1000 })).status, 400);
    assert.equal((await a.call('estudos/sessoes/salvar', { ...base, day: '2026-02-30' })).status, 400);
    assert.equal((await a.call('estudos/sessoes/salvar', { ...base, subject_id: 999999 })).status, 400);
    sessao = (await a.call('estudos/sessoes/salvar', base)).result.item;
    assert.equal(sessao.subject, 'Matemática');
    const planejada = (await a.call('estudos/sessoes/salvar', { ...base, day: somar(dia, 3), status: 'planejada', performance: 5, topic: 'Geometria plana' })).result.item;
    assert.equal(planejada.performance, null, 'desempenho só vale para concluída');
    for (let i = 1; i <= 12; i++) await a.call('estudos/sessoes/salvar', { ...base, subject_id: fis.id, day: somar(dia, -i), minutes: 20 + i * 5, topic: `Cinemática ${i}`, performance: (i % 5) + 1 });
    const lista = await a.call('estudos/sessoes?disciplina=' + fis.id + '&por=5&pagina=2&ordem=duracao&dir=desc');
    assert.equal(lista.result.total, 12); assert.equal(lista.result.pages, 3); assert.equal(lista.result.items.length, 5);
    assert.equal(lista.result.items[0].minutes, 55, 'página 2 começa no 6º maior: 80, 75, 70, 65, 60 | 55');
    assert.equal((await a.call('estudos/sessoes?status=planejada')).result.total, 1);
    assert.equal((await a.call('estudos/sessoes?q=cinematica 1')).result.total, 4, 'busca ignora acento: 1, 10, 11, 12');
    assert.equal((await a.call(`estudos/sessoes?de=${somar(dia, -3)}&ate=${dia}&disciplina=${fis.id}`)).result.total, 3);
    assert.equal((await a.call('estudos/sessoes?dmin=70&dmax=80')).result.total, 3);
    assert.equal((await a.call('estudos/sessoes?nota=5')).result.total, 2);
    assert.equal((await a.call(`estudos/sessoes?de=${dia}&ate=${somar(dia, -1)}`)).status, 400);
    const resumo = (await a.call('estudos/sessoes?disciplina=' + mat.id)).result.summary;
    assert.equal(resumo.minutes, 60); assert.equal(resumo.planned, 1);
    assert.equal(typeof lista.result.ms, 'number');
  });

  await t.test('Dúvidas: vínculo só com sessão da mesma disciplina; resolução obrigatória', async () => {
    const base = { subject_id: mat.id, session_id: sessao.id, title: 'Como achar a raiz?', details: '', priority: 'alta', status: 'aberta', resolution: '' };
    const sessaoFisica = (await a.call('estudos/sessoes?disciplina=' + fis.id)).result.items[0];
    assert.equal((await a.call('estudos/duvidas/salvar', { ...base, session_id: sessaoFisica.id })).status, 400);
    assert.equal((await a.call('estudos/duvidas/salvar', { ...base, status: 'resolvida' })).status, 400);
    assert.equal((await a.call('estudos/duvidas/salvar', { ...base, priority: 'urgente' })).status, 400);
    duvida = (await a.call('estudos/duvidas/salvar', base)).result.item;
    assert.equal(duvida.session_topic, 'Função afim');
    const resolvida = (await a.call('estudos/duvidas/salvar', { ...base, id: duvida.id, status: 'resolvida', resolution: 'Refiz os exercícios.' })).result.item;
    assert.ok(resolvida.resolved > 0);
    await a.call('estudos/duvidas/salvar', { ...base, session_id: '', title: 'Dúvida sem sessão', priority: 'baixa' });
    assert.equal((await a.call('estudos/duvidas?vinculo=sem_sessao')).result.total, 1);
    assert.equal((await a.call('estudos/duvidas?status=pendentes')).result.total, 1);
    assert.equal((await a.call('estudos/duvidas?ordem=prioridade&dir=desc')).result.items[0].priority, 'alta');
    assert.equal((await a.call('estudos/disciplinas/' + mat.id)).result.subject.open_questions, 1);
  });

  await t.test('Relacionamentos: bloqueio, cascata, desvinculação e troca de disciplina', async () => {
    const bloqueio = await a.call('estudos/disciplinas/excluir', { id: mat.id });
    assert.equal(bloqueio.status, 409); assert.match(bloqueio.result.message, /sessões de estudo vinculadas/);
    assert.equal((await a.call('estudos/sessoes/salvar', { id: sessao.id, subject_id: fis.id, day: dia, minutes: 60, topic: 'Função afim', status: 'concluida', performance: 4, notes: '' })).status, 409);
    const excluida = await a.call('estudos/sessoes/excluir', { id: sessao.id });
    assert.equal(excluida.status, 200); assert.match(excluida.result.message, /desvinculada/);
    assert.equal(database.prepare('SELECT session_id FROM questions WHERE id=?').get(duvida.id).session_id, null);
    for (const s of (await a.call('estudos/sessoes?disciplina=' + mat.id)).result.items) await a.call('estudos/sessoes/excluir', { id: s.id });
    const cascata = await a.call('estudos/disciplinas/excluir', { id: mat.id });
    assert.equal(cascata.status, 200); assert.match(cascata.result.message, /2 dúvidas vinculadas também foram excluídas/);
    assert.equal(database.prepare('SELECT COUNT(*) AS n FROM questions WHERE subject_id=?').get(mat.id).n, 0);
    // A própria base recusa sessão apontando para disciplina de outro usuário (chave composta).
    const outro = database.prepare('SELECT id FROM users WHERE email=?').get(b.email).id;
    assert.throws(() => database.exec(`PRAGMA foreign_keys=ON; INSERT INTO study_sessions (user_id, subject_id, day, minutes, topic, status, created, updated) VALUES ('${outro}', ${fis.id}, '${dia}', 30, 'x', 'planejada', 0, 0)`), /FOREIGN KEY/);
  });

  await t.test('Isolamento entre usuários e proteção contra CSRF', async () => {
    assert.equal((await b.call('estudos/disciplinas')).result.total, 0);
    assert.equal((await b.call('estudos/disciplinas/' + fis.id)).status, 404);
    assert.equal((await b.call('estudos/disciplinas/salvar', { id: fis.id, name: 'Invasão', color: 1, weekly_goal: 0, description: '' })).status, 404);
    assert.equal((await b.call('estudos/disciplinas/excluir', { id: fis.id })).status, 404);
    assert.equal((await b.call('estudos/sessoes/salvar', { subject_id: fis.id, day: dia, minutes: 30, topic: 'Teste', status: 'planejada', notes: '' })).status, 400);
    assert.equal((await a.call('estudos/disciplinas/salvar', { name: 'Química', color: 4, weekly_goal: 60, description: '' }, { headers: { Origin: 'https://site-malicioso.example' } })).status, 403);
    assert.equal((await a.call('estudos/disciplinas/salvar', { name: 'Química', color: 4, weekly_goal: 60, description: '' }, { headers: { 'X-Mentor-Request': '' } })).status, 403);
    assert.equal((await fetch(origin + '/api/estudos/disciplinas')).status, 401);
    for (const path of ['/login/js/estudos.js', '/login/css/estudos.css', '/login/js/graficos.js']) assert.equal((await fetch(origin + path)).status, 200);
    assert.equal((await fetch(origin + '/login/css/estudos.css')).headers.get('content-type'), 'text/css; charset=utf-8');
    for (const path of ['/server/estudos.mjs', '/server/estudos-db.mjs', '/server/relatorios.mjs']) assert.equal((await fetch(origin + path)).status, 404);
  });

  await t.test('Painel: indicadores conferidos com os dados cadastrados', async () => {
    const c = (await b.call('estudos/disciplinas/salvar', { name: 'Química', color: 4, weekly_goal: 120, description: '' })).result.item;
    const s = { subject_id: c.id, minutes: 60, topic: 'Soluções', notes: '' };
    await b.call('estudos/sessoes/salvar', { ...s, day: dia, status: 'concluida', performance: 4 });
    await b.call('estudos/sessoes/salvar', { ...s, day: somar(dia, -1), minutes: 30, status: 'concluida', performance: 2 });
    await b.call('estudos/sessoes/salvar', { ...s, day: dia, status: 'planejada' });
    await b.call('estudos/sessoes/salvar', { ...s, day: somar(dia, -2), status: 'cancelada' });
    await b.call('estudos/sessoes/salvar', { ...s, day: somar(dia, -20), status: 'concluida', performance: 5 });
    await b.call('estudos/duvidas/salvar', { subject_id: c.id, title: 'Molaridade', details: '', priority: 'media', status: 'aberta', resolution: '' });
    const p = (await b.call('estudos/painel?periodo=7')).result;
    assert.deepEqual({ ...p.kpis }, { minutes: 90, done: 2, planned: 1, canceled: 1, performance: 3, goalMinutes: 120, goalPercent: 75, pendingQuestions: 1, resolvedQuestions: 0 });
    assert.equal(p.series.length, 7); assert.equal(p.series.at(-1).minutes, 60);
    assert.equal(p.subjects[0].goal, 120);
    assert.deepEqual(p.questionsByStatus.map(x => x.total), [1, 0, 0]);
    const ano = (await b.call('estudos/painel?periodo=365')).result;
    assert.equal(ano.period.granularity, 'semana'); assert.equal(ano.kpis.minutes, 150);
    assert.equal((await b.call(`estudos/painel?periodo=personalizado&de=${somar(dia, -1)}&ate=${somar(dia, -1)}`)).result.kpis.minutes, 30);
    assert.equal((await b.call('estudos/painel?periodo=personalizado&de=2026-10-10&ate=2026-10-01')).status, 400);
    assert.equal((await b.call('estudos/painel?periodo=12')).status, 400);
  });

  await t.test('Relatórios PDF e XLSX trazem título, data, filtros, dados e consolidado', async () => {
    const pdf = await b.call('estudos/relatorio?formato=pdf&tipo=sessoes&status=concluida&ordem=data&dir=desc');
    assert.equal(pdf.status, 200); assert.equal(pdf.response.headers.get('content-type'), 'application/pdf');
    assert.match(pdf.response.headers.get('content-disposition'), /mentor-ia-sessoes-\d{4}-\d{2}-\d{2}\.pdf/);
    const texto = lerPdf(pdf.result);
    for (const trecho of ['Relatório de sessões de estudo', 'Gerado em', 'Filtros aplicados', 'Situação: Concluída', 'Dados consolidados', 'Química', 'Soluções', 'Consolidado por conteúdo', 'Página 1 de 1']) assert.ok(texto.includes(trecho), 'PDF contém: ' + trecho);
    const planilha = await b.call('estudos/relatorio?formato=xlsx&tipo=painel&periodo=30');
    assert.equal(planilha.status, 200);
    const arquivos = lerZip(planilha.result);
    for (const parte of ['[Content_Types].xml', 'xl/workbook.xml', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']) assert.ok(arquivos[parte], 'XLSX contém ' + parte);
    assert.match(arquivos['xl/workbook.xml'], /name="Relatório"/);
    assert.match(arquivos['xl/worksheets/sheet1.xml'], /Resumo do painel de estudos/);
    assert.match(arquivos['xl/worksheets/sheet1.xml'], /Filtros aplicados/);
    for (const tipo of ['duvidas', 'disciplinas']) for (const formato of ['pdf', 'xlsx']) assert.equal((await b.call(`estudos/relatorio?formato=${formato}&tipo=${tipo}`)).status, 200);
    assert.equal((await b.call('estudos/relatorio?formato=doc&tipo=sessoes')).status, 400);
    assert.equal((await fetch(origin + '/api/estudos/relatorio?formato=pdf&tipo=sessoes')).status, 401);
  });

  await t.test('Dados de exemplo, limpeza e exclusão da conta removem os dados de estudo', async () => {
    const c = await conta('fase3-c@example.com');
    const exemplo = await c.call('estudos/exemplo', {});
    assert.equal(exemplo.status, 200);
    assert.equal((await c.call('estudos/exemplo', {})).status, 409);
    assert.ok((await c.call('estudos/painel?periodo=30')).result.kpis.minutes > 0);
    assert.equal((await c.call('estudos/limpar', { confirm: 'sim' })).status, 400);
    assert.equal((await c.call('estudos/limpar', { confirm: 'LIMPAR' })).status, 200);
    assert.equal((await c.call('estudos/disciplinas')).result.total, 0);
    const id = database.prepare('SELECT id FROM users WHERE email=?').get(b.email).id;
    const pedido = await b.call('security/request', { purpose: 'delete', password: b.password });
    const m = (await b.call('dev/mail')).result.messages.find(x => x.to === b.email && x.subject.includes('Excluir'));
    assert.equal((await b.call('security/delete', { challenge: pedido.result.challenge, code: m.message.match(/é: (\d{6})/)[1], confirm: 'EXCLUIR' })).status, 200);
    for (const tabela of ['subjects', 'study_sessions', 'questions']) assert.equal(database.prepare(`SELECT COUNT(*) AS n FROM ${tabela} WHERE user_id=?`).get(id).n, 0);
  });

  await t.test('Desempenho: consultas e relatórios com 3.000 sessões', async () => {
    const id = database.prepare('SELECT id FROM users WHERE email=?').get(a.email).id;
    const inserir = database.prepare("INSERT INTO study_sessions (user_id, subject_id, day, minutes, topic, status, performance, notes, created, updated) VALUES (?,?,?,?,?,'concluida',?,'',0,0)");
    database.exec('BEGIN');
    for (let i = 0; i < 3000; i++) inserir.run(id, fis.id, somar(dia, -(i % 700)), 30 + (i % 60), 'Tema ' + i, 1 + (i % 5));
    database.exec('COMMIT');
    const medir = async rota => { const inicio = performance.now(); const r = await a.call(rota); assert.equal(r.status, 200); return Math.round(performance.now() - inicio); };
    const tempos = {
      lista: await medir('estudos/sessoes?q=tema 29&ordem=duracao&dir=desc&por=50'),
      painel: await medir('estudos/painel?periodo=365'),
      pdf: await medir('estudos/relatorio?formato=pdf&tipo=sessoes'),
      xlsx: await medir('estudos/relatorio?formato=xlsx&tipo=sessoes')
    };
    t.diagnostic('Tempos (ms): ' + JSON.stringify(tempos));
    assert.ok(tempos.lista < 1000 && tempos.painel < 1000, 'consultas abaixo de 1 s');
    assert.ok(tempos.pdf < 5000 && tempos.xlsx < 5000, 'relatórios abaixo de 5 s');
  });
});
