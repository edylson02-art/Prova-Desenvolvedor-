// Feriados nacionais vindos da BrasilAPI (https://brasilapi.com.br/docs#tag/Feriados-Nacionais):
// pública, brasileira, gratuita, sem chave de acesso e de código aberto
// (dá para conferir como cada data é calculada no repositório BrasilAPI/BrasilAPI).
export const URL_BRASILAPI = (ano) => `https://brasilapi.com.br/api/feriados/v1/${ano}`;

const DIA_DA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const diaDaSemana = (data) => new Date(`${data}T00:00:00Z`).getUTCDay();

// Feriados móveis caem sempre no mesmo dia da semana. Se a API mandar um
// deles em outro dia, a data veio deslocada e não serve para contar prazo.
// (O cálculo da BrasilAPI usa o fuso do servidor: num servidor a leste de
// UTC, todos os móveis saem um dia antes — por isso a conferência.)
const DIA_ESPERADO = {
  'Sexta-feira Santa': [5],
  'Páscoa': [0],
  'Carnaval': [1, 2],
  'Corpus Christi': [4],
};

/**
 * Confere a resposta da API e devolve só os feriados nacionais do ano,
 * ordenados por data, no formato { date, name }.
 */
export function validarFeriados(resposta, ano) {
  if (!Array.isArray(resposta)) {
    throw new Error(`Resposta inesperada da API (esperava uma lista): ${JSON.stringify(resposta).slice(0, 200)}`);
  }
  const nacionais = resposta.filter((f) => f.type === 'national');
  if (nacionais.length === 0) throw new Error(`A API não devolveu nenhum feriado nacional para ${ano}.`);

  const datas = new Set();
  for (const f of nacionais) {
    if (typeof f.date !== 'string' || !f.date.startsWith(`${ano}-`) || Number.isNaN(diaDaSemana(f.date))) {
      throw new Error(`Feriado com data inválida para ${ano}: ${JSON.stringify(f)}`);
    }
    const esperado = DIA_ESPERADO[f.name];
    if (esperado && !esperado.includes(diaDaSemana(f.date))) {
      throw new Error(`"${f.name}" veio em ${f.date} (${DIA_DA_SEMANA[diaDaSemana(f.date)]}), ` +
        `dia da semana impossível — a API parece ter mandado datas deslocadas.`);
    }
    datas.add(f.date);
  }

  return [...datas].sort().map((date) => ({
    date,
    name: nacionais.filter((f) => f.date === date).map((f) => f.name).join(' / '),
  }));
}

/** Baixa os feriados nacionais do ano. `fetchFn` pode ser trocado nos testes. */
export async function baixarFeriadosNacionais(ano, fetchFn = fetch) {
  if (!/^\d{4}$/.test(String(ano))) throw new Error(`Ano inválido: ${JSON.stringify(ano)}`);
  const url = URL_BRASILAPI(ano);
  let resposta;
  try {
    resposta = await fetchFn(url, { headers: { accept: 'application/json' } });
  } catch (erro) {
    throw new Error(`Não consegui acessar ${url}: ${erro.message}`);
  }
  if (!resposta.ok) throw new Error(`A API respondeu ${resposta.status} para ${url}`);
  return validarFeriados(await resposta.json(), Number(ano));
}
