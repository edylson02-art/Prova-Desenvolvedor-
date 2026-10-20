import { describe, it, expect } from 'vitest';
import tarefas from '../data/tarefas.json';
import { gerarCSV, celula, formatarData } from '../src/exportar.js';

const BOM = '﻿';

/** Leitor de CSV (RFC 4180, separador ';') para conferir o que o Excel vai ver. */
function lerCSV(texto) {
  const linhas = [];
  let linha = [];
  let campo = '';
  let entreAspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreAspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') entreAspas = false;
      else campo += c;
    } else if (c === '"') entreAspas = true;
    else if (c === ';') { linha.push(campo); campo = ''; }
    else if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else if (c !== '\r') campo += c;
  }
  linha.push(campo);
  linhas.push(linha);
  return linhas;
}

const umaTarefa = (titulo) => [{ id: 1, titulo, status: 'aberta', criada_em: '2026-10-03' }];
const linhasDe = (csv) => lerCSV(csv.replace(BOM, ''));

describe('gerarCSV', () => {
  it('começa com o BOM UTF-8 (Excel reconhece os acentos)', () => {
    expect(gerarCSV(tarefas).startsWith(BOM)).toBe(true);
    expect(Buffer.from(gerarCSV([]), 'utf8').subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  });

  it('primeira linha é id;titulo;status;criada_em', () => {
    expect(gerarCSV(tarefas).replace(BOM, '').split('\n')[0]).toBe('id;titulo;status;criada_em');
  });

  it('lista vazia gera só o cabeçalho', () => {
    expect(gerarCSV([])).toBe(`${BOM}id;titulo;status;criada_em`);
  });

  it('datas em DD/MM/AAAA', () => {
    expect(linhasDe(gerarCSV(umaTarefa('X')))[1]).toEqual(['1', 'X', 'aberta', '03/10/2026']);
  });

  it('com os dados reais: toda linha tem exatamente 4 colunas e os títulos voltam intactos', () => {
    const linhas = linhasDe(gerarCSV(tarefas));
    expect(linhas).toHaveLength(tarefas.length + 1);
    for (const l of linhas) expect(l).toHaveLength(4);
    expect(linhas.slice(1).map((l) => l[1].replace(/^'/, ''))).toEqual(tarefas.map((t) => t.titulo));
  });

  it('título com ; e aspas fica numa coluna só (tarefa 112)', () => {
    const csv = gerarCSV(umaTarefa('Treinamento "Vendas 2026"; turma 1'));
    expect(csv).toContain('"Treinamento ""Vendas 2026""; turma 1"');
    expect(linhasDe(csv)[1][1]).toBe('Treinamento "Vendas 2026"; turma 1');
  });

  it('título com quebra de linha não quebra a planilha', () => {
    const linhas = linhasDe(gerarCSV(umaTarefa('linha 1\nlinha 2')));
    expect(linhas).toHaveLength(2);
    expect(linhas[1][1]).toBe('linha 1\nlinha 2');
  });

  it('título com vírgula não é dividido (o separador é ;)', () => {
    expect(linhasDe(gerarCSV(umaTarefa('Visita técnica — Rua das Flores, 42')))[1])
      .toEqual(['1', 'Visita técnica — Rua das Flores, 42', 'aberta', '03/10/2026']);
  });

  it('título que parece fórmula não é executado pelo Excel (tarefa 114)', () => {
    const csv = gerarCSV(umaTarefa('=SOMA(despesas) conferir na auditoria'));
    expect(linhasDe(csv)[1][1]).toBe("'=SOMA(despesas) conferir na auditoria");
    for (const inicio of ['+', '-', '@']) {
      expect(linhasDe(gerarCSV(umaTarefa(`${inicio}1`)))[1][1]).toBe(`'${inicio}1`);
    }
  });

  it('mantém acentos e caracteres especiais', () => {
    expect(linhasDe(gerarCSV(umaTarefa('Licença — São João ção')))[1][1]).toBe('Licença — São João ção');
  });

  it('campo vazio ou ausente vira célula vazia, não "undefined"', () => {
    const csv = gerarCSV([{ id: 7, titulo: '', status: undefined, criada_em: '2026-10-03' }]);
    expect(linhasDe(csv)[1]).toEqual(['7', '', '', '03/10/2026']);
  });
});

describe('auxiliares', () => {
  it('formatarData não depende do fuso (não usa Date)', () => {
    expect(formatarData('2026-01-01')).toBe('01/01/2026');
    expect(formatarData('2026-12-31')).toBe('31/12/2026');
  });

  it('celula não mexe em números negativos de verdade', () => {
    expect(celula(-5)).toBe('-5');
  });
});
