# Status da entrega

**Nome:** Edylson
**Tempo total gasto (aprox.):** ~3h30 (ajustar)

## Ordem em que trabalhei

1. **Tarefa 3 (vazamento entre empresas):** é falha de segurança e de privacidade (LGPD). Cada minuto aberto expõe dados de clientes, então veio antes de tudo.
2. **Tarefa 1 (tela vazia):** sistema parado para quem escolhe o Grupo Aurora. Além disso, é a mesma regra de árvore da Tarefa 3, e a tela é usada pelas tarefas 4 e 5.
3. **Tarefa 2 (relatório errado):** é dinheiro, mas o financeiro já tinha o valor certo conferido à mão, então não bloqueava ninguém.
4. **Tarefa 4 (dias úteis):** funcionalidade de contrato, mas não é incidente. É a mais longa: API, script, regra e coluna.
5. **Tarefa 5 (CSV):** conveniência, com o contorno de copiar da tela.

Todas as branches saem da `main`, como pedido. Por isso cada uma corrige **só o seu problema**: nas branches `tarefa-4` e `tarefa-5`, a tela ainda tem o bug da Tarefa 1. Por exemplo, o Grupo Aurora continua vazio ali, e por isso as provas dessas branches usam a Vértice. As PRs mexem em partes pequenas do `App.jsx`, então os conflitos no merge devem ser triviais.

### Como testei sem internet

O ambiente onde trabalhei com a IA não tinha acesso ao npm nem à API de feriados. Por isso:

- **Banco (Tarefa 3):** rodei o `schema.sql` num **PostgreSQL 16 real**, imitando o `scripts/db.js` (mesmo papel `app_user`, mesmos grants e mesmo `set_config`). O PGlite usado pelo projeto também é Postgres 16.
- **Testes:** rodei os arquivos de `test/` com um substituto mínimo do vitest (mesmos `describe/it/expect`). **Falta confirmar com `npm test` de verdade**, inclusive o `test/rls.test.js`, que usa o PGlite.
- **Tela:** empacotei o `App.jsx` com esbuild e abri num Chromium headless para tirar prints e clicar no botão de exportar.

## Tarefa 1 — Tela de tarefas

- **Situação:** pronta.
- **Qual era o problema:** havia duas causas em `listarTarefas`.
  - **Empresa exata em vez da árvore.** O filtro era `t.empresa_id === empresaId`. O Grupo Aurora não tem nenhuma tarefa própria, então a tela ficava vazia, e a Aurora Serviços não via a Aurora Campo.
  - **Pontas do período excluídas.** O filtro era `criada_em > de && criada_em < ate`, que exclui **os dois** dias das pontas, e não só o último como o cliente suspeitava. No padrão da tela, que começa em 01/09, a tarefa 101 de 01/09 sumia.
- **Correção:** `empresasDaArvore()` percorre os descendentes em qualquer profundidade, com proteção contra ciclo, e o período passou a usar `>=` e `<=`. Um campo de data apagado na tela vira "sem limite" em vez de esconder tudo. Também adicionei a coluna "Empresa" na tela, porque o Grupo mostra tarefas de várias empresas. O nome e os parâmetros de `listarTarefas` foram mantidos.
- **Como provei que funciona:** 17 testes em `test/tarefas.test.js`: árvore, neta, isolamento da empresa 5, pontas do período, período invertido, campo vazio, ordenação e ciclo. Desses, **10 falham no código antigo**. Há prints de antes e depois em `docs/tarefa-1/`. Antes, o Grupo Aurora mostrava 0 tarefas; depois, mostra 13, nenhuma da Outra Empresa.
- **PR:** `tarefa-1` → `main`

## Tarefa 2 — Relatório de vendas

- **Situação:** pronta. O relatório agora dá **R$ 3.400,50**.
- **Qual era o problema:** três causas somadas.

| Causa | Efeito em 01/10 |
|---|---|
| O dia era cortado do horário UTC (`slice(0,10)`) | Entrava a V-0990, de **23:00 de 30/09** em Brasília (+600,00). Saíam a V-0995 e a V-0996, de 22:30 e 23:45 de 01/10 em Brasília (−950,00). |
| A sincronização manda vendas repetidas (V-0992, V-0994, V-0997) | V-0992 e V-0994 contavam duas vezes (+1.450,50). |
| Soma em ponto flutuante | Risco de centavos errados, como `0.1 + 0.2 = 0.30000000000000004`. |

  A conta fecha: 4.501,00 − 600,00 − 1.450,50 + 950,00 = **3.400,50**.

