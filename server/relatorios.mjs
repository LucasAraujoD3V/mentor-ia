// Fase 3 — geração de relatórios sem dependências externas.
// PDF 1.4 (Helvetica, WinAnsi) e XLSX (Office Open XML compactado em ZIP).
import { deflateSync, deflateRawSync, crc32 } from 'node:zlib';

export const dataBR = dia => dia ? String(dia).split('-').reverse().join('/') : '';
export const momentoBR = (t = Date.now()) => new Date(t).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
export function duracao(minutos) {
  const m = Math.round(Number(minutos) || 0), h = Math.floor(m / 60), r = m % 60;
  return h ? `${h}h${r ? String(r).padStart(2, '0') : ''}` : `${r} min`;
}
export function formatar(valor, tipo) {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (tipo === 'data') return dataBR(valor);
  if (tipo === 'duracao') return duracao(valor);
  if (tipo === 'decimal') return Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (tipo === 'numero') return Number(valor).toLocaleString('pt-BR');
  return String(valor);
}

// ---------- PDF ----------
// Larguras AFM da Helvetica para os caracteres 32–126 (milésimos de em).
export const larguras = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const winAnsi = { '€': 128, '‚': 130, 'ƒ': 131, '„': 132, '…': 133, '†': 134, '‡': 135, 'ˆ': 136, '‰': 137, 'Š': 138, '‹': 139, 'Œ': 140, 'Ž': 142, '‘': 145, '’': 146, '“': 147, '”': 148, '•': 149, '–': 150, '—': 151, '˜': 152, '™': 153, 'š': 154, '›': 155, 'œ': 156, 'ž': 158, 'Ÿ': 159 };
export function ansi(texto) {
  let r = '';
  for (const ch of String(texto).normalize('NFC')) {
    const c = ch.codePointAt(0);
    if ((c >= 32 && c < 127) || (c >= 160 && c <= 255)) r += ch;
    else if (winAnsi[ch]) r += String.fromCharCode(winAnsi[ch]);
    else r += /\s/.test(ch) ? ' ' : '?';
  }
  return r;
}
function largura(texto, tamanho, negrito) {
  let total = 0;
  for (const ch of String(texto)) {
    const base = ch.normalize('NFD').codePointAt(0);
    total += base >= 32 && base <= 126 ? larguras[base - 32] : ['—', '…'].includes(ch) ? 1000 : 556;
  }
  return total / 1000 * tamanho * (negrito ? 1.1 : 1);
}
function caber(texto, max, tamanho, negrito) {
  let t = String(texto);
  if (largura(t, tamanho, negrito) <= max) return t;
  while (t.length && largura(t + '…', tamanho, negrito) > max) t = t.slice(0, -1);
  return t.trimEnd() + '…';
}
function quebrar(texto, max, tamanho) {
  const linhas = []; let atual = '';
  for (const palavra of String(texto).split(/\s+/)) {
    const tentativa = atual ? atual + ' ' + palavra : palavra;
    if (largura(tentativa, tamanho) <= max || !atual) atual = tentativa; else { linhas.push(atual); atual = palavra; }
  }
  if (atual) linhas.push(atual);
  return linhas.map(l => caber(l, max, tamanho));
}
const num = x => String(Math.round(x * 100) / 100);
const literal = s => '(' + ansi(s).replace(/[\\()]/g, '\\$&') + ')';

/**
 * Monta um PDF A4 paisagem.
 * dados: { titulo, subtitulo, filtros: [[rótulo, valor]], resumo: [[rótulo, valor]], tabelas: [{ titulo, colunas: [{ titulo, largura, tipo }], linhas: [[...]] }], aviso }
 */
