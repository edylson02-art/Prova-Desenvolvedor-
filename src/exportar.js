// CSV para o financeiro abrir no Excel em português:
// * separador ';' (no Excel pt-BR a vírgula é o separador decimal);
// * BOM UTF-8 no início: sem ele o Excel lê o arquivo como Windows-1252 e
//   "Manutenção" vira "ManutenÃ§Ã£o";
// * campos com ';', aspas ou quebra de linha vão entre aspas, com as aspas
//   internas dobradas (RFC 4180) — senão um título como
//   Treinamento "Vendas 2026"; turma 1 se espalha por duas colunas;
// * linhas separadas por \n (o Excel aceita; quebras dentro de um título
//   ficam protegidas pelas aspas).
const BOM = '\uFEFF';
const SEPARADOR = ';';
const FIM_DE_LINHA = '\n';
const COLUNAS = ['id', 'titulo', 'status', 'criada_em'];

/** 'YYYY-MM-DD' → 'DD/MM/AAAA' (sem passar por Date, para não mudar o dia por fuso). */
export function formatarData(data) {
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(data ?? ''));
  if (!partes) return String(data ?? '');
  const [, ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}

/**
 * Prepara um valor para uma célula do CSV.
 *
 * Texto que começa com = + - @ (ou tab / retorno) o Excel executa como
 * fórmula: "=SOMA(despesas) conferir na auditoria" viraria um erro #NOME? e,
 * num arquivo malicioso, uma fórmula pode buscar dados ou rodar comandos
 * (CSV injection). Esses textos ganham um apóstrofo na frente, como a OWASP
 * recomenda, e o Excel mostra o conteúdo como texto.
 */
export function celula(valor) {
  let texto = valor === null || valor === undefined ? '' : String(valor);
  if (typeof valor === 'string' && /^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  if (/[";\r\n]/.test(texto) || texto.startsWith("'")) {
    texto = `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

/** Gera o CSV das tarefas para o financeiro abrir no Excel. */
export function gerarCSV(tarefas) {
  const linhas = tarefas.map((t) =>
    [t.id, t.titulo, t.status, formatarData(t.criada_em)].map(celula).join(SEPARADOR));
  return BOM + [COLUNAS.join(SEPARADOR), ...linhas].join(FIM_DE_LINHA);
}
