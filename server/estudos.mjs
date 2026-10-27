// Fase 3 — rotas /api/estudos/*: cadastros, consultas, painel e relatórios.
// Validação e regras de negócio ficam aqui; SQL em estudos-db.mjs; arquivos em relatorios.mjs.
import { fail } from './security.mjs';
import * as dados from './estudos-db.mjs';
import { pdf, xlsx, dataBR, duracao, momentoBR } from './relatorios.mjs';

const STATUS_SESSAO = { planejada: 'Planejada', concluida: 'Concluída', cancelada: 'Cancelada' };
const STATUS_DUVIDA = { aberta: 'Aberta', estudando: 'Em estudo', resolvida: 'Resolvida' };
const PRIORIDADES = { baixa: 'Baixa', media: 'Média', alta: 'Alta' };
const SITUACOES = { com_duvidas: 'Com dúvidas pendentes', sem_sessoes: 'Sem sessões', abaixo_meta: 'Abaixo da meta nos últimos 7 dias', meta_cumprida: 'Meta cumprida nos últimos 7 dias' };
const ORDENS = {
  disciplinas: { nome: 'nome', meta: 'meta semanal', sessoes: 'sessões', minutos: 'tempo total', semana: 'últimos 7 dias', duvidas: 'dúvidas pendentes', desempenho: 'desempenho', criada: 'cadastro' },
  sessoes: { data: 'data', duracao: 'duração', disciplina: 'conteúdo', tema: 'tema', status: 'situação', desempenho: 'desempenho' },
  duvidas: { criada: 'registro', atualizada: 'atualização', titulo: 'título', prioridade: 'prioridade', situacao: 'situação', disciplina: 'conteúdo' }
};
const LIMITE_RELATORIO = 5000;
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const diaDe = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));

// ---------- Validação ----------
function campo(valor, rotulo, min, max) {
  if (valor === undefined || valor === null) valor = '';
  if (typeof valor !== 'string') fail(`${rotulo}: texto inválido.`);
  const t = valor.replace(/\r\n?/g, '\n').trim();
  if (/[\x00-\x08\x0b-\x1f]/.test(t)) fail(`${rotulo}: texto inválido.`);
  if (t.length < min) fail(min === 1 ? `${rotulo}: campo obrigatório.` : `${rotulo}: informe pelo menos ${min} caracteres.`);
  if (t.length > max) fail(`${rotulo}: use no máximo ${max} caracteres.`);
  return t;
}
function inteiro(valor, rotulo, min, max) {
  const n = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
  if (!Number.isInteger(n) || n < min || n > max) fail(`${rotulo}: informe um número inteiro entre ${min} e ${max}.`);
  return n;
}
function identificador(valor, rotulo) {
  const n = Number(valor);
  if (valor === '' || valor === null || !Number.isSafeInteger(n) || n < 1) fail(`${rotulo}: seleção inválida.`);
  return n;
}
function opcao(valor, opcoes, rotulo) {
  if (typeof valor !== 'string' || !Object.hasOwn(opcoes, valor)) fail(`${rotulo}: selecione uma opção válida.`);
  return valor;
}
function dia(valor, rotulo) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) fail(`${rotulo}: data inválida.`);
  const d = new Date(valor + 'T00:00:00Z');
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== valor) fail(`${rotulo}: data inválida.`);
  if (valor < '2000-01-01' || valor > dados.somarDias(dados.hoje(), 366)) fail(`${rotulo}: use uma data entre 2000 e o próximo ano.`);
  return valor;
}
const vazio = v => v === undefined || v === null || v === '';

