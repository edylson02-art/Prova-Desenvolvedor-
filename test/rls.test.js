// Prova da Tarefa 3: sobe o banco igual ao scripts/db.js (schema + dados +
// papel sem privilégio) e confere o que cada empresa consegue ler e escrever.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const ler = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
let db;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(ler('sql/schema.sql'));
  for (const e of JSON.parse(ler('data/empresas.json'))) {
    await db.query('insert into empresas values ($1, $2, $3)', [e.id, e.nome, e.pai_id]);
  }
  for (const t of JSON.parse(ler('data/tarefas.json'))) {
    await db.query('insert into tarefas values ($1, $2, $3, $4, $5)',
      [t.id, t.empresa_id, t.titulo, t.status, t.criada_em]);
  }
  await db.exec(`
    create role app_user;
    grant select, insert, update, delete on all tables in schema public to app_user;
    grant execute on all functions in schema public to app_user;
  `);
}, 60_000);

/**
 * Roda `sql` como uma pessoa logada na empresa `empresaId`, dentro de uma
 * transação que sempre é desfeita (um teste não suja o outro).
 * `antes` roda como administrador, dentro da mesma transação.
 */
async function comoEmpresa(empresaId, sql, params = [], antes = '') {
  await db.exec('begin');
  try {
    if (antes) await db.exec(antes);
    await db.query(`select set_config('app.empresa_id', $1, true)`, [String(empresaId)]);
    await db.exec('set local role app_user');
    return (await db.query(sql, params)).rows;
  } finally {
    await db.exec('rollback');
  }
}

const idsVisiveis = async (empresaId) =>
  (await comoEmpresa(empresaId, 'select id from tarefas order by id')).map((r) => r.id);

describe('leitura de tarefas (RLS)', () => {
  it('Vértice Finanças (3) vê só as dela — o caso do chamado', async () => {
    expect(await idsVisiveis(3)).toEqual([105, 106, 110, 114]);
  });

  it('Grupo Aurora (1) vê o grupo inteiro, inclusive a neta, e nada da Outra Empresa', async () => {
    expect(await idsVisiveis(1)).toEqual([101, 102, 103, 104, 105, 106, 108, 109, 110, 112, 113, 114, 115]);
  });

  it('Aurora Serviços (2) vê ela e a Aurora Campo (4), mas não a irmã Vértice', async () => {
    expect(await idsVisiveis(2)).toEqual([101, 102, 103, 104, 108, 109, 112, 113, 115]);
  });

  it('Aurora Campo (4) não enxerga a empresa de cima', async () => {
    expect(await idsVisiveis(4)).toEqual([103, 104, 109, 113]);
  });

  it('Outra Empresa (5) vê só as dela', async () => {
    expect(await idsVisiveis(5)).toEqual([107, 111]);
  });

  it('sem empresa definida, não vê nada', async () => {
    await db.exec('begin');
    try {
      await db.exec('set local role app_user');
      expect((await db.query('select id from tarefas')).rows).toEqual([]);
    } finally {
      await db.exec('rollback');
    }
  });

  it('funciona em qualquer profundidade da árvore (bisneta criada só neste teste)', async () => {
    const r = await comoEmpresa(2, 'select id from tarefas where id = 950', [], `
      insert into empresas values (6, 'Aurora Campo Norte', 4);
      insert into tarefas values (950, 6, 'Tarefa da bisneta', 'aberta', '2026-10-15');
    `);
    expect(r).toEqual([{ id: 950 }]);
  });
});

describe('lista de empresas (RLS)', () => {
  it('cada empresa só enxerga a própria árvore', async () => {
    const empresas = async (id) =>
      (await comoEmpresa(id, 'select id from empresas order by id')).map((r) => r.id);
    expect(await empresas(1)).toEqual([1, 2, 3, 4]);
    expect(await empresas(3)).toEqual([3]);
    expect(await empresas(5)).toEqual([5]);
  });
});

describe('escrita de tarefas (RLS)', () => {
  const inserir = (empresaLogada, empresaDaTarefa) => comoEmpresa(empresaLogada,
    `insert into tarefas values (900, $1, 'Nova', 'aberta', '2026-10-20') returning id`, [empresaDaTarefa]);

  it('cria tarefa para a própria empresa e para as de baixo', async () => {
    expect(await inserir(3, 3)).toEqual([{ id: 900 }]);
    expect(await inserir(2, 4)).toEqual([{ id: 900 }]);
    expect(await inserir(1, 4)).toEqual([{ id: 900 }]);
  });

  it('não cria tarefa para outra empresa, nem para a empresa de cima', async () => {
    await expect(inserir(3, 5)).rejects.toThrow(/row-level security/);
    await expect(inserir(3, 2)).rejects.toThrow(/row-level security/);
    await expect(inserir(4, 2)).rejects.toThrow(/row-level security/);
    await expect(inserir(5, 1)).rejects.toThrow(/row-level security/);
  });

  it('altera as próprias tarefas', async () => {
    const r = await comoEmpresa(3, `update tarefas set status = 'concluida' where id = 106 returning id`);
    expect(r).toEqual([{ id: 106 }]);
  });

  it('não altera nem apaga tarefa de fora da árvore (0 linhas afetadas)', async () => {
    expect(await comoEmpresa(3, `update tarefas set status = 'x' where id = 107 returning id`)).toEqual([]);
    expect(await comoEmpresa(3, `update tarefas set status = 'x' where id = 101 returning id`)).toEqual([]);
    expect(await comoEmpresa(3, 'delete from tarefas where id = 107 returning id')).toEqual([]);
    expect(await comoEmpresa(5, 'delete from tarefas where id = 101 returning id')).toEqual([]);
  });

  it('não "move" uma tarefa para uma empresa fora da árvore', async () => {
    await expect(comoEmpresa(3, 'update tarefas set empresa_id = 5 where id = 105'))
      .rejects.toThrow(/row-level security/);
    await expect(comoEmpresa(4, 'update tarefas set empresa_id = 2 where id = 103'))
      .rejects.toThrow(/row-level security/);
  });

  it('pode mover entre empresas que ela enxerga (Serviços → Campo)', async () => {
    const r = await comoEmpresa(2, 'update tarefas set empresa_id = 4 where id = 101 returning id');
    expect(r).toEqual([{ id: 101 }]);
  });
});