- **Correção:** o dia de Brasília é calculado pelo fuso `America/Sao_Paulo` (e não por "−3h" fixo, para aguentar a volta do horário de verão). Cada id de venda conta uma vez, valendo a última versão recebida. A soma é feita em centavos inteiros. O `ticketMedio` também estava errado: dividia por canceladas e repetidas (R$ 643,00) e agora dá R$ 680,10. O `vendas.json` não foi alterado, e os nomes e parâmetros foram mantidos.
- **Como provei que funciona:** `npm run relatorio -- 2026-10-01` deu R$ 4.501,00 antes e **R$ 3.400,50** depois. O resultado é o mesmo rodando com `TZ=UTC`, `America/Sao_Paulo`, `Asia/Tokyo` e `America/Los_Angeles`. Há 17 testes em `test/relatorio.test.js`, incluindo a virada exata do dia (02:59:59Z × 03:00:00Z) e os totais dos outros dias. Desses, **12 falham no código antigo**.
- **PR:** `tarefa-2` → `main`

## Tarefa 3 — Cliente vendo dado de outra empresa

- **Situação:** pronta.
- **Qual era o problema:** havia três falhas no `sql/schema.sql`.
  - **Política aberta somada às outras.** A política `tarefas_importacao` era `for all using (true) with check (true)`, criada "para a importação inicial (#412)". Políticas permissivas se somam com **OR**, então ela liberava ler, criar, alterar e apagar **qualquer** tarefa, para todo mundo.
  - **Leitura sem a árvore.** Mesmo sem ela, a política de leitura comparava só a empresa exata. O Grupo Aurora não veria nada, e a Aurora Serviços não veria a Aurora Campo.
  - **Escrita sem trava.** Não existia nenhuma regra própria para criar, alterar ou apagar.
- **Correção:**
  - A função `empresas_visiveis()` devolve a empresa logada mais os descendentes, com uma CTE recursiva. Ela é `security definer` com `search_path` fixo, e sem `app.empresa_id` não devolve nada.
  - Uma única política `for all` em `tarefas`, com `using` e `with check` pela árvore. Ela impede criar tarefa para outra empresa e "mover" uma tarefa para fora da árvore.
  - `force row level security` em `tarefas`.
  - Leitura de `empresas` com a mesma regra, para que a Vértice não fique sabendo da Outra Empresa.
  - Tabelas e colunas não foram alteradas.
- **Como provei que funciona:** rodei como cada empresa, num Postgres 16 real, antes e depois:

| Empresa logada | Antes | Depois |
|---|---|---|
| 1 Grupo Aurora | 15 tarefas (incl. 107 e 111 da empresa 5) | 13 tarefas do grupo |
| 2 Aurora Serviços | 15 | 9 (dela + Aurora Campo) |
| 3 Vértice | 15 | 4 (105, 106, 110, 114) |
| 4 Aurora Campo | 15 | 4 |
| 5 Outra Empresa | 15 | 2 (107, 111) |
| sem empresa | 15 | 0 |

  Também testei a escrita, logado na Vértice:
  - criar tarefa para a empresa 5 ou para a empresa 1 → **erro de RLS**;
  - alterar ou apagar a tarefa 107 → **0 linhas afetadas**;
  - mover a 105 para a empresa 5 → **erro**.

  A Aurora Serviços pode mover uma tarefa para a Aurora Campo, porque enxerga as duas. Uma bisneta criada no teste também aparece para a Aurora Serviços. Tudo isso está automatizado em `test/rls.test.js` (PGlite).
- **PR:** `tarefa-3` → `main`

## Tarefa 4 — Prazo em dias úteis

- **Situação:** código pronto, mas o **`data/feriados-2026.json` ainda precisa ser gerado e commitado**. O ambiente que usei não acessava a internet e o enunciado proíbe digitar as datas, então ele precisa ser gerado rodando `npm run feriados -- 2026` numa máquina com internet.
- **Qual API de feriados usei e por quê:** a **BrasilAPI** (`https://brasilapi.com.br/api/feriados/v1/{ano}`). Ela é brasileira, gratuita, sem chave e de **código aberto**. Li o código-fonte do serviço de feriados (repositório BrasilAPI/BrasilAPI) para saber exatamente como cada data é calculada. Isso revelou dois pontos:
  - **Carnaval e Corpus Christi vêm como `national`**, mas pela lei são pontos facultativos (Leis 662/1949 e 6.802/1980). Mantive o que a API devolve, porque a regra é não editar à mão, mas é uma **decisão do cliente**: se ele trabalha no Carnaval, os prazos dessa época ficam um ou dois dias mais longos do que deveriam.
  - **O cálculo dos feriados móveis da API depende do fuso do servidor.** Rodando o mesmo código num fuso a leste de UTC, todos os móveis saem um dia antes (Sexta-feira Santa numa quinta). Por isso o script **confere o dia da semana** de Sexta-feira Santa, Páscoa, Carnaval e Corpus Christi e recusa a resposta se vier deslocada.