function validarDisciplina(userId, b, id) {
  const d = {
    name: campo(b.name, 'Nome', 2, 60),
    color: inteiro(b.color, 'Cor', 1, 8),
    weekly_goal: inteiro(b.weekly_goal, 'Meta semanal (minutos)', 0, 3000),
    description: campo(b.description, 'Descrição', 0, 300)
  };
  if (dados.nomeEmUso(userId, d.name, id)) fail('Já existe um conteúdo com esse nome.', 409);
  return d;
}
function validarSessao(userId, b, atual) {
  const s = {
    subject_id: identificador(b.subject_id, 'Conteúdo'),
    day: dia(b.day, 'Data'),
    minutes: inteiro(b.minutes, 'Duração (minutos)', 5, 720),
    topic: campo(b.topic, 'Tema estudado', 2, 120),
    status: opcao(b.status, STATUS_SESSAO, 'Situação'),
    notes: campo(b.notes, 'Anotações', 0, 1000),
    performance: null
  };
  if (!dados.obterDisciplina(userId, s.subject_id)) fail('Conteúdo: selecione um conteúdo cadastrado.');
  if (s.status === 'concluida') {
    if (vazio(b.performance)) fail('Avalie seu desempenho de 1 a 5 para registrar a sessão como concluída.');
    s.performance = inteiro(b.performance, 'Desempenho', 1, 5);
    if (s.day > dados.hoje()) fail('Uma sessão concluída não pode ter data futura. Use a situação "Planejada".');
  }
  if (atual && atual.subject_id !== s.subject_id && atual.questions) fail(`Esta sessão tem ${plural(atual.questions, 'dúvida vinculada', 'dúvidas vinculadas')} ao conteúdo atual. Desvincule-as antes de trocar o conteúdo.`, 409);
  return s;
}
function validarDuvida(userId, b, atual) {
  const q = {
    subject_id: identificador(b.subject_id, 'Conteúdo'),
    session_id: vazio(b.session_id) ? null : identificador(b.session_id, 'Sessão vinculada'),
    title: campo(b.title, 'Título', 3, 120),
    details: campo(b.details, 'Detalhes', 0, 1000),
    priority: opcao(b.priority, PRIORIDADES, 'Prioridade'),
    status: opcao(b.status, STATUS_DUVIDA, 'Situação'),
    resolution: campo(b.resolution, 'Como foi resolvida', 0, 1000)
  };
  if (!dados.obterDisciplina(userId, q.subject_id)) fail('Conteúdo: selecione um conteúdo cadastrado.');
  if (q.session_id) {
    const s = dados.obterSessao(userId, q.session_id);
    if (!s) fail('Sessão vinculada: selecione uma sessão cadastrada.');
    if (s.subject_id !== q.subject_id) fail('A sessão escolhida pertence a outro conteúdo.');
  }
  if (q.status === 'resolvida' && q.resolution.length < 3) fail('Descreva como a dúvida foi resolvida (mínimo de 3 caracteres).');
  q.resolved = q.status === 'resolvida' ? (atual?.status === 'resolvida' ? atual.resolved : Date.now()) : null;
  return q;
}

