// Fase 3 — persistência de disciplinas, sessões de estudo e dúvidas (modelo em docs/FASE3.md).
// usuário 1:N disciplinas · disciplina 1:N sessões (exclusão bloqueada) ·
// disciplina 1:N dúvidas (exclusão em cascata) · sessão 0..1:N dúvidas (vínculo desfeito ao excluir).
import { db } from './db.mjs';

export const semAcento = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
db.function('sem_acento', { deterministic: true }, semAcento);
db.exec(`
CREATE TABLE IF NOT EXISTS subjects (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name TEXT NOT NULL, color INTEGER NOT NULL CHECK(color BETWEEN 1 AND 8),
 weekly_goal INTEGER NOT NULL CHECK(weekly_goal BETWEEN 0 AND 3000),
 description TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL, updated INTEGER NOT NULL,
 UNIQUE(id, user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS subjects_user_name ON subjects(user_id, name COLLATE NOCASE);
CREATE TABLE IF NOT EXISTS study_sessions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 subject_id INTEGER NOT NULL,
 day TEXT NOT NULL CHECK(day GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
 minutes INTEGER NOT NULL CHECK(minutes BETWEEN 5 AND 720),
 topic TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('planejada','concluida','cancelada')),
 performance INTEGER CHECK(performance BETWEEN 1 AND 5),
 notes TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL, updated INTEGER NOT NULL,
 -- Chave composta: a sessão só aponta para disciplina do mesmo usuário. Sem cascata: bloqueia exclusão.
 FOREIGN KEY (subject_id, user_id) REFERENCES subjects(id, user_id)
);
CREATE INDEX IF NOT EXISTS study_sessions_user_day ON study_sessions(user_id, day);
CREATE INDEX IF NOT EXISTS study_sessions_subject ON study_sessions(subject_id, status);
CREATE TABLE IF NOT EXISTS questions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 subject_id INTEGER NOT NULL,
 session_id INTEGER REFERENCES study_sessions(id) ON DELETE SET NULL,
 title TEXT NOT NULL, details TEXT NOT NULL DEFAULT '',
 priority TEXT NOT NULL CHECK(priority IN ('baixa','media','alta')),
 status TEXT NOT NULL CHECK(status IN ('aberta','estudando','resolvida')),
 resolution TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL, updated INTEGER NOT NULL, resolved INTEGER,
 FOREIGN KEY (subject_id, user_id) REFERENCES subjects(id, user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS questions_user_status ON questions(user_id, status);
CREATE INDEX IF NOT EXISTS questions_subject ON questions(subject_id);
CREATE INDEX IF NOT EXISTS questions_session ON questions(session_id);
`);

const um = (sql, ...p) => db.prepare(sql).get(...p);
const todos = (sql, ...p) => db.prepare(sql).all(...p);
const executar = (sql, ...p) => db.prepare(sql).run(...p);
const like = q => '%' + semAcento(q).replace(/[\\%_]/g, '\\$&') + '%';
function transacao(fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (err) { db.exec('ROLLBACK'); throw err; }
}

export const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const utc = dia => { const [a, m, d] = dia.split('-').map(Number); return Date.UTC(a, m - 1, d); };
export const somarDias = (dia, n) => new Date(utc(dia) + n * 86400000).toISOString().slice(0, 10);
export const diasEntre = (de, ate) => Math.round((utc(ate) - utc(de)) / 86400000);
// Brasília não adota horário de verão desde 2019: UTC-3 fixo.
export const inicioDoDia = dia => Date.parse(dia + 'T00:00:00-03:00');

function paginar(base, params, ordem, f) {
  const total = um(`SELECT COUNT(*) AS n FROM (${base})`, ...params).n;
  const pages = Math.max(1, Math.ceil(total / f.por)), page = Math.min(f.pagina, pages);
  const items = todos(`SELECT * FROM (${base}) ORDER BY ${ordem} LIMIT ? OFFSET ?`, ...params, f.por, (page - 1) * f.por);
  return { items, total, page, pages, perPage: f.por };
}
const direcao = f => f.dir === 'asc' ? 'ASC' : 'DESC';