- **Correção:** `prazoSLA` conta a partir do dia seguinte à criação e pula sábados, domingos e feriados. Toda a conta é feita em UTC, só com datas; o código antigo misturava UTC com hora local e somava dias corridos. Um dia útil é contado só quando cai de segunda a sexta. O script `npm run feriados -- <ano>` filtra os `national`, valida e salva `{ date, name }`. Na tela há a coluna "Prazo (3 dias úteis)". A tela carrega **todos** os `data/feriados-*.json`, então basta baixar 2027 para os prazos de fim de ano ficarem certos, e ela mostra um aviso quando falta o arquivo do ano de algum prazo. O nome e os parâmetros de `prazoSLA` foram mantidos.
- **Como provei que funciona:** 15 testes em `test/prazo.test.js`:
  - o caso do chamado: sexta + 1 dia → segunda;
  - criada no sábado ou num feriado;
  - 12/10 no meio da janela;
  - 20/11 colado no fim de semana;
  - virada do ano;
  - feriado no domingo;
  - entradas inválidas.

  Eles passam com `TZ` = São Paulo, Tóquio, Kiritimati (UTC+14) e Los Angeles. **12 falham no código antigo**. Há mais 7 testes em `test/feriados.test.js`, para o script, com `fetch` simulado. Também rodei o script de ponta a ponta com a API simulada (a resposta gerada pelo próprio código da BrasilAPI), com uma resposta deslocada (recusada) e sem rede (mensagem clara).
- **PR:** `tarefa-4` → `main`

## Tarefa 5 — Exportar para o Excel

- **Situação:** pronta.
- **Qual era o problema:** o CSV usava vírgula, que no Excel em português é o separador decimal, por isso tudo caía numa coluna. Não tinha BOM UTF-8, por isso os acentos quebravam. Não punha aspas: o título da tarefa 112, `Treinamento "Vendas 2026"; turma 1`, se dividia mesmo com `;`. As datas estavam em `AAAA-MM-DD`.
- **Correção:**
  - separador `;`;
  - BOM UTF-8;
  - aspas no padrão RFC 4180 para campos com `;`, aspas ou quebra de linha;
  - datas `DD/MM/AAAA` sem passar por `Date`, sem risco de fuso;
  - proteção contra **CSV injection**: títulos que começam com `= + - @` ganham um apóstrofo. Sem isso, a tarefa 114 (`=SOMA(despesas) conferir na auditoria`) seria executada como fórmula.

  O botão "Exportar CSV" baixa exatamente a lista que está na tela. O nome e os parâmetros de `gerarCSV` foram mantidos.
- **Como provei que funciona:**
  - 13 testes em `test/exportar.test.js`, com um leitor de CSV que confere 4 colunas em toda linha e todos os títulos intactos. **12 falham no código antigo**.
  - Abri o CSV antigo e o novo no LibreOffice como planilha. O antigo ficou com tudo numa coluna (e a 112 quebrada), como o cliente relatou. O novo ficou com 4 colunas, acentos certos e datas reconhecidas.
  - Cliquei no botão no navegador, e o arquivo baixado começa com o BOM e contém só as tarefas da tela. Print em `docs/tarefa-5/`.
  - **Não testei no Excel de verdade.**
- **PR:** `tarefa-5` → `main`

## Encontrei também

- **`app.empresa_id` pode ser trocado pela própria pessoa.** Quem consegue rodar SQL como `app_user` pode executar `set_config('app.empresa_id', '1', false)` e virar o Grupo Aurora. Esse modelo só é seguro se o usuário final **nunca** mandar SQL direto: o servidor tem que definir a empresa a partir do login. O ideal é um papel por sessão ou um claim assinado (JWT), e não uma variável que o próprio usuário pode alterar.
- **Importação (#412).** A carga em massa deve rodar com um papel próprio (dono da tabela sem FORCE, ou com `BYPASSRLS`). Uma política aberta como a que existia não deve voltar.
- **A tela não usa o banco.** O `App.jsx` lê o `tarefas.json` direto e filtra no navegador. Em produção, quem faz a regra de acesso precisa ser o servidor (RLS), e não o filtro da tela. O seletor de empresas também mostra todas as empresas, incluindo a Outra Empresa.
- **`vendas.json` com repetidas.** Corrigi a leitura, mas vale avisar quem cuida da sincronização, porque outros relatórios podem estar inflados também.
- **Feriados de outros anos.** Prazos que caem em 2027 só ficam certos depois de `npm run feriados -- 2027`. A tela avisa quando falta.
- **Carnaval e Corpus Christi:** confirmar com o cliente se contam como dia útil.
- **`npm install` com cache.** Ele falhou no ambiente da IA por bloqueio de rede, sem relação com o projeto.

## O que ficou faltando / o que eu faria com mais tempo

- **Gerar e commitar o `data/feriados-2026.json`** na branch `tarefa-4`, com `npm run feriados -- 2026`. O ambiente da IA não tinha internet.
- **Rodar `npm test` com o vitest de verdade**, principalmente o `test/rls.test.js` com PGlite. A lógica SQL foi provada em Postgres 16, mas esse arquivo de teste não chegou a rodar.
- **Abrir o CSV no Excel** (só testei no LibreOffice).
- **Mover a filtragem da tela para uma API** que consulte o banco com RLS.
