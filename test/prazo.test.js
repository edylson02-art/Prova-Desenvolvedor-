import { describe, it, expect } from 'vitest';
import { prazoSLA, ehDiaUtil } from '../src/prazo.js';

// Nos testes, os feriados são entradas da função (casos montados à mão de
// propósito). Os do sistema vêm de data/feriados-<ano>.json, gerado pela API.
const SEM_FERIADOS = [];
const N_S_APARECIDA = '2026-10-12'; // segunda-feira
const FINADOS = '2026-11-02'; // segunda-feira
const CONSCIENCIA_NEGRA = '2026-11-20'; // sexta-feira
const NATAL = '2026-12-25'; // sexta-feira

describe('prazoSLA — dias úteis', () => {
  it('o caso do chamado: criada na sexta com 1 dia vence na segunda, não no sábado', () => {
    expect(prazoSLA('2026-10-02', 1, SEM_FERIADOS)).toBe('2026-10-05');
  });

  it('começa a contar no dia seguinte à criação', () => {
    expect(prazoSLA('2026-10-05', 1, SEM_FERIADOS)).toBe('2026-10-06'); // seg → ter
  });

  it('3 dias úteis atravessando o fim de semana', () => {
    expect(prazoSLA('2026-10-01', 3, SEM_FERIADOS)).toBe('2026-10-06'); // qui → ter
  });

  it('criada no sábado ou no domingo: o primeiro dia útil é a segunda', () => {
    expect(prazoSLA('2026-10-03', 1, SEM_FERIADOS)).toBe('2026-10-05');
    expect(prazoSLA('2026-10-04', 1, SEM_FERIADOS)).toBe('2026-10-05');
  });

  it('feriado no meio não conta (12/10, N. Sra. Aparecida, segunda)', () => {
    expect(prazoSLA('2026-10-09', 1, [N_S_APARECIDA])).toBe('2026-10-13'); // sex → ter
    expect(prazoSLA('2026-10-08', 3, [N_S_APARECIDA])).toBe('2026-10-14'); // qui → qua
  });

  it('feriado colado no fim de semana (sexta 20/11 + sábado + domingo)', () => {
    expect(prazoSLA('2026-11-19', 1, [CONSCIENCIA_NEGRA])).toBe('2026-11-23');
  });

  it('criada num feriado: conta do dia seguinte normalmente', () => {
    expect(prazoSLA(N_S_APARECIDA, 1, [N_S_APARECIDA])).toBe('2026-10-13');
  });

  it('dois feriados na mesma janela', () => {
    expect(prazoSLA('2026-10-30', 3, [FINADOS])).toBe('2026-11-05'); // sex; seg é Finados
  });

  it('atravessa a virada do ano', () => {
    expect(prazoSLA('2026-12-24', 3, [NATAL, '2027-01-01'])).toBe('2026-12-30');
    expect(prazoSLA('2026-12-30', 3, [NATAL, '2027-01-01'])).toBe('2027-01-05');
  });

  it('feriado que cai no fim de semana não "consome" dia útil extra', () => {
    expect(prazoSLA('2026-11-13', 1, ['2026-11-15'])).toBe('2026-11-16'); // 15/11 é domingo
  });

  it('0 dias: o prazo é o próprio dia', () => {
    expect(prazoSLA('2026-10-05', 0, SEM_FERIADOS)).toBe('2026-10-05');
  });

  it('aceita a lista no formato da API ({ date, name })', () => {
    expect(prazoSLA('2026-10-09', 1, [{ date: N_S_APARECIDA, name: 'Nossa Senhora Aparecida' }]))
      .toBe('2026-10-13');
  });

  it('sem lista de feriados, conta só os fins de semana', () => {
    expect(prazoSLA('2026-10-09', 1)).toBe('2026-10-12');
  });

  it('recusa entrada inválida em vez de devolver uma data errada', () => {
    expect(() => prazoSLA('2026-02-30', 1, [])).toThrow(/inválida/);
    expect(() => prazoSLA('09/10/2026', 1, [])).toThrow(/inválida/);
    expect(() => prazoSLA('2026-10-09', -1, [])).toThrow(/inválida/);
    expect(() => prazoSLA('2026-10-09', 1.5, [])).toThrow(/inválida/);
  });
});

describe('ehDiaUtil', () => {
  it('segunda a sexta sim; sábado, domingo e feriado não', () => {
    expect(ehDiaUtil('2026-10-05')).toBe(true); // segunda
    expect(ehDiaUtil('2026-10-09')).toBe(true); // sexta
    expect(ehDiaUtil('2026-10-10')).toBe(false); // sábado
    expect(ehDiaUtil('2026-10-11')).toBe(false); // domingo
    expect(ehDiaUtil(N_S_APARECIDA, new Set([N_S_APARECIDA]))).toBe(false);
  });
});