// ---------- Disciplinas ----------
const DISCIPLINA = `SELECT d.id, d.name, d.color, d.weekly_goal, d.description, d.created, d.updated,
 (SELECT COUNT(*) FROM study_sessions s WHERE s.subject_id=d.id) AS sessions,
 (SELECT COALESCE(SUM(s.minutes),0) FROM study_sessions s WHERE s.subject_id=d.id AND s.status='concluida') AS minutes,
 (SELECT COALESCE(SUM(s.minutes),0) FROM study_sessions s WHERE s.subject_id=d.id AND s.status='concluida' AND s.day BETWEEN ? AND ?) AS week_minutes,
 (SELECT ROUND(AVG(s.performance),2) FROM study_sessions s WHERE s.subject_id=d.id AND s.status='concluida') AS performance,
 (SELECT COUNT(*) FROM questions q WHERE q.subject_id=d.id) AS questions,
 (SELECT COUNT(*) FROM questions q WHERE q.subject_id=d.id AND q.status<>'resolvida') AS open_questions,
 (SELECT MAX(s.day) FROM study_sessions s WHERE s.subject_id=d.id AND s.status='concluida') AS last_day
 FROM subjects d WHERE d.user_id=?`;
const semana = () => [somarDias(hoje(), -6), hoje()];
export function listarDisciplinas(userId, f) {
  const params = [...semana(), userId]; let base = DISCIPLINA;
  if (f.q) { base += ` AND (sem_acento(d.name) LIKE ? ESCAPE '\\' OR sem_acento(d.description) LIKE ? ESCAPE '\\')`; params.push(like(f.q), like(f.q)); }
  const situacao = { com_duvidas: 'open_questions>0', sem_sessoes: 'sessions=0', abaixo_meta: 'week_minutes<weekly_goal', meta_cumprida: 'weekly_goal>0 AND week_minutes>=weekly_goal' }[f.situacao];
  if (situacao) base = `SELECT * FROM (${base}) WHERE ${situacao}`;
  const ordem = { nome: 'name COLLATE NOCASE', meta: 'weekly_goal', sessoes: 'sessions', minutos: 'minutes', semana: 'week_minutes', duvidas: 'open_questions', desempenho: 'performance', criada: 'created' }[f.ordem] || 'name COLLATE NOCASE';
  const r = paginar(base, params, `${ordem} ${f.ordem ? direcao(f) : 'ASC'}, id`, f);
  r.summary = um(`SELECT COUNT(*) AS subjects, COALESCE(SUM(sessions),0) AS sessions, COALESCE(SUM(minutes),0) AS minutes, COALESCE(SUM(open_questions),0) AS open_questions, COALESCE(SUM(weekly_goal),0) AS weekly_goal, COALESCE(SUM(week_minutes),0) AS week_minutes FROM (${base})`, ...params);
  return r;
}
export const obterDisciplina = (userId, id) => um(DISCIPLINA + ' AND d.id=?', ...semana(), userId, id);
export function detalheDisciplina(userId, id) {
  const subject = obterDisciplina(userId, id);
  if (!subject) return null;
  return {
    subject,
    sessions: todos('SELECT id, day, minutes, topic, status, performance FROM study_sessions WHERE user_id=? AND subject_id=? ORDER BY day DESC, id DESC LIMIT 5', userId, id),
    questions: todos("SELECT id, title, priority, status, created FROM questions WHERE user_id=? AND subject_id=? AND status<>'resolvida' ORDER BY CASE priority WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END, created DESC LIMIT 10", userId, id)
  };
}
export const nomeEmUso = (userId, nome, exceto = 0) => todos('SELECT id, name FROM subjects WHERE user_id=?', userId).some(d => d.id !== exceto && semAcento(d.name).trim() === semAcento(nome).trim());
export function salvarDisciplina(userId, d, id) {
  const agora = Date.now();
  if (id) executar('UPDATE subjects SET name=?, color=?, weekly_goal=?, description=?, updated=? WHERE id=? AND user_id=?', d.name, d.color, d.weekly_goal, d.description, agora, id, userId);
  else id = Number(executar('INSERT INTO subjects (user_id, name, color, weekly_goal, description, created, updated) VALUES (?,?,?,?,?,?,?)', userId, d.name, d.color, d.weekly_goal, d.description, agora, agora).lastInsertRowid);
  return obterDisciplina(userId, id);
}
export const proximaCor = userId => {
  const usadas = new Set(todos('SELECT color FROM subjects WHERE user_id=?', userId).map(x => x.color));
  return [1, 2, 3, 4, 5, 6, 7, 8].find(c => !usadas.has(c)) || 1;
};
export const excluirDisciplina = (userId, id) => executar('DELETE FROM subjects WHERE id=? AND user_id=?', id, userId).changes;

