'use strict';
// Fase 3 — gráficos SVG sem bibliotecas externas (a CSP só permite scripts locais).
// A view devolve um marcador; o gráfico é desenhado na largura real do contêiner e redesenhado ao redimensionar.
window.MentorGraficos = (() => {
  const specs = new Map(); let sequencia = 0;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]));
  const n = v => Math.round(v * 10) / 10;
  const horas = m => { m = Math.round(m); const h = Math.floor(m / 60), r = m % 60; return h ? `${h}h${r ? String(r).padStart(2, '0') : ''}` : `${r} min`; };
  const decimal = v => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

  function marcador(tipo, dados, opcoes) {
    const id = 'g' + (++sequencia);
    specs.set(id, { tipo, dados, opcoes });
    if (specs.size > 40) specs.delete(specs.keys().next().value);
    return `<div class="grafico grafico-${tipo}" data-grafico="${id}" role="img" aria-label="${esc(opcoes.descricao)}"></div>`;
  }
  function escala(max, passos) {
    const bruto = max / 4, mag = Math.pow(10, Math.floor(Math.log10(bruto || 1)));
    const passo = passos.map(p => p * mag).find(p => p >= bruto) || 10 * mag;
    return { passo, topo: Math.max(passo, Math.ceil(max / passo) * passo) };
  }
  const barraArredondada = (x, y, w, h, r = 4) => w <= r ? `M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}Z` : `M${n(x)} ${n(y)}H${n(x + w - r)}Q${n(x + w)} ${n(y)} ${n(x + w)} ${n(y + r)}V${n(y + h - r)}Q${n(x + w)} ${n(y + h)} ${n(x + w - r)} ${n(y + h)}H${n(x)}Z`;
  const colunaArredondada = (x, y, w, h, r = 4) => h <= r ? `M${n(x)} ${n(y + h)}v${n(-h)}h${n(w)}v${n(h)}Z` : `M${n(x)} ${n(y + h)}V${n(y + r)}Q${n(x)} ${n(y)} ${n(x + r)} ${n(y)}H${n(x + w - r)}Q${n(x + w)} ${n(y)} ${n(x + w)} ${n(y + r)}V${n(y + h)}Z`;
  const vazio = (w, h, texto) => `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><text class="g-vazio" x="${w / 2}" y="${h / 2}" text-anchor="middle">${esc(texto)}</text></svg>`;

  // Linha: tempo por dia/semana (uma série; mira vertical acompanha o ponteiro).
  function linha(w, pontos, o) {
    const h = 240, m = { t: 22, r: 18, b: 30, l: 50 }, iw = w - m.l - m.r, ih = h - m.t - m.b;
    if (!pontos.some(p => p.valor > 0)) return vazio(w, h, o.vazio);
    const { passo, topo } = escala(Math.max(...pontos.map(p => p.valor / 60)), [0.25, 0.5, 1, 2, 2.5, 5]);
    const x = i => m.l + (pontos.length === 1 ? iw / 2 : i * iw / (pontos.length - 1)), y = v => m.t + ih - v / 60 / topo * ih;
    let s = '';
    for (let t = 0; t <= topo + 1e-9; t += passo) s += `<line class="g-grade" x1="${m.l}" x2="${w - m.r}" y1="${n(y(t * 60))}" y2="${n(y(t * 60))}"/><text class="g-eixo-texto" x="${m.l - 8}" y="${n(y(t * 60)) + 4}" text-anchor="end">${decimal(t)} h</text>`;
    const cada = Math.ceil(pontos.length / Math.max(2, Math.floor(iw / 64)));
    // Rótulos espaçados; o último entra quando não colide com o anterior.
    pontos.forEach((p, i) => { if (i % cada === 0 || (i === pontos.length - 1 && i % cada >= cada / 2)) s +=`<text class="g-eixo-texto" x="${n(x(i))}" y="${h - 9}" text-anchor="middle">${esc(p.rotulo)}</text>`; });
    const caminho = pontos.map((p, i) => `${i ? 'L' : 'M'}${n(x(i))} ${n(y(p.valor))}`).join('');
    s += `<path class="g-area" d="${caminho}L${n(x(pontos.length - 1))} ${m.t + ih}L${n(x(0))} ${m.t + ih}Z"/><line class="g-base" x1="${m.l}" x2="${w - m.r}" y1="${m.t + ih}" y2="${m.t + ih}"/><path class="g-linha" d="${caminho}"/>`;
    const ultimo = pontos.length - 1, maior = pontos.reduce((a, p, i) => p.valor > pontos[a].valor ? i : a, 0);
    for (const i of new Set([maior, ultimo])) s += `<circle class="g-ponto" cx="${n(x(i))}" cy="${n(y(pontos[i].valor))}" r="4"/><text class="g-rotulo" x="${n(Math.min(x(i), w - m.r - 4))}" y="${n(y(pontos[i].valor)) - 10}" text-anchor="${x(i) > w - 60 ? 'end' : 'middle'}">${horas(pontos[i].valor)}</text>`;
    s += '<line class="g-mira" visibility="hidden"/><circle class="g-mira-ponto" r="5" visibility="hidden"/>';
    const passoX = pontos.length > 1 ? iw / (pontos.length - 1) : iw;
    pontos.forEach((p, i) => s += `<rect class="g-alvo" x="${n(Math.max(m.l, x(i) - passoX / 2))}" y="${m.t}" width="${n(Math.min(passoX, iw))}" height="${ih}" data-dica="${esc(horas(p.valor))}|${esc(p.dica)}" data-mira-x="${n(x(i))}" data-mira-y="${n(y(p.valor))}" data-mira-topo="${m.t}" data-mira-base="${m.t + ih}"/>`);
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${s}</svg>`;
  }

  // Barras horizontais: tempo por disciplina, com marcador da meta do período.
  function barras(w, itens, o) {
    if (!itens.length) return vazio(w, 120, o.vazio);
    const linhaH = 38, barra = 18, rotuloW = Math.min(150, Math.max(90, w * 0.3)), valorW = 104, iw = Math.max(40, w - rotuloW - valorW - 8);
    const h = itens.length * linhaH + 34;
    const max = Math.max(1, ...itens.map(i => Math.max(i.valor, i.meta || 0)));
    const x = v => rotuloW + v / max * iw, caber = Math.floor((rotuloW - 12) / 7);
    let s = `<line class="g-base" x1="${rotuloW}" x2="${rotuloW}" y1="4" y2="${itens.length * linhaH + 2}"/>`;
    itens.forEach((it, k) => {
      const y = 6 + k * linhaH + (linhaH - barra) / 2 - 3, largura = Math.max(it.valor ? 2 : 0, x(it.valor) - rotuloW);
      const nome = it.rotulo.length > caber ? it.rotulo.slice(0, caber - 1) + '…' : it.rotulo;
      s += `<a href="${esc(it.href)}" class="g-item" data-dica="${esc(it.dica)}" aria-label="${esc(it.rotulo + ': ' + it.dica.replace('|', ' · '))}">`;
      s += `<rect class="g-alvo" x="0" y="${n(y - 8)}" width="${w}" height="${barra + 16}"/>`;
      s += `<text class="g-eixo-texto g-rotulo-barra" x="${rotuloW - 10}" y="${n(y + barra / 2 + 4)}" text-anchor="end">${esc(nome)}</text>`;
      if (largura) s += `<path class="c${it.cor} g-marca" d="${barraArredondada(rotuloW, y, largura, barra)}"/>`;
      if (it.meta) s += `<line class="g-meta" x1="${n(x(it.meta))}" x2="${n(x(it.meta))}" y1="${n(y - 4)}" y2="${n(y + barra + 4)}"/>`;
      s += `<text class="g-rotulo" x="${n(Math.max(x(it.valor), it.meta ? x(it.meta) : 0) + 8)}" y="${n(y + barra / 2 + 4)}">${esc(it.valorTexto)}</text></a>`;
    });
    const ly = itens.length * linhaH + 22;
    s += `<rect class="g-legenda-barra" x="${rotuloW}" y="${ly - 9}" width="14" height="10" rx="2"/><text class="g-eixo-texto" x="${rotuloW + 20}" y="${ly}">tempo estudado</text><line class="g-meta" x1="${rotuloW + 136}" x2="${rotuloW + 136}" y1="${ly - 11}" y2="${ly + 2}"/><text class="g-eixo-texto" x="${rotuloW + 144}" y="${ly}">meta do período</text>`;
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${s}</svg>`;
  }

  // Colunas: contagem por categoria (uma série, uma cor).
  function colunas(w, itens, o) {
    const h = 230, m = { t: 26, r: 12, b: 34, l: 40 }, iw = w - m.l - m.r, ih = h - m.t - m.b;
    if (!itens.some(i => i.valor > 0)) return vazio(w, h, o.vazio);
    const { passo, topo } = escala(Math.max(...itens.map(i => i.valor)), [1, 2, 5]);
    const passoInteiro = Math.max(1, Math.round(passo)), topoInteiro = Math.max(passoInteiro, Math.ceil(topo / passoInteiro) * passoInteiro);
    const y = v => m.t + ih - v / topoInteiro * ih, faixa = iw / itens.length, cw = Math.min(24, faixa * 0.6);
    let s = '';
    for (let t = 0; t <= topoInteiro; t += passoInteiro) s += `<line class="g-grade" x1="${m.l}" x2="${w - m.r}" y1="${n(y(t))}" y2="${n(y(t))}"/><text class="g-eixo-texto" x="${m.l - 8}" y="${n(y(t)) + 4}" text-anchor="end">${t}</text>`;
    s += `<line class="g-base" x1="${m.l}" x2="${w - m.r}" y1="${m.t + ih}" y2="${m.t + ih}"/>`;
    itens.forEach((it, i) => {
      const cx = m.l + faixa * i + faixa / 2;
      s += `<g class="g-item" tabindex="0" data-dica="${esc(it.valor)}|${esc(it.rotulo)}" aria-label="${esc(it.rotulo + ': ' + it.valor)}"><rect class="g-alvo" x="${n(cx - faixa / 2)}" y="${m.t}" width="${n(faixa)}" height="${ih}"/>`;
      if (it.valor) s += `<path class="g-coluna g-marca" d="${colunaArredondada(cx - cw / 2, y(it.valor), cw, m.t + ih - y(it.valor))}"/>`;
      s += `<text class="g-rotulo" x="${n(cx)}" y="${n(y(it.valor)) - 8}" text-anchor="middle">${it.valor}</text><text class="g-eixo-texto" x="${n(cx)}" y="${h - 12}" text-anchor="middle">${esc(it.rotulo)}</text></g>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${s}</svg>`;
  }

  // Rosca: partes de um todo (até três categorias), legenda sempre visível com valor e percentual.
  function rosca(w, itens, o) {
    const total = itens.reduce((s, i) => s + i.valor, 0);
    if (!total) return vazio(w, 200, o.vazio);
    const lado = w >= 380, d = Math.min(176, lado ? w * 0.46 : w - 40), r1 = d / 2, r0 = r1 * 0.64;
    const cx = lado ? r1 + 8 : w / 2, cy = r1 + 8, h = lado ? d + 16 : d + 24 + itens.length * 26;
    const ponto = (r, a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
    const arco = (a0, a1) => {
      const g = a1 - a0 > Math.PI ? 1 : 0, [x0, y0] = ponto(r1, a0), [x1, y1] = ponto(r1, a1), [x2, y2] = ponto(r0, a1), [x3, y3] = ponto(r0, a0);
      return `M${n(x0)} ${n(y0)}A${n(r1)} ${n(r1)} 0 ${g} 1 ${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}A${n(r0)} ${n(r0)} 0 ${g} 0 ${n(x3)} ${n(y3)}Z`;
    };
    const visiveis = itens.filter(i => i.valor), folga = visiveis.length > 1 ? 2 / r1 : 0;
    let a = 0, s = '';
    for (const it of itens) {
      if (!it.valor) continue;
      const fatia = it.valor / total * Math.PI * 2, pct = Math.round(it.valor / total * 100);
      const d = fatia >= Math.PI * 2 - 1e-6 ? arco(0, Math.PI) + arco(Math.PI, Math.PI * 2) : arco(a + folga / 2, a + fatia - folga / 2);
      s += `<path class="${it.cor} g-marca" tabindex="0" d="${d}" data-dica="${esc(it.valor)} (${pct}%)|${esc(it.rotulo)}" aria-label="${esc(`${it.rotulo}: ${it.valor} (${pct}%)`)}"/>`;
      a += fatia;
    }
    s += `<text class="g-centro" x="${n(cx)}" y="${n(cy + 4)}" text-anchor="middle">${total}</text><text class="g-eixo-texto" x="${n(cx)}" y="${n(cy + 22)}" text-anchor="middle">${esc(o.unidade)}</text>`;
    itens.forEach((it, i) => {
      const lx = lado ? d + 36 : 20, ly = lado ? cy - itens.length * 14 + i * 28 + 8 : d + 32 + i * 26, pct = Math.round(it.valor / total * 100);
      s += `<rect class="${it.cor}" x="${lx}" y="${ly - 9}" width="12" height="12" rx="3"/><text class="g-legenda" x="${lx + 20}" y="${ly + 1}">${esc(it.rotulo)}</text><text class="g-rotulo" x="${w - 8}" y="${ly + 1}" text-anchor="end">${it.valor} · ${pct}%</text>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${s}</svg>`;
  }

  const tipos = { linha, barras, colunas, rosca };
  function desenhar(el) {
    const spec = specs.get(el.dataset.grafico);
    if (!spec) return;
    const largura = Math.max(240, Math.floor(el.clientWidth));
    if (Number(el.dataset.largura) === largura) return;
    el.dataset.largura = String(largura);
    el.innerHTML = tipos[spec.tipo](largura, spec.dados, spec.opcoes);
  }
  const observador = new ResizeObserver(entradas => { for (const e of entradas) desenhar(e.target); });
  new MutationObserver(() => {
    for (const el of document.querySelectorAll('[data-grafico]:not([data-observado])')) { el.dataset.observado = '1'; desenhar(el); observador.observe(el); }
  }).observe(document.body, { childList: true, subtree: true });

  // Dica única: valor em destaque, rótulo depois. Texto inserido com textContent.
  const dica = document.createElement('div');
  dica.className = 'g-dica'; dica.setAttribute('role', 'tooltip'); dica.hidden = true;
  document.body.append(dica);
  function mostrar(alvo, x, y) {
    const [valor, rotulo] = alvo.dataset.dica.split('|');
    dica.replaceChildren(Object.assign(document.createElement('strong'), { textContent: valor }), Object.assign(document.createElement('span'), { textContent: rotulo || '' }));
    dica.hidden = false;
    const r = dica.getBoundingClientRect();
    dica.style.left = Math.min(window.innerWidth - r.width - 8, x + 14) + 'px';
    dica.style.top = Math.max(8, y - r.height - 12) + 'px';
    const svg = alvo.closest('svg'), mira = svg?.querySelector('.g-mira');
    if (mira && alvo.dataset.miraX) {
      mira.setAttribute('x1', alvo.dataset.miraX); mira.setAttribute('x2', alvo.dataset.miraX);
      mira.setAttribute('y1', alvo.dataset.miraTopo); mira.setAttribute('y2', alvo.dataset.miraBase); mira.setAttribute('visibility', 'visible');
      const p = svg.querySelector('.g-mira-ponto'); p.setAttribute('cx', alvo.dataset.miraX); p.setAttribute('cy', alvo.dataset.miraY); p.setAttribute('visibility', 'visible');
    }
  }
  function esconder(alvo) {
    dica.hidden = true;
    alvo?.closest('svg')?.querySelectorAll('.g-mira, .g-mira-ponto').forEach(x => x.setAttribute('visibility', 'hidden'));
  }
  document.addEventListener('pointermove', e => {
    const alvo = e.target.closest?.('.grafico [data-dica]');
    if (alvo) mostrar(alvo, e.clientX, e.clientY); else if (!dica.hidden) esconder(document.querySelector('.g-mira[visibility=visible]'));
  });
  document.addEventListener('focusin', e => {
    const alvo = e.target.closest?.('.grafico [data-dica]');
    if (alvo) { const r = alvo.getBoundingClientRect(); mostrar(alvo, r.left + r.width / 2, r.top); }
  });
  document.addEventListener('focusout', e => { if (e.target.closest?.('.grafico [data-dica]')) esconder(e.target); });
  window.addEventListener('scroll', () => { if (!dica.hidden) esconder(document.querySelector('.g-mira[visibility=visible]')); }, { passive: true });

  return { marcador, horas };
})();
