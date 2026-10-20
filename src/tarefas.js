/**
 * Ids da empresa escolhida e de todas as empresas abaixo dela na árvore
 * (filhas, netas...). Regra do negócio: quem escolhe uma empresa vê os dados
 * dela e de todas as de baixo.
 *
 * @param {Array}  empresas  lista de empresas (data/empresas.json)
 * @param {number} empresaId empresa escolhida
 * @returns {Set<number>}
 */
export function empresasDaArvore(empresas, empresaId) {
  const raiz = Number(empresaId);
  const ids = new Set();
  if (!empresas.some((e) => e.id === raiz)) return ids; // empresa inexistente: nada

  const fila = [raiz];
  while (fila.length > 0) {
    const atual = fila.shift();
    if (ids.has(atual)) continue; // protege contra ciclo no cadastro
    ids.add(atual);
    for (const e of empresas) {
      if (e.pai_id === atual) fila.push(e.id);
    }
  }
  return ids;
}

/**
 * Lista as tarefas que a pessoa vê quando escolhe uma empresa no seletor.
 *
 * @param {object}   p
 * @param {Array}    p.tarefas   lista de tarefas (data/tarefas.json)
 * @param {Array}    p.empresas  lista de empresas (data/empresas.json)
 * @param {number}   p.empresaId empresa escolhida no seletor
 * @param {string}   p.de        data inicial, 'YYYY-MM-DD' (inclusive; vazio = sem limite)
 * @param {string}   p.ate       data final, 'YYYY-MM-DD' (inclusive; vazio = sem limite)
 * @returns {Array} tarefas ordenadas pela data de criação
 */
export function listarTarefas({ tarefas, empresas, empresaId, de, ate }) {
  const visiveis = empresasDaArvore(empresas, empresaId);
  // criada_em é 'YYYY-MM-DD' (só data, sem hora), então comparar texto é
  // comparar datas — e com >= / <= os dois dias das pontas entram.
  return tarefas
    .filter((t) => visiveis.has(t.empresa_id))
    .filter((t) => (!de || t.criada_em >= de) && (!ate || t.criada_em <= ate))
    .sort((a, b) => a.criada_em.localeCompare(b.criada_em) || a.id - b.id);
}
