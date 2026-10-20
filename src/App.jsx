import { useState } from 'react';
import empresas from '../data/empresas.json';
import tarefas from '../data/tarefas.json';
import { listarTarefas } from './tarefas.js';
import { prazoSLA } from './prazo.js';

// SLA contratado pelo cliente: 3 dias úteis.
const SLA_DIAS_UTEIS = 3;

// Carrega todos os data/feriados-<ano>.json que existirem (gerados por
// `npm run feriados -- <ano>`). Assim, ao baixar 2027, os prazos que caem
// em 2027 passam a usar os feriados de 2027 sem mexer no código.
const arquivosDeFeriados = import.meta.glob('../data/feriados-*.json', { eager: true, import: 'default' });
const feriados = Object.values(arquivosDeFeriados).flat().map((f) => f.date);
const anosComFeriados = new Set(
  Object.keys(arquivosDeFeriados).map((caminho) => caminho.match(/feriados-(\d{4})\.json$/)[1]),
);

export function App() {
  const [empresaId, setEmpresaId] = useState(1);
  const [de, setDe] = useState('2026-09-01');
  const [ate, setAte] = useState('2026-10-31');

  const lista = listarTarefas({ tarefas, empresas, empresaId, de, ate })
    .map((t) => ({ ...t, prazo: prazoSLA(t.criada_em, SLA_DIAS_UTEIS, feriados) }));
  // prazo num ano sem arquivo de feriados pode estar errado: avisa na tela
  const anosSemFeriados = [...new Set(lista.map((t) => t.prazo.slice(0, 4)))]
    .filter((ano) => !anosComFeriados.has(ano));

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
      </div>
      {anosSemFeriados.length > 0 && (
        <p role="alert" style={{ background: '#fff4ce', padding: 8 }}>
          Feriados de {anosSemFeriados.join(', ')} não carregados: o prazo está contando só fins de semana.
          Rode <code>npm run feriados -- {anosSemFeriados[0]}</code>.
        </p>
      )}
      {lista.length === 0 ? (
        <p>Nenhuma tarefa no período.</p>
      ) : (
        <table width="100%" cellPadding={6}>
          <thead>
            <tr><th align="left">Data</th><th align="left">Tarefa</th><th align="left">Status</th><th align="left" title={`${SLA_DIAS_UTEIS} dias úteis, contando do dia seguinte à criação`}>Prazo ({SLA_DIAS_UTEIS} dias úteis)</th></tr>
          </thead>
          <tbody>
            {lista.map((t) => (
              <tr key={t.id}><td>{t.criada_em}</td><td>{t.titulo}</td><td>{t.status}</td><td>{t.prazo}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
