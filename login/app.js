'use strict';
const app = document.querySelector('#app');
const icons = {
  home: '<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  shield: '<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Z"/><path d="m8 12 3 3 5-6"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9 8a3 3 0 1 1 4 3c-1 1-1 2-1 3M12 17h.01"/>',
  star: '<path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  settings: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
  exit: '<path d="M9 3H3v18h6M9 12h12m-5-5 5 5-5 5"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  book: '<path d="M12 5C8 2 3 3 2 4v16c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v16"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.settings}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]));
const brand = `<a class="brand" href="#home" aria-label="Mentor IA — início da aplicação"><span class="mark" aria-hidden="true">M<span>↗</span></span><span>Mentor <span class="brand-i">I</span><span class="brand-a">A</span></span></a>`;
const policy = 'De 12 a 128 caracteres, com letra maiúscula, minúscula, número e símbolo. Não compartilhe sua senha ou códigos de segurança.';
let user = null, config = null, available = false, renderId = 0;
let pending = (() => { try { return JSON.parse(sessionStorage.getItem('mentor.pending') || 'null'); } catch { return null; } })();
function setPending(value) { pending = value; try { if (value) sessionStorage.setItem('mentor.pending', JSON.stringify(value)); else sessionStorage.removeItem('mentor.pending'); } catch { /* Session-only state still works without browser storage. */ } }
function toast(message) { const box = document.querySelector('#toast'); box.textContent = message; box.hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => { box.hidden = true; }, 6500); }
async function api(path, data) {
  const response = await fetch('/api/' + path, { credentials: 'same-origin', headers: data === undefined ? {} : { 'Content-Type': 'application/json', 'X-Mentor-Request': '1' }, method: data === undefined ? 'GET' : 'POST', body: data === undefined ? undefined : JSON.stringify(data) });
  const type = response.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw new Error('O servidor da aplicação não está disponível. Consulte as instruções de instalação.');
  const result = await response.json();
  if (!response.ok) { const error = new Error(result.message || 'Não foi possível concluir.'); error.status = response.status; throw error; }
  return result;
}
function preferences(prefs) {
  const p = prefs || { theme: 'light', font: 100 };
  document.documentElement.dataset.theme = p.theme;
  document.documentElement.dataset.font = p.font;
  try { localStorage.setItem('mentor.accessibility', JSON.stringify({ theme: p.theme, font: p.font })); } catch { /* Optional device preference. */ }
}
try { const p = JSON.parse(localStorage.getItem('mentor.accessibility') || 'null'); if (p) preferences(p); } catch { /* Safe defaults. */ }
function field(name, label, value = '', options = {}) {
  const id = 'field-' + name;
  return `<div class="field"><label for="${id}">${label}</label>${options.textarea ? `<textarea id="${id}" name="${name}" maxlength="${options.max || 500}">${esc(value)}</textarea>` : `<input id="${id}" name="${name}" type="${options.type || 'text'}" value="${esc(value)}" ${options.readonly ? 'readonly aria-readonly="true"' : ''} ${options.required ? 'required' : ''} ${options.min ? `minlength="${options.min}"` : ''} maxlength="${options.max || 120}" ${options.autocomplete ? `autocomplete="${options.autocomplete}"` : ''} ${options.type === 'email' ? 'inputmode="email" autocapitalize="none"' : ''}>`}${options.hint ? `<small>${options.hint}</small>` : ''}</div>`;
}
function passwordField(name, label, isNew = false, required = true) {
  return `<div class="field"><label for="field-${name}">${label}</label><div class="password-wrap"><input id="field-${name}" name="${name}" type="password" autocomplete="${isNew ? 'new-password' : 'current-password'}" maxlength="128" ${isNew ? 'minlength="12"' : ''} ${required ? 'required' : ''}><button class="password-toggle" type="button" data-action="password" data-target="field-${name}" aria-label="Mostrar ${label.toLowerCase()}" aria-pressed="false">${icon('eye')}</button></div></div>`;
}
function errorBox() { return '<div class="form-error" role="alert" hidden tabindex="-1"></div>'; }
function codeField() { return '<div class="field"><label for="code">Código de confirmação</label><input class="code-input" id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required placeholder="000000"><small>Seis dígitos · válido por 10 minutos · até cinco tentativas.</small></div>'; }
function submit(label) { return `<button class="btn full" type="submit" ${!available ? 'disabled' : ''}>${label}</button>`; }
function acceptance() { return '<label class="check"><input type="checkbox" name="accept" required><span>Li e aceito os <a href="#terms" target="_blank" rel="noopener">Termos de Uso</a> e estou ciente da <a href="#privacy" target="_blank" rel="noopener">Política de Privacidade</a> da versão acadêmica.</span></label>'; }
function devTools() { return config?.localMailbox ? '<details class="dev-tools"><summary>Desenvolvimento local · caixa de e-mails de teste</summary><p>Não há envio externo neste modo. Use apenas dados fictícios. Os códigos aparecem nesta caixa local.</p><button type="button" class="text-button" data-action="mail">Atualizar caixa local</button><div id="mailbox" aria-live="polite"></div></details>' : ''; }
function authLayout(content) {
  return `<div class="auth-page"><aside class="auth-story">${brand}<div class="story-content"><p class="eyebrow">Seu espaço para ir além</p><h1>Aprenda pensando.<br><span>Evolua entendendo.</span></h1><p>Aprender é descobrir o caminho. Estamos aqui para ajudar você a construir o seu.</p><div class="story-card"><p class="eyebrow">Uma ideia que nos move</p><div class="thinking">A melhor resposta começa com uma boa pergunta.</div><div class="pills"><span>Autonomia</span><span>Raciocínio</span><span>Colaboração</span></div></div></div><div class="story-footer"><i></i><i></i><i></i><span>Aluno + Professor + IA</span></div></aside><div class="auth-side"><div class="auth-top"><a href="../">← Conheça o projeto</a><span class="badge">Versão acadêmica</span></div><main id="main" class="auth-content" tabindex="-1">${!available ? '<div class="notice warn"><strong>Aplicação sem conexão com o servidor.</strong><br>O GitHub Pages exibe a interface, mas não executa autenticação nem banco de dados. Para usar o sistema, inicie o servidor conforme o README.</div>' : ''}${content}${devTools()}</main><footer class="auth-bottom">Mentor IA · 2026<br><a href="#privacy">Privacidade</a> · <a href="#terms">Termos de Uso</a> · <a href="mailto:escolamentoria@outlook.com.br">Suporte</a></footer></div></div>`;
}
function authView(route, query) {
  if (route === 'register') return authLayout(`<p class="eyebrow">Comece sua jornada</p><h2>Crie sua conta</h2><p>Organize seu perfil e personalize sua experiência.</p><div class="notice">Versão acadêmica em avaliação. Use dados fictícios; o atendimento a estudantes menores de idade ainda exige revisão do projeto.</div><form data-form="register">${field('name', 'Nome', '', { required: true, min: 2, max: 80, autocomplete: 'name' })}${field('email', 'E-mail', '', { type: 'email', required: true, max: 254, autocomplete: 'username' })}${passwordField('password', 'Crie uma senha', true)}<p class="small muted">${policy}</p>${passwordField('confirm', 'Repita a senha', true)}${acceptance()}${errorBox()}${submit('Criar conta e confirmar e-mail →')}</form><p class="auth-switch">Já tem uma conta? <a href="#login">Entrar</a></p>`);
  if (route === 'recover') return authLayout(`<p class="eyebrow">Vamos ajudar</p><h2>Recupere seu acesso</h2><p>Informe o e-mail da conta. Você receberá um código para definir uma nova senha.</p><form data-form="recover">${field('email', 'E-mail cadastrado', '', { type: 'email', required: true, max: 254, autocomplete: 'username' })}${errorBox()}${submit('Enviar código de recuperação')}</form><p class="auth-switch"><a href="#login">← Voltar para entrar</a></p>`);
  if (route === 'confirm' || route === 'google-confirm' || route === 'reset') {
    if (!pending) return authLayout('<h2>Solicite um novo código</h2><p>A solicitação expirou neste navegador.</p><a class="btn full" href="#login">Voltar ao acesso</a>');
    const reset = route === 'reset', consent = pending.consent;
    return authLayout(`<p class="eyebrow">${reset ? 'Recuperação de senha' : 'Mais proteção para você'}</p><h2>${reset ? 'Defina uma nova senha' : 'Confira seu e-mail'}</h2><p>${esc(pending.message || 'Digite o código enviado ao e-mail da sua conta.')}</p><form data-form="${reset ? 'reset' : 'confirm'}">${codeField()}${reset ? passwordField('password', 'Nova senha', true) + `<p class="small muted">${policy}</p>` + passwordField('confirm', 'Repita a nova senha', true) : ''}${consent ? acceptance() : ''}${errorBox()}${submit(reset ? 'Salvar nova senha' : 'Confirmar e continuar →')}</form><button type="button" class="text-button" data-action="resend">Reenviar código</button><p class="auth-switch"><a href="#login">← Voltar ao acesso</a></p>`);
  }
  const err = query.get('error');
  return authLayout(`<p class="eyebrow">Bem-vindo ao Mentor IA</p><h2>Seu próximo passo<br>começa aqui.</h2><p>Entre na sua conta para acessar seu espaço.</p>${err ? `<div class="form-error" role="alert">${err === 'google-existing' ? 'Já existe uma conta com esse e-mail. Entre com sua senha. A vinculação de contas Google existentes não é automática.' : 'Não foi possível entrar com Google. Tente novamente ou use e-mail e senha.'}</div>` : ''}<form data-form="login">${field('email', 'E-mail', '', { type: 'email', required: true, max: 254, autocomplete: 'username' })}${passwordField('password', 'Senha')}<div class="auth-subrow"><a href="#recover">Esqueci minha senha</a></div>${errorBox()}${submit('Entrar na minha conta →')}</form><div class="divider">ou continue com</div>${config?.google ? `<a class="btn secondary full" href="/api/google/start"><b aria-hidden="true">G</b> Continuar com Google</a><p class="small muted center">Após o Google, confirmaremos um código por e-mail.</p>` : '<button type="button" class="btn secondary full" disabled><b aria-hidden="true">G</b> Google · configuração pendente</button>'}<p class="auth-switch">Primeira vez por aqui? <a href="#register">Criar uma conta</a></p>`);
}
const navigation = [['home', 'home', 'Visão geral'], ['profile', 'user', 'Minha conta'], ['notifications', 'bell', 'Notificações'], ['security', 'shield', 'Segurança'], ['accessibility', 'settings', 'Acessibilidade'], ['support', 'help', 'Ajuda e suporte'], ['review', 'star', 'Avaliar o sistema'], ['legal', 'book', 'Privacidade e termos']];
const titles = Object.fromEntries(navigation.map(x => [x[0], x[2]]));
function avatar(size = '') { return user.avatar ? `<img class="avatar ${size}" src="${esc(user.avatar)}" alt="Sua foto de perfil">` : `<span class="avatar ${size}" aria-hidden="true">${esc(user.name.split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase())}</span>`; }
function shell(route, content) {
  const title = titles[route] || 'Documentos';
  return `<div class="shell"><aside class="sidebar" id="sidebar" aria-label="Navegação da aplicação">${brand}<button type="button" class="text-button" data-action="menu-close">Fechar menu</button><p class="nav-caption">SEU ESPAÇO</p><nav class="nav">${navigation.map(([key, glyph, label]) => `<a href="#${key}" ${route === key ? 'aria-current="page"' : ''}>${icon(glyph)}${label}</a>`).join('')}</nav><div class="sidebar-bottom"><button type="button" class="text-button" data-action="logout">${icon('exit')} Sair da conta</button><div class="account-mini">${avatar()}<div><b>${esc(user.name)}</b><small>Conta confirmada</small></div></div></div></aside><div class="workspace"><header class="top"><button class="menu-toggle" type="button" data-action="menu" aria-label="Abrir menu da aplicação" aria-controls="sidebar" aria-expanded="false">${icon('menu')}</button><div class="breadcrumb">Meu espaço <span aria-hidden="true">/</span> <span>${title}</span></div><div class="top-actions"><span class="badge"><span class="dot"></span>${config.development ? 'Ambiente local' : 'Versão acadêmica'}</span><a href="../">Apresentação ↗</a><a href="#profile" aria-label="Abrir meu perfil">${avatar()}</a></div></header><main id="main" class="content" tabindex="-1">${content}<footer class="footer-note">Mentor IA · v0.2.0 · Aprenda pensando. Evolua entendendo.</footer></main></div></div>`;
}
function heading(title, subtitle) { return `<div class="page-heading"><div><p class="eyebrow">Configurações do seu espaço</p><h1>${title}</h1><p>${subtitle}</p></div><span class="badge">${icon('shield')} Conta confirmada</span></div>`; }
function cardHead(title, subtitle, glyph) { return `<div class="card-head"><div><h2>${title}</h2><p>${subtitle}</p></div>${icon(glyph)}</div>`; }
function viewHome(notices) {
  return heading(`Olá, ${esc(user.name.split(' ')[0])}.`, 'Um espaço organizado para cuidar da sua conta e das suas preferências.') + `<section class="card welcome"><p class="eyebrow">Seu aprendizado, do seu jeito</p><h2>Pequenos passos.<br>Novas possibilidades.</h2><p>Comece pelo seu perfil e escolha como quer acompanhar as novidades.</p><span class="badge">Acesso e configurações disponíveis</span></section><div class="cards">${[['profile', 'user', 'Deixe com a sua cara', 'Complete seu cadastro e adicione uma foto.'], ['notifications', 'bell', 'No seu tempo', 'Escolha onde e quando receber atualizações.'], ['security', 'shield', 'Cuide do seu acesso', 'Conheça a política de senha e gerencie sua conta.']].map(([route, glyph, title, text]) => `<section class="card"><span class="card-icon">${icon(glyph)}</span><h2>${title}</h2><p>${text}</p><a href="#${route}">Configurar →</a></section>`).join('')}</div><section class="card">${cardHead('Atualizações da conta', 'Notificações internas e eventos recentes.', 'bell')}${notices.length ? `<ul class="notice-list">${notices.map(n => `<li>${esc(n.message)}<small>${new Date(n.created).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</small></li>`).join('')}</ul><button class="text-button" type="button" data-action="clear-notices">Limpar notificações</button>` : '<p>Sem novas notificações por aqui.</p>'}</section><p class="small muted">O mentor educacional com IA e o painel pedagógico continuam em desenvolvimento. Esta versão implementa acesso e configurações.</p>`;
}
function viewProfile() {
  return heading('Minha conta', 'Seu perfil, suas informações. Mantenha tudo atualizado para uma experiência mais pessoal.') + `<div class="profile-grid"><section class="card">${cardHead('Dados pessoais', 'Informações que ajudam a conhecer você.', 'user')}<form data-form="profile"><div class="form-grid">${field('name', 'Nome', user.name, { required: true, min: 2, max: 80, autocomplete: 'name' })}${field('email', 'E-mail de identificação', user.email, { type: 'email', readonly: true, max: 254, hint: 'Por segurança, o e-mail não pode ser alterado aqui.' })}${field('school', 'Escola ou instituição (opcional)', user.school, { max: 120 })}<div class="field"><label for="grade">Etapa de ensino (opcional)</label><select id="grade" name="grade"><option value="">Prefiro não informar</option>${['1º ano', '2º ano', '3º ano', 'Professor', 'Outro'].map(x => `<option ${user.grade === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="wide">${field('bio', 'Sobre você (opcional)', user.bio, { textarea: true, max: 500, hint: 'Até 500 caracteres. Evite incluir dados sensíveis.' })}</div></div>${errorBox()}<div class="save-row"><small>CPF não é solicitado nesta versão.</small><button class="btn" type="submit">Salvar alterações</button></div></form></section><aside class="card photo-card">${avatar()}<h2>Sua foto de perfil</h2><p>Uma imagem para deixar seu espaço com a sua identidade.</p><form data-form="avatar"><label class="sr" for="photo">Escolha uma foto PNG ou JPEG</label><input id="photo" name="photo" type="file" accept="image/png,image/jpeg" required><p>PNG ou JPEG · até 500 KB</p>${errorBox()}<button class="btn secondary full" type="submit">Salvar foto</button></form>${user.avatar ? '<button type="button" class="text-button" data-action="remove-avatar">Remover foto</button>' : ''}<p class="small muted">Prefira uma imagem sem outras pessoas ou documentos.</p></aside></div>`;
}
function prefForm(content) { return `<form data-form="preferences">${content}${errorBox()}<div class="save-row"><small>Preferências vinculadas à sua conta.</small><button class="btn" type="submit">Salvar preferências</button></div></form>`; }
function viewNotifications() {
  const p = user.prefs;
  return heading('Notificações', 'Escolha o canal e a frequência que combinam com a sua rotina.') + `<section class="card">${cardHead('Você escolhe como acompanhar', 'Preferências para atualizações do perfil e acessos à conta.', 'bell')}${prefForm(`<fieldset class="star-options"><legend>Onde deseja receber?</legend><div class="radio-options">${[['app', 'Na aplicação'], ['email', 'Por e-mail'], ['none', 'Desativar avisos']].map(([v, label]) => `<label class="radio-card"><input type="radio" name="channel" value="${v}" ${p.channel === v ? 'checked' : ''}>${label}</label>`).join('')}</div></fieldset><div class="form-grid"><div class="field"><label for="frequency">Frequência</label><select name="frequency" id="frequency">${[['event', 'Por evento'], ['daily', 'Resumo diário (em 24 horas)'], ['scheduled', 'Resumo no horário escolhido']].map(([v, label]) => `<option value="${v}" ${p.frequency === v ? 'selected' : ''}>${label}</option>`).join('')}</select></div>${field('time', 'Horário programado · Brasília', p.time, { type: 'time', hint: 'Usado somente na frequência “horário escolhido”.' })}</div><div class="notice">Códigos de acesso, troca de senha e exclusão são sempre enviados imediatamente por e-mail, independentemente destas preferências. WhatsApp não está integrado.</div><p class="small muted">Resumos são enviados apenas quando existem eventos pendentes. O servidor precisa permanecer em execução; após reinício, processa as entregas vencidas. ${config.localMailbox ? 'Neste ambiente, e-mails são entregues na caixa local de testes.' : ''}</p>`)}</section>`;
}
function viewAccessibility() {
  return heading('Acessibilidade', 'Mais conforto para ler, navegar e aprender.') + `<section class="card">${cardHead('Uma interface no seu ritmo', 'Os ajustes podem ser testados antes de salvar.', 'settings')}${prefForm(`<div class="field-row"><div><strong>Aparência</strong><p>Escolha o tema mais confortável para você.</p></div><div class="radio-options">${['light', 'dark'].map(v => `<label class="radio-card"><input type="radio" name="theme" value="${v}" ${user.prefs.theme === v ? 'checked' : ''} data-preview>${v === 'light' ? '☀ Claro' : '☾ Escuro'}</label>`).join('')}</div></div><div class="field-row"><div><strong>Tamanho do texto</strong><p>Altere a escala em toda a aplicação.</p></div><div class="field"><label class="sr" for="font">Escala do texto</label><select name="font" id="font" data-preview>${[100, 112, 125].map(n => `<option value="${n}" ${user.prefs.font === n ? 'selected' : ''}>${n}%${n === 100 ? ' · padrão' : ''}</option>`).join('')}</select></div></div><div class="notice">Você também pode usar o zoom do navegador. A interface respeita a preferência de redução de movimento e oferece navegação por teclado e rótulos nos formulários.</div>`)}</section>`;
}
function viewSecurity() {
  const action = pending?.purpose;
  return heading('Segurança e acesso', 'Controle seu acesso com confirmações enviadas ao seu e-mail.') + `<section class="card">${cardHead('Política de senha', 'Regras utilizadas no cadastro e na alteração.', 'shield')}<ul class="policy-list"><li>${policy}</li><li>O servidor armazena um hash scrypt com salt individual. A senha original não é armazenada.</li><li>O acesso exige confirmação em duas etapas: senha (ou Google) e código por e-mail.</li><li>Códigos expiram em 10 minutos, são de uso único e bloqueiam após cinco erros.</li></ul></section><section class="card">${cardHead(user.hasPassword ? 'Alterar senha' : 'Definir uma senha', 'A alteração encerra as outras sessões da conta.', 'shield')}<form data-form="${action === 'password' ? 'change-password' : 'request-password'}">${action === 'password' ? codeField() + passwordField('password', 'Nova senha', true) + passwordField('confirm', 'Repita a nova senha', true) : user.hasPassword ? passwordField('password', 'Senha atual') : '<p>Confirme o código enviado ao e-mail da sua conta Google para definir uma senha.</p>'}${errorBox()}<button class="btn" type="submit">${action === 'password' ? 'Confirmar nova senha' : 'Enviar código de confirmação'}</button></form>${action === 'password' ? '<button type="button" class="text-button" data-action="cancel-security">Cancelar e solicitar outro código</button>' : ''}</section><section class="card danger-zone">${cardHead('Excluir conta', 'Uma decisão sua, com confirmação de segurança.', 'user')}<p>Manter a conta permite preservar suas preferências, seu perfil e suas avaliações. Você pode desativar notificações sem excluir sua conta.</p><p>Se preferir sair, a exclusão remove perfil, foto, preferências, avaliações, notificações, códigos e sessões da base ativa. Não é reversível. A recuperação de cópias de segurança depende da política de quem hospedar o sistema.</p><a class="btn secondary" href="/api/export" download>Baixar meus dados antes de excluir</a><form data-form="${action === 'delete' ? 'delete-account' : 'request-delete'}">${action === 'delete' ? codeField() + field('confirm', 'Digite EXCLUIR para confirmar', '', { required: true, max: 7 }) : user.hasPassword ? passwordField('currentDelete', 'Confirme sua senha atual') : '<p>Será necessário confirmar um código por e-mail.</p>'}${errorBox()}<button class="btn danger" type="submit">${action === 'delete' ? 'Excluir minha conta definitivamente' : 'Solicitar exclusão segura'}</button></form>${action === 'delete' ? '<button type="button" class="text-button" data-action="cancel-security">Cancelar exclusão</button>' : ''}</section>`;
}
function viewSupport() {
  return heading('Ajuda e suporte', 'Encontre respostas e saiba como falar com a equipe.') + `<div class="cards"><section class="card"><span class="card-icon">${icon('help')}</span><h2>Fale conosco</h2><p>O canal disponível é o e-mail do projeto. Ao escrever, não envie senhas nem códigos.</p><a href="mailto:escolamentoria@outlook.com.br?subject=Suporte%20Mentor%20IA">Enviar e-mail →</a></section><section class="card"><span class="card-icon">${icon('star')}</span><h2>Sua opinião importa</h2><p>Avalie sua experiência e gerencie seu comentário.</p><a href="#review">Avaliar o sistema →</a></section><section class="card"><span class="card-icon">${icon('book')}</span><h2>Seus direitos e dados</h2><p>Consulte os documentos da versão acadêmica ou exporte seus dados.</p><a href="#legal">Privacidade e termos →</a></section></div><section class="card faq">${cardHead('Perguntas frequentes', 'Respostas para os primeiros passos.', 'help')}${[['Não recebi meu código. O que faço?', config.localMailbox ? 'Este ambiente usa uma caixa local de testes. Abra “Caixa de e-mails de teste” abaixo. Nenhum e-mail externo é enviado.' : 'Verifique spam e a caixa de entrada. O código dura 10 minutos. Volte ao início do fluxo e solicite um novo código se necessário.'], ['Posso trocar meu e-mail ou CPF?', 'O e-mail é a identificação principal e não pode ser alterado pela tela de perfil. CPF não é coletado nesta versão. Para questões de identificação, fale com o suporte.'], ['As notificações já chegam por WhatsApp?', 'Não. Os canais implementados são aplicação e e-mail. O envio externo de e-mail depende de configuração do serviço de entrega.'], ['Por que preciso confirmar o acesso?', 'A segunda etapa confirma o controle do e-mail associado à conta. Não compartilhe esse código com ninguém.'], ['Já posso estudar com a IA?', 'O módulo pedagógico ainda não está implementado. Esta versão cobre acesso, perfil e configurações do sistema.']].map(([q, a]) => `<details><summary>${q}</summary><p>${esc(a)}</p></details>`).join('')}</section><section class="card">${cardHead('Sobre o sistema', 'Informações desta distribuição.', 'book')}<p><strong>Mentor IA · versão 0.2.0</strong><br>Aplicação Web acadêmica · distribuição de código-fonte para avaliação · sem aplicativo móvel nativo.</p><p>Desenvolvimento: Filipe Silva Avena e Lucas Araujo de Andrade.<br>Pesquisa e documentação: Victor Fernandes de Vasconcelos.<br>Design e experiência: Bruno Nascimento Rocha.</p><p>Responsável pelo produto: equipe acadêmica Mentor IA. Fabricante comercial e operador público ainda não definidos.</p></section>${devTools()}`;
}
function viewReview(review) {
  return heading('Avalie sua experiência', 'Seu comentário ajuda a equipe a entender o que pode melhorar.') + `<section class="card">${cardHead('Como está sendo usar o Mentor IA?', 'Sua avaliação fica vinculada à conta e visível à equipe que administra a base.', 'star')}<form data-form="review"><fieldset class="star-options"><legend>Escolha de uma a cinco estrelas</legend>${[1,2,3,4,5].map(n => `<label><input type="radio" name="stars" value="${n}" ${review?.stars === n ? 'checked' : ''} required><span class="star-symbol" aria-hidden="true">★</span> ${n}<span class="sr"> ${n === 1 ? 'estrela' : 'estrelas'}</span></label>`).join('')}</fieldset>${field('comment', 'Seu comentário (opcional)', review?.comment || '', { textarea: true, max: 1000, hint: 'Até 1.000 caracteres. Não inclua senhas, documentos ou dados de outras pessoas.' })}${errorBox()}<div class="save-row"><small>${review ? 'Você já avaliou. Salve para atualizar sua avaliação.' : 'Você pode editar ou excluir depois.'}</small><button class="btn" type="submit">${review ? 'Atualizar avaliação' : 'Salvar avaliação'}</button></div></form>${review ? '<button class="text-button" type="button" data-action="delete-review">Excluir minha avaliação</button>' : ''}</section>`;
}
function viewLegal() {
  return heading('Privacidade e termos', 'Entenda os dados utilizados nesta versão e como gerenciá-los.') + `<section class="card"><div class="notice warn"><strong>Documentos da versão acadêmica.</strong> A disponibilização pública exige revisão dos responsáveis, das bases legais, dos fornecedores e do atendimento a menores. Estes documentos não certificam conformidade legal.</div><a class="section-link" href="#privacy">Política de Privacidade →</a><a class="section-link" href="#terms">Termos de Uso →</a><a class="section-link" href="/api/export" download>Baixar meus dados em JSON ↓</a><a class="section-link" href="mailto:escolamentoria@outlook.com.br?subject=Privacidade%20Mentor%20IA">Solicitar orientação sobre meus dados →</a><p class="small muted">Identificação do controlador formal, endereço, encarregado, bases legais por finalidade e prazos de backups devem ser definidos antes de uso público.</p></section>`;
}
function legalDocument(route) {
  const privacy = route === 'privacy';
  const content = privacy ? `
    <h1>Política de Privacidade</h1><p class="muted">Versão acadêmica · 19/10/2026 · v2026-10-19-academica</p>
    <div class="notice warn">Documento inicial para avaliação com dados fictícios. Não é uma declaração de adequação integral à LGPD. O controlador formal e as condições de operação pública ainda precisam ser definidos.</div>
    <h2>1. Quem somos e contato</h2><p>Mentor IA é um projeto acadêmico de plataforma educacional. A equipe é formada por Filipe Silva Avena, Lucas Araujo de Andrade, Victor Fernandes de Vasconcelos e Bruno Nascimento Rocha. Contato do projeto: <a href="mailto:escolamentoria@outlook.com.br">escolamentoria@outlook.com.br</a>. A instituição controladora, endereço e eventual encarregado devem ser identificados antes de disponibilizar o serviço ao público.</p>
    <h2>2. Dados e finalidades</h2><ul><li>Nome e e-mail: identificar a conta, confirmar acesso e prestar suporte.</li><li>Senha: processada no servidor para gerar um hash scrypt com salt; a senha original não é armazenada.</li><li>Escola, etapa, biografia e foto: opcionais, para personalizar o perfil. CPF não é solicitado.</li><li>Preferências de canal, frequência, tema e fonte: personalizar a aplicação e enviar avisos de conta.</li><li>Estrelas e comentário: registrar sua avaliação e permitir sua edição ou exclusão.</li><li>Sessão e códigos: autenticar solicitações. Endereço IP é utilizado temporariamente em memória para limitar tentativas.</li><li>Google, quando configurado: identificador do provedor, nome e e-mail verificado para autenticação.</li></ul>
    <h2>3. Armazenamento e proteção</h2><p>Os dados ficam no banco SQLite do servidor que executa a aplicação, separado do navegador. A foto é armazenada na mesma base. A sessão usa cookie HttpOnly, com Secure em produção; códigos são armazenados como hashes, duram 10 minutos e têm limite de tentativas. A comunicação pública deve usar HTTPS. Não há publicidade ou analytics incorporados neste módulo.</p><p>No desenvolvimento, e-mails são simulados em uma caixa local em memória e podem ser consultados por quem utiliza esse servidor local. Por isso, utilize dados fictícios. Não use esse modo com dados reais.</p>
    <h2>4. Compartilhamento e fornecedores</h2><p>Quando configurado, o Resend recebe endereço de e-mail e conteúdo das mensagens para entrega. O Google recebe as informações inerentes ao seu fluxo de autenticação se você optar por esse acesso. A localização do servidor, os contratos dos fornecedores e eventual transferência internacional devem ser documentados pelo operador antes do uso público. Nenhuma credencial do fornecedor é enviada ao navegador.</p>
    <h2>5. Retenção e exclusão</h2><p>Perfis ficam na base ativa até a exclusão da conta. Cadastros não confirmados são removidos após 24 horas. Sessões expiram em 24 horas e códigos em 10 minutos. Notificações internas são removidas após 30 dias. A caixa local é volátil e limitada a 50 mensagens. A exclusão remove os registros associados da base ativa; arquivos de backups e cópias nos provedores exigem uma política própria de retenção e descarte. Não existe garantia de eliminação física de todas as cópias nesta versão.</p>
    <h2>6. Controle e direitos</h2><p>Você pode visualizar e corrigir os dados editáveis, retirar sua foto, escolher notificações, exportar dados e excluir a conta com confirmação por código. Para demais solicitações, como informações de tratamento ou correção de identificadores, contate a equipe. A confirmação de identidade será necessária, sem solicitar sua senha.</p>
    <h2>7. Crianças e adolescentes</h2><p>O público pretendido do projeto inclui estudantes do ensino médio. Esta versão é restrita à avaliação acadêmica com dados fictícios. Antes de atender menores com dados reais, a equipe deverá avaliar o melhor interesse, a hipótese legal aplicável, mecanismos de participação dos responsáveis quando cabíveis e as normas vigentes. Uma caixa de aceite não resolve essas obrigações.</p>
    <h2>8. Cookies e dispositivo</h2><p>Usamos cookies essenciais para sessão e autenticação Google, quando ativada. O navegador guarda apenas preferência de aparência/fonte e o identificador temporário do desafio; senhas e códigos não são persistidos pela aplicação no navegador. As preferências locais podem ser removidas nas configurações do navegador.</p>
    <h2>9. Antes do uso público</h2><p>É necessário definir o controlador, bases legais por finalidade, retenção de backups, resposta a incidentes, fornecedores, atendimento aos titulares e regras para estudantes menores de idade. Consulte a <a href="https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm" target="_blank" rel="noopener">LGPD</a> e as <a href="https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-divulga-enunciado-sobre-o-tratamento-de-dados-pessoais-de-criancas-e-adolescentes" target="_blank" rel="noopener">orientações da ANPD</a>.</p>
  ` : `<h1>Termos de Uso</h1><p class="muted">Versão acadêmica · 19/10/2026 · v2026-10-19-academica</p><div class="notice warn">Condições iniciais de uso para avaliação acadêmica. Utilize dados fictícios. As condições comerciais e jurídicas para disponibilização pública ainda não foram definidas.</div><h2>1. Objetivo e recursos</h2><p>Esta versão do Mentor IA disponibiliza acesso, perfil, configurações, notificações de conta e suporte. O mentor educacional com IA, o acompanhamento de estudos e o painel do professor ainda não estão disponíveis. Não há cobrança, assinatura ou garantia de disponibilidade.</p><h2>2. Conta e acesso</h2><p>Use um e-mail de teste sob seu controle no modo de envio real. Nunca compartilhe senhas ou códigos. O acesso depende da confirmação de cadastro e de uma segunda etapa por e-mail. A entrada com Google depende da configuração do provedor e também passa por confirmação de e-mail. Dados de identificação principal não são alterados pela tela de perfil.</p><h2>3. Uso responsável</h2><p>Não inclua documentos, dados sensíveis ou informações de terceiros nas fotos, biografias e avaliações. Não tente acessar contas alheias, contornar limitações ou prejudicar o serviço. Os comentários ficam vinculados à sua conta e podem ser editados ou excluídos por você.</p><h2>4. Comunicações e acessibilidade</h2><p>Você escolhe canal e frequência dos avisos opcionais. Códigos de segurança permanecem imediatos por e-mail. Tema e tamanho de texto podem ser ajustados a qualquer momento.</p><h2>5. Encerramento e dados</h2><p>Você pode exportar os dados e excluir a conta com confirmação por código. A exclusão da base ativa é irreversível e encerra todas as sessões. O tratamento de cópias e backups deve seguir a política do operador. Consulte a <a href="#privacy">Política de Privacidade</a>.</p><h2>6. Atendimento e responsabilidade</h2><p>O serviço é fornecido para avaliação acadêmica, sem promessa de resultados pedagógicos. Falhas podem ser comunicadas a <a href="mailto:escolamentoria@outlook.com.br">escolamentoria@outlook.com.br</a>. Os direitos legalmente assegurados não são afastados por estes termos.</p><h2>7. Operação pública e menores</h2><p>O operador formal, regras para uso por menores, condições de suporte, fornecedores e revisão jurídica devem ser estabelecidos antes de receber usuários reais. Alterações relevantes nos documentos deverão ser apresentadas ao usuário.</p>`;
  const inner = `<article class="card legal">${content}<div class="inline-links"><a href="#${privacy ? 'terms' : 'privacy'}">${privacy ? 'Consultar Termos de Uso' : 'Consultar Política de Privacidade'}</a><a href="#${user ? 'legal' : 'login'}">← Voltar</a></div></article>`;
  return user ? shell('legal', inner) : `<main id="main" class="public-legal" tabindex="-1">${brand}${inner}</main>`;
}
async function render() {
  const id = ++renderId;
  const [routeRaw, search] = location.hash.slice(1).split('?');
  let route = routeRaw || (user ? 'home' : 'login');
  const query = new URLSearchParams(search || '');
  if (route === 'google-confirm' && query.has('challenge')) {
    setPending({ purpose: 'login', challenge: query.get('challenge'), consent: query.get('consent') === '1' });
    history.replaceState(null, '', '#confirm'); route = 'confirm';
  }
  if (['privacy', 'terms'].includes(route)) { app.innerHTML = legalDocument(route); document.title = `${route === 'privacy' ? 'Privacidade' : 'Termos de Uso'} | Mentor IA`; return; }
  if (!user) { app.innerHTML = authView(route, query); document.title = 'Acesso | Mentor IA'; return; }
  if (!titles[route]) { route = 'home'; history.replaceState(null, '', '#home'); }
  let content;
  try {
    if (route === 'home') content = viewHome((await api('notices')).notices);
    else if (route === 'review') content = viewReview((await api('review')).review);
    else if (window.MentorEstudos?.routes.includes(route)) content = await window.MentorEstudos.view(route, query); // Fase 3
    else content = ({ profile: viewProfile, notifications: viewNotifications, security: viewSecurity, accessibility: viewAccessibility, support: viewSupport, legal: viewLegal })[route]();
    if (id !== renderId) return;
    app.innerHTML = shell(route, content);
    document.title = `${titles[route]} | Mentor IA`;
  } catch (err) {
    if (id !== renderId) return;
    if (err.status === 401) { user = null; setPending(null); history.replaceState(null, '', '#login'); app.innerHTML = authView('login', new URLSearchParams()); toast('Sua sessão expirou. Entre novamente.'); }
    else app.innerHTML = shell(route, `<section class="card"><h1>Não foi possível carregar</h1><p>${esc(err.message)}</p><button class="btn" type="button" data-action="reload">Tentar novamente</button></section>`);
  }
}
function navigate(hash) { if (location.hash === '#' + hash) return render(); location.hash = hash; }
function values(form) { return Object.fromEntries(new FormData(form)); }
function checkPasswords(data) {
  if (data.password !== data.confirm) throw new Error('As senhas não coincidem.');
  if (data.password.length < 12 || data.password.length > 128 || !/[a-z]/.test(data.password) || !/[A-Z]/.test(data.password) || !/\d/.test(data.password) || !/[^A-Za-z0-9\s]/.test(data.password)) throw new Error(policy);
}
document.addEventListener('submit', async event => {
  const form = event.target.closest('form[data-form]'); if (!form) return;
  event.preventDefault();
  if (form.dataset.busy) return;
  const box = form.querySelector('.form-error'); box.hidden = true;
  const button = form.querySelector('[type=submit]'), label = button.textContent;
  button.disabled = true; button.textContent = 'Aguarde…'; form.dataset.busy = 'true';
  const d = values(form), kind = form.dataset.form;
  try {
    let result;
    if (kind === 'register') {
      checkPasswords(d); result = await api('register', { name: d.name, email: d.email, password: d.password, accept: d.accept === 'on' });
      setPending({ purpose: 'verify', challenge: result.challenge, message: result.message }); form.reset(); navigate('confirm');
    } else if (kind === 'login') {
      result = await api('login', { email: d.email, password: d.password });
      setPending({ purpose: result.purpose, challenge: result.challenge, message: result.message }); form.reset(); navigate('confirm');
    } else if (kind === 'recover') {
      result = await api('recover', { email: d.email }); setPending({ purpose: 'reset', challenge: result.challenge, message: result.message }); navigate('reset');
    } else if (kind === 'confirm') {
      result = await api('verify', { ...pending, code: d.code, accept: d.accept === 'on' });
      user = result.user; setPending(null); preferences(user.prefs); form.reset(); navigate('home');
    } else if (kind === 'reset') {
      checkPasswords(d); result = await api('reset', { ...pending, code: d.code, password: d.password }); setPending(null); form.reset(); navigate('login'); toast(result.message);
    } else if (kind === 'profile') {
      result = await api('profile', { name: d.name, school: d.school, grade: d.grade, bio: d.bio }); user = result.user; await render(); toast(result.message);
    } else if (kind === 'avatar') {
      const file = form.elements.photo.files[0];
      if (!file || !['image/jpeg', 'image/png'].includes(file.type) || file.size > 512000) throw new Error('Escolha PNG ou JPEG de até 500 KB.');
      const avatar = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Não foi possível ler a foto.')); reader.readAsDataURL(file); });
      result = await api('avatar', { avatar }); user = result.user; await render(); toast(result.message);
    } else if (kind === 'preferences') {
      const prefs = { ...user.prefs, ...d }; prefs.font = Number(prefs.font);
      result = await api('preferences', prefs); user = result.user; preferences(user.prefs); toast(result.message);
    } else if (kind === 'request-password' || kind === 'request-delete') {
      const purpose = kind === 'request-password' ? 'password' : 'delete';
      result = await api('security/request', { purpose, password: d.password || d.currentDelete }); setPending({ purpose, challenge: result.challenge }); form.reset(); await render(); toast(result.message);
    } else if (kind === 'change-password') {
      checkPasswords(d); result = await api('security/password', { challenge: pending.challenge, code: d.code, password: d.password }); user = result.user; setPending(null); form.reset(); await render(); toast(result.message);
    } else if (kind === 'delete-account') {
      result = await api('security/delete', { challenge: pending.challenge, code: d.code, confirm: d.confirm }); user = null; setPending(null); form.reset(); navigate('login'); toast(result.message);
    } else if (kind === 'review') {
      result = await api('review', { stars: Number(d.stars), comment: d.comment }); await render(); toast(result.message);
    }
  } catch (err) {
    box.textContent = err.message; box.hidden = false; box.focus();
    if (err.status === 401 && user && !['request-password', 'request-delete'].includes(kind)) { user = null; setPending(null); navigate('login'); toast(err.message); }
  } finally { button.disabled = false; button.textContent = label; delete form.dataset.busy; }
});
document.addEventListener('click', async event => {
  if (event.target.closest('.skip')) { event.preventDefault(); document.querySelector('#main')?.focus(); return; }
  const target = event.target.closest('[data-action]'); if (!target) return;
  const action = target.dataset.action;
  try {
    if (action === 'password') { const input = document.getElementById(target.dataset.target); input.type = input.type === 'password' ? 'text' : 'password'; target.setAttribute('aria-pressed', String(input.type === 'text')); target.setAttribute('aria-label', input.type === 'text' ? 'Ocultar senha' : 'Mostrar senha'); }
    if (action === 'menu' || action === 'menu-close') {
      const sidebar = document.querySelector('#sidebar'), toggle = document.querySelector('[data-action=menu]');
      const open = action === 'menu' && !sidebar.classList.contains('open'); sidebar.classList.toggle('open', open); toggle.setAttribute('aria-expanded', String(open));
      if (open) sidebar.querySelector('[data-action=menu-close]').focus(); else toggle.focus();
    }
    if (action === 'logout') { await api('logout', {}); user = null; setPending(null); navigate('login'); toast('Você saiu da conta.'); }
    if (action === 'resend') { target.disabled = true; const result = await api('resend', { challenge: pending.challenge, purpose: pending.purpose }); setPending({ ...pending, challenge: result.challenge }); toast(result.message); }
    if (action === 'remove-avatar') { const result = await api('avatar', { avatar: '' }); user = result.user; await render(); toast(result.message); }
    if (action === 'delete-review') { const result = await api('review/delete', {}); await render(); toast(result.message); }
    if (action === 'clear-notices') { const result = await api('notices/clear', {}); await render(); toast(result.message); }
    if (action === 'reload') await render();
    if (action === 'cancel-security') { setPending(null); await render(); }
    if (action === 'mail') {
      const result = await api('dev/mail');
      document.querySelector('#mailbox').innerHTML = result.messages.length ? result.messages.map(m => `<article class="mail"><strong>${esc(m.subject)}</strong><div>${esc(m.to)} · ${new Date(m.created).toLocaleTimeString('pt-BR')}</div><pre>${esc(m.message)}</pre></article>`).join('') : '<p>Nenhum e-mail de teste nesta execução.</p>';
    }
  } catch (err) { toast(err.message); }
  finally { if (action === 'resend') target.disabled = false; }
});
document.addEventListener('change', event => {
  if (!event.target.matches('[data-preview]')) return;
  const d = values(event.target.form); preferences({ ...user.prefs, theme: d.theme || user.prefs.theme, font: Number(d.font || user.prefs.font) });
});
document.addEventListener('keydown', event => {
  const sidebar = document.querySelector('#sidebar.open');
  if (!sidebar) return;
  if (event.key === 'Escape') { sidebar.classList.remove('open'); const toggle = document.querySelector('[data-action=menu]'); toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); }
  if (event.key === 'Tab') {
    const items = [...sidebar.querySelectorAll('a,button')].filter(x => x.offsetParent !== null);
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
window.addEventListener('hashchange', async () => { await render(); document.querySelector('#main')?.focus(); window.scrollTo(0, 0); });
(async () => {
  try {
    config = await api('config'); available = true;
    try { user = (await api('me')).user; preferences(user.prefs); } catch (err) { if (err.status !== 401) throw err; }
  } catch { config = { google: false, development: false, localMailbox: false }; available = false; }
  await render();
})();
