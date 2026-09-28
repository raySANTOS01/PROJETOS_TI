-- O Instagram da empresa, pelo Apify. `instagram` (o link) já existia, vindo do site; aqui entra o perfil.
-- Colunas soltas para o que filtra e ordena; o resto (bio, legendas, médias) fica no jsonb.
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS instagram_perfil        JSONB;        -- usuario, seguidores, posts, legendas...
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS seguidores              INTEGER;
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS posts_instagram         INTEGER;
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS ultimo_post_instagram   TIMESTAMPTZ;
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS justificativa_instagram TEXT;         -- "2,3 mil seguidores, 412 posts. Último post há 94 dias..."
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS abordagem_instagram     TEXT;         -- leitura do perfil + 3 ganchos (a IA da conversa, comando `ia`)
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS instagram_nota          TEXT;         -- por que não consultou ou não achou
ALTER TABLE prospeccao.leads ADD COLUMN IF NOT EXISTS instagram_consultado_em TIMESTAMPTZ;
