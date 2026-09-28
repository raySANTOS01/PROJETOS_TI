// Acesso ao schema prospeccao no seu projeto no Supabase, via conexão Postgres direta.
import pg from 'pg';
import { env, exigir } from './env.mjs';

let pool;
function conexao() {
  if (!pool) {
    // Exigido aqui, e não no topo do módulo: no topo derruba a tela de ajuda com stack trace,
    // porque o import acontece antes do try/catch da CLI.
    exigir('SUPABASE_DB_URL');
    pool = new pg.Pool({
      connectionString: env.SUPABASE_DB_URL,
      ssl: { rejectUnauthorized: false },
      max: 4,
    });
  }
  return pool;
}

/**
 * Toda consulta roda numa transação que PEDE escrita. A URL que o Supabase entrega é a do pooler
 * em modo transação (porta 6543), onde as conexões são compartilhadas: se algum outro cliente deu
 * `SET default_transaction_read_only = on` e não desfez, o ajuste fica na conexão e o próximo a
 * pegá-la recebe "cannot execute UPDATE in a read-only transaction" (aconteceu em 14/set/2026, no
 * meio de um enriquecimento). `BEGIN READ WRITE` vale só para a transação e vence o ajuste vazado.
 */
export async function consultar(sql, params = []) {
  const cliente = await conexao().connect();
  try {
    await cliente.query('BEGIN READ WRITE');
    const resultado = await cliente.query(sql, params);
    await cliente.query('COMMIT');
    return resultado;
  } catch (e) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    cliente.release();
  }
}
export const encerrar = async () => { if (pool) await pool.end(); pool = null; };

/**
 * Grava o lead vindo do Maps. Rodar de novo NÃO duplica: o google_id manda.
 * Em conflito, só refresca os dados do Maps — o enriquecimento já feito fica de pé.
 * Devolve { novo: boolean } pra CLI saber o que contar.
 */
export async function inserirLead(lead) {
  const { rows } = await consultar(
    `INSERT INTO prospeccao.leads
       (google_id, nicho, praca, termo_busca, nome, categoria, endereco, cidade, uf,
        lat, lng, google_maps_url, avaliacao, total_avaliacoes, telefone_google, site)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (google_id) DO UPDATE SET
       avaliacao        = EXCLUDED.avaliacao,
       total_avaliacoes = EXCLUDED.total_avaliacoes,
       telefone_google  = COALESCE(EXCLUDED.telefone_google, prospeccao.leads.telefone_google),
       site             = COALESCE(prospeccao.leads.site, EXCLUDED.site),
       updated_at       = now()
     RETURNING (xmax = 0) AS novo`,
    [lead.google_id, lead.nicho, lead.praca, lead.termo_busca, lead.nome, lead.categoria,
     lead.endereco, lead.cidade, lead.uf, lead.lat, lead.lng, lead.google_maps_url,
     lead.avaliacao, lead.total_avaliacoes, lead.telefone_google, lead.site],
  );
  return { novo: rows[0].novo };
}

/** `refazer` devolve à fila quem foi enriquecido antes de existir a leitura de marketing. */
export async function leadsPendentes({ nicho, limite, refazer = false }) {
  const filtro = nicho ? `AND nicho = $2` : '';
  const estado = refazer ? `(status = 'novo' OR (status = 'enriquecido' AND situacao_site IS NULL))` : `status = 'novo'`;
  const { rows } = await consultar(
    `SELECT * FROM prospeccao.leads
      WHERE ${estado} ${filtro}
      ORDER BY total_avaliacoes DESC NULLS LAST
      LIMIT $1`,
    nicho ? [limite, nicho] : [limite],
  );
  return rows;
}

/**
 * O texto do site fica guardado para a IA da conversa ler depois (comando `ia`). Texto novo — site
 * que mudou ou morreu — apaga a leitura antiga: o resumo tem que ser do site de agora.
 * (Do lado direito do SET, texto_site ainda é o valor antigo.)
 */
export async function salvarEnriquecimento(id, d) {
  await consultar(
    `UPDATE prospeccao.leads SET
       site = COALESCE($2, site), site_url_final = $3, site_status = $4, site_vivo = $5,
       site_titulo = $6, site_erro = $7, emails = $8, telefones_site = $9, whatsapp = $10,
       instagram = $11, facebook = $12, linkedin = $13, youtube = $14, cnpj = $15,
       texto_site = $16,
       resumo_site    = CASE WHEN $16::text IS DISTINCT FROM texto_site THEN NULL ELSE resumo_site END,
       porte_estimado = CASE WHEN $16::text IS DISTINCT FROM texto_site THEN NULL ELSE porte_estimado END,
       site_lido_em   = CASE WHEN $16::text IS DISTINCT FROM texto_site THEN NULL ELSE site_lido_em END,
       score = $17, classificacao = $18,
       sinais = $19, status = $20, situacao_site = $21, marketing = $22, oportunidade = $23,
       justificativa_nota = $24, justificativa_oportunidade = $25, enriquecido_em = now()
     WHERE id = $1`,
    [id, d.site, d.site_url_final, d.site_status, d.site_vivo, d.site_titulo, d.site_erro,
     d.emails, d.telefones_site, d.whatsapp, d.instagram, d.facebook, d.linkedin,
     d.youtube, d.cnpj, d.texto_site ?? null, d.score, d.classificacao,
     JSON.stringify(d.sinais), d.status, d.situacao_site,
     d.marketing ? JSON.stringify(d.marketing) : null, d.oportunidade,
     d.justificativa_nota ?? null, d.justificativa_oportunidade ?? null],
  );
}