// ---------- Filtros de consulta ----------
function filtros(q, tipo) {
  const f = { pagina: 1, por: 10, dir: q.get('dir') === 'asc' ? 'asc' : 'desc' };
  const por = Number(q.get('por')), pagina = Number(q.get('pagina'));
  if ([5, 10, 25, 50].includes(por)) f.por = por;
  if (Number.isSafeInteger(pagina) && pagina > 0) f.pagina = pagina;
  if (q.get('ordem') && Object.hasOwn(ORDENS[tipo], q.get('ordem'))) f.ordem = q.get('ordem');
  if (q.get('q')) f.q = campo(q.get('q'), 'Busca', 1, 80);
  if (q.get('disciplina')) f.disciplina = identificador(q.get('disciplina'), 'Conteúdo');
  if (q.get('de')) f.de = dia(q.get('de'), 'Data inicial');
  if (q.get('ate')) f.ate = dia(q.get('ate'), 'Data final');
  if (f.de && f.ate && f.de > f.ate) fail('A data inicial deve ser anterior ou igual à data final.');
  if (tipo === 'disciplinas' && q.get('situacao')) f.situacao = opcao(q.get('situacao'), SITUACOES, 'Situação');
  if (tipo === 'sessoes') {
    if (q.get('status')) f.status = opcao(q.get('status'), STATUS_SESSAO, 'Situação');
    if (q.get('dmin')) f.dmin = inteiro(q.get('dmin'), 'Duração mínima', 5, 720);
    if (q.get('dmax')) f.dmax = inteiro(q.get('dmax'), 'Duração máxima', 5, 720);
    if (f.dmin && f.dmax && f.dmin > f.dmax) fail('A duração mínima deve ser menor ou igual à máxima.');
    if (q.get('nota')) f.nota = inteiro(q.get('nota'), 'Desempenho mínimo', 1, 5);
  }
  if (tipo === 'duvidas') {
    if (q.get('status')) f.status = opcao(q.get('status'), { ...STATUS_DUVIDA, pendentes: 'Pendentes' }, 'Situação');
    if (q.get('prioridade')) f.prioridade = opcao(q.get('prioridade'), PRIORIDADES, 'Prioridade');
    if (q.get('vinculo')) f.vinculo = opcao(q.get('vinculo'), { com_sessao: 1, sem_sessao: 1 }, 'Vínculo');
    if (q.get('sessao')) f.sessao = identificador(q.get('sessao'), 'Sessão');
  }
  return f;
}
function filtrosPainel(q) {
  const hoje = dados.hoje(), periodo = q.get('periodo') || '30';
  let de, ate;
  if (periodo === 'personalizado') {
    de = dia(q.get('de'), 'Data inicial'); ate = dia(q.get('ate'), 'Data final');
    if (de > ate) fail('A data inicial deve ser anterior ou igual à data final.');
    if (dados.diasEntre(de, ate) > 731) fail('Escolha um período de até dois anos.');
  } else {
    const dias = opcao(periodo, { 7: 1, 30: 1, 90: 1, 365: 1 }, 'Período');
    ate = hoje; de = dados.somarDias(hoje, -(Number(dias) - 1));
  }
  return { de, ate, disciplina: q.get('disciplina') ? identificador(q.get('disciplina'), 'Conteúdo') : null };
}
function medir(fn) {
  const inicio = performance.now(), r = fn();
  r.ms = Math.round((performance.now() - inicio) * 10) / 10;
  return r;
}