export function pdf({ titulo, subtitulo = '', filtros = [], resumo = [], tabelas = [], aviso = '' }) {
  const L = 842, A = 595, M = 36, util = L - 2 * M, base = 44;
  const cor = { tinta: '0.04 0.04 0.04', suave: '0.36 0.39 0.38', verde: '0 0.529 0.184', linha: '0.86 0.89 0.87', zebra: '0.957 0.973 0.965', branco: '1 1 1', caixa: '0.933 0.973 0.945' };
  const paginas = []; let ops = [], y = 0;
  const texto = (x, yy, s, tam = 9, negrito = false, c = cor.tinta) => ops.push(`BT /${negrito ? 'F2' : 'F1'} ${tam} Tf ${c} rg ${num(x)} ${num(yy)} Td ${literal(s)} Tj ET`);
  const caixa = (x, yy, w, h, c) => ops.push(`${c} rg ${num(x)} ${num(yy)} ${num(w)} ${num(h)} re f`);
  const traco = (x1, y1, x2, y2, c = cor.linha) => ops.push(`${c} RG 0.6 w ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S`);
  function novaPagina() {
    if (ops.length) paginas.push(ops);
    ops = []; y = A - M;
    caixa(0, A - 8, L, 8, cor.verde);
  }
  const espaco = h => { if (y - h < base) { novaPagina(); return true; } return false; };

  novaPagina();
  texto(M, y - 14, titulo, 18, true); y -= 32;
  if (subtitulo) { texto(M, y - 9, subtitulo, 9, false, cor.suave); y -= 20; }
  if (aviso) { for (const l of quebrar(aviso, util, 8.5)) { texto(M, y - 9, l, 8.5, true, cor.tinta); y -= 13; } y -= 4; }
  if (filtros.length) {
    texto(M, y - 10, 'Filtros aplicados', 10.5, true); y -= 18;
    const linha = filtros.map(([r, v]) => `${r}: ${v}`).join('   ·   ');
    for (const l of quebrar(linha, util, 8.5)) { texto(M, y - 9, l, 8.5, false, cor.suave); y -= 13; }
    y -= 8;
  }
  if (resumo.length) {
    texto(M, y - 10, 'Dados consolidados', 10.5, true); y -= 18;
    const porLinha = Math.min(4, resumo.length), w = (util - (porLinha - 1) * 8) / porLinha;
    for (let i = 0; i < resumo.length; i += porLinha) {
      espaco(44);
      resumo.slice(i, i + porLinha).forEach(([r, v], j) => {
        const x = M + j * (w + 8);
        caixa(x, y - 40, w, 40, cor.caixa);
        texto(x + 10, y - 15, caber(r, w - 20, 8), 8, false, cor.suave);
        texto(x + 10, y - 32, caber(v, w - 20, 13, true), 13, true);
      });
      y -= 48;
    }
    y -= 6;
  }
  for (const tabela of tabelas) {
    const cols = tabela.colunas, soma = cols.reduce((s, c) => s + c.largura, 0);
    const xs = []; let acc = M;
    for (const c of cols) { xs.push(acc); acc += c.largura / soma * util; }
    const lw = i => cols[i].largura / soma * util;
    const direita = c => ['numero', 'decimal', 'duracao'].includes(c.tipo);
    const cabecalho = continua => {
      texto(M, y - 11, tabela.titulo + (continua ? ' (continuação)' : ''), 11, true); y -= 20;
      caixa(M, y - 18, util, 18, cor.verde);
      cols.forEach((c, i) => {
        const t = caber(c.titulo, lw(i) - 8, 8, true);
        texto(direita(c) ? xs[i] + lw(i) - 4 - largura(t, 8, true) : xs[i] + 4, y - 12.5, t, 8, true, cor.branco);
      });
      y -= 18;
    };
    espaco(70); cabecalho(false);
    if (!tabela.linhas.length) { texto(M + 4, y - 13, 'Nenhum registro encontrado para os filtros aplicados.', 8.5, false, cor.suave); y -= 22; }
    tabela.linhas.forEach((linha, n) => {
      if (espaco(16)) cabecalho(true);
      if (n % 2) caixa(M, y - 15, util, 15, cor.zebra);
      linha.forEach((valor, i) => {
        const t = caber(formatar(valor, cols[i].tipo), lw(i) - 8, 8);
        texto(direita(cols[i]) ? xs[i] + lw(i) - 4 - largura(t, 8) : xs[i] + 4, y - 10.5, t, 8);
      });
      y -= 15;
    });
    traco(M, y, M + util, y); y -= 22;
  }
  paginas.push(ops);

  // Rodapé com numeração, após saber o total de páginas.
  const gerado = momentoBR();
  paginas.forEach((p, i) => {
    ops = p;
    traco(M, 30, L - M, 30);
    texto(M, 18, caber(`Mentor IA · ${titulo} · gerado em ${gerado} (Brasília)`, util - 90, 7.5), 7.5, false, cor.suave);
    const pag = `Página ${i + 1} de ${paginas.length}`;
    texto(L - M - largura(pag, 7.5), 18, pag, 7.5, false, cor.suave);
  });

  const objetos = [];
  const total = 5 + paginas.length * 2;
  objetos[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objetos[2] = `<< /Type /Pages /Kids [${paginas.map((_, i) => `${6 + i * 2} 0 R`).join(' ')}] /Count ${paginas.length} >>`;
  objetos[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objetos[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  const agora = new Date(), d = agora.toISOString().replace(/\D/g, '').slice(0, 14);
  objetos[5] = `<< /Title ${literal(titulo)} /Producer (Mentor IA) /Creator (Mentor IA) /CreationDate (D:${d}Z) >>`;
  const partes = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
  let tamanho = partes[0].length;
  const deslocamentos = [];
  const escrever = (n, corpo) => {
    deslocamentos[n] = tamanho;
    const b = Buffer.concat([Buffer.from(`${n} 0 obj\n`, 'latin1'), corpo, Buffer.from('\nendobj\n', 'latin1')]);
    partes.push(b); tamanho += b.length;
  };
  for (let n = 1; n <= 5; n++) escrever(n, Buffer.from(objetos[n], 'latin1'));
  paginas.forEach((p, i) => {
    const pagina = 6 + i * 2, conteudo = deflateSync(Buffer.from(p.join('\n'), 'latin1'));
    escrever(pagina, Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${L} ${A}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pagina + 1} 0 R >>`, 'latin1'));
    escrever(pagina + 1, Buffer.concat([Buffer.from(`<< /Length ${conteudo.length} /Filter /FlateDecode >>\nstream\n`, 'latin1'), conteudo, Buffer.from('\nendstream', 'latin1')]));
  });
  const xref = tamanho;
  let tabelaXref = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let n = 1; n < total; n++) tabelaXref += `${String(deslocamentos[n]).padStart(10, '0')} 00000 n \n`;
  partes.push(Buffer.from(`${tabelaXref}trailer\n<< /Size ${total} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`, 'latin1'));
  return Buffer.concat(partes);
}

// ---------- XLSX ----------
const xml = s => String(s).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function letraColuna(i) { let s = ''; for (let n = i + 1; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; }
const serialExcel = dia => (Date.UTC(...dia.split('-').map((v, i) => i === 1 ? v - 1 : +v)) - Date.UTC(1899, 11, 30)) / 86400000;
// Estilos: 0 normal · 1 título · 2 negrito · 3 cabeçalho · 4 data · 5 texto com borda · 6 decimal · 7 inteiro
const estilos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts><fonts count="4"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="15"/><color rgb="FF00872F"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF00872F"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFDCE4DF"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/><xf numFmtId="2" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="1" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
function celula(ref, valor, tipo, estilo) {
  if (valor === null || valor === undefined || valor === '') return `<c r="${ref}" s="${estilo ?? 5}"/>`;
  if (tipo === 'data' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return `<c r="${ref}" s="4"><v>${serialExcel(valor)}</v></c>`;
  if (['numero', 'decimal', 'duracao'].includes(tipo) && Number.isFinite(Number(valor))) return `<c r="${ref}" s="${tipo === 'decimal' ? 6 : 7}"><v>${Number(valor)}</v></c>`;
  return `<c r="${ref}" t="inlineStr" s="${estilo ?? 5}"><is><t xml:space="preserve">${xml(valor)}</t></is></c>`;
}
function planilha(linhas, colunas) {
  const cols = colunas.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  const corpo = linhas.map((linha, r) => `<row r="${r + 1}">${linha.map((c, i) => c ? celula(letraColuna(i) + (r + 1), c.v, c.t, c.s) : '').join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetFormatPr defaultRowHeight="15"/>${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${corpo}</sheetData></worksheet>`;
}
const nomePlanilha = (s, usados) => {
  let nome = String(s).replace(/[[\]:*?/\\]/g, ' ').slice(0, 31).trim() || 'Planilha';
  for (let i = 2; usados.has(nome); i++) nome = nome.slice(0, 28) + ' ' + i;
  usados.add(nome); return nome;
};

/** Mesmo formato de dados do PDF. A primeira tabela fica na aba principal; as demais em abas próprias. */
export function xlsx({ titulo, subtitulo = '', filtros = [], resumo = [], tabelas = [], aviso = '' }) {
  const abas = [], usados = new Set();
  const tabelaLinhas = t => [
    [{ v: t.titulo, s: 2 }],
    // Duração vai como número de minutos, para permitir somas na planilha.
    t.colunas.map(c => ({ v: c.tipo === 'duracao' ? c.titulo + ' (min)' : c.titulo, s: 3 })),
    ...t.linhas.map(l => l.map((v, i) => ({ v, t: t.colunas[i].tipo })))
  ];
  const larguraCols = t => t.colunas.map(c => Math.max(10, Math.min(60, Math.round(c.largura * 1.6))));
  const [primeira, ...demais] = tabelas;
  const principal = [
    [{ v: titulo, s: 1 }],
    [{ v: subtitulo, s: 0 }],
    ...(aviso ? [[{ v: aviso, s: 2 }]] : []),
    [],
    [{ v: 'Filtros aplicados', s: 2 }],
    ...filtros.map(([r, v]) => [{ v: r, s: 2 }, { v, s: 0 }]),
    [],
    [{ v: 'Dados consolidados', s: 2 }],
    ...resumo.map(([r, v]) => [{ v: r, s: 2 }, { v, s: 0 }]),
    [],
    ...(primeira ? tabelaLinhas(primeira) : [])
  ];
  const largPrincipal = primeira ? larguraCols(primeira) : [];
  largPrincipal[0] = Math.max(largPrincipal[0] || 0, 24); largPrincipal[1] = Math.max(largPrincipal[1] || 0, 28);
  abas.push({ nome: nomePlanilha('Relatório', usados), xml: planilha(principal, largPrincipal) });
  for (const t of demais) abas.push({ nome: nomePlanilha(t.planilha || t.titulo, usados), xml: planilha(tabelaLinhas(t), larguraCols(t)) });

  const cab = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const arquivos = [
    ['[Content_Types].xml', `${cab}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${abas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`],
    ['_rels/.rels', `${cab}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`],
    ['docProps/core.xml', `${cab}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(titulo)}</dc:title><dc:creator>Mentor IA</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`],
    ['xl/workbook.xml', `${cab}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${abas.map((a, i) => `<sheet name="${xml(a.nome)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `${cab}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${abas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${abas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', estilos],
    ...abas.map((a, i) => [`xl/worksheets/sheet${i + 1}.xml`, a.xml])
  ];
  return zip(arquivos.map(([nome, conteudo]) => ({ nome, dados: Buffer.from(conteudo, 'utf8') })));
}

/** ZIP mínimo (deflate) — suficiente para o pacote XLSX. */
export function zip(arquivos) {
  const locais = [], central = []; let offset = 0;
  const agora = new Date();
  const hora = (agora.getHours() << 11) | (agora.getMinutes() << 5) | Math.floor(agora.getSeconds() / 2);
  const data = ((agora.getFullYear() - 1980) << 9) | ((agora.getMonth() + 1) << 5) | agora.getDate();
  for (const { nome, dados } of arquivos) {
    const n = Buffer.from(nome, 'utf8'), comprimido = deflateRawSync(dados), crc = crc32(dados);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
    h.writeUInt16LE(hora, 10); h.writeUInt16LE(data, 12); h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(comprimido.length, 18); h.writeUInt32LE(dados.length, 22); h.writeUInt16LE(n.length, 26); h.writeUInt16LE(0, 28);
    locais.push(h, n, comprimido);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10);
    c.writeUInt16LE(hora, 12); c.writeUInt16LE(data, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(comprimido.length, 20);
    c.writeUInt32LE(dados.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(offset, 42);
    central.push(c, n);
    offset += 30 + n.length + comprimido.length;
  }
  const diretorio = Buffer.concat(central), fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(arquivos.length, 8); fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(diretorio.length, 12); fim.writeUInt32LE(offset, 16);
  return Buffer.concat([...locais, diretorio, fim]);
}
