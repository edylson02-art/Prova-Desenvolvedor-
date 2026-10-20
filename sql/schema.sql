-- Banco das tarefas. Cada pessoa logada pertence a UMA empresa, que o
-- servidor grava em app.empresa_id antes de cada consulta.
-- A pessoa vê a própria empresa e as empresas abaixo dela na árvore.

create table empresas (
  id     int primary key,
  nome   text not null,
  pai_id int references empresas(id)
);

create table tarefas (
  id         int primary key,
  empresa_id int not null references empresas(id),
  titulo     text not null,
  status     text not null default 'aberta',
  criada_em  date not null
);

-- Empresas que a pessoa logada pode acessar: a empresa de app.empresa_id e
-- todas as que estão abaixo dela, em qualquer nível (filhas, netas...).
--
-- * security definer: percorre a árvore lendo `empresas` com os direitos do
--   dono da função, sem depender da política de `empresas` (que, por sua vez,
--   usa esta função — sem isso haveria recursão infinita).
-- * search_path fixo: impede que alguém "sequestre" a tabela empresas criando
--   outra com o mesmo nome num schema próprio.
-- * sem app.empresa_id (ou vazio) não devolve nada: na dúvida, ninguém vê nada.
create function empresas_visiveis() returns setof int
  language sql stable security definer
  set search_path = public, pg_temp
as $$
  with recursive arvore(id) as (
    select id
      from empresas
     where id = nullif(current_setting('app.empresa_id', true), '')::int
    union
    select e.id
      from empresas e
      join arvore a on e.pai_id = a.id
  )
  select id from arvore
$$;

alter table tarefas enable row level security;
-- vale também para o dono das tabelas (só superusuário ignora)
alter table tarefas force row level security;

-- Ler, alterar, criar e apagar: só tarefas das empresas visíveis.
-- using      → quais linhas existentes a pessoa enxerga / pode alterar / apagar
-- with check → como a linha pode ficar depois de um insert ou update
--              (impede criar tarefa para outra empresa ou "mover" uma tarefa
--              para uma empresa fora da árvore da pessoa)
create policy tarefas_da_arvore on tarefas
  for all
  using      (empresa_id in (select empresas_visiveis()))
  with check (empresa_id in (select empresas_visiveis()));

-- A lista de empresas também segue a regra: a Vértice não fica sabendo que a
-- Outra Empresa S.A. existe, e vice-versa. Só leitura: cadastro de empresa não
-- é feito pela pessoa logada.
-- (sem FORCE aqui de propósito: empresas_visiveis() roda como o dono e
-- precisa ler a árvore inteira para calcular os descendentes.)
alter table empresas enable row level security;

create policy empresas_da_arvore on empresas
  for select
  using (id in (select empresas_visiveis()));

-- A antiga política "tarefas_importacao" (for all using (true), chamado #412)
-- foi removida: políticas permissivas se somam com OR, então ela liberava
-- tudo para todo mundo e anulava a de leitura. Importação em massa deve rodar
-- com um papel próprio (dono das tabelas sem FORCE, ou com BYPASSRLS), nunca
-- com uma política aberta para a pessoa logada.
