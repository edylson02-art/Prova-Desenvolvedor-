import { describe, it, expect } from 'vitest';
import { validarFeriados, baixarFeriadosNacionais, URL_BRASILAPI } from '../src/feriados.js';

// Trecho no formato exato que a BrasilAPI devolve
const RESPOSTA = [
  { date: '2026-01-01', name: 'Confraternização mundial', type: 'national', weekday: 'quinta-feira' },
  { date: '2026-02-16', name: 'Carnaval', type: 'national', weekday: 'segunda-feira' },
  { date: '2026-04-03', name: 'Sexta-feira Santa', type: 'national', weekday: 'sexta-feira' },
  { date: '2026-07-26', name: 'Fundação da Cidade de Goiás', type: 'state', state: 'GO' },
  { date: '2026-10-12', name: 'Nossa Senhora Aparecida', type: 'national', weekday: 'segunda-feira' },
];

const fetchFalso = (corpo, status = 200) => async (url) => {
  fetchFalso.ultimaUrl = url;
  return { ok: status >= 200 && status < 300, status, json: async () => corpo };
};

describe('validarFeriados', () => {
  it('fica só com os nacionais, ordenados, no formato { date, name }', () => {
    expect(validarFeriados(RESPOSTA, 2026)).toEqual([
      { date: '2026-01-01', name: 'Confraternização mundial' },
      { date: '2026-02-16', name: 'Carnaval' },
      { date: '2026-04-03', name: 'Sexta-feira Santa' },
      { date: '2026-10-12', name: 'Nossa Senhora Aparecida' },
    ]);
  });

  it('junta dois feriados no mesmo dia em uma linha só', () => {
    const r = validarFeriados([
      { date: '2026-01-01', name: 'A', type: 'national' },
      { date: '2026-01-01', name: 'B', type: 'national' },
    ], 2026);
    expect(r).toEqual([{ date: '2026-01-01', name: 'A / B' }]);
  });

  it('recusa feriado móvel em dia da semana impossível (data deslocada)', () => {
    const deslocado = [{ date: '2026-04-02', name: 'Sexta-feira Santa', type: 'national' }];
    expect(() => validarFeriados(deslocado, 2026)).toThrow(/dia da semana impossível/);
  });

  it('recusa data de outro ano ou resposta que não é lista', () => {
    expect(() => validarFeriados([{ date: '2025-12-25', name: 'Natal', type: 'national' }], 2026))
      .toThrow(/data inválida/);
    expect(() => validarFeriados({ message: 'erro' }, 2026)).toThrow(/esperava uma lista/);
    expect(() => validarFeriados([], 2026)).toThrow(/nenhum feriado nacional/);
  });
});

describe('baixarFeriadosNacionais', () => {
  it('chama a BrasilAPI do ano pedido', async () => {
    const r = await baixarFeriadosNacionais('2026', fetchFalso(RESPOSTA));
    expect(fetchFalso.ultimaUrl).toBe(URL_BRASILAPI(2026));
    expect(r).toHaveLength(4);
  });

  it('erro HTTP e falta de rede viram mensagens claras', async () => {
    await expect(baixarFeriadosNacionais(2026, fetchFalso({}, 500))).rejects.toThrow(/respondeu 500/);
    const semRede = async () => { throw new Error('fetch failed'); };
    await expect(baixarFeriadosNacionais(2026, semRede)).rejects.toThrow(/Não consegui acessar/);
  });

  it('recusa ano inválido sem chamar a API', async () => {
    await expect(baixarFeriadosNacionais('20x6', fetchFalso(RESPOSTA))).rejects.toThrow(/Ano inválido/);
  });
});