// ---------- Rotas ----------
export async function estudos(req, res, url, { auth, json, readBody, rate, origin }) {
  const rota = url.pathname.slice('/api/estudos/'.length), q = url.searchParams;
  if (req.method === 'GET') {
    const u = auth(req);
    if (rota === 'opcoes') return json(res, dados.opcoes(u.id));
    if (rota === 'disciplinas') return json(res, medir(() => dados.listarDisciplinas(u.id, filtros(q, 'disciplinas'))));
    if (rota === 'sessoes') return json(res, medir(() => dados.listarSessoes(u.id, filtros(q, 'sessoes'))));
    if (rota === 'duvidas') return json(res, medir(() => dados.listarDuvidas(u.id, filtros(q, 'duvidas'))));
    if (rota === 'painel') return json(res, medir(() => dados.painel(u.id, filtrosPainel(q))));
    if (rota === 'relatorio') return relatorio(res, u, q);
    const detalhe = /^disciplinas\/(\d{1,15})$/.exec(rota);
    if (detalhe) {
      const r = dados.detalheDisciplina(u.id, Number(detalhe[1]));
      if (!r) fail('Conteúdo não encontrado.', 404);
      return json(res, r);
    }
    fail('Página não encontrada.', 404);
  }
  if (req.method !== 'POST') fail('Página não encontrada.', 404);
  // Mesma proteção contra CSRF das demais rotas de alteração.
  if (req.headers.origin !== origin || req.headers['x-mentor-request'] !== '1' || !req.headers['content-type']?.startsWith('application/json')) fail('Solicitação não autorizada.', 403);
  rate(`estudos:${req.socket.remoteAddress}`, 600);
  const b = await readBody(req), u = auth(req);
  const idDe = () => vazio(b.id) ? 0 : identificador(b.id, 'Registro');

  if (rota === 'disciplinas/salvar') {
    const id = idDe();
    if (id && !dados.obterDisciplina(u.id, id)) fail('Conteúdo não encontrado.', 404);
    const item = dados.salvarDisciplina(u.id, validarDisciplina(u.id, b, id), id);
    return json(res, { item, message: id ? 'Conteúdo atualizado.' : 'Conteúdo cadastrado.' });
  }
  if (rota === 'disciplinas/excluir') {
    const atual = dados.obterDisciplina(u.id, identificador(b.id, 'Conteúdo'));
    if (!atual) fail('Conteúdo não encontrado.', 404);
    // Regra de integridade: sessões são o histórico de estudo e bloqueiam a exclusão.
    if (atual.sessions) fail(`Não é possível excluir "${atual.name}": há ${plural(atual.sessions, 'sessão de estudo vinculada', 'sessões de estudo vinculadas')}. Exclua ou mova essas sessões para outro conteúdo antes.`, 409);
    dados.excluirDisciplina(u.id, atual.id);
    return json(res, { message: 'Conteúdo excluído.' + (atual.questions ? ` ${plural(atual.questions, 'dúvida vinculada também foi excluída', 'dúvidas vinculadas também foram excluídas')}.` : '') });
  }
  if (rota === 'sessoes/salvar') {
    const id = idDe(), atual = id ? dados.obterSessao(u.id, id) : null;
    if (id && !atual) fail('Sessão não encontrada.', 404);
    const item = dados.salvarSessao(u.id, validarSessao(u.id, b, atual), id);
    return json(res, { item, message: id ? 'Sessão atualizada.' : 'Sessão registrada.' });
  }
  if (rota === 'sessoes/excluir') {
    const atual = dados.obterSessao(u.id, identificador(b.id, 'Sessão'));
    if (!atual) fail('Sessão não encontrada.', 404);
    dados.excluirSessao(u.id, atual.id);
    return json(res, { message: 'Sessão excluída.' + (atual.questions ? ` ${plural(atual.questions, 'dúvida foi desvinculada e continua cadastrada', 'dúvidas foram desvinculadas e continuam cadastradas')}.` : '') });
  }
  if (rota === 'duvidas/salvar') {
    const id = idDe(), atual = id ? dados.obterDuvida(u.id, id) : null;
    if (id && !atual) fail('Dúvida não encontrada.', 404);
    const item = dados.salvarDuvida(u.id, validarDuvida(u.id, b, atual), id);
    return json(res, { item, message: id ? 'Dúvida atualizada.' : 'Dúvida registrada.' });
  }
  if (rota === 'duvidas/excluir') {
    const atual = dados.obterDuvida(u.id, identificador(b.id, 'Dúvida'));
    if (!atual) fail('Dúvida não encontrada.', 404);
    dados.excluirDuvida(u.id, atual.id);
    return json(res, { message: 'Dúvida excluída.' });
  }
  if (rota === 'exemplo') {
    if (dados.totalDisciplinas(u.id)) fail('Os dados de exemplo só podem ser carregados enquanto você não tiver conteúdos cadastrados.', 409);
    const r = dados.criarExemplo(u.id);
    return json(res, { message: `Dados de exemplo carregados: ${r.subjects} conteúdos de Matemática, ${r.sessions} sessões e ${r.questions} dúvidas fictícias.` });
  }
  if (rota === 'limpar') {
    if (b.confirm !== 'LIMPAR') fail('Digite LIMPAR para confirmar.');
    const r = dados.limparEstudos(u.id);
    return json(res, { message: `Dados de estudo removidos: ${plural(r.subjects, 'conteúdo', 'conteúdos')}, ${plural(r.sessions, 'sessão', 'sessões')} e ${plural(r.questions, 'dúvida', 'dúvidas')}.` });
  }
  fail('Página não encontrada.', 404);
}