// ---------- Sessões de estudo ----------
const SESSAO = `SELECT s.id, s.subject_id, d.name AS subject, d.color, s.day, s.minutes, s.topic, s.status, s.performance, s.notes, s.created, s.updated,
 (SELECT COUNT(*) FROM questions q WHERE q.session_id=s.id) AS questions
 FROM study_sessions s JOIN subjects d ON d.id=s.subject_id WHERE s.user_id=?`;
function filtroSessoes(userId, f) {
  let base = SESSAO; const params = [userId];
  const add = (sql, ...p) => { base += ' AND ' + sql; params.push(...p); };
  if (f.disciplina) add('s.subject_id=?', f.disciplina);
  if (f.status) add('s.status=?', f.status);
  if (f.de) add('s.day>=?', f.de);
  if (f.ate) add('s.day<=?', f.ate);
  if (f.dmin) add('s.minutes>=?', f.dmin);
  if (f.dmax) add('s.minutes<=?', f.dmax);
  if (f.nota) add('s.performance>=?', f.nota);
  if (f.q) add(`(sem_acento(s.topic) LIKE ? ESCAPE '\\' OR sem_acento(s.notes) LIKE ? ESCAPE '\\' OR sem_acento(d.name) LIKE ? ESCAPE '\\')`, like(f.q), like(f.q), like(f.q));
  return { base, params };
}
export function listarSessoes(userId, f) {
  const { base, params } = filtroSessoes(userId, f);
  const ordem = { data: 'day', duracao: 'minutes', disciplina: 'subject COLLATE NOCASE', tema: 'topic COLLATE NOCASE', status: 'status', desempenho: 'performance' }[f.ordem] || 'day';
  const r = paginar(base, params, `${ordem} ${direcao(f)}, id DESC`, f);
  r.summary = um(`SELECT COUNT(*) AS sessions, COALESCE(SUM(CASE WHEN status='concluida' THEN minutes END),0) AS minutes, ROUND(AVG(CASE WHEN status='concluida' THEN performance END),2) AS performance,
    COUNT(CASE WHEN status='concluida' THEN 1 END) AS done, COUNT(CASE WHEN status='planejada' THEN 1 END) AS planned, COUNT(CASE WHEN status='cancelada' THEN 1 END) AS canceled FROM (${base})`, ...params);
  return r;
}
export function sessoesPorDisciplina(userId, f) {
  const { base, params } = filtroSessoes(userId, f);
  return todos(`SELECT subject, COUNT(*) AS sessions, COUNT(CASE WHEN status='concluida' THEN 1 END) AS done, COALESCE(SUM(CASE WHEN status='concluida' THEN minutes END),0) AS minutes, ROUND(AVG(CASE WHEN status='concluida' THEN performance END),2) AS performance FROM (${base}) GROUP BY subject_id ORDER BY minutes DESC, subject COLLATE NOCASE`, ...params);
}
export const obterSessao = (userId, id) => um(SESSAO + ' AND s.id=?', userId, id);
export const duvidasDaSessao = (userId, id) => todos('SELECT id, subject_id, title, status FROM questions WHERE user_id=? AND session_id=?', userId, id);
export function salvarSessao(userId, s, id) {
  const agora = Date.now();
  if (id) executar('UPDATE study_sessions SET subject_id=?, day=?, minutes=?, topic=?, status=?, performance=?, notes=?, updated=? WHERE id=? AND user_id=?', s.subject_id, s.day, s.minutes, s.topic, s.status, s.performance, s.notes, agora, id, userId);
  else id = Number(executar('INSERT INTO study_sessions (user_id, subject_id, day, minutes, topic, status, performance, notes, created, updated) VALUES (?,?,?,?,?,?,?,?,?,?)', userId, s.subject_id, s.day, s.minutes, s.topic, s.status, s.performance, s.notes, agora, agora).lastInsertRowid);
  return obterSessao(userId, id);
}
export const excluirSessao = (userId, id) => executar('DELETE FROM study_sessions WHERE id=? AND user_id=?', id, userId).changes;

