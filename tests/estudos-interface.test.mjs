import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const fonte = arquivo => readFileSync(new URL('../login/' + arquivo, import.meta.url), 'utf8');
const app = fonte('app.js');
const XSS = '<img src=x onerror=alert(1)>';

function contexto() {
  const ouvintes = {}, criados = [];
  const elemento = () => ({ setAttribute() {}, append() {}, addEventListener() {}, showModal() { this.open = true; }, close() { this.open = false; }, querySelector: () => null, open: false, dataset: {}, style: {} });
  const document = {
    querySelector: () => ({}), querySelectorAll: () => [], body: { append() {} },
    addEventListener: (tipo, fn) => { (ouvintes[tipo] ||= []).push(fn); },
    createElement: () => { const e = elemento(); criados.push(e); return e; }
  };
  const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const c = vm.createContext({ document, window: { addEventListener() {} }, sessionStorage: storage, localStorage: storage, URLSearchParams, console, Intl, Date, Promise, Math, Number, String, Object, Array, Set, Map,
    MutationObserver: class { observe() {} }, ResizeObserver: class { observe() {} } });
  vm.runInContext(app.slice(0, app.lastIndexOf('(async () => {')), c);
  vm.runInContext(fonte('js/graficos.js'), c);
  vm.runInContext(fonte('js/estudos.js'), c);
  const lista = items => ({ items, total: items.length, page: 1, pages: 1, perPage: 10, ms: 1.5 });
  const subject = { id: 1, name: XSS, color: 1, weekly_goal: 120, description: XSS, sessions: 2, minutes: 90, week_minutes: 60, performance: 3.5, questions: 1, open_questions: 1, last_day: '2026-10-20', created: 0, updated: 0 };
  const sessao = { id: 5, subject_id: 1, subject: XSS, color: 1, day: '2026-10-20', minutes: 60, topic: XSS, status: 'concluida', performance: 4, notes: XSS, questions: 1, created: 0, updated: 0 };
  const duvida = { id: 9, subject_id: 1, subject: XSS, color: 1, session_id: 5, session_day: '2026-10-20', session_topic: XSS, title: XSS, details: XSS, priority: 'alta', status: 'aberta', resolution: '', created: 0, updated: 0, resolved: null };
  c.fixtures = {
    'estudos/opcoes': { subjects: [{ id: 1, name: XSS, color: 1 }], sessions: [{ id: 5, subject_id: 1, day: '2026-10-20', topic: XSS, status: 'concluida' }] },
    'estudos/disciplinas': { ...lista([subject]), summary: { subjects: 1, sessions: 2, minutes: 90, open_questions: 1, weekly_goal: 120, week_minutes: 60 } },
    'estudos/disciplinas/1': { subject, sessions: [sessao], questions: [duvida] },
    'estudos/sessoes': { ...lista([sessao]), summary: { sessions: 1, minutes: 60, performance: 4, done: 1, planned: 0, canceled: 0 } },
    'estudos/duvidas': { ...lista([duvida]), summary: { questions: 1, open: 1, studying: 0, resolved: 0, urgent: 1, linked: 1 } },
    'estudos/painel': { period: { from: '2026-09-28', to: '2026-10-27', days: 30, granularity: 'dia' }, ms: 2, kpis: { minutes: 90, done: 2, planned: 1, canceled: 0, performance: 3.5, goalMinutes: 514, goalPercent: 18, pendingQuestions: 1, resolvedQuestions: 0 },
      series: [{ start: '2026-10-26', end: '2026-10-26', minutes: 30 }, { start: '2026-10-27', end: '2026-10-27', minutes: 60 }], subjects: [{ ...subject, goal: 514, done: 2 }],
      sessionsByStatus: [{ status: 'planejada', total: 1 }, { status: 'concluida', total: 2 }, { status: 'cancelada', total: 0 }], questionsByStatus: [{ status: 'aberta', total: 1 }, { status: 'estudando', total: 0 }, { status: 'resolvida', total: 0 }] }
  };
  vm.runInContext(`api = async path => { const chave = path.split('?')[0]; if (!(chave in fixtures)) throw new Error('rota sem dado: ' + path); return fixtures[chave]; };
    render = async () => {}; toast = () => {};
    config={localMailbox:true,google:false,development:true};available=true;user={name:'Aluna',email:'a@example.com',avatar:'',hasPassword:true,prefs:{theme:'light',font:100}};`, c);
  return { c, ouvintes, criados };
}
function estrutura(html, rotulo) {
  const ids = [...html.matchAll(/(?<![\w-])id="([^"]+)"/g)].map(x => x[1]); // ignora data-id
  assert.equal(ids.length, new Set(ids).size, `IDs únicos: ${rotulo} ${ids.filter((x, i) => ids.indexOf(x) !== i)}`);
  for (const x of html.matchAll(/\bfor="([^"]+)"/g)) assert.ok(ids.includes(x[1]), `Rótulo associado: ${rotulo} ${x[1]}`);
  for (const x of html.matchAll(/aria-describedby="([^"]+)"/g)) assert.ok(ids.includes(x[1]), `Descrição associada: ${rotulo} ${x[1]}`);
  assert.ok(!html.includes(XSS), `Dados escapados: ${rotulo}`);
}

test('Fase 3: rotas registradas no menu existente sem substituir as anteriores', () => {
  const { c } = contexto();
  const rotas = vm.runInContext('navigation.map(x => x[0])', c);
  assert.deepEqual([...rotas], ['home', 'painel', 'disciplinas', 'sessoes', 'duvidas', 'profile', 'notifications', 'security', 'accessibility', 'support', 'review', 'legal']);
  assert.equal(vm.runInContext('titles.painel', c), 'Painel de estudos');
});

test('Fase 3: telas e diálogos têm rótulos, IDs únicos e escapam dados do usuário', async () => {
  const { c, ouvintes, criados } = contexto();
  const dialogo = criados.find(e => e.className === 'e-dialogo'), clique = ouvintes.click.at(-1);
  const acionar = dataset => clique({ target: { closest: () => ({ dataset, disabled: false }) } });
  for (const rota of ['painel', 'disciplinas', 'sessoes', 'duvidas']) {
    const pagina = await vm.runInContext(`window.MentorEstudos.view('${rota}', new URLSearchParams('q=teste&disciplina=1'))`, c);
    estrutura(pagina, rota);
    for (const [acao, tipo, id] of [['novo', 'disciplina'], ['novo', 'sessao'], ['novo', 'duvida'], ['ver', 'disciplina', '1'], ['excluir', 'disciplina', '1'], ['limpar']]) {
      await acionar({ estudosAcao: acao, tipo, id });
      estrutura(pagina + dialogo.innerHTML, `${rota} + ${acao} ${tipo || ''}`);
    }
  }
  // Após listar, os itens ficam disponíveis para detalhe, edição e exclusão.
  for (const [rota, tipo, id] of [['sessoes', 'sessao', '5'], ['duvidas', 'duvida', '9']]) {
    await vm.runInContext(`window.MentorEstudos.view('${rota}', new URLSearchParams())`, c);
    for (const acao of ['ver', 'editar', 'excluir']) { await acionar({ estudosAcao: acao, tipo, id }); estrutura(dialogo.innerHTML, `${acao} ${tipo}`); assert.ok(dialogo.innerHTML.length > 100); }
  }
  await acionar({ estudosAcao: 'excluir', tipo: 'disciplina', id: '1' });
  assert.match(dialogo.innerHTML, /Exclusão bloqueada/, 'disciplina com sessões mostra o bloqueio');
});
