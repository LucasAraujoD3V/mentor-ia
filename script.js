// ===== Menu móvel (abre/fecha, Escape, fecha ao clicar num link) =====
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
  if (e.key === 'Escape' && menu.classList.contains('open')) {
    setMenu(false);
    menuBtn.focus();
  }
});

// ===== Animação ao rolar =====
const reveals = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { threshold: 0.12 });
  reveals.forEach(el => io.observe(el));
} else {
  reveals.forEach(el => el.classList.add('in'));
}

// ===== Demonstração em 4 etapas (simulação pré-programada) =====
const tabs = document.querySelectorAll('.steps button');
const panels = document.querySelectorAll('.panel');
const form = document.getElementById('answer');
const input = document.getElementById('resposta');
const label = document.getElementById('answer-label');
const btn = document.getElementById('answer-btn');
const feedback = document.getElementById('feedback');
const CORRETA = '3'; // 2x + 4 = 10  ->  x = 3
let step = 1;

function goTo(n) {
  step = n;
  tabs.forEach(t => t.setAttribute('aria-selected', String(Number(t.dataset.step) === n)));
  panels.forEach(p => { p.hidden = Number(p.dataset.panel) !== n; });
  input.value = '';
  feedback.className = 'feedback';
  if (n === 4) {
    label.textContent = 'Sua resposta: qual é o valor de x?';
    btn.textContent = 'Verificar';
    feedback.textContent = 'Etapa 4: verificação. Digite sua resposta.';
  } else {
    label.textContent = 'Digite o número da etapa (1 a 4):';
    btn.textContent = 'Ir';
    feedback.textContent = 'Etapa ' + n + ' de 4.';
  }
}

tabs.forEach(t => t.addEventListener('click', () => goTo(Number(t.dataset.step))));

form.addEventListener('submit', e => {
  e.preventDefault();
  const v = input.value.trim().replace(',', '.');
  if (step === 4) {
    if (v === '') { feedback.className = 'feedback err'; feedback.textContent = 'Digite um número antes de verificar.'; return; }
    if (v === CORRETA) {
      feedback.className = 'feedback ok';
      feedback.textContent = 'Correto! x = 3. Você chegou lá pelo próprio raciocínio: 10 − 4 = 6 e 6 ÷ 2 = 3.';
    } else {
      feedback.className = 'feedback err';
      feedback.textContent = 'Ainda não. Refaça: quanto é 10 − 4? Agora divida o resultado por 2.';
    }
    return;
  }
  const n = Number(v);
  if (n >= 1 && n <= 4) {
    goTo(n);
    input.focus();
  } else {
    feedback.className = 'feedback err';
    feedback.textContent = 'Digite um número de 1 a 4.';
  }
});

document.getElementById('reset').addEventListener('click', () => { goTo(1); input.focus(); });
