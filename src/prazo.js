const UM_DIA = 24 * 60 * 60 * 1000;
const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;

// Toda a conta é feita em UTC (meia-noite UTC de cada dia), só com datas.
// Assim o resultado não depende do fuso do computador nem de horário de verão:
// misturar new Date('YYYY-MM-DD') (UTC) com setDate/getDay (hora local) é o
// tipo de coisa que faz o prazo pular ou repetir um dia.
function paraData(texto) {
  if (!FORMATO_DATA.test(texto)) throw new Error(`Data inválida: ${JSON.stringify(texto)}`);
  const d = new Date(`${texto}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== texto) {
    throw new Error(`Data inválida: ${JSON.stringify(texto)}`); // ex.: 2026-02-30
  }
  return d;
}

const paraTexto = (d) => d.toISOString().slice(0, 10);

/** true se o dia é útil: segunda a sexta e fora da lista de feriados. */
export function ehDiaUtil(data, feriados = new Set()) {
  const d = typeof data === 'string' ? paraData(data) : data;
  const diaDaSemana = d.getUTCDay(); // 0 = domingo, 6 = sábado
  return diaDaSemana !== 0 && diaDaSemana !== 6 && !feriados.has(paraTexto(d));
}

/**
 * Prazo de atendimento (SLA) de uma tarefa, em dias úteis.
 *
 * A contagem começa no dia seguinte à criação; dia útil é de segunda a sexta,
 * exceto os feriados informados. Ex.: criada na sexta com 1 dia → segunda
 * (ou terça, se a segunda for feriado).
 *
 * @param {string}   criadaEm   data de criação, 'YYYY-MM-DD'
 * @param {number}   dias       quantos dias o cliente contratou
 * @param {string[]} feriados   datas 'YYYY-MM-DD' que não contam
 * @returns {string} data do prazo, 'YYYY-MM-DD'
 */
export function prazoSLA(criadaEm, dias, feriados = []) {
  if (!Number.isInteger(dias) || dias < 0) {
    throw new Error(`Quantidade de dias inválida: ${JSON.stringify(dias)}`);
  }
  // aceita também a lista no formato da API ({ date: 'YYYY-MM-DD', ... })
  const naoContam = new Set((feriados ?? []).map((f) => (typeof f === 'string' ? f : f.date)));

  let dia = paraData(criadaEm);
  let faltam = dias;
  while (faltam > 0) {
    dia = new Date(dia.getTime() + UM_DIA);
    if (ehDiaUtil(dia, naoContam)) faltam -= 1;
  }
  return paraTexto(dia);
}
