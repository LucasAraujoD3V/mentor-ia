'use strict';
// Fase 3 — cadastros, consultas, painel e relatórios.
// Reaproveita o shell e os utilitários do app.js (api, esc, icon, toast, render, user) e registra suas rotas no menu.
(() => {
  const G = window.MentorGraficos;
  const ROTAS = [['painel', 'chart', 'Painel de estudos'], ['disciplinas', 'layers', 'Conteúdos'], ['sessoes', 'clock', 'Sessões de estudo'], ['duvidas', 'question', 'Dúvidas']];
  Object.assign(icons, {
    chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    question: '<path d="M4 5h16v11H9l-5 4Z"/><path d="M10 9a2 2 0 1 1 2.5 1.9c-.4.2-.5.5-.5 1.1M12 14h.01"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    download: '<path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/>'
  });
  navigation.splice(1, 0, ...ROTAS);
  for (const [rota, , rotulo] of ROTAS) titles[rota] = rotulo;

  const CORES = { 1: 'Azul', 2: 'Laranja', 3: 'Verde-água', 4: 'Amarelo', 5: 'Rosa', 6: 'Verde', 7: 'Violeta', 8: 'Vermelho' };
  const SESSAO = { planejada: 'Planejada', concluida: 'Concluída', cancelada: 'Cancelada' };
  const DUVIDA = { aberta: 'Aberta', estudando: 'Em estudo', resolvida: 'Resolvida' };
  const PRIORIDADE = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
  const SITUACAO = { com_duvidas: 'Com dúvidas pendentes', sem_sessoes: 'Sem sessões', abaixo_meta: 'Abaixo da meta (7 dias)', meta_cumprida: 'Meta cumprida (7 dias)' };
  const PLURAL = { disciplina: 'disciplinas', sessao: 'sessoes', duvida: 'duvidas' };
  const cache = { disciplina: new Map(), sessao: new Map(), duvida: new Map() };
  let opcoesAtuais = { subjects: [], sessions: [] };

  const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const dataBR = d => d ? d.split('-').reverse().join('/') : '—';
  const diaMes = d => d.split('-').reverse().slice(0, 2).join('/');
  const dataDe = ms => ms ? new Date(ms).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—';
  const duracao = G.horas;
  const numero = v => Number(v || 0).toLocaleString('pt-BR');
  const nota = v => v === null || v === undefined ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const bolinha = cor => `<svg class="bolinha" viewBox="0 0 12 12" aria-hidden="true"><circle class="c${Number(cor)}" cx="6" cy="6" r="5"/></svg>`;
  const selo = (classe, texto) => `<span class="selo selo-${classe}">${esc(texto)}</span>`;
  const guardar = (tipo, itens) => { cache[tipo].clear(); for (const x of itens) cache[tipo].set(x.id, x); };

  // ---------- Componentes ----------
  function cabecalho(titulo, subtitulo, acoes = '') {
    return `<div class="page-heading"><div><p class="eyebrow">Meus estudos</p><h1>${titulo}</h1><p>${subtitulo}</p></div>${acoes ? `<div class="e-acoes">${acoes}</div>` : ''}</div>`;
  }
  const botaoNovo = (tipo, rotulo) => `<button type="button" class="btn" data-estudos-acao="novo" data-tipo="${tipo}">${icon('plus')} ${rotulo}</button>`;
  // Campos da página usam "e-"; campos do diálogo usam "f-", para os IDs nunca se repetirem no documento.
  let prefixo = 'e-';
  const noDialogo = fn => { prefixo = 'f-'; try { return fn(); } finally { prefixo = 'e-'; } };
  function entrada(nome, rotulo, valor = '', o = {}) {
    const id = prefixo + nome;
    const attrs = [`id="${id}"`, `name="${nome}"`, `type="${o.type || 'text'}"`, `value="${esc(valor)}"`, o.required ? 'required' : '', o.minlength ? `minlength="${o.minlength}"` : '', o.maxlength ? `maxlength="${o.maxlength}"` : '',
      o.min !== undefined ? `min="${o.min}"` : '', o.max !== undefined ? `max="${o.max}"` : '', o.step ? `step="${o.step}"` : '', o.placeholder ? `placeholder="${esc(o.placeholder)}"` : '', o.dica ? `aria-describedby="${id}-dica"` : '', o.disabled ? 'disabled' : ''].filter(Boolean).join(' ');
    return `<div class="field${o.classe ? ' ' + o.classe : ''}"><label for="${id}">${rotulo}</label><input ${attrs}>${o.dica ? `<small id="${id}-dica">${o.dica}</small>` : ''}</div>`;
  }
  function areaTexto(nome, rotulo, valor, max, dica) {
    const id = prefixo + nome;
    return `<div class="field wide"><label for="${id}">${rotulo}</label><textarea id="${id}" name="${nome}" maxlength="${max}" ${dica ? `aria-describedby="${id}-dica"` : ''}>${esc(valor || '')}</textarea>${dica ? `<small id="${id}-dica">${dica}</small>` : ''}</div>`;
  }
  function selecao(nome, rotulo, opcoes, valor, o = {}) {
    const id = prefixo + nome;
    return `<div class="field${o.classe ? ' ' + o.classe : ''}"><label for="${id}">${rotulo}</label><select id="${id}" name="${nome}" ${o.required ? 'required' : ''} ${o.change ? `data-estudos-change="${o.change}"` : ''} ${o.dica ? `aria-describedby="${id}-dica"` : ''} ${o.disabled ? 'disabled' : ''}>${opcoes.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(valor ?? '') ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>${o.dica ? `<small id="${id}-dica">${o.dica}</small>` : ''}</div>`;
  }
  const resumo = itens => `<section class="e-resumo" aria-label="Dados consolidados da consulta">${itens.map(([r, v]) => `<div class="card"><p>${r}</p><strong>${v}</strong></div>`).join('')}</section>`;
  function formFiltros(rota, query, { busca, ordens, avancados, ocultos = [] }) {
    const ativos = avancados.filter(([nome]) => query.get(nome)).length;
    const dir = query.get('dir') || 'desc';
    return `<form class="card e-filtros" data-estudos="filtros" data-rota="${rota}" role="search" aria-label="Consultar ${titles[rota].toLowerCase()}">
      <div class="e-linha-busca">${entrada('q', 'Busca simples', query.get('q') || '', { type: 'search', maxlength: 80, placeholder: busca })}
      ${selecao('ordem', 'Ordenar por', [['', 'Padrão'], ...ordens], query.get('ordem'))}
      ${selecao('dir', 'Direção', [['desc', 'Decrescente'], ['asc', 'Crescente']], dir)}
      ${selecao('por', 'Por página', [5, 10, 25, 50].map(v => [v, v]), query.get('por') || 10)}
      <button class="btn" type="submit">Consultar</button></div>
      <details class="e-avancada" ${ativos ? 'open' : ''}><summary>Busca avançada${ativos ? ` · ${plural(ativos, 'filtro ativo', 'filtros ativos')}` : ''}</summary><div class="e-grade-filtros">${avancados.map(([, html]) => html).join('')}</div></details>
      ${ocultos.filter(n => query.get(n)).map(n => `<input type="hidden" name="${n}" value="${esc(query.get(n))}">`).join('')}
      ${[...query.keys()].length ? `<a class="text-button" href="#${rota}">Limpar filtros</a>` : ''}
    </form>`;
  }
  function th(rota, query, chave, rotulo, padrao = 'asc', classe = '') {
    const ativo = query.get('ordem') === chave, atual = query.get('dir') === 'asc' ? 'asc' : 'desc';
    const q = new URLSearchParams(query); q.set('ordem', chave); q.set('dir', ativo ? (atual === 'asc' ? 'desc' : 'asc') : padrao); q.delete('pagina');
    return `<th scope="col" class="${classe}" ${ativo ? `aria-sort="${atual === 'asc' ? 'ascending' : 'descending'}"` : ''}><a href="#${rota}?${q}">${rotulo}${ativo ? (atual === 'asc' ? ' ↑' : ' ↓') : ''}</a></th>`;
  }
  function paginacao(rota, query, r) {
    const inicio = r.total ? (r.page - 1) * r.perPage + 1 : 0, fim = Math.min(r.total, r.page * r.perPage);
    const link = p => { const q = new URLSearchParams(query); q.set('pagina', p); return `#${rota}?${q}`; };
    const paginas = [...new Set([1, r.page - 1, r.page, r.page + 1, r.pages])].filter(p => p >= 1 && p <= r.pages).sort((a, b) => a - b);
    let botoes = '', anterior = 0;
    for (const p of paginas) { if (p - anterior > 1) botoes += '<span aria-hidden="true">…</span>'; botoes += p === r.page ? `<span class="e-pagina-atual" aria-current="page">${p}</span>` : `<a href="${link(p)}" aria-label="Página ${p}">${p}</a>`; anterior = p; }
    return `<nav class="e-paginacao" aria-label="Paginação"><p>${numero(inicio)}–${numero(fim)} de ${numero(r.total)} · consulta em ${nota(r.ms)} ms</p><div>${r.page > 1 ? `<a href="${link(r.page - 1)}">← Anterior</a>` : ''}${botoes}${r.page < r.pages ? `<a href="${link(r.page + 1)}">Próxima →</a>` : ''}</div></nav>`;
  }
  function botoesRelatorio(tipo, query, rotulo = 'Relatório desta consulta') {
    const q = new URLSearchParams(query); q.delete('pagina'); q.delete('por');
    return `<div class="e-relatorio"><span>${rotulo}</span>${['pdf', 'xlsx'].map(f => `<button type="button" class="btn secondary" data-estudos-acao="relatorio" data-formato="${f}" data-tipo="${tipo}" data-filtros="${esc(q.toString())}">${icon('download')} ${f === 'pdf' ? 'PDF' : 'Excel (.xlsx)'}</button>`).join('')}</div>`;
  }
  const acoesLinha = (tipo, id, nome) => `<div class="e-acoes-linha"><button type="button" class="text-button" data-estudos-acao="ver" data-tipo="${tipo}" data-id="${id}" aria-label="Ver detalhes de ${esc(nome)}">Ver</button><button type="button" class="text-button" data-estudos-acao="editar" data-tipo="${tipo}" data-id="${id}" aria-label="Editar ${esc(nome)}">Editar</button><button type="button" class="text-button e-perigo" data-estudos-acao="excluir" data-tipo="${tipo}" data-id="${id}" aria-label="Excluir ${esc(nome)}">Excluir</button></div>`;
  function tabela(titulo, rota, query, r, cabecas, linhas, tipoRelatorio, vazio) {
    return `<section class="card e-tabela-card"><div class="e-tabela-topo"><h2>${titulo}</h2>${botoesRelatorio(tipoRelatorio, query)}</div>${r.total ? `<div class="e-rolagem" tabindex="0" role="region" aria-label="${titulo} (role para os lados em telas pequenas)"><table class="e-tabela"><caption class="sr">${titulo}</caption><thead><tr>${cabecas}</tr></thead><tbody>${linhas}</tbody></table></div>${paginacao(rota, query, r)}` : `<div class="e-vazio">${vazio}</div>`}</section>`;
  }
  const semResultado = rota => `<p>Nenhum resultado para os filtros aplicados.</p><a class="btn secondary" href="#${rota}">Limpar filtros</a>`;

  // ---------- Disciplinas ----------
  async function viewDisciplinas(query) {
    const r = await api('estudos/disciplinas?' + query); guardar('disciplina', r.items);
    const s = r.summary, filtrado = [...query.keys()].some(k => !['ordem', 'dir', 'por', 'pagina'].includes(k));
    const linhas = r.items.map(d => `<tr><th scope="row"><span class="e-nome">${bolinha(d.color)}<button type="button" class="e-link" data-estudos-acao="ver" data-tipo="disciplina" data-id="${d.id}">${esc(d.name)}</button></span>${d.description ? `<small>${esc(d.description)}</small>` : ''}</th>
      <td class="num">${duracao(d.week_minutes)}<small>meta ${duracao(d.weekly_goal)}</small></td><td class="num"><a href="#sessoes?disciplina=${d.id}">${numero(d.sessions)}</a></td><td class="num">${duracao(d.minutes)}</td><td class="num">${nota(d.performance)}</td>
      <td class="num">${d.open_questions ? `<a href="#duvidas?disciplina=${d.id}&amp;status=pendentes">${d.open_questions}</a>` : '0'}</td><td>${acoesLinha('disciplina', d.id, d.name)}</td></tr>`).join('');
    const cabecas = th('disciplinas', query, 'nome', 'Conteúdo') + th('disciplinas', query, 'semana', 'Últimos 7 dias', 'desc', 'num') + th('disciplinas', query, 'sessoes', 'Sessões', 'desc', 'num') + th('disciplinas', query, 'minutos', 'Tempo total', 'desc', 'num') + th('disciplinas', query, 'desempenho', 'Desempenho', 'desc', 'num') + th('disciplinas', query, 'duvidas', 'Dúvidas pendentes', 'desc', 'num') + '<th scope="col"><span class="sr">Ações</span></th>';
    return cabecalho('Conteúdos de Matemática', 'Organize os conteúdos de Matemática que você estuda (ex.: Funções, Geometria), defina metas semanais e acompanhe sessões e dúvidas de cada um.', botaoNovo('disciplina', 'Novo conteúdo'))
      + resumo([['Conteúdos', numero(s.subjects)], ['Tempo total estudado', duracao(s.minutes)], ['Últimos 7 dias / meta semanal', `${duracao(s.week_minutes)} / ${duracao(s.weekly_goal)}`], ['Dúvidas pendentes', numero(s.open_questions)]])
      + formFiltros('disciplinas', query, { busca: 'Nome ou descrição', ordens: [['nome', 'Nome'], ['meta', 'Meta semanal'], ['semana', 'Últimos 7 dias'], ['sessoes', 'Sessões'], ['minutos', 'Tempo total'], ['desempenho', 'Desempenho'], ['duvidas', 'Dúvidas pendentes'], ['criada', 'Data de cadastro']],
        avancados: [['situacao', selecao('situacao', 'Situação', [['', 'Todas'], ...Object.entries(SITUACAO)], query.get('situacao'))]] })
      + tabela('Conteúdos cadastrados', 'disciplinas', query, r, cabecas, linhas, 'disciplinas', filtrado ? semResultado('disciplinas') : `<p>Nenhum conteúdo cadastrado ainda. Comece criando um ou carregue dados fictícios para conhecer o sistema.</p><div class="e-acoes">${botaoNovo('disciplina', 'Novo conteúdo')}<button type="button" class="btn secondary" data-estudos-acao="exemplo">Carregar dados de exemplo</button></div>`);
  }
  function formDisciplina(d, proxima) {
    const cor = d?.color || proxima;
    return `<form data-estudos="salvar" data-tipo="disciplina"><input type="hidden" name="id" value="${d?.id || ''}"><div class="form-grid">
      ${entrada('name', 'Nome do conteúdo', d?.name, { required: true, minlength: 2, maxlength: 60, classe: 'wide' })}
      ${entrada('weekly_goal', 'Meta semanal (minutos)', d?.weekly_goal ?? 120, { type: 'number', required: true, min: 0, max: 3000, step: 5, dica: 'Ex.: 120 = 2 horas por semana. Use 0 para não definir meta.' })}
      <fieldset class="e-cores"><legend>Cor nos gráficos</legend>${Object.entries(CORES).map(([n, nome]) => `<label class="e-cor"><input type="radio" name="color" value="${n}" ${Number(n) === cor ? 'checked' : ''} required>${bolinha(n)}<span>${nome}</span></label>`).join('')}</fieldset>
      ${areaTexto('description', 'Descrição (opcional)', d?.description, 300, 'Até 300 caracteres.')}</div>
      ${rodapeForm(d ? 'Salvar alterações' : 'Cadastrar conteúdo')}</form>`;
  }

  // ---------- Sessões ----------
  async function viewSessoes(query) {
    const [r, op] = await Promise.all([api('estudos/sessoes?' + query), api('estudos/opcoes')]); guardar('sessao', r.items);
    const s = r.summary, filtrado = [...query.keys()].some(k => !['ordem', 'dir', 'por', 'pagina'].includes(k));
    const linhas = r.items.map(x => `<tr><td>${dataBR(x.day)}</td><td><span class="e-nome">${bolinha(x.color)}${esc(x.subject)}</span></td><th scope="row"><button type="button" class="e-link" data-estudos-acao="ver" data-tipo="sessao" data-id="${x.id}">${esc(x.topic)}</button></th>
      <td>${selo(x.status, SESSAO[x.status])}</td><td class="num">${duracao(x.minutes)}</td><td class="num">${x.performance ? `${x.performance}/5` : '—'}</td>
      <td class="num">${x.questions ? `<a href="#duvidas?sessao=${x.id}">${x.questions}</a>` : '0'}</td><td>${acoesLinha('sessao', x.id, x.topic)}</td></tr>`).join('');
    const cabecas = th('sessoes', query, 'data', 'Data', 'desc') + th('sessoes', query, 'disciplina', 'Conteúdo') + th('sessoes', query, 'tema', 'Tema') + th('sessoes', query, 'status', 'Situação') + th('sessoes', query, 'duracao', 'Duração', 'desc', 'num') + th('sessoes', query, 'desempenho', 'Desempenho', 'desc', 'num') + '<th scope="col" class="num">Dúvidas</th><th scope="col"><span class="sr">Ações</span></th>';
    const disciplinas = [['', 'Todos'], ...op.subjects.map(d => [d.id, d.name])];
    return cabecalho('Sessões de estudo', 'Registre o que estudou de Matemática ou planeje os próximos estudos. Cada sessão pertence a um conteúdo.', botaoNovo('sessao', 'Nova sessão'))
      + resumo([['Sessões encontradas', numero(s.sessions)], ['Tempo estudado (concluídas)', duracao(s.minutes)], ['Desempenho médio', nota(s.performance) + (s.performance ? ' / 5' : '')], ['Concluídas · planejadas · canceladas', `${s.done} · ${s.planned} · ${s.canceled}`]])
      + formFiltros('sessoes', query, { busca: 'Tema, anotação ou conteúdo', ordens: [['data', 'Data'], ['duracao', 'Duração'], ['disciplina', 'Conteúdo'], ['tema', 'Tema'], ['status', 'Situação'], ['desempenho', 'Desempenho']], avancados: [
        ['disciplina', selecao('disciplina', 'Conteúdo', disciplinas, query.get('disciplina'))],
        ['status', selecao('status', 'Situação', [['', 'Todas'], ...Object.entries(SESSAO)], query.get('status'))],
        ['de', entrada('de', 'De', query.get('de') || '', { type: 'date' })], ['ate', entrada('ate', 'Até', query.get('ate') || '', { type: 'date' })],
        ['dmin', entrada('dmin', 'Duração mínima (min)', query.get('dmin') || '', { type: 'number', min: 5, max: 720 })], ['dmax', entrada('dmax', 'Duração máxima (min)', query.get('dmax') || '', { type: 'number', min: 5, max: 720 })],
        ['nota', selecao('nota', 'Desempenho mínimo', [['', 'Qualquer'], ...[1, 2, 3, 4, 5].map(n => [n, `${n} ou mais`])], query.get('nota'))]] })
      + tabela('Sessões registradas', 'sessoes', query, r, cabecas, linhas, 'sessoes', filtrado ? semResultado('sessoes') : op.subjects.length ? `<p>Nenhuma sessão registrada ainda.</p>${botaoNovo('sessao', 'Registrar primeira sessão')}` : `<p>Cadastre um conteúdo antes de registrar sessões.</p>${botaoNovo('disciplina', 'Novo conteúdo')}`);
  }
  function formSessao(x) {
    const status = x?.status || 'concluida', concluida = status === 'concluida';
    return `<form data-estudos="salvar" data-tipo="sessao"><input type="hidden" name="id" value="${x?.id || ''}"><div class="form-grid">
      ${selecao('subject_id', 'Conteúdo', [['', 'Selecione…'], ...opcoesAtuais.subjects.map(d => [d.id, d.name])], x?.subject_id, { required: true })}
      ${selecao('status', 'Situação', Object.entries(SESSAO), status, { required: true, change: 'status-sessao' })}
      ${entrada('day', 'Data', x?.day || hoje(), { type: 'date', required: true, min: '2000-01-01', max: concluida ? hoje() : undefined })}
      ${entrada('minutes', 'Duração (minutos)', x?.minutes ?? 60, { type: 'number', required: true, min: 5, max: 720, step: 5 })}
      ${entrada('topic', 'Tema estudado', x?.topic, { required: true, minlength: 2, maxlength: 120, classe: 'wide' })}
      ${selecao('performance', 'Como foi seu desempenho?', [['', 'Selecione…'], ['5', '5 · Excelente'], ['4', '4 · Bom'], ['3', '3 · Regular'], ['2', '2 · Difícil'], ['1', '1 · Muito difícil']], x?.performance, { required: concluida, disabled: !concluida, dica: 'Obrigatório para sessões concluídas.', classe: 'wide' })}
      ${areaTexto('notes', 'Anotações (opcional)', x?.notes, 1000, 'Até 1.000 caracteres.')}</div>
      ${rodapeForm(x ? 'Salvar alterações' : 'Registrar sessão')}</form>`;
  }

  // ---------- Dúvidas ----------
  async function viewDuvidas(query) {
    const [r, op] = await Promise.all([api('estudos/duvidas?' + query), api('estudos/opcoes')]); guardar('duvida', r.items);
    const s = r.summary, filtrado = [...query.keys()].some(k => !['ordem', 'dir', 'por', 'pagina'].includes(k));
    const linhas = r.items.map(x => `<tr><td>${dataDe(x.created)}</td><th scope="row"><button type="button" class="e-link" data-estudos-acao="ver" data-tipo="duvida" data-id="${x.id}">${esc(x.title)}</button></th>
      <td><span class="e-nome">${bolinha(x.color)}${esc(x.subject)}</span></td><td>${x.session_id ? `<a href="#sessoes?disciplina=${x.subject_id}&amp;de=${x.session_day}&amp;ate=${x.session_day}">${diaMes(x.session_day)} · ${esc(x.session_topic)}</a>` : '<span class="muted">Sem vínculo</span>'}</td>
      <td>${selo('p-' + x.priority, PRIORIDADE[x.priority])}</td><td>${selo(x.status, DUVIDA[x.status])}</td><td>${acoesLinha('duvida', x.id, x.title)}</td></tr>`).join('');
    const cabecas = th('duvidas', query, 'criada', 'Registro', 'desc') + th('duvidas', query, 'titulo', 'Título') + th('duvidas', query, 'disciplina', 'Conteúdo') + '<th scope="col">Sessão vinculada</th>' + th('duvidas', query, 'prioridade', 'Prioridade', 'desc') + th('duvidas', query, 'situacao', 'Situação') + '<th scope="col"><span class="sr">Ações</span></th>';
    const daSessao = query.get('sessao') ? `<div class="notice e-chip">Mostrando apenas as dúvidas de uma sessão.${r.items[0]?.session_topic ? ` <strong>${dataBR(r.items[0].session_day)} · ${esc(r.items[0].session_topic)}</strong>.` : ''} <a href="#duvidas">Ver todas</a></div>` : '';
    return cabecalho('Dúvidas', 'Anote o que ficou pendente em Matemática. Vincule a dúvida a uma sessão do mesmo conteúdo e registre como foi resolvida.', botaoNovo('duvida', 'Nova dúvida'))
      + resumo([['Dúvidas encontradas', numero(s.questions)], ['Abertas · em estudo', `${s.open} · ${s.studying}`], ['Resolvidas', numero(s.resolved)], ['Pendentes de alta prioridade', numero(s.urgent)]])
      + daSessao
      + formFiltros('duvidas', query, { busca: 'Título, detalhes ou resolução', ordens: [['criada', 'Data de registro'], ['atualizada', 'Última atualização'], ['titulo', 'Título'], ['prioridade', 'Prioridade'], ['situacao', 'Situação'], ['disciplina', 'Conteúdo']], ocultos: ['sessao'], avancados: [
        ['disciplina', selecao('disciplina', 'Conteúdo', [['', 'Todos'], ...op.subjects.map(d => [d.id, d.name])], query.get('disciplina'))],
        ['status', selecao('status', 'Situação', [['', 'Todas'], ['pendentes', 'Pendentes (abertas e em estudo)'], ...Object.entries(DUVIDA)], query.get('status'))],
        ['prioridade', selecao('prioridade', 'Prioridade', [['', 'Todas'], ...Object.entries(PRIORIDADE)], query.get('prioridade'))],
        ['vinculo', selecao('vinculo', 'Vínculo com sessão', [['', 'Todos'], ['com_sessao', 'Com sessão vinculada'], ['sem_sessao', 'Sem sessão vinculada']], query.get('vinculo'))],
        ['de', entrada('de', 'Registrada de', query.get('de') || '', { type: 'date' })], ['ate', entrada('ate', 'até', query.get('ate') || '', { type: 'date' })]] })
      + tabela('Dúvidas registradas', 'duvidas', query, r, cabecas, linhas, 'duvidas', filtrado ? semResultado('duvidas') : op.subjects.length ? `<p>Nenhuma dúvida registrada.</p>${botaoNovo('duvida', 'Registrar dúvida')}` : `<p>Cadastre um conteúdo antes de registrar dúvidas.</p>${botaoNovo('disciplina', 'Novo conteúdo')}`);
  }
  const opcoesSessao = (disciplina, atual) => [['', 'Sem vínculo'], ...opcoesAtuais.sessions.filter(s => s.subject_id === Number(disciplina)).map(s => [s.id, `${dataBR(s.day)} · ${s.topic} (${SESSAO[s.status]})`])].map(([v, t]) => `<option value="${v}" ${String(v) === String(atual ?? '') ? 'selected' : ''}>${esc(t)}</option>`).join('');
  function formDuvida(x) {
    const resolvida = x?.status === 'resolvida';
    return `<form data-estudos="salvar" data-tipo="duvida"><input type="hidden" name="id" value="${x?.id || ''}"><div class="form-grid">
      ${entrada('title', 'Qual é a dúvida?', x?.title, { required: true, minlength: 3, maxlength: 120, classe: 'wide' })}
      ${selecao('subject_id', 'Conteúdo', [['', 'Selecione…'], ...opcoesAtuais.subjects.map(d => [d.id, d.name])], x?.subject_id, { required: true, change: 'disciplina-duvida' })}
      <div class="field"><label for="f-session_id">Sessão vinculada (opcional)</label><select id="f-session_id" name="session_id" aria-describedby="f-session_id-dica">${opcoesSessao(x?.subject_id, x?.session_id)}</select><small id="f-session_id-dica">Somente sessões do conteúdo escolhido.</small></div>
      ${selecao('priority', 'Prioridade', Object.entries(PRIORIDADE), x?.priority || 'media', { required: true })}
      ${selecao('status', 'Situação', Object.entries(DUVIDA), x?.status || 'aberta', { required: true, change: 'status-duvida' })}
      ${areaTexto('details', 'Detalhes (opcional)', x?.details, 1000)}
      ${areaTexto('resolution', resolvida ? 'Como foi resolvida (obrigatório)' : 'Como foi resolvida', x?.resolution, 1000, 'Obrigatório quando a situação for “Resolvida”.')}</div>
      ${rodapeForm(x ? 'Salvar alterações' : 'Registrar dúvida')}</form>`;
  }

  // ---------- Painel ----------
  async function viewPainel(query) {
    const periodo = query.get('periodo') || '30', personalizado = periodo === 'personalizado';
    const [p, op] = await Promise.all([api('estudos/painel?' + query), api('estudos/opcoes')]);
    if (!op.subjects.length) return cabecalho('Painel de estudos', 'Acompanhe tempo, metas, desempenho e dúvidas em um só lugar.') + `<section class="card welcome e-boas-vindas"><p class="eyebrow">Primeiros passos</p><h2>Monte seu plano de estudos de Matemática.</h2><p>1. Cadastre os conteúdos (ex.: Funções, Geometria, Trigonometria) e suas metas semanais. 2. Registre as sessões de estudo. 3. Anote as dúvidas. O painel e os relatórios se atualizam a cada registro.</p><div class="e-acoes">${botaoNovo('disciplina', 'Cadastrar primeiro conteúdo')}<button type="button" class="btn secondary" data-estudos-acao="exemplo">Carregar dados de exemplo (fictícios)</button></div></section>`;
    const k = p.kpis, semanal = p.period.granularity === 'semana';
    const filtroSessoes = id => `#sessoes?${new URLSearchParams({ disciplina: id, status: 'concluida', de: p.period.from, ate: p.period.to })}`;
    const pontos = p.series.map(x => ({ valor: x.minutes, rotulo: diaMes(x.start), dica: semanal ? `Semana de ${diaMes(x.start)} a ${diaMes(x.end)}` : dataBR(x.start) }));
    const barras = p.subjects.map(d => ({ rotulo: d.name, valor: d.minutes, meta: d.goal, cor: d.color, href: filtroSessoes(d.id), valorTexto: d.goal ? `${duracao(d.minutes)} · ${Math.round(d.minutes / d.goal * 100)}%` : duracao(d.minutes), dica: `${duracao(d.minutes)}${d.goal ? ` de ${duracao(d.goal)} (${Math.round(d.minutes / d.goal * 100)}% da meta)` : ''}|${d.name} · desempenho ${nota(d.performance)}` }));
    const tabelaDados = (cab, linhas) => `<details class="e-dados"><summary>Ver dados em tabela</summary><div class="e-rolagem"><table class="e-tabela"><thead><tr>${cab.map((c, i) => `<th scope="col" class="${i ? 'num' : ''}">${c}</th>`).join('')}</tr></thead><tbody>${linhas.map(l => `<tr>${l.map((c, i) => i ? `<td class="num">${c}</td>` : `<th scope="row">${c}</th>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
    const meta = k.goalPercent === null ? '—' : `${k.goalPercent}%`;
    const medidor = k.goalPercent === null ? '' : `<svg class="e-medidor" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true"><rect class="e-trilho" width="100" height="8"/><rect class="e-preenchido" width="${Math.min(100, k.goalPercent)}" height="8"/></svg>`;
    const agora = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    return cabecalho('Painel de estudos', `${dataBR(p.period.from)} a ${dataBR(p.period.to)} · ${plural(p.period.days, 'dia', 'dias')}${query.get('disciplina') ? ' · ' + esc(op.subjects.find(d => d.id === Number(query.get('disciplina')))?.name || '') : ' · todos os conteúdos'}`, `<button type="button" class="btn secondary" data-estudos-acao="atualizar">Atualizar dados</button>`)
      + `<form class="card e-filtros e-filtros-painel" data-estudos="painel" aria-label="Filtros do painel"><div class="e-linha-busca">
        ${selecao('periodo', 'Período', [['7', 'Últimos 7 dias'], ['30', 'Últimos 30 dias'], ['90', 'Últimos 90 dias'], ['365', 'Últimos 12 meses'], ['personalizado', 'Personalizado…']], periodo, { change: 'periodo' })}
        <div class="e-periodo-custom" ${personalizado ? '' : 'hidden'}>${entrada('de', 'De', query.get('de') || p.period.from, { type: 'date', required: true, disabled: !personalizado })}${entrada('ate', 'Até', query.get('ate') || p.period.to, { type: 'date', required: true, disabled: !personalizado })}</div>
        ${selecao('disciplina', 'Conteúdo', [['', 'Todos'], ...op.subjects.map(d => [d.id, d.name])], query.get('disciplina'), { change: 'aplicar' })}
        <button class="btn" type="submit">Aplicar</button></div></form>`
      + `<section class="e-kpis" aria-label="Indicadores do período">
        <article class="card e-kpi e-kpi-destaque"><p>Tempo estudado</p><strong>${duracao(k.minutes)}</strong><small>em ${plural(k.done, 'sessão concluída', 'sessões concluídas')}</small></article>
        <article class="card e-kpi"><p>Cumprimento da meta</p><strong>${meta}</strong><small>${k.goalPercent === null ? 'Defina metas nos conteúdos' : `de ${duracao(k.goalMinutes)} previstas no período`}</small>${medidor}</article>
        <article class="card e-kpi"><p>Desempenho médio</p><strong>${nota(k.performance)}${k.performance ? '<span> / 5</span>' : ''}</strong><small>autoavaliação das sessões concluídas</small></article>
        <article class="card e-kpi"><p>Dúvidas pendentes</p><strong>${numero(k.pendingQuestions)}</strong><small>${plural(k.resolvedQuestions, 'resolvida', 'resolvidas')} no período · <a href="#duvidas?status=pendentes${query.get('disciplina') ? '&amp;disciplina=' + Number(query.get('disciplina')) : ''}">ver</a></small></article></section>`
      + `<div class="e-graficos">
        <section class="card e-grafico-card e-largo">${cardHead('Tempo de estudo no período', `Horas de sessões concluídas por ${p.period.granularity}. Passe o ponteiro para ver cada valor.`, 'chart')}${G.marcador('linha', pontos, { descricao: `Gráfico de linha do tempo estudado por ${p.period.granularity}. Total de ${duracao(k.minutes)}.`, vazio: 'Nenhuma sessão concluída no período.' })}${tabelaDados([semanal ? 'Semana' : 'Dia', 'Tempo estudado'], p.series.map(x => [semanal ? `${dataBR(x.start)} a ${dataBR(x.end)}` : dataBR(x.start), duracao(x.minutes)]))}</section>
        <section class="card e-grafico-card e-largo">${cardHead('Tempo por conteúdo × meta do período', 'Clique em uma barra para consultar as sessões do conteúdo.', 'layers')}${G.marcador('barras', barras, { descricao: 'Gráfico de barras do tempo estudado por conteúdo comparado à meta do período.', vazio: 'Sem conteúdos para o filtro.' })}${tabelaDados(['Conteúdo', 'Meta do período', 'Tempo estudado', '% da meta', 'Sessões concluídas', 'Desempenho médio'], p.subjects.map(d => [esc(d.name), duracao(d.goal), duracao(d.minutes), d.goal ? Math.round(d.minutes / d.goal * 100) + '%' : '—', d.done, nota(d.performance)]))}</section>
        <section class="card e-grafico-card">${cardHead('Sessões por situação', 'Sessões com data dentro do período.', 'clock')}${G.marcador('colunas', p.sessionsByStatus.map(x => ({ rotulo: SESSAO[x.status], valor: x.total })), { descricao: `Gráfico de colunas: ${p.sessionsByStatus.map(x => `${SESSAO[x.status]} ${x.total}`).join(', ')}.`, vazio: 'Nenhuma sessão no período.' })}${tabelaDados(['Situação', 'Sessões'], p.sessionsByStatus.map(x => [SESSAO[x.status], x.total]))}</section>
        <section class="card e-grafico-card">${cardHead('Dúvidas registradas por situação', 'Dúvidas criadas no período, pela situação atual.', 'question')}${G.marcador('rosca', p.questionsByStatus.map((x, i) => ({ rotulo: DUVIDA[x.status], valor: x.total, cor: 'c' + (i + 1) })), { unidade: 'dúvidas', descricao: `Gráfico de rosca: ${p.questionsByStatus.map(x => `${DUVIDA[x.status]} ${x.total}`).join(', ')}.`, vazio: 'Nenhuma dúvida registrada no período.' })}${tabelaDados(['Situação', 'Dúvidas'], p.questionsByStatus.map(x => [DUVIDA[x.status], x.total]))}</section></div>`
      + `<section class="card e-rodape-painel"><p class="small muted">Dados atualizados às ${agora} · consulta em ${nota(p.ms)} ms. O painel é recalculado a cada acesso, filtro e registro.</p>${botoesRelatorio('painel', query, 'Exportar resumo do painel')}</section>`
      + `<section class="card danger-zone e-limpar"><h2>Gerenciar dados de estudo</h2><p>Remove todos os seus conteúdos, sessões e dúvidas. Sua conta e configurações continuam. Útil para recomeçar após testar com dados de exemplo.</p><button type="button" class="btn secondary" data-estudos-acao="limpar">Limpar meus dados de estudo</button></section>`;
  }

  // ---------- Diálogos ----------
  const dialogo = document.createElement('dialog');
  dialogo.className = 'e-dialogo'; dialogo.setAttribute('aria-labelledby', 'e-dialogo-titulo');
  document.body.append(dialogo);
  dialogo.addEventListener('click', e => { if (e.target === dialogo) dialogo.close(); });
  window.addEventListener('hashchange', () => { if (dialogo.open) dialogo.close(); });
  function abrir(titulo, corpo) {
    dialogo.innerHTML = `<div class="e-dialogo-conteudo"><div class="e-dialogo-topo"><h2 id="e-dialogo-titulo">${titulo}</h2><button type="button" class="e-fechar" data-estudos-acao="fechar" aria-label="Fechar">×</button></div>${corpo}</div>`;
    if (!dialogo.open) dialogo.showModal();
    dialogo.querySelector('.e-dialogo-conteudo input:not([type=hidden]), .e-dialogo-conteudo select, .e-dialogo-conteudo textarea, .e-dialogo-conteudo .btn')?.focus();
  }
  const rodapeForm = rotulo => `${errorBox()}<div class="e-dialogo-acoes"><button type="button" class="btn secondary" data-estudos-acao="fechar">Cancelar</button><button class="btn" type="submit">${rotulo}</button></div>`;
  const detalhes = pares => `<dl class="e-detalhes">${pares.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  const rodapeDetalhe = (tipo, id) => `<div class="e-dialogo-acoes"><button type="button" class="btn secondary e-perigo-btn" data-estudos-acao="excluir" data-tipo="${tipo}" data-id="${id}">Excluir</button><button type="button" class="btn" data-estudos-acao="editar" data-tipo="${tipo}" data-id="${id}">Editar</button></div>`;

  async function abrirFormulario(tipo, item) {
    opcoesAtuais = await api('estudos/opcoes');
    if (tipo !== 'disciplina' && !opcoesAtuais.subjects.length) return abrir('Cadastre um conteúdo primeiro', `<p>Sessões e dúvidas sempre pertencem a um conteúdo de Matemática.</p><div class="e-dialogo-acoes"><button type="button" class="btn" data-estudos-acao="novo" data-tipo="disciplina">Novo conteúdo</button></div>`);
    const titulos = { disciplina: ['Novo conteúdo', 'Editar conteúdo'], sessao: ['Nova sessão de estudo', 'Editar sessão'], duvida: ['Nova dúvida', 'Editar dúvida'] };
    const usadas = new Set(opcoesAtuais.subjects.map(d => d.color));
    const corpo = noDialogo(() => tipo === 'disciplina' ? formDisciplina(item, [1, 2, 3, 4, 5, 6, 7, 8].find(c => !usadas.has(c)) || 1) : tipo === 'sessao' ? formSessao(item) : formDuvida(item));
    abrir(titulos[tipo][item ? 1 : 0], corpo);
  }
  async function abrirDetalhe(tipo, id) {
    if (tipo === 'disciplina') {
      const r = await api('estudos/disciplinas/' + id), d = r.subject; cache.disciplina.set(d.id, d);
      return abrir(`${bolinha(d.color)} ${esc(d.name)}`, detalhes([['Descrição', esc(d.description) || '—'], ['Meta semanal', duracao(d.weekly_goal)], ['Últimos 7 dias', duracao(d.week_minutes)], ['Tempo total', duracao(d.minutes)], ['Sessões', numero(d.sessions)], ['Desempenho médio', nota(d.performance)], ['Dúvidas pendentes', `${d.open_questions} de ${d.questions}`], ['Último estudo', dataBR(d.last_day)], ['Cadastrado em', dataDe(d.created)]])
        + `<h3>Últimas sessões</h3>${r.sessions.length ? `<ul class="e-lista">${r.sessions.map(s => `<li><span>${dataBR(s.day)} · ${esc(s.topic)}</span>${selo(s.status, SESSAO[s.status])}<small>${duracao(s.minutes)}</small></li>`).join('')}</ul>` : '<p class="muted">Nenhuma sessão registrada.</p>'}<a href="#sessoes?disciplina=${d.id}">Ver todas as sessões →</a>`
        + `<h3>Dúvidas pendentes</h3>${r.questions.length ? `<ul class="e-lista">${r.questions.map(q => `<li><span>${esc(q.title)}</span>${selo('p-' + q.priority, PRIORIDADE[q.priority])}</li>`).join('')}</ul>` : '<p class="muted">Nenhuma dúvida pendente.</p>'}<a href="#duvidas?disciplina=${d.id}">Ver todas as dúvidas →</a>`
        + rodapeDetalhe('disciplina', d.id));
    }
    if (tipo === 'sessao') {
      const x = cache.sessao.get(id); if (!x) return;
      const vinculadas = x.questions ? (await api(`estudos/duvidas?sessao=${id}&por=50`)).items : [];
      return abrir(esc(x.topic), detalhes([['Conteúdo', `${bolinha(x.color)} ${esc(x.subject)}`], ['Data', dataBR(x.day)], ['Duração', duracao(x.minutes)], ['Situação', selo(x.status, SESSAO[x.status])], ['Desempenho', x.performance ? `${x.performance} / 5` : '—'], ['Anotações', esc(x.notes) || '—'], ['Atualizada em', dataDe(x.updated)]])
        + `<h3>Dúvidas vinculadas</h3>${vinculadas.length ? `<ul class="e-lista">${vinculadas.map(q => `<li><span>${esc(q.title)}</span>${selo(q.status, DUVIDA[q.status])}</li>`).join('')}</ul><a href="#duvidas?sessao=${id}">Abrir na consulta de dúvidas →</a>` : '<p class="muted">Nenhuma dúvida vinculada a esta sessão.</p>'}`
        + rodapeDetalhe('sessao', id));
    }
    const x = cache.duvida.get(id); if (!x) return;
    abrir(esc(x.title), detalhes([['Conteúdo', `${bolinha(x.color)} ${esc(x.subject)}`], ['Sessão vinculada', x.session_id ? `${dataBR(x.session_day)} · ${esc(x.session_topic)}` : 'Sem vínculo'], ['Prioridade', selo('p-' + x.priority, PRIORIDADE[x.priority])], ['Situação', selo(x.status, DUVIDA[x.status])], ['Detalhes', esc(x.details) || '—'], ['Como foi resolvida', esc(x.resolution) || '—'], ['Registrada em', dataDe(x.created)], ['Resolvida em', dataDe(x.resolved)]]) + rodapeDetalhe('duvida', id));
  }
  function abrirExclusao(tipo, x) {
    if (!x) return;
    const confirmar = (texto, aviso = '') => abrir('Confirmar exclusão', `<p>${texto}</p>${aviso ? `<div class="notice warn">${aviso}</div>` : ''}<form data-estudos="excluir" data-tipo="${tipo}" data-id="${x.id}">${errorBox()}<div class="e-dialogo-acoes"><button type="button" class="btn secondary" data-estudos-acao="fechar">Cancelar</button><button class="btn danger" type="submit">Excluir definitivamente</button></div></form>`);
    if (tipo === 'disciplina') {
      if (x.sessions) return abrir('Exclusão bloqueada', `<p>O conteúdo <strong>${esc(x.name)}</strong> tem ${plural(x.sessions, 'sessão de estudo vinculada', 'sessões de estudo vinculadas')}. Para preservar seu histórico, a exclusão só é permitida depois que essas sessões forem excluídas ou movidas para outro conteúdo.</p><div class="e-dialogo-acoes"><button type="button" class="btn secondary" data-estudos-acao="fechar">Entendi</button><a class="btn" href="#sessoes?disciplina=${x.id}">Ver sessões do conteúdo</a></div>`);
      return confirmar(`Excluir o conteúdo <strong>${esc(x.name)}</strong>?`, x.questions ? `${plural(x.questions, 'dúvida vinculada também será excluída', 'dúvidas vinculadas também serão excluídas')} (exclusão em cascata).` : '');
    }
    if (tipo === 'sessao') return confirmar(`Excluir a sessão <strong>${esc(x.topic)}</strong> de ${dataBR(x.day)}?`, x.questions ? `${plural(x.questions, 'dúvida vinculada será desvinculada', 'dúvidas vinculadas serão desvinculadas')}, mas continuará${x.questions === 1 ? '' : 'ão'} cadastrada${x.questions === 1 ? '' : 's'}.` : '');
    confirmar(`Excluir a dúvida <strong>${esc(x.title)}</strong>?`);
  }

  // ---------- Formulários: leitura, validação no navegador e envio ----------
  function dadosForm(form, tipo) {
    const v = nome => form.elements[nome]?.value ?? '';
    if (tipo === 'disciplina') return { id: v('id'), name: v('name'), color: Number(v('color')), weekly_goal: Number(v('weekly_goal')), description: v('description') };
    if (tipo === 'sessao') return { id: v('id'), subject_id: Number(v('subject_id')), day: v('day'), minutes: Number(v('minutes')), topic: v('topic'), status: v('status'), performance: v('performance') ? Number(v('performance')) : '', notes: v('notes') };
    return { id: v('id'), subject_id: Number(v('subject_id')), session_id: v('session_id') ? Number(v('session_id')) : '', title: v('title'), details: v('details'), priority: v('priority'), status: v('status'), resolution: v('resolution') };
  }
  function validar(tipo, d) {
    if (tipo === 'disciplina') {
      if (d.name.trim().length < 2) return 'Nome: informe pelo menos 2 caracteres.';
      if (!Number.isInteger(d.weekly_goal) || d.weekly_goal < 0 || d.weekly_goal > 3000) return 'Meta semanal: informe de 0 a 3.000 minutos.';
    }
    if (tipo === 'sessao') {
      if (!d.subject_id) return 'Selecione o conteúdo.';
      if (d.topic.trim().length < 2) return 'Tema estudado: informe pelo menos 2 caracteres.';
      if (!Number.isInteger(d.minutes) || d.minutes < 5 || d.minutes > 720) return 'Duração: informe de 5 a 720 minutos.';
      if (d.status === 'concluida' && !d.performance) return 'Avalie seu desempenho de 1 a 5 para registrar a sessão como concluída.';
      if (d.status === 'concluida' && d.day > hoje()) return 'Uma sessão concluída não pode ter data futura. Use a situação "Planejada".';
    }
    if (tipo === 'duvida') {
      if (!d.subject_id) return 'Selecione o conteúdo.';
      if (d.title.trim().length < 3) return 'Título: informe pelo menos 3 caracteres.';
      if (d.status === 'resolvida' && d.resolution.trim().length < 3) return 'Descreva como a dúvida foi resolvida (mínimo de 3 caracteres).';
    }
    return '';
  }
  function aplicarFiltros(form) {
    const q = new URLSearchParams();
    for (const [k, v] of new FormData(form)) if (String(v).trim() && !(k === 'por' && v === '10') && !(k === 'dir' && !form.elements.ordem.value)) q.set(k, String(v).trim());
    navigate(form.dataset.rota + (q.toString() ? '?' + q : ''));
  }
  function aplicarPainel(form) {
    const q = new URLSearchParams();
    for (const [k, v] of new FormData(form)) if (v && !(k === 'periodo' && v === '30')) q.set(k, v);
    if (q.get('periodo') === 'personalizado' && q.get('de') > q.get('ate')) return toast('A data inicial deve ser anterior ou igual à data final.');
    navigate('painel' + (q.toString() ? '?' + q : ''));
  }
  document.addEventListener('submit', async event => {
    const form = event.target.closest('form[data-estudos]'); if (!form) return;
    event.preventDefault();
    const acao = form.dataset.estudos, tipo = form.dataset.tipo;
    if (acao === 'filtros') return aplicarFiltros(form);
    if (acao === 'painel') return aplicarPainel(form);
    const box = form.querySelector('.form-error'), botao = form.querySelector('[type=submit]'), rotulo = botao.innerHTML;
    if (form.dataset.busy) return;
    box.hidden = true; botao.disabled = true; botao.textContent = 'Aguarde…'; form.dataset.busy = '1';
    try {
      let r;
      if (acao === 'salvar') { const d = dadosForm(form, tipo), erro = validar(tipo, d); if (erro) throw new Error(erro); r = await api(`estudos/${PLURAL[tipo]}/salvar`, d); }
      else if (acao === 'excluir') r = await api(`estudos/${PLURAL[tipo]}/excluir`, { id: Number(form.dataset.id) });
      else if (acao === 'limpar') r = await api('estudos/limpar', { confirm: form.elements.confirm.value.trim() });
      dialogo.close(); toast(r.message); await render();
    } catch (err) {
      box.textContent = err.message; box.hidden = false; box.focus();
      if (err.status === 401) { dialogo.close(); await render(); }
    } finally { botao.disabled = false; botao.innerHTML = rotulo; delete form.dataset.busy; }
  });
  async function baixarRelatorio(botao) {
    const q = new URLSearchParams(botao.dataset.filtros); q.set('formato', botao.dataset.formato); q.set('tipo', botao.dataset.tipo);
    const original = botao.innerHTML; botao.disabled = true; botao.textContent = 'Gerando…';
    try {
      const resposta = await fetch('/api/estudos/relatorio?' + q, { credentials: 'same-origin' });
      if (!resposta.ok) { let mensagem = 'Não foi possível gerar o relatório.'; try { mensagem = (await resposta.json()).message || mensagem; } catch { /* resposta sem JSON */ } throw Object.assign(new Error(mensagem), { status: resposta.status }); }
      const nome = /filename="([^"]+)"/.exec(resposta.headers.get('content-disposition') || '')?.[1] || 'relatorio.' + botao.dataset.formato;
      const url = URL.createObjectURL(await resposta.blob()), link = Object.assign(document.createElement('a'), { href: url, download: nome });
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
      toast(`Relatório gerado: ${nome}`);
    } finally { botao.disabled = false; botao.innerHTML = original; }
  }
  document.addEventListener('click', async event => {
    const alvo = event.target.closest('[data-estudos-acao]'); if (!alvo) return;
    const acao = alvo.dataset.estudosAcao, tipo = alvo.dataset.tipo, id = Number(alvo.dataset.id);
    try {
      if (acao === 'fechar') dialogo.close();
      if (acao === 'novo') await abrirFormulario(tipo);
      if (acao === 'editar') {
        let item = cache[tipo].get(id);
        if (!item && tipo === 'disciplina') item = (await api('estudos/disciplinas/' + id)).subject;
        await abrirFormulario(tipo, item);
      }
      if (acao === 'ver') await abrirDetalhe(tipo, id);
      if (acao === 'excluir') abrirExclusao(tipo, cache[tipo].get(id));
      if (acao === 'relatorio') await baixarRelatorio(alvo);
      if (acao === 'atualizar') { await render(); toast('Painel atualizado com os dados mais recentes.'); }
      if (acao === 'exemplo') { alvo.disabled = true; const r = await api('estudos/exemplo', {}); toast(r.message); navigate('painel'); }
      if (acao === 'limpar') abrir('Limpar dados de estudo', `<p>Esta ação remove <strong>todos</strong> os seus conteúdos, sessões e dúvidas. Não pode ser desfeita. Se quiser guardar uma cópia, exporte os relatórios antes.</p><form data-estudos="limpar">${noDialogo(() => entrada('confirm', 'Digite LIMPAR para confirmar', '', { required: true, maxlength: 6 }))}${errorBox()}<div class="e-dialogo-acoes"><button type="button" class="btn secondary" data-estudos-acao="fechar">Cancelar</button><button class="btn danger" type="submit">Limpar dados de estudo</button></div></form>`);
    } catch (err) {
      toast(err.message);
      if (err.status === 401) await render();
    } finally { if (acao === 'exemplo') alvo.disabled = false; }
  });
  document.addEventListener('change', event => {
    const el = event.target.closest('[data-estudos-change]'); if (!el) return;
    const form = el.form, tipo = el.dataset.estudosChange;
    if (tipo === 'status-sessao') {
      const concluida = el.value === 'concluida', desempenho = form.elements.performance;
      desempenho.disabled = !concluida; desempenho.required = concluida; if (!concluida) desempenho.value = '';
      if (concluida) form.elements.day.max = hoje(); else form.elements.day.removeAttribute('max');
    }
    if (tipo === 'status-duvida') {
      const resolvida = el.value === 'resolvida';
      form.elements.resolution.required = resolvida;
      form.querySelector('label[for="f-resolution"]').textContent = resolvida ? 'Como foi resolvida (obrigatório)' : 'Como foi resolvida';
    }
    if (tipo === 'disciplina-duvida') form.elements.session_id.innerHTML = opcoesSessao(el.value, '');
    if (tipo === 'periodo') {
      const personalizado = el.value === 'personalizado', bloco = form.querySelector('.e-periodo-custom');
      bloco.hidden = !personalizado; bloco.querySelectorAll('input').forEach(i => { i.disabled = !personalizado; });
      if (!personalizado) form.requestSubmit();
    }
    if (tipo === 'aplicar') form.requestSubmit();
  });

  async function view(rota, query) {
    if (rota === 'painel') return viewPainel(query);
    if (rota === 'disciplinas') return viewDisciplinas(query);
    if (rota === 'sessoes') return viewSessoes(query);
    return viewDuvidas(query);
  }
  window.MentorEstudos = { routes: ROTAS.map(r => r[0]), view };
  // Se o app já desenhou a tela antes deste módulo carregar, desenha de novo com o menu completo.
  if (config && user) render();
})();
