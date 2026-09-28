-- Pesquisa no Google (Serper) do que o Maps e o site não trouxeram: site, Instagram, LinkedIn e CNPJ.
-- A origem importa: o que veio da pesquisa é pista até ser conferido (telefone do site, perfil pelo Apify, CEP na Receita).
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS site_origem        TEXT;          -- maps | pesquisa
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS instagram_origem   TEXT;          -- site | pesquisa
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS linkedin_origem    TEXT;          -- site | pesquisa
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS pesquisa           JSONB;         -- o que buscou, quantas buscas, o que achou e o que descartou
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS pesquisado_em      TIMESTAMPTZ;
