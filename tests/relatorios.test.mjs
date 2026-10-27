import test from 'node:test';
import assert from 'node:assert/strict';
import { pdf, xlsx, zip, ansi, larguras, letraColuna, duracao } from '../server/relatorios.mjs';
import { lerZip, lerPdf } from './leitores.mjs';

const documento = linhas => ({
  titulo: 'Relatório de teste', subtitulo: 'Gerado para teste',
  filtros: [['Período', '01/10/2026 a 27/10/2026'], ['Busca', '"função (afim)"']],
  resumo: [['Sessões', '3'], ['Tempo estudado', '2h15']],
  tabelas: [{ titulo: 'Sessões', colunas: [{ titulo: 'Data', largura: 10, tipo: 'data' }, { titulo: 'Tema', largura: 30 }, { titulo: 'Duração', largura: 10, tipo: 'duracao' }, { titulo: 'Média', largura: 10, tipo: 'decimal' }], linhas },
    { titulo: 'Consolidado', planilha: 'Por disciplina', colunas: [{ titulo: 'Disciplina', largura: 30 }, { titulo: 'Total', largura: 10, tipo: 'numero' }], linhas: [['Matemática', 3]] }]
});

test('Utilitários: larguras Helvetica, WinAnsi, colunas e duração', () => {
  assert.equal(larguras.length, 95);
  assert.equal(ansi('Ação — “ok” ✓'), 'A\xe7\xe3o \x97 \x93ok\x94 ?');
  assert.deepEqual([0, 25, 26, 701].map(letraColuna), ['A', 'Z', 'AA', 'ZZ']);
  assert.deepEqual([45, 60, 95, 0].map(duracao), ['45 min', '1h', '1h35', '0 min']);
});

test('PDF: xref válida, textos com acentos e parênteses, quebra de página com cabeçalho repetido', () => {
  const linhas = Array.from({ length: 80 }, (_, i) => ['2026-10-' + String(1 + i % 27).padStart(2, '0'), `Tema (${i}) com acentuação — ${'palavra '.repeat(i % 14)}`, 30 + i, 3.25]);
  const texto = lerPdf(pdf(documento(linhas)));
  for (const t of ['Relatório de teste', 'Filtros aplicados', 'Busca: "função (afim)"', 'Dados consolidados', 'Tema (0) com acentuação — ', 'Sessões (continuação)', 'Consolidado', 'Matemática', '27/10/2026', '1h20', '3,3']) assert.ok(texto.includes(t), 'PDF contém: ' + t);
  assert.match(texto, /Página 1 de [2-9]/);
  assert.ok(texto.includes('…'), 'texto longo é truncado com reticências');
});

test('PDF sem registros informa a ausência de dados', () => {
  assert.ok(lerPdf(pdf(documento([]))).includes('Nenhum registro encontrado para os filtros aplicados.'));
});

test('XLSX: pacote válido, datas e números como valores, abas separadas e XML escapado', () => {
  const arquivos = lerZip(xlsx(documento([['2026-10-27', 'A & B <c>', 90, 4.5]])));
  assert.deepEqual(Object.keys(arquivos).sort(), ['[Content_Types].xml', '_rels/.rels', 'docProps/core.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml'].sort());
  const aba = arquivos['xl/worksheets/sheet1.xml'];
  assert.match(aba, /<c r="A\d+" s="4"><v>46322<\/v><\/c>/, 'data como número serial do Excel');
  assert.match(aba, /<v>90<\/v>/); assert.match(aba, /<v>4.5<\/v>/);
  assert.ok(aba.includes('A &amp; B &lt;c&gt;'));
  assert.ok(aba.includes('Duração (min)'));
  assert.match(arquivos['xl/workbook.xml'], /name="Relatório".*name="Por disciplina"/);
});

test('ZIP: CRC e tamanhos conferem', () => {
  const arquivos = lerZip(zip([{ nome: 'a.txt', dados: Buffer.from('olá '.repeat(100)) }, { nome: 'pasta/b.xml', dados: Buffer.from('<x/>') }]));
  assert.equal(arquivos['a.txt'], 'olá '.repeat(100));
  assert.equal(arquivos['pasta/b.xml'], '<x/>');
});
