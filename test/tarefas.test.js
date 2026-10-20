import { describe, it, expect } from 'vitest';
import empresas from '../data/empresas.json';
import tarefas from '../data/tarefas.json';
import { listarTarefas, empresasDaArvore } from '../src/tarefas.js';

const ids = (filtro) => listarTarefas({ tarefas, empresas, ...filtro }).map((t) => t.id);

describe('listarTarefas', () => {
  it('lista as tarefas da Vértice Finanças em setembro', () => {
    const r = listarTarefas({ tarefas, empresas, empresaId: 3, de: '2026-09-01', ate: '2026-09-30' });
    expect(r.map((t) => t.id)).toEqual([105, 106]);
  });

  describe('empresa escolhida + empresas abaixo dela', () => {
    const periodo = { de: '2026-09-01', ate: '2026-10-31' };

    it('Grupo Aurora (sem tarefas próprias) mostra o grupo inteiro, inclusive a neta', () => {
      expect(ids({ empresaId: 1, ...periodo })).toEqual(
        [101, 102, 103, 104, 105, 106, 108, 109, 110, 112, 113, 114, 115]);
    });

    it('Grupo Aurora não mostra a Outra Empresa S.A.', () => {
      const r = listarTarefas({ tarefas, empresas, empresaId: 1, ...periodo });
      expect(r.some((t) => t.empresa_id === 5)).toBe(false);
    });

    it('Aurora Serviços mostra ela e a Aurora Campo, mas não a Vértice', () => {
      expect(ids({ empresaId: 2, ...periodo })).toEqual([101, 102, 103, 104, 108, 109, 112, 113, 115]);
    });

    it('Aurora Campo (folha) mostra só as dela', () => {
      expect(ids({ empresaId: 4, ...periodo })).toEqual([103, 104, 109, 113]);
    });

    it('Outra Empresa S.A. mostra só as dela', () => {
      expect(ids({ empresaId: 5, ...periodo })).toEqual([107, 111]);
    });

    it('empresa inexistente não mostra nada', () => {
      expect(ids({ empresaId: 99, ...periodo })).toEqual([]);
    });

    it('aceita o id como texto (valor cru de um <select>)', () => {
      expect(ids({ empresaId: '3', ...periodo })).toEqual([105, 106, 110, 114]);
    });
  });

  describe('período inclui os dois dias das pontas', () => {
    it('tarefa criada no dia "de" aparece', () => {
      // 105 é de 15/09
      expect(ids({ empresaId: 3, de: '2026-09-15', ate: '2026-09-30' })).toEqual([105, 106]);
    });

    it('tarefa criada no dia "até" aparece', () => {
      // 110 é de 01/10
      expect(ids({ empresaId: 3, de: '2026-09-16', ate: '2026-10-01' })).toEqual([106, 110]);
    });

    it('de e até no mesmo dia mostra as tarefas daquele dia', () => {
      expect(ids({ empresaId: 1, de: '2026-10-01', ate: '2026-10-01' })).toEqual([109, 110]);
    });

    it('período invertido não mostra nada', () => {
      expect(ids({ empresaId: 1, de: '2026-10-31', ate: '2026-09-01' })).toEqual([]);
    });

    it('campo de data apagado na tela (vazio) não esconde tudo: vira "sem limite"', () => {
      expect(ids({ empresaId: 3, de: '', ate: '2026-09-30' })).toEqual([105, 106]);
      expect(ids({ empresaId: 3, de: '2026-10-01', ate: '' })).toEqual([110, 114]);
    });
  });

  it('ordena por data e, no mesmo dia, por id', () => {
    const r = listarTarefas({ tarefas, empresas, empresaId: 1, de: '2026-09-15', ate: '2026-09-20' });
    expect(r.map((t) => [t.criada_em, t.id])).toEqual([
      ['2026-09-15', 104], ['2026-09-15', 105], ['2026-09-20', 106],
    ]);
  });

  it('não altera a lista original', () => {
    const copia = JSON.stringify(tarefas);
    listarTarefas({ tarefas, empresas, empresaId: 1, de: '2026-09-01', ate: '2026-10-31' });
    expect(JSON.stringify(tarefas)).toBe(copia);
  });
});

describe('empresasDaArvore', () => {
  it('desce qualquer número de níveis', () => {
    const arvore = [
      { id: 1, pai_id: null }, { id: 2, pai_id: 1 }, { id: 3, pai_id: 2 }, { id: 4, pai_id: 3 },
    ];
    expect([...empresasDaArvore(arvore, 1)].sort()).toEqual([1, 2, 3, 4]);
    expect([...empresasDaArvore(arvore, 3)].sort()).toEqual([3, 4]);
  });

  it('não entra em loop se o cadastro tiver um ciclo', () => {
    const ciclo = [{ id: 1, pai_id: 2 }, { id: 2, pai_id: 1 }];
    expect([...empresasDaArvore(ciclo, 1)].sort()).toEqual([1, 2]);
  });
});