// ---------- Dúvidas ----------
const DUVIDA = `SELECT q.id, q.subject_id, d.name AS subject, d.color, q.session_id, s.day AS session_day, s.topic AS session_topic,
 q.title, q.details, q.priority, q.status, q.resolution, q.created, q.updated, q.resolved
 FROM questions q JOIN subjects d ON d.id=q.subject_id LEFT JOIN study_sessions s ON s.id=q.session_id WHERE q.user_id=?`;
function filtroDuvidas(userId, f) {
  let base = DUVIDA; const params = [userId];
  const add = (sql, ...p) => { base += ' AND ' + sql; params.push(...p); };
  if (f.disciplina) add('q.subject_id=?', f.disciplina);
  if (f.status === 'pendentes') add("q.status<>'resolvida'");
  else if (f.status) add('q.status=?', f.status);
  if (f.prioridade) add('q.priority=?', f.prioridade);
  if (f.vinculo === 'com_sessao') add('q.session_id IS NOT NULL');
  if (f.vinculo === 'sem_sessao') add('q.session_id IS NULL');
  if (f.sessao) add('q.session_id=?', f.sessao);
  if (f.de) add('q.created>=?', inicioDoDia(f.de));
  if (f.ate) add('q.created<?', inicioDoDia(somarDias(f.ate, 1)));
  if (f.q) add(`(sem_acento(q.title) LIKE ? ESCAPE '\\' OR sem_acento(q.details) LIKE ? ESCAPE '\\' OR sem_acento(q.resolution) LIKE ? ESCAPE '\\')`, like(f.q), like(f.q), like(f.q));
  return { base, params };
}
const PRIORIDADE = "CASE priority WHEN 'alta' THEN 3 WHEN 'media' THEN 2 ELSE 1 END";
export function listarDuvidas(userId, f) {
  const { base, params } = filtroDuvidas(userId, f);
  const ordem = { criada: 'created', atualizada: 'updated', titulo: 'title COLLATE NOCASE', prioridade: PRIORIDADE, situacao: "CASE status WHEN 'aberta' THEN 1 WHEN 'estudando' THEN 2 ELSE 3 END", disciplina: 'subject COLLATE NOCASE' }[f.ordem] || 'created';
  const r = paginar(base, params, `${ordem} ${direcao(f)}, id DESC`, f);
  r.summary = um(`SELECT COUNT(*) AS questions, COUNT(CASE WHEN status='aberta' THEN 1 END) AS open, COUNT(CASE WHEN status='estudando' THEN 1 END) AS studying,
    COUNT(CASE WHEN status='resolvida' THEN 1 END) AS resolved, COUNT(CASE WHEN priority='alta' AND status<>'resolvida' THEN 1 END) AS urgent, COUNT(session_id) AS linked FROM (${base})`, ...params);
  return r;
}
export function duvidasPorDisciplina(userId, f) {
  const { base, params } = filtroDuvidas(userId, f);
  return todos(`SELECT subject, COUNT(*) AS questions, COUNT(CASE WHEN status='aberta' THEN 1 END) AS open, COUNT(CASE WHEN status='estudando' THEN 1 END) AS studying, COUNT(CASE WHEN status='resolvida' THEN 1 END) AS resolved FROM (${base}) GROUP BY subject_id ORDER BY questions DESC, subject COLLATE NOCASE`, ...params);
}
export const obterDuvida = (userId, id) => um(DUVIDA + ' AND q.id=?', userId, id);
export function salvarDuvida(userId, q, id) {
  const agora = Date.now();
  if (id) executar('UPDATE questions SET subject_id=?, session_id=?, title=?, details=?, priority=?, status=?, resolution=?, resolved=?, updated=? WHERE id=? AND user_id=?', q.subject_id, q.session_id, q.title, q.details, q.priority, q.status, q.resolution, q.resolved, agora, id, userId);
  else id = Number(executar('INSERT INTO questions (user_id, subject_id, session_id, title, details, priority, status, resolution, resolved, created, updated) VALUES (?,?,?,?,?,?,?,?,?,?,?)', userId, q.subject_id, q.session_id, q.title, q.details, q.priority, q.status, q.resolution, q.resolved, agora, agora).lastInsertRowid);
  return obterDuvida(userId, id);
}
export const excluirDuvida = (userId, id) => executar('DELETE FROM questions WHERE id=? AND user_id=?', id, userId).changes;

