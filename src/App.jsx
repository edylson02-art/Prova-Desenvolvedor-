import { useState } from 'react';
import empresas from '../data/empresas.json';
import tarefas from '../data/tarefas.json';
import { listarTarefas } from './tarefas.js';
import { gerarCSV } from './exportar.js';

// Baixa exatamente as tarefas que estão na tela (empresa e período escolhidos).
function baixarCSV(lista) {
  const arquivo = new Blob([gerarCSV(lista)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement('a');
  link.href = url;
  link.download = `tarefas-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function App() {
  const [empresaId, setEmpresaId] = useState(1);
  const [de, setDe] = useState('2026-09-01');
  const [ate, setAte] = useState('2026-10-31');

  const lista = listarTarefas({ tarefas, empresas, empresaId, de, ate });

  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 720, margin: '32px auto', padding: '0 16px' }}>
      <h1>Tarefas</h1>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <select value={empresaId} onChange={(e) => setEmpresaId(Number(e.target.value))}>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>{e.nome}</option>
          ))}
        </select>
        <label>De <input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></label>
        <label>Até <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></label>
        <button type="button" onClick={() => baixarCSV(lista)}>
          Exportar CSV
        </button>
      </div>
      {lista.length === 0 ? (
        <p>Nenhuma tarefa no período.</p>
      ) : (
        <table width="100%" cellPadding={6}>
          <thead>
            <tr><th align="left">Data</th><th align="left">Tarefa</th><th align="left">Status</th></tr>
          </thead>
          <tbody>
            {lista.map((t) => (
              <tr key={t.id}><td>{t.criada_em}</td><td>{t.titulo}</td><td>{t.status}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
