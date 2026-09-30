# Correções para o `sistema_hapvida`

Resultado da revisão de deploy. Cada correção foi testada contra um MySQL/MariaDB
real (banco vazio → `db:deploy` → seed → servidor → requisições), sem alterar o
repositório original.

## Como aplicar

Copie os 8 arquivos da pasta `arquivos/` por cima dos do projeto, mantendo os
caminhos (`arquivos/server/seed.js` → `server/seed.js`, e assim por diante).
Atenção: `.env.example` é arquivo oculto (`ls -A`). Revise com `git diff`.

Depois:

```bash
git add -A
git commit -m "fix: correções de segurança e de deploy para a VPS"
```

## O que muda

| Arquivo | Correção |
|---|---|
| `server/seed.js` | Só cria admin(s), lidos do `.env` (`SEED_ADMIN_N_*`). Sem senhas no código, senha mínima de 10 caracteres, não imprime senha, não altera conta existente. |
| `server/package.json` | Novo `db:deploy` (`prisma generate && prisma migrate deploy`), `postinstall` que gera o Prisma Client; removido o script `corrigir-parcela1` (arquivo não existe). |
| `server/backup.js` | `--no-tablespaces` (sem ele o `mysqldump` 8 falha com o usuário da aplicação), grava direto em arquivo, valida o dump, detecta falha do `tar`, permissões 700/600, sai com código 1 em qualquer falha. |
| `server/src/server.js` | Respeita `HOST` (com `HOST=127.0.0.1` o Node só escuta localmente); recusa subir sem `JWT_SECRET`; handler de erro (JSON, sem stack trace; CORS inválido → 403); socket confere a conta no banco. |
| `server/src/middlewares/auth.middleware.js` | `autenticar` confere no banco se a conta está ativa e aprovada: desativar/rejeitar um corretor derruba o acesso na hora, mesmo com token de 30 dias. |
| `server/src/middlewares/upload.middleware.js` | Extensão do arquivo vem do tipo validado (não do nome enviado). Impede salvar `.html` disfarçado de imagem em `/uploads`. |
| `server/prisma/schema.prisma` | Só o comentário do topo (não fala mais de HostGator). |
| `server/.env.example` | `HOST`, `SEED_ADMIN_1_*`, `DATABASE_URL` com `localhost`, comentário do `CLIENT_URL`, sem linha duplicada. |

## Depois de aplicar

1. **Segredos:** as senhas do `seed.js` antigo (as 3 senhas fracas que estavam no arquivo) estão
   no histórico do Git. Considere-as comprometidas; se o repositório for público,
   é melhor recriá-lo sem esse histórico.
2. **Na VPS**, rode o servidor com `NODE_ENV=production`:
   `NODE_ENV=production pm2 start src/server.js --name vidasaude --cwd /home/deploy/hapvida-ranking/server`
3. No guia, o passo do banco continua `npm run db:deploy` (dentro de `server/`).

## Não incluído (decisão sua)

- Guardar o código de redefinição de senha com hash (hoje fica em texto no banco, expira em 15 min).
- Comprimir as imagens de `client/public` (9 MB) para a TV carregar mais rápido.
- README ainda cita `npm run setup` e HostGator; **não use o `setup` na VPS**.
- O `backup.js` não criptografa: cifre com `rclone crypt` antes de enviar para fora.
