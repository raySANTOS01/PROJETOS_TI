// Carrega o .env.local desta pasta. Sem dependência externa.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function carregar() {
  const arquivo = path.join(RAIZ, '.env.local');
  // Sem o arquivo, devolve vazio em vez de lançar: isto roda no import, antes do try/catch da CLI,
  // e lançar aqui derrubava até a tela de ajuda com stack trace. Quem precisa de chave cai no exigir().
  if (!fs.existsSync(arquivo)) return {};
  const env = {};
  for (const linha of fs.readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
    if (!linha.includes('=') || linha.trim().startsWith('#')) continue;
    const i = linha.indexOf('=');
    env[linha.slice(0, i).trim()] = linha.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

export const env = carregar();

export function exigir(...chaves) {
  const faltando = chaves.filter((c) => !env[c]);
  if (!faltando.length) return;
  if (!fs.existsSync(path.join(RAIZ, '.env.local'))) {
    throw new Error(`.env.local não encontrado em ${RAIZ}. Copie o .env.exemplo para .env.local. Veja o COMECE-AQUI.md deste kit.`);
  }
  throw new Error(`Faltam chaves no .env.local: ${faltando.join(', ')}`);
}
