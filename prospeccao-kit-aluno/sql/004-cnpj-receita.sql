-- Quem é a empresa no papel. O site entrega o CNPJ em ~1 a cada 8 leads; o resto é procurado pelo
-- nome (pesquisa no Google pelo Serper) e só é aceito se o CEP da Receita bater com o do Maps.
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS receita            JSONB;        -- razão social, abertura, porte, capital, sócios
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS razao_social       TEXT;
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS decisor            TEXT;         -- o sócio-administrador
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS cnpj_origem        TEXT;         -- site | busca
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS cnpj_nota          TEXT;         -- por que não achou ou por que descartou
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS cnpj_consultado_em TIMESTAMPTZ;
