-- Duas perguntas que o score não responde.
--
-- 1. Qual venda cabe nesse lead? Quem não tem site compra site; quem tem site e não anuncia compra
--    tráfego. situacao_site é a tag que separa, e marketing guarda o que a página inicial entregou.
-- 2. O lead passa nos requisitos do nicho? Requisito elimina (faixa de avaliações, celular);
--    o score só ordena quem passou.
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS situacao_site     TEXT;   -- com_site | sem_site | site_morto
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS marketing         JSONB;  -- pixel, mobile, copyright, botão de WhatsApp
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS oportunidade      TEXT;   -- alta | media | baixa (só com site vivo)
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS celular           TEXT;   -- o melhor celular achado, E.164
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS requisitos_ok     BOOLEAN;
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS motivo_requisitos TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_situacao_site ON prospeccao.leads(nicho, situacao_site);
