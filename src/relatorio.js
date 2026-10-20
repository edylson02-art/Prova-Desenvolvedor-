// Os dias do relatório são no horário de Brasília. As vendas chegam da
// sincronização com o horário em UTC (ex.: '2026-10-02T01:30:00Z' é 22:30 do
// dia 01/10 em Brasília). O fuso é aplicado pelo nome (America/Sao_Paulo), e
// não por um "-3h" fixo, para continuar certo se o horário de verão voltar.
const FUSO = 'America/Sao_Paulo';
const formatoDia = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit',
}); // en-CA formata como 'YYYY-MM-DD'

/** Dia ('YYYY-MM-DD') em Brasília de um horário vindo da sincronização. */
export function diaEmBrasilia(criadaEm) {
  // só a data, sem hora: já é o dia, não há fuso para converter
  if (/^\d{4}-\d{2}-\d{2}$/.test(criadaEm)) return criadaEm;
  const instante = new Date(criadaEm);
  if (Number.isNaN(instante.getTime())) {
    throw new Error(`Data de venda inválida: ${JSON.stringify(criadaEm)}`);
  }
  return formatoDia.format(instante);
}

/**
 * A sincronização às vezes manda a mesma venda (mesmo id) mais de uma vez.
 * Uma venda conta uma vez só; se vier repetida, vale a última versão
 * recebida (a mais recente da sincronização).
 */
export function vendasUnicas(vendas) {
  const porId = new Map();
  for (const v of vendas) {
    porId.delete(v.id); // reinsere no fim: mantém a ordem da última ocorrência
    porId.set(v.id, v);
  }
  return [...porId.values()];
}

/** Vendas pagas, sem repetição, de um dia de Brasília. */
function vendasPagasDoDia(vendas, dia) {
  return vendasUnicas(vendas)
    .filter((v) => v.status === 'paga')
    .filter((v) => diaEmBrasilia(v.criada_em) === dia);
}

// Soma em centavos (inteiros) para não acumular erro de ponto flutuante:
// 0.1 + 0.2 em JavaScript dá 0.30000000000000004.
const emCentavos = (valor) => Math.round(Number(valor) * 100);

/** Total vendido (só vendas pagas) em um dia 'YYYY-MM-DD'. */
export function totalDoDia(vendas, dia) {
  const centavos = vendasPagasDoDia(vendas, dia)
    .reduce((soma, v) => soma + emCentavos(v.valor), 0);
  return centavos / 100;
}

/** Ticket médio do dia: total vendido ÷ número de vendas. */
export function ticketMedio(vendas, dia) {
  // mesmas vendas do total: pagas, sem repetição, no dia de Brasília
  // (antes dividia também pelas canceladas e pelas repetidas)
  const quantidade = vendasPagasDoDia(vendas, dia).length;
  if (quantidade === 0) return 0;
  return Math.round((totalDoDia(vendas, dia) * 100) / quantidade) / 100;
}

export function formatarBRL(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
