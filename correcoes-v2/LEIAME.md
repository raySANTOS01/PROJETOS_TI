# Pacote v2 para o `sistema_hapvida` (sobre o commit `965e7b4`)

Os itens de código que este pacote trazia antes (autenticação por conta ativa, upload seguro,
`JWT_SECRET` obrigatório e handler de erro) **você já aplicou** no commit "Atualização de
segurança" (os arquivos ficaram byte a byte iguais aos que testei). Restam 3 arquivos.

## Como aplicar (na raiz do projeto `hapvida-ranking/`)

**Opção A – patch:**
```bash
git apply --check /caminho/correcoes.patch     # só confere
git apply /caminho/correcoes.patch
git diff --stat
```
**Opção B – copiar** os 3 arquivos de `arquivos/` por cima, mantendo os caminhos
(`.gitignore` é arquivo oculto). Depois: `chmod +x server/backup-enviar.sh`.

```bash
git add -A && git commit -m "docs/ops: backup-enviar.sh, guia de deploy revisado e *.sql no gitignore"
```

## O que muda

| Arquivo | O que faz |
|---|---|
| `server/backup-enviar.sh` (novo) | Gera o backup (`diario` ou `horario`) e envia ao R2 via `rclone copy`; `flock` (um por vez); sai com erro se algo falhar. Usado na seção 12 do guia. |
| `.gitignore` | Acrescenta `*.sql` (dumps nunca vão para o Git). |
| `DEPLOY-VPS.md` | Guia revisado: fuso `America/Sao_Paulo`, `NODE_ENV=production`, deploy key, `chmod 600`, `git checkout -- package-lock.json` antes do `pull`, backup diário + horário, runbook de restauração, cadastro de aparelhos na VPN e **seção 18: nome no lugar do IP** (DNS, `server_name`, `CLIENT_URL`). E-mail e backup externo ficam marcados como "fora da primeira rodada". |

## Testado

- `backup-enviar.sh horario` gera só o `.sql`; `diario` gera `.sql` + `.tar.gz` (pastas 700, arquivos 600); `flock` impede execuções simultâneas; falha do `rclone` dá código de saída ≠ 0.
- O patch aplica limpo no `origin/main` atual.

## Não testado

WireGuard, `ufw`, Nginx, PM2, DNS, o nome do domínio (seção 18) e o envio real ao R2: não há VPS neste ambiente.

## Antes do deploy

- Deixe o repositório **privado**: o histórico ainda tem o `seed.js` antigo com senhas fracas.
- Na VPS o `server/.env` precisa de `HOST=127.0.0.1` e `NODE_ENV=production`.
