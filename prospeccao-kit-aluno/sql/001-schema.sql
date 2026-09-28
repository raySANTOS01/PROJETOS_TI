-- Schema dedicado da prospecção. Aplique no SEU projeto do Supabase.
-- Por que schema próprio e não public: mantém os seus leads isolados do resto do banco,
-- e o RLS abaixo nega acesso anônimo — só a chave de serviço lê e escreve.

CREATE SCHEMA IF NOT EXISTS prospeccao;

CREATE TABLE IF NOT EXISTS prospeccao.leads (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id           TEXT UNIQUE NOT NULL,

  -- origem da busca
  nicho               TEXT NOT NULL,
  praca               TEXT,
  termo_busca         TEXT,

  -- identidade (Google Maps)
  nome                TEXT,
  categoria           TEXT,
  endereco            TEXT,
  cidade              TEXT,
  uf                  TEXT,
  lat                 DOUBLE PRECISION,
  lng                 DOUBLE PRECISION,
  google_maps_url     TEXT,
  avaliacao           NUMERIC(2,1),
  total_avaliacoes    INTEGER,
  telefone_google     TEXT,

  -- site e enriquecimento
  site                TEXT,
  site_url_final      TEXT,          -- depois dos redirects
  site_status         INTEGER,       -- código HTTP (NULL = nunca testado)
  site_vivo           BOOLEAN,
  site_titulo         TEXT,
  site_erro           TEXT,
  emails              TEXT[] DEFAULT '{}',
  telefones_site      TEXT[] DEFAULT '{}',
  whatsapp            TEXT,
  instagram           TEXT,
  facebook            TEXT,
  linkedin            TEXT,
  youtube             TEXT,
  cnpj                TEXT,

  -- leitura por IA (só o que a empresa vende / porte)
  resumo_site         TEXT,
  porte_estimado      TEXT,

  -- classificação
  score               INTEGER DEFAULT 0,
  classificacao       TEXT,          -- A | B | C | D
  sinais              JSONB DEFAULT '{}'::jsonb,   -- a conta do score, auditável

  -- controle
  status              TEXT NOT NULL DEFAULT 'novo', -- novo | enriquecido | erro
  enriquecido_em      TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_google_id     ON prospeccao.leads(google_id);
CREATE INDEX IF NOT EXISTS idx_leads_nicho_classe  ON prospeccao.leads(nicho, classificacao);
CREATE INDEX IF NOT EXISTS idx_leads_status        ON prospeccao.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_score         ON prospeccao.leads(score DESC);

-- updated_at automático
CREATE OR REPLACE FUNCTION prospeccao.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_leads_touch ON prospeccao.leads;
CREATE TRIGGER trg_leads_touch BEFORE UPDATE ON prospeccao.leads
  FOR EACH ROW EXECUTE FUNCTION prospeccao.touch_updated_at();

-- RLS: ninguém entra por anon/authenticated. service_role ignora RLS.
ALTER TABLE prospeccao.leads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA prospeccao FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA prospeccao FROM anon, authenticated;
