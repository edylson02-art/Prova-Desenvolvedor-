// Baixa os feriados nacionais de um ano e salva em data/feriados-<ano>.json.
// Uso: npm run feriados -- 2026
import { writeFileSync } from 'node:fs';
import { baixarFeriadosNacionais, URL_BRASILAPI } from '../src/feriados.js';

const ano = process.argv[2];
if (!ano) {
  console.error('Informe o ano: npm run feriados -- 2026');
  process.exit(1);
}

try {
  const feriados = await baixarFeriadosNacionais(ano);
  const destino = new URL(`../data/feriados-${ano}.json`, import.meta.url);
  writeFileSync(destino, JSON.stringify(feriados, null, 2) + '\n');
  console.log(`${feriados.length} feriados nacionais de ${ano} (fonte: ${URL_BRASILAPI(ano)})`);
  for (const f of feriados) console.log(`  ${f.date}  ${f.name}`);
  console.log(`Salvo em data/feriados-${ano}.json`);
} catch (erro) {
  console.error(`Erro: ${erro.message}`);
  process.exit(1);
}
