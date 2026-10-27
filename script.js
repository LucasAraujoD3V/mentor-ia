'use strict';
const menuBtn = document.querySelector('.menu-btn');
const menu = document.getElementById('menu');
function setMenu(open) {
  menu.classList.toggle('open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
}
menuBtn.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && menu.classList.contains('open')) { setMenu(false); menuBtn.focus(); }
});
window.matchMedia('(min-width: 901px)').addEventListener('change', () => setMenu(false));
const form = document.getElementById('answer');
const input = document.getElementById('resposta');
const feedback = document.getElementById('feedback');
form.addEventListener('submit', e => {
  e.preventDefault();
  const raw = input.value.trim().replace(',', '.');
  const numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw);
  const correct = numeric && Number(raw) === 3;
  feedback.className = 'feedback ' + (correct ? 'ok' : 'err');
  feedback.textContent = correct
    ? 'Isso! x = 3. Conferindo na equação: 2 × 3 + 4 = 10.'
    : numeric ? 'Tente mais uma vez: subtraia 4 de 10 e divida o resultado por 2. A pista acima mostra esse caminho.' : 'Digite apenas um número para verificar o exemplo.';
});
form.addEventListener('reset', () => {
  feedback.textContent = '';
  feedback.className = 'feedback';
  document.querySelector('.demo-hint').open = false;
  input.focus();
});
