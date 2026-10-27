// Leitores mínimos usados pelos testes para conferir os arquivos gerados (não são testes).
import assert from 'node:assert/strict';
import { inflateRawSync, inflateSync, crc32 } from 'node:zlib';

/** Lê um ZIP pelo diretório central, confere CRC de cada parte e devolve { nome: texto }. */
export function lerZip(buf) {
  const fim = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(fim > 0, 'ZIP sem registro final');
  const total = buf.readUInt16LE(fim + 10), arquivos = {};
  let p = buf.readUInt32LE(fim + 16);
  for (let i = 0; i < total; i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50, 'entrada do diretório central');
    const metodo = buf.readUInt16LE(p + 10), crc = buf.readUInt32LE(p + 16), tamanho = buf.readUInt32LE(p + 20);
    const n = buf.readUInt16LE(p + 28), extra = buf.readUInt16LE(p + 30), comentario = buf.readUInt16LE(p + 32), local = buf.readUInt32LE(p + 42);
    const nome = buf.toString('utf8', p + 46, p + 46 + n);
    assert.equal(buf.readUInt32LE(local), 0x04034b50, 'cabeçalho local de ' + nome);
    const inicio = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const dados = buf.subarray(inicio, inicio + tamanho), conteudo = metodo === 8 ? inflateRawSync(dados) : dados;
    assert.equal(crc32(conteudo), crc, 'CRC de ' + nome);
    arquivos[nome] = conteudo.toString('utf8');
    p += 46 + n + extra + comentario;
  }
  return arquivos;
}

/** Confere a tabela xref do PDF e devolve o texto das páginas (WinAnsi → JS). */
export function lerPdf(buf) {
  const bruto = buf.toString('latin1');
  assert.ok(bruto.startsWith('%PDF-1.'), 'cabeçalho PDF');
  assert.ok(bruto.trimEnd().endsWith('%%EOF'), 'final PDF');
  const xref = Number(/startxref\n(\d+)/.exec(bruto)[1]);
  assert.equal(bruto.slice(xref, xref + 4), 'xref');
  const [, quantidade] = /xref\n0 (\d+)/.exec(bruto.slice(xref));
  const entradas = bruto.slice(xref).split('\n').slice(3, 2 + Number(quantidade));
  entradas.forEach((linha, i) => { const off = Number(linha.slice(0, 10)); assert.equal(bruto.slice(off, off + String(i + 1).length + 6), `${i + 1} 0 obj`, 'deslocamento do objeto ' + (i + 1)); });
  const especiais = { '\x85': '…', '\x96': '–', '\x97': '—', '\x93': '“', '\x94': '”', '\x95': '•' };
  const textos = [];
  for (const m of bruto.matchAll(/stream\n([\s\S]*?)\nendstream/g)) {
    const conteudo = inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1');
    for (const t of conteudo.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)) textos.push(t[1].replace(/\\(.)/g, '$1').replace(/[\x85\x93-\x97]/g, c => especiais[c]));
  }
  return textos.join('\n');
}
