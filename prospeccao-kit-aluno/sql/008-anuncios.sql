-- Anúncio ativo na Biblioteca de Anúncios da Meta, pelo Apify. Busca pelo nome limpo da empresa
-- (nome_empresa), porque a página que anuncia nem sempre é a ligada ao Instagram.
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS anuncios               JSONB;        -- ativos, páginas, desde, exemplos, citada_por
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS anuncios_ativos        INTEGER;      -- 0 = não achou; 5 = 5 ou mais
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS justificativa_anuncios TEXT;
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS anuncios_consultado_em TIMESTAMPTZ;