// ---------- Opções para formulários ----------
export const opcoes = userId => ({
  subjects: todos('SELECT id, name, color FROM subjects WHERE user_id=? ORDER BY name COLLATE NOCASE', userId),
  sessions: todos('SELECT id, subject_id, day, topic, status FROM study_sessions WHERE user_id=? ORDER BY day DESC, id DESC LIMIT 400', userId)
});

// ---------- Painel ----------
export function painel(userId, { de, ate, disciplina }) {
  const fd = disciplina ? ' AND subject_id=?' : '', pd = disciplina ? [disciplina] : [];
  const totais = um(`SELECT COALESCE(SUM(CASE WHEN status='concluida' THEN minutes END),0) AS minutes, COUNT(CASE WHEN status='concluida' THEN 1 END) AS done,
    COUNT(CASE WHEN status='planejada' THEN 1 END) AS planned, COUNT(CASE WHEN status='cancelada' THEN 1 END) AS canceled,
    ROUND(AVG(CASE WHEN status='concluida' THEN performance END),2) AS performance FROM study_sessions WHERE user_id=? AND day BETWEEN ? AND ?${fd}`, userId, de, ate, ...pd);
  const porDia = new Map(todos(`SELECT day, SUM(minutes) AS minutes FROM study_sessions WHERE user_id=? AND status='concluida' AND day BETWEEN ? AND ?${fd} GROUP BY day`, userId, de, ate, ...pd).map(x => [x.day, x.minutes]));
  const dias = diasEntre(de, ate) + 1, semanal = dias > 62, series = [];
  if (!semanal) for (let i = 0; i < dias; i++) { const d = somarDias(de, i); series.push({ start: d, end: d, minutes: porDia.get(d) || 0 }); }
  else {
    // Semanas de segunda a domingo, recortadas ao período.
    const semanaDe = d => somarDias(d, -((new Date(utc(d)).getUTCDay() + 6) % 7));
    for (let inicio = semanaDe(de); inicio <= ate; inicio = somarDias(inicio, 7)) {
      let minutes = 0;
      for (let i = 0; i < 7; i++) minutes += porDia.get(somarDias(inicio, i)) || 0;
      series.push({ start: inicio < de ? de : inicio, end: somarDias(inicio, 6) > ate ? ate : somarDias(inicio, 6), minutes });
    }
  }
  const subjects = todos(`SELECT d.id, d.name, d.color, d.weekly_goal, COALESCE(SUM(CASE WHEN s.status='concluida' THEN s.minutes END),0) AS minutes,
    COUNT(CASE WHEN s.status='concluida' THEN 1 END) AS done, ROUND(AVG(CASE WHEN s.status='concluida' THEN s.performance END),2) AS performance
    FROM subjects d LEFT JOIN study_sessions s ON s.subject_id=d.id AND s.day BETWEEN ? AND ?
    WHERE d.user_id=?${disciplina ? ' AND d.id=?' : ''} GROUP BY d.id ORDER BY minutes DESC, d.name COLLATE NOCASE`, de, ate, userId, ...pd);
  const goal = subjects.reduce((s, d) => s + d.weekly_goal, 0) * dias / 7;
  const inicio = inicioDoDia(de), fim = inicioDoDia(somarDias(ate, 1));
  const questions = todos(`SELECT status, COUNT(*) AS total FROM questions WHERE user_id=? AND created>=? AND created<?${fd} GROUP BY status`, userId, inicio, fim, ...pd);
  const pendentes = um(`SELECT COUNT(*) AS n FROM questions WHERE user_id=? AND status<>'resolvida'${fd}`, userId, ...pd).n;
  const resolvidas = um(`SELECT COUNT(*) AS n FROM questions WHERE user_id=? AND status='resolvida' AND resolved>=? AND resolved<?${fd}`, userId, inicio, fim, ...pd).n;
  return {
    period: { from: de, to: ate, days: dias, granularity: semanal ? 'semana' : 'dia' },
    kpis: { minutes: totais.minutes, done: totais.done, planned: totais.planned, canceled: totais.canceled, performance: totais.performance, goalMinutes: Math.round(goal), goalPercent: goal ? Math.round(totais.minutes / goal * 100) : null, pendingQuestions: pendentes, resolvedQuestions: resolvidas },
    series, subjects: subjects.map(d => ({ ...d, goal: Math.round(d.weekly_goal * dias / 7) })),
    sessionsByStatus: [['planejada', totais.planned], ['concluida', totais.done], ['cancelada', totais.canceled]].map(([status, total]) => ({ status, total })),
    questionsByStatus: ['aberta', 'estudando', 'resolvida'].map(status => ({ status, total: questions.find(q => q.status === status)?.total || 0 }))
  };
}