// ---------- Relatórios (PDF e XLSX a partir das mesmas consultas) ----------
function descrever(u, f, tipo, extras) {
  const lista = [['Período', f.de || f.ate ? `${f.de ? dataBR(f.de) : 'início'} a ${f.ate ? dataBR(f.ate) : 'hoje'}` : 'todo o histórico']];
  if (f.disciplina) lista.push(['Conteúdo', dados.obterDisciplina(u.id, f.disciplina)?.name || 'não encontrada']);
  lista.push(...extras.filter(([, v]) => v));
  if (f.q) lista.push(['Busca', `"${f.q}"`]);
  lista.push(['Ordenação', f.ordem ? `${ORDENS[tipo][f.ordem]} (${f.dir === 'asc' ? 'crescente' : 'decrescente'})` : 'padrão']);
  return lista;
}
function aviso(total) { return total > LIMITE_RELATORIO ? `Relatório limitado aos primeiros ${LIMITE_RELATORIO.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')} registros. Refine os filtros para ver os demais.` : ''; }
const media = v => v === null || v === undefined ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' / 5';

function relatorioSessoes(u, q) {
  const f = { ...filtros(q, 'sessoes'), pagina: 1, por: LIMITE_RELATORIO }, r = dados.listarSessoes(u.id, f), s = r.summary;
  return {
    titulo: 'Relatório de sessões de estudo', aviso: aviso(r.total),
    filtros: descrever(u, f, 'sessoes', [['Situação', STATUS_SESSAO[f.status]], ['Duração', f.dmin || f.dmax ? `${f.dmin || 5} a ${f.dmax || 720} min` : ''], ['Desempenho mínimo', f.nota ? `${f.nota} / 5` : '']]),
    resumo: [['Sessões encontradas', s.sessions.toLocaleString('pt-BR')], ['Tempo estudado (concluídas)', duracao(s.minutes)], ['Desempenho médio', media(s.performance)], ['Concluídas · planejadas · canceladas', `${s.done} · ${s.planned} · ${s.canceled}`]],
    tabelas: [
      { titulo: 'Sessões', colunas: [{ titulo: 'Data', largura: 9, tipo: 'data' }, { titulo: 'Conteúdo', largura: 16 }, { titulo: 'Tema', largura: 24 }, { titulo: 'Situação', largura: 10 }, { titulo: 'Duração', largura: 8, tipo: 'duracao' }, { titulo: 'Desempenho', largura: 9, tipo: 'numero' }, { titulo: 'Dúvidas', largura: 7, tipo: 'numero' }, { titulo: 'Anotações', largura: 24 }],
        linhas: r.items.map(x => [x.day, x.subject, x.topic, STATUS_SESSAO[x.status], x.minutes, x.performance, x.questions, x.notes]) },
      { titulo: 'Consolidado por conteúdo', planilha: 'Por conteúdo', colunas: [{ titulo: 'Conteúdo', largura: 30 }, { titulo: 'Sessões', largura: 12, tipo: 'numero' }, { titulo: 'Concluídas', largura: 12, tipo: 'numero' }, { titulo: 'Tempo estudado', largura: 14, tipo: 'duracao' }, { titulo: 'Desempenho médio', largura: 14, tipo: 'decimal' }],
        linhas: dados.sessoesPorDisciplina(u.id, f).map(x => [x.subject, x.sessions, x.done, x.minutes, x.performance]) }
    ]
  };
}
function relatorioDuvidas(u, q) {
  const f = { ...filtros(q, 'duvidas'), pagina: 1, por: LIMITE_RELATORIO }, r = dados.listarDuvidas(u.id, f), s = r.summary;
  return {
    titulo: 'Relatório de dúvidas', aviso: aviso(r.total),
    filtros: descrever(u, f, 'duvidas', [['Situação', f.status === 'pendentes' ? 'Pendentes (abertas e em estudo)' : STATUS_DUVIDA[f.status]], ['Prioridade', PRIORIDADES[f.prioridade]], ['Vínculo', { com_sessao: 'Com sessão vinculada', sem_sessao: 'Sem sessão vinculada' }[f.vinculo]], ['Sessão', f.sessao ? `nº ${f.sessao}` : '']]),
    resumo: [['Dúvidas encontradas', String(s.questions)], ['Abertas · em estudo', `${s.open} · ${s.studying}`], ['Resolvidas', String(s.resolved)], ['Pendentes de alta prioridade', String(s.urgent)]],
    tabelas: [
      { titulo: 'Dúvidas', colunas: [{ titulo: 'Registro', largura: 9, tipo: 'data' }, { titulo: 'Conteúdo', largura: 15 }, { titulo: 'Título', largura: 26 }, { titulo: 'Prioridade', largura: 9 }, { titulo: 'Situação', largura: 9 }, { titulo: 'Sessão vinculada', largura: 18 }, { titulo: 'Resolvida em', largura: 9, tipo: 'data' }, { titulo: 'Como foi resolvida', largura: 20 }],
        linhas: r.items.map(x => [diaDe(x.created), x.subject, x.title, PRIORIDADES[x.priority], STATUS_DUVIDA[x.status], x.session_id ? `${dataBR(x.session_day)} · ${x.session_topic}` : '', x.resolved ? diaDe(x.resolved) : '', x.resolution]) },
      { titulo: 'Consolidado por conteúdo', planilha: 'Por conteúdo', colunas: [{ titulo: 'Conteúdo', largura: 30 }, { titulo: 'Total', largura: 10, tipo: 'numero' }, { titulo: 'Abertas', largura: 10, tipo: 'numero' }, { titulo: 'Em estudo', largura: 10, tipo: 'numero' }, { titulo: 'Resolvidas', largura: 10, tipo: 'numero' }],
        linhas: dados.duvidasPorDisciplina(u.id, f).map(x => [x.subject, x.questions, x.open, x.studying, x.resolved]) }
    ]
  };
}
function relatorioDisciplinas(u, q) {
  const f = { ...filtros(q, 'disciplinas'), pagina: 1, por: LIMITE_RELATORIO }, r = dados.listarDisciplinas(u.id, f), s = r.summary;
  return {
    titulo: 'Relatório de conteúdos de Matemática', aviso: aviso(r.total),
    filtros: descrever(u, { ...f, de: '', ate: '' }, 'disciplinas', [['Situação', SITUACOES[f.situacao]]]).slice(1),
    resumo: [['Conteúdos', String(s.subjects)], ['Tempo total estudado', duracao(s.minutes)], ['Últimos 7 dias / meta semanal', `${duracao(s.week_minutes)} / ${duracao(s.weekly_goal)}`], ['Dúvidas pendentes', String(s.open_questions)]],
    tabelas: [{ titulo: 'Conteúdos', colunas: [{ titulo: 'Conteúdo', largura: 20 }, { titulo: 'Meta semanal', largura: 10, tipo: 'duracao' }, { titulo: 'Últimos 7 dias', largura: 10, tipo: 'duracao' }, { titulo: 'Sessões', largura: 8, tipo: 'numero' }, { titulo: 'Tempo total', largura: 10, tipo: 'duracao' }, { titulo: 'Desempenho médio', largura: 11, tipo: 'decimal' }, { titulo: 'Dúvidas pendentes', largura: 11, tipo: 'numero' }, { titulo: 'Último estudo', largura: 10, tipo: 'data' }, { titulo: 'Descrição', largura: 20 }],
      linhas: r.items.map(x => [x.name, x.weekly_goal, x.week_minutes, x.sessions, x.minutes, x.performance, x.open_questions, x.last_day, x.description]) }]
  };
}
function relatorioPainel(u, q) {
  const f = filtrosPainel(q), p = dados.painel(u.id, f), k = p.kpis;
  return {
    titulo: 'Resumo do painel de estudos',
    filtros: [['Período', `${dataBR(f.de)} a ${dataBR(f.ate)} (${p.period.days} dias)`], ['Conteúdo', f.disciplina ? dados.obterDisciplina(u.id, f.disciplina)?.name || 'não encontrado' : 'todos']],
    resumo: [['Tempo estudado', duracao(k.minutes)], ['Cumprimento da meta', k.goalPercent === null ? 'sem meta definida' : `${k.goalPercent}% de ${duracao(k.goalMinutes)}`], ['Desempenho médio', media(k.performance)], ['Dúvidas pendentes (agora)', String(k.pendingQuestions)], ['Sessões concluídas', String(k.done)], ['Sessões planejadas', String(k.planned)], ['Sessões canceladas', String(k.canceled)], ['Dúvidas resolvidas no período', String(k.resolvedQuestions)]],
    tabelas: [
      { titulo: 'Tempo por conteúdo no período', planilha: 'Por conteúdo', colunas: [{ titulo: 'Conteúdo', largura: 26 }, { titulo: 'Meta do período', largura: 12, tipo: 'duracao' }, { titulo: 'Tempo estudado', largura: 12, tipo: 'duracao' }, { titulo: '% da meta', largura: 10, tipo: 'numero' }, { titulo: 'Sessões concluídas', largura: 12, tipo: 'numero' }, { titulo: 'Desempenho médio', largura: 12, tipo: 'decimal' }],
        linhas: p.subjects.map(d => [d.name, d.goal, d.minutes, d.goal ? Math.round(d.minutes / d.goal * 100) : null, d.done, d.performance]) },
      { titulo: `Evolução do tempo estudado (por ${p.period.granularity})`, planilha: 'Evolução', colunas: [{ titulo: 'Início', largura: 12, tipo: 'data' }, { titulo: 'Fim', largura: 12, tipo: 'data' }, { titulo: 'Tempo estudado', largura: 14, tipo: 'duracao' }],
        linhas: p.series.map(x => [x.start, x.end, x.minutes]) },
      { titulo: 'Sessões e dúvidas por situação', planilha: 'Situações', colunas: [{ titulo: 'Registro', largura: 14 }, { titulo: 'Situação', largura: 16 }, { titulo: 'Quantidade', largura: 12, tipo: 'numero' }],
        linhas: [...p.sessionsByStatus.map(x => ['Sessões', STATUS_SESSAO[x.status], x.total]), ...p.questionsByStatus.map(x => ['Dúvidas registradas', STATUS_DUVIDA[x.status], x.total])] }
    ]
  };
}
function relatorio(res, u, q) {
  const formato = q.get('formato'), tipo = q.get('tipo');
  if (!['pdf', 'xlsx'].includes(formato)) fail('Formato de relatório inválido. Use PDF ou XLSX.');
  const montar = { sessoes: relatorioSessoes, duvidas: relatorioDuvidas, disciplinas: relatorioDisciplinas, painel: relatorioPainel }[tipo];
  if (!montar) fail('Tipo de relatório inválido.');
  const doc = montar(u, q);
  doc.subtitulo = `Gerado em ${momentoBR()} (horário de Brasília) · ${u.name} · Mentor IA`;
  const conteudo = formato === 'pdf' ? pdf(doc) : xlsx(doc);
  res.writeHead(200, {
    'Content-Type': formato === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="mentor-ia-${tipo}-${dados.hoje()}.${formato}"`,
    'Content-Length': conteudo.length
  });
  res.end(conteudo);
}
