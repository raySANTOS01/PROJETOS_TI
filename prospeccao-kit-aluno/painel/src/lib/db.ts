import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { Pool, types } from 'pg';

// A senha do banco é a mesma do prospectar.mjs e mora num lugar só: o .env.local da pasta de cima.
// Um SUPABASE_DB_URL no ambiente (ou num .env.local dentro de painel/) ganha dele.
function urlDoBanco() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  const arquivo = path.join(process.cwd(), '..', '.env.local');
  if (!fs.existsSync(arquivo)) return undefined;
  const linha = fs.readFileSync(arquivo, 'utf8').split(/\r?\n/).find((l) => /^\s*SUPABASE_DB_URL\s*=/.test(l));
  return linha?.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') || undefined;
}

// O driver devolve timestamp como objeto Date. Um Date que atravessa a fronteira Server ->
// Client Component chega como Date de novo, mas qualquer codigo que o trate como string
// (localeCompare, split) quebra em runtime. Padronizamos tudo em ISO string na saida do banco:
// uma forma so para o painel inteiro.
const paraIso = (v: string | null) => (v === null ? null : new Date(v).toISOString());
types.setTypeParser(types.builtins.TIMESTAMPTZ, paraIso);
types.setTypeParser(types.builtins.TIMESTAMP, paraIso);

// O painel fala com o banco por `pg`, sempre no servidor: a senha nunca chega ao navegador.
declare global {
  // eslint-disable-next-line no-var
  var __painelPool: Pool | undefined;
}

export const pool =
  global.__painelPool ??
  new Pool({
    connectionString: urlDoBanco(),
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30_000,
  });

if (process.env.NODE_ENV !== 'production') global.__painelPool = pool;

export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

export async function one<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
