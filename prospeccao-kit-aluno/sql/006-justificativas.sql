-- A nota e a oportunidade por extenso. `sinais` e `marketing` (jsonb) continuam sendo a conta;
-- estas colunas são a conta lida em português, para quem abre a tabela ou a planilha.
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS justificativa_nota         TEXT;  -- "A · 85 de 100 (quente...). Somou: ... Faltou: ..."
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS justificativa_oportunidade TEXT;  -- "Oportunidade alta: não anuncia e o site..."
