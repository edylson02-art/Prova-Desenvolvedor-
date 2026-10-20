import { describe, it, expect } from 'vitest';
import vendas from '../data/vendas.json';
import { totalDoDia, ticketMedio, diaEmBrasilia, vendasUnicas } from '../src/relatorio.js';

describe('totalDoDia', () => {
  it('soma só as vendas pagas', () => {
    const vendas = [
      { id: 'A', valor: 100, status: 'paga', criada_em: '2026-10-05T15:00:00Z' },
      { id: 'B', valor: 50, status: 'cancelada', criada_em: '2026-10-05T16:00:00Z' },
    ];
    expect(totalDoDia(vendas, '2026-10-05')).toBe(100);
  });

  it('01/10/2026 com os dados reais dá R$ 3.400,50 (valor conferido pelo financeiro)', () => {
    expect(totalDoDia(vendas, '2026-10-01')).toBe(3400.5);
  });

  it('usa o dia de Brasília, não o de UTC', () => {
    const v = [
      // 23:00 de 30/09 em Brasília → não é de 01/10
      { id: 'A', valor: 600, status: 'paga', criada_em: '2026-10-01T02:00:00Z' },
      // 22:30 de 01/10 em Brasília → é de 01/10, mesmo sendo 02/10 em UTC
      { id: 'B', valor: 800, status: 'paga', criada_em: '2026-10-02T01:30:00Z' },
    ];
    expect(totalDoDia(v, '2026-09-30')).toBe(600);
    expect(totalDoDia(v, '2026-10-01')).toBe(800);
  });

  it('virada exata do dia: 03:00 UTC é 00:00 em Brasília', () => {
    const v = [
      { id: 'A', valor: 1, status: 'paga', criada_em: '2026-10-02T02:59:59Z' },
      { id: 'B', valor: 2, status: 'paga', criada_em: '2026-10-02T03:00:00Z' },
    ];
    expect(totalDoDia(v, '2026-10-01')).toBe(1);
    expect(totalDoDia(v, '2026-10-02')).toBe(2);
  });

  it('aceita horário com fuso explícito', () => {
    const v = [{ id: 'A', valor: 10, status: 'paga', criada_em: '2026-10-01T23:50:00-03:00' }];
    expect(totalDoDia(v, '2026-10-01')).toBe(10);
  });

  it('venda repetida pela sincronização conta uma vez só', () => {
    const v = [
      { id: 'A', valor: 250.5, status: 'paga', criada_em: '2026-10-01T15:30:00Z' },
      { id: 'A', valor: 250.5, status: 'paga', criada_em: '2026-10-01T15:30:00Z' },
    ];
    expect(totalDoDia(v, '2026-10-01')).toBe(250.5);
  });

  it('se a repetição chega com status novo, vale a última versão', () => {
    const v = [
      { id: 'A', valor: 100, status: 'paga', criada_em: '2026-10-01T15:00:00Z' },
      { id: 'A', valor: 100, status: 'cancelada', criada_em: '2026-10-01T15:00:00Z' },
    ];
    expect(totalDoDia(v, '2026-10-01')).toBe(0);
  });

  it('soma centavos sem erro de ponto flutuante', () => {
    const v = [
      { id: 'A', valor: 0.1, status: 'paga', criada_em: '2026-10-01T15:00:00Z' },
      { id: 'B', valor: 0.2, status: 'paga', criada_em: '2026-10-01T15:00:00Z' },
    ];
    expect(totalDoDia(v, '2026-10-01')).toBe(0.3);
  });

  it('dia sem vendas dá zero', () => {
    expect(totalDoDia(vendas, '2026-12-25')).toBe(0);
  });

  it('confere os outros dias do arquivo (no horário de Brasília, sem repetidas)', () => {
    expect(totalDoDia(vendas, '2026-09-30')).toBe(1370); // 450 + 320 + 600
    expect(totalDoDia(vendas, '2026-10-02')).toBe(3340); // 900 + 2100 + 340
    expect(totalDoDia(vendas, '2026-10-03')).toBe(510);
  });

  it('não altera a lista recebida', () => {
    const copia = JSON.stringify(vendas);
    totalDoDia(vendas, '2026-10-01');
    expect(JSON.stringify(vendas)).toBe(copia);
  });
});

describe('ticketMedio', () => {
  it('divide o total pelo número de vendas pagas e únicas do dia', () => {
    // 3.400,50 ÷ 5 vendas (V-0991, V-0992, V-0994, V-0995, V-0996)
    expect(ticketMedio(vendas, '2026-10-01')).toBe(680.1);
  });

  it('venda cancelada não entra na conta', () => {
    const v = [
      { id: 'A', valor: 100, status: 'paga', criada_em: '2026-10-05T15:00:00Z' },
      { id: 'B', valor: 50, status: 'cancelada', criada_em: '2026-10-05T16:00:00Z' },
    ];
    expect(ticketMedio(v, '2026-10-05')).toBe(100);
  });

  it('dia sem vendas pagas dá zero', () => {
    const v = [{ id: 'B', valor: 50, status: 'cancelada', criada_em: '2026-10-05T16:00:00Z' }];
    expect(ticketMedio(v, '2026-10-05')).toBe(0);
  });
});

describe('auxiliares', () => {
  it('diaEmBrasilia converte UTC para o dia de Brasília', () => {
    expect(diaEmBrasilia('2026-10-02T02:45:00Z')).toBe('2026-10-01');
    expect(diaEmBrasilia('2026-10-01')).toBe('2026-10-01');
  });

  it('diaEmBrasilia recusa data inválida em vez de sumir com a venda', () => {
    expect(() => diaEmBrasilia('ontem')).toThrow(/inválida/);
  });

  it('vendasUnicas remove repetidas', () => {
    expect(vendasUnicas(vendas)).toHaveLength(14); // 17 linhas, 3 repetidas
  });
});
