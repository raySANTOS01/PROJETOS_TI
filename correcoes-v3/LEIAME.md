# Pacote v3 para o `sistema_hapvida` (sobre o commit `cc7b368`)

Substitui o `correcoes-v2`. Testado contra um MariaDB real, com os recursos novos (logs de
auditoria e exportação para planilha) funcionando.

## IMPORTANTE: regressão no `server.js`

O commit `e511aea` ("Implementação de logs e exportação") **desfez 3 correções de segurança** do
`server.js` (provavelmente porque foi feito sobre uma cópia antiga do arquivo):

1. recusar subir sem `JWT_SECRET`;
2. handler de erro (sem isso, um erro devolve página HTML com o stack trace do servidor);
3. o socket conferir no banco se a conta está ativa (sem isso, conta desativada continua
   recebendo o ranking em tempo real por até 30 dias).

Este pacote as restaura **sem perder** o que o commit novo acrescentou (`exposedHeaders`, etc.).
`auth.middleware.js` e `upload.middleware.js` continuam corrigidos. **Antes de editar o `server.js`
de novo, faça `git pull`**, para não sobrescrever com uma cópia velha.

## Como aplicar (na raiz do projeto `hapvida-ranking/`)

```bash
git pull
git apply --check /caminho/correcoes.patch     # só confere
git apply /caminho/correcoes.patch
git diff --stat
git add -A && git commit -m "fix: restaura protecoes do server.js; backup-enviar, verificador e guias"
```
Ou copie os 6 arquivos de `arquivos/` por cima (`.gitignore` é oculto) e `chmod +x server/backup-enviar.sh`.

## O que há no pacote

| Arquivo | O que faz |
|---|---|
| `server/src/server.js` | Restaura `JWT_SECRET` obrigatório, handler de erro e conferência de conta no socket. |
| `server/backup-enviar.sh` | Gera o backup (`diario`/`horario`) e envia ao R2 (`rclone copy`); `flock`; sai com erro se falhar. |
| `server/verificar-migracao.js` | Confere contagens, se a `DADOS_SENSIVEIS_CHAVE` abre os campos cifrados e se os arquivos existem; não imprime dado pessoal. |
| `MIGRAR-PC-PARA-VPS.md` | Roteiro para levar banco + fotos + documentos do PC para a VPS. |
| `DEPLOY-VPS.md` | Guia revisado (fuso, `NODE_ENV`, deploy key, backup diário + horário, runbook, VPN, seção 18 nome no lugar do IP, seção 19 migração). |
| `.gitignore` | Acrescenta `*.sql`. |

## Resultado dos testes

- `db:deploy` aplica as 13 migrações; seed cria o admin; o servidor escuta só em `127.0.0.1:3333`.
- Sem `JWT_SECRET` o servidor não sobe; CORS inválido → 403 em JSON.
- Vendedor em `/api/admin` → 403; admin → 200; **logs** e **exportação** só para admin (vendedor → 403).
- A exportação devolve um `.xlsx` válido e registra "Dados exportados" no log.
- Conta desativada → 401 na API e socket recusado; reativada → volta.

## Atenção na VPS

- **Fuso `America/Sao_Paulo`**: as horas das planilhas e dos logs seguem o relógio do servidor.
- Os logs guardam o IP: atrás do Nginx, é o IP do aparelho na VPN (`10.10.0.x`), o que identifica o aparelho.
- A tabela `logs_auditoria` cresce sem limite (inclui tentativas de login falhas). Vale um
  plano de retenção (ex.: apagar com mais de 12 meses) mais adiante.
- Não testado: WireGuard, `ufw`, Nginx, PM2, DNS e o envio real ao R2 (não há VPS neste ambiente).
