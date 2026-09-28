-- O nome do Maps vem com serviço, cidade e slogan. A abordagem usa o nome curto e, quando houver,
-- o do profissional. `nome` continua sendo o original do Maps.
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS nome_empresa TEXT;   -- "Clínica OSPE"
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS nome_pessoa  TEXT;   -- "Dr. Paulo Mendes"
