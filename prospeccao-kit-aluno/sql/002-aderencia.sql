-- O lead pode ser ótimo e ainda assim não ser do nicho buscado.
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS aderente_nicho BOOLEAN;
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS motivo_nicho   TEXT;
CREATE INDEX IF NOT EXISTS idx_leads_aderente ON prospeccao.leads(nicho, aderente_nicho, score DESC);
