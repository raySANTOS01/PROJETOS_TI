# Correções restantes para o `sistema_hapvida` (sobre o `origin/main` atual)

Complementa o que você já aplicou (`db:deploy`, seed só com admin, `backup.js` com modos,
`HOST`, `limpar-vendas`, front de mesma origem). Testado contra um MariaDB real: banco vazio →
`db:deploy` → seed → servidor → requisições, sem alterar o repositório original.

## Como aplicar (na raiz do projeto `hapvida-ranking/`)

**Opção A – patch:**
```bash
git apply --check /caminho/correcoes.patch     # só confere
git apply /caminho/correcoes.patch
git diff --stat
```
**Opção B – copiar** os 6 arquivos de `arquivos/` por cima, mantendo os caminhos
(`.gitignore` é arquivo oculto). Depois: `chmod +x server/backup-enviar.sh`.

```bash
git add -A && git commit -m "fix: auth por conta ativa, upload seguro, JWT_SECRET obrigatorio, backup horario"
```

## O que muda

| Arquivo | Correção |
|---|---|
| `server/src/middlewares/auth.middleware.js` | `autenticar` confere no banco se a conta está ativa e aprovada. Desativar/rejeitar/remover um corretor derruba o acesso na hora (antes valia até 30 dias). |
| `server/src/server.js` | Recusa subir sem `JWT_SECRET`; handler de erro (JSON, sem stack trace; CORS inválido → 403); o socket também confere a conta no banco e usa o papel atual. |
| `server/src/middlewares/upload.middleware.js` | A extensão vem do tipo validado, não do nome enviado (um `.html` disfarçado de imagem é salvo como `.png`). |
| `server/backup-enviar.sh` (novo) | Gera o backup (`diario`/`horario`) e envia ao R2 via `rclone copy`; `flock` (um por vez); sai com erro se algo falhar. Usado na seção 12 do guia (depois da 1ª rodada). |
| `.gitignore` | Acrescenta `*.sql`. |
| `DEPLOY-VPS.md` | Guia atualizado: fuso, `NODE_ENV=production`, deploy key, `chmod 600`, `git checkout -- package-lock.json` antes do `pull`, backup novo, runbook de restauração e cadastro de aparelhos na VPN. E-mail e backup externo marcados como "fora da primeira rodada". |

## Resultado dos testes

- `db:deploy` aplica as 12 migrações; o seed cria o admin; `ss` mostra `127.0.0.1:3333`.
- Vendedor em rota `/api/admin` → 403; admin → 200; origem CORS inválida → 403 em JSON.
- Conta desativada → 401 na API e socket recusado; reativada → volta a funcionar.
- Sem `JWT_SECRET` o servidor não sobe.
- `backup-enviar.sh horario` gera só o `.sql`; `diario` gera `.sql` + `.tar.gz`; pastas 700, arquivos 600.
- Build do front sem `localhost:3333` no bundle (URLs relativas).

## Não testado aqui

- O `limpar-vendas` rodou sem erro, mas o banco de teste não tinha vendas para apagar.
- WireGuard, `ufw`, Nginx, PM2 e o envio real ao R2 (não há VPS neste ambiente).

## Antes do deploy

- Deixe o repositório **privado**: o histórico ainda tem o `seed.js` antigo com senhas fracas.
- Na VPS o `server/.env` precisa de `HOST=127.0.0.1` e `NODE_ENV=production` (o `.env.example` traz `HOST=0.0.0.0`, que é para desenvolvimento).