// ---------- Dados de exemplo e limpeza ----------
export const totalDisciplinas = userId => um('SELECT COUNT(*) AS n FROM subjects WHERE user_id=?', userId).n;
export function limparEstudos(userId) {
  return transacao(() => {
    const q = executar('DELETE FROM questions WHERE user_id=?', userId).changes;
    const s = executar('DELETE FROM study_sessions WHERE user_id=?', userId).changes;
    const d = executar('DELETE FROM subjects WHERE user_id=?', userId).changes;
    return { questions: q, sessions: s, subjects: d };
  });
}
export function criarExemplo(userId) {
  // Gerador determinístico: a demonstração fica igual a cada carga.
  let semente = 2026;
  const aleatorio = () => {
    semente = (semente + 0x6D2B79F5) | 0;
    let t = Math.imul(semente ^ (semente >>> 15), 1 | semente);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const escolher = lista => lista[Math.floor(aleatorio() * lista.length)];
  // O app é focado em Matemática: cada "disciplina" do modelo é um conteúdo de Matemática.
  const catalogo = [
    ['Funções', 1, 240, 'Função afim, quadrática, exponencial e logaritmos.', ['Função afim', 'Função quadrática', 'Função exponencial', 'Logaritmos']],
    ['Geometria plana', 2, 180, 'Áreas, semelhança de triângulos e Teorema de Pitágoras.', ['Áreas de figuras planas', 'Semelhança de triângulos', 'Teorema de Pitágoras', 'Circunferência']],
    ['Trigonometria', 3, 150, 'Razões trigonométricas e ciclo trigonométrico.', ['Seno, cosseno e tangente', 'Ciclo trigonométrico', 'Lei dos senos', 'Lei dos cossenos']],
    ['Probabilidade e estatística', 7, 120, 'Contagem, probabilidade e medidas estatísticas.', ['Princípio fundamental da contagem', 'Arranjo e combinação', 'Probabilidade', 'Média, moda e mediana']],
    ['Progressões', 4, 90, 'Progressão aritmética (PA) e geométrica (PG).', ['Progressão aritmética', 'Progressão geométrica', 'Soma dos termos da PG', 'Problemas com PA']]
  ];
  const duvidas = {
    'Funções': ['Quando usar a fórmula de Bhaskara?', 'Como achar o vértice da parábola?', 'Como resolver equação exponencial com bases diferentes?'],
    'Geometria plana': ['Como saber se dois triângulos são semelhantes?', 'Qual a diferença entre área e comprimento da circunferência?'],
    'Trigonometria': ['Por que o seno de 30° é 1/2?', 'Quando usar a lei dos cossenos?'],
    'Probabilidade e estatística': ['Diferença entre arranjo e combinação', 'Como calcular a probabilidade de eventos independentes?'],
    'Progressões': ['Como achar a razão de uma PG?']
  };
  const dia = hoje(), agora = Date.now();
  return transacao(() => {
    const ids = catalogo.map(([name, color, goal, description]) => ({ name, id: Number(executar('INSERT INTO subjects (user_id, name, color, weekly_goal, description, created, updated) VALUES (?,?,?,?,?,?,?)', userId, name, color, goal, description, agora, agora).lastInsertRowid) }));
    const sessoes = [];
    for (let atras = 59; atras >= -6; atras--) {
      const quantas = atras < 0 ? (aleatorio() < 0.5 ? 1 : 0) : aleatorio() < 0.25 ? 0 : aleatorio() < 0.65 ? 1 : 2;
      for (let k = 0; k < quantas; k++) {
        const i = Math.floor(Math.pow(aleatorio(), 1.4) * catalogo.length), [nome, , , , temas] = catalogo[i];
        const status = atras < 0 ? 'planejada' : aleatorio() < 0.08 ? 'cancelada' : 'concluida';
        const minutes = escolher([30, 40, 45, 50, 60, 75, 90]), day = somarDias(dia, -atras);
        const performance = status === 'concluida' ? Math.min(5, Math.max(1, Math.round(2.6 + aleatorio() * 2.4 - (i === 3 ? 0.8 : 0)))) : null;
        const criado = agora - Math.max(atras, 0) * 86400000;
        const id = Number(executar('INSERT INTO study_sessions (user_id, subject_id, day, minutes, topic, status, performance, notes, created, updated) VALUES (?,?,?,?,?,?,?,?,?,?)', userId, ids[i].id, day, minutes, escolher(temas), status, performance, status === 'concluida' ? escolher(['Fiz exercícios de fixação.', 'Revisei o resumo e refiz a lista.', 'Assisti à videoaula e anotei dúvidas.', '']) : '', criado, criado).lastInsertRowid);
        if (status === 'concluida') sessoes.push({ id, subject: ids[i].id, atras });
      }
    }
    let total = 0;
    ids.forEach(({ name, id }) => duvidas[name].forEach((title, n) => {
      const ligada = sessoes.filter(s => s.subject === id && s.atras < 30);
      const sessao = n % 2 === 0 && ligada.length ? escolher(ligada) : null;
      const atras = sessao ? sessao.atras : Math.floor(aleatorio() * 28);
      const status = escolher(['aberta', 'aberta', 'estudando', 'resolvida', 'resolvida']);
      const criado = agora - atras * 86400000 - 3600000;
      executar('INSERT INTO questions (user_id, subject_id, session_id, title, details, priority, status, resolution, resolved, created, updated) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        userId, id, sessao?.id ?? null, title, 'Registrada durante os estudos para revisar com o professor.', escolher(['baixa', 'media', 'media', 'alta']), status,
        status === 'resolvida' ? 'Revisei o conteúdo com exemplos resolvidos.' : '', status === 'resolvida' ? Math.min(agora, criado + 2 * 86400000) : null, criado, criado);
      total++;
    }));
    return { subjects: ids.length, sessions: um('SELECT COUNT(*) AS n FROM study_sessions WHERE user_id=?', userId).n, questions: total };
  });
}
