# Migrar o banco e os arquivos do PC para a VPS

Roteiro para levar **todos os dados** do sistema que roda no seu PC para a VPS, sem perder
nada e sem expor dado de cliente. Os dados são duas coisas:

| O quê | Onde fica | Como viaja |
|---|---|---|
| Banco (corretores, solicitações, vendas, adesões, metas, logs) | MySQL | `.sql` gerado pelo `backup.js` |
| Arquivos (fotos de perfil e documentos de clientes) | `server/uploads/` e `server/documentos-privados/` | `.tar.gz` gerado pelo `backup.js` |

O `backup.js` (modo diário, sem argumento) gera os dois ao mesmo tempo.

**Testado** (MariaDB local, com um "PC" de 11 migrações e uma "VPS" vazia): restaurar o `.sql`,
rodar `db:deploy` (aplicou as 2 migrações que faltavam) e restaurar o `.tar.gz` deixa a VPS
igual ao PC. A ferramenta `verificar-migracao.js` acusou corretamente chave errada e arquivos
faltando. **Não testado aqui:** a VPS real, o WireGuard e o `scp` a partir do Windows.

---

## 0. Regras que não podem ser quebradas

1. **A `DADOS_SENSIVEIS_CHAVE` da VPS tem que ser exatamente a do PC.** CPF, CNPJ,
   pré-existências e os documentos foram cifrados com ela. Chave diferente = dado ilegível.
   - Use no PC uma chave **forte** (48 bytes aleatórios) e guarde no gerenciador de senhas.
   - Se a chave do PC é fraca ou de teste, **não a leve para produção**: é preciso recifrar tudo
     (campos e arquivos) com uma chave nova. Me peça o script de recifragem antes de migrar.
2. **Um sistema de cada vez.** Depois da troca, o PC para de ser usado. Dois bancos em uso
   ao mesmo tempo não têm como ser juntados.
3. **O código da VPS tem que estar no mesmo commit do PC ou mais novo.** Se o PC tiver uma
   migração que a VPS não conhece, o `db:deploy` não resolve. Faça `git pull` nos dois lados.
4. **Os arquivos de backup têm dado de cliente.** Só trafegam pela VPN (`scp`), nunca por
   WhatsApp, e-mail ou nuvem sem cifrar. Apague depois.
5. **Contas de teste com senha fraca não vão para produção.** Veja a seção 5.

## 1. Ensaio (faça uma vez antes do dia da troca)

Rode **todo este roteiro com os dados de teste atuais** do PC, numa VPS ainda sem uso real.
Confirme que a verificação (seção 4) termina com "Tudo certo". No dia da troca, apague o banco da
VPS (seção 3, passo 1) e repita com os dados finais. O ensaio descobre o problema (chave,
versão, permissão) enquanto ainda não tem nada em jogo.

## 2. No PC (corte)

1. Avise a equipe e **pare o servidor** (`Ctrl+C` no `npm run dev`).
2. Copie `verificar-migracao.js` para `server/` (se ainda não estiver) e rode:
   ```powershell
   cd server
   node verificar-migracao.js
   ```
   Guarde essa saída: as **contagens** são o que você vai comparar com a VPS.
   Tudo em "OK" e "Tudo certo" no PC é pré-requisito.
3. Gere o backup completo:
   ```powershell
   node backup.js
   ```
   Confira que a última linha do `.sql` é `-- Dump completed on ...`:
   ```powershell
   Get-Content backups\diario\backup-*.sql -Tail 1
   ```
   (se o seu `backup.js` for o antigo, os arquivos ficam em `backups\` e não em `backups\diario\`)
4. **Não apague nada no PC ainda.** Ele é o seu plano B até a seção 6.

## 3. Na VPS

**Transferir (VPN ligada, PowerShell no PC).** Use os nomes exatos dos arquivos
(`dir backups\diario` mostra):
```powershell
scp backups\diario\backup-hapvida_ranking-AAAA-MM-DDTHH-MM-SS.sql deploy@10.10.0.1:/home/deploy/
scp backups\diario\arquivos-AAAA-MM-DDTHH-MM-SS.tar.gz deploy@10.10.0.1:/home/deploy/
```

**Restaurar (dentro da VPS)**. O sistema já deve estar instalado até a seção 10 do
`DEPLOY-VPS.md`, com o `.env` usando a `DADOS_SENSIVEIS_CHAVE` do PC.

```bash
cd /home/deploy/hapvida-ranking && git pull          # mesmo commit (ou mais novo) que o PC
chmod 600 /home/deploy/backup-*.sql /home/deploy/arquivos-*.tar.gz
pm2 stop vidasaude                                   # ninguém grava durante a troca
```

1. **Zere o banco da VPS** (se você já rodou `seed` ou fez testes lá). O dump apaga e recria
   as tabelas, mas começar de um banco vazio evita sobra:
   ```bash
   sudo mysql -e "DROP DATABASE hapvida_ranking; CREATE DATABASE hapvida_ranking CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL PRIVILEGES ON hapvida_ranking.* TO 'hapvida_app'@'localhost'; FLUSH PRIVILEGES;"
   ```
2. **Restaure o banco:**
   ```bash
   sudo mysql hapvida_ranking < /home/deploy/backup-hapvida_ranking-AAAA-MM-DDTHH-MM-SS.sql
   ```
3. **Aplique as migrações que o dump ainda não tinha** (o dump do PC pode estar atrás do código):
   ```bash
   cd /home/deploy/hapvida-ranking/server
   npm run db:deploy        # deve listar "Applying migration ..." só das que faltam
   ```
   **Não rode `npm run seed`**: as contas vieram no dump.
4. **Restaure os arquivos** (dentro de `server/`):
   ```bash
   cd /home/deploy/hapvida-ranking/server
   tar -xzf /home/deploy/arquivos-AAAA-MM-DDTHH-MM-SS.tar.gz
   ls uploads | head -3; ls documentos-privados | head -3
   ```
5. **Verifique** (seção 4) e só então: `pm2 start vidasaude --update-env`.

## 4. Verificação (não imprime dado pessoal)

Na VPS, dentro de `server/`:
```bash
node verificar-migracao.js
```

| Confira | Esperado |
|---|---|
| 1) Contagens | **Iguais** às do PC (`logs_auditoria` pode ter mais: é tabela nova) |
| 2) Chave | Todas as linhas `OK`, nenhuma `ERRO` |
| 3) Arquivos | Fotos encontradas e `0 faltando` nos documentos |
| Resultado | "Tudo certo" (código de saída 0) |

Se aparecer **ERRO** na chave: o `.env` da VPS tem outra `DADOS_SENSIVEIS_CHAVE`. Corrija o
`.env`, `pm2 restart vidasaude --update-env` e rode de novo (o dump não precisa ser refeito).
Se aparecer **arquivos faltando**: o `.tar.gz` não foi extraído em `server/`.

Depois, teste pelo sistema (VPN ligada): login do admin e de um vendedor; abrir uma
solicitação com CPF e um anexo; uma foto de perfil; o ranking da TV.

## 5. Limpeza de segurança depois de restaurar

Contas do `seed.js` antigo (senhas fracas) podem estar no banco do PC. Veja a lista **sem os hashes**:
```bash
sudo mysql hapvida_ranking -e "SELECT id,nome,email,papel,status,ativo FROM corretores ORDER BY id;"
```
- **Admins:** entre com cada um e **troque a senha** (tela de perfil). Se a senha for fraca,
  considere a conta comprometida até trocar.
- **Contas de teste** (as do seed antigo, nomes fictícios): apague ou desative pelo painel admin.
- Confira se a política de senha (10+ caracteres) vale para quem vai usar o sistema de verdade.

## 6. Encerrar

1. Rode o checklist final do `DEPLOY-VPS.md` (reboot, backup, SSH público).
2. Rode um backup na VPS (`backup-enviar.sh diario`, quando o R2 estiver configurado) e confirme
   que a restauração funciona num banco de teste.
3. Mantenha o backup do PC **por alguns dias** (cifrado) e depois apague com segurança:
   ```powershell
   # Windows: apague os .sql e .tar.gz do PC e esvazie a lixeira (ou use "cipher /w:C:\pasta")
   ```
   ```bash
   # VPS: shred -u apaga sobrescrevendo (os arquivos em /home/deploy)
   shred -u /home/deploy/backup-*.sql /home/deploy/arquivos-*.tar.gz
   ```
4. **Pare de usar o banco do PC.** Todos passam a acessar só pela VPN.

## Se algo der errado

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| `ERRO` na chave | `DADOS_SENSIVEIS_CHAVE` diferente | Use a do PC no `.env` da VPS |
| Documentos faltando | `.tar.gz` não restaurado, ou extraído fora de `server/` | `tar -xzf` dentro de `server/` |
| `db:deploy` reclama de migração desconhecida | PC com código mais novo que a VPS | `git pull` na VPS e repita o `db:deploy` |
| Erro de coluna/enum no app | Faltou o `db:deploy` depois de restaurar | `npm run db:deploy` e `pm2 restart` |
| `Access denied` ao restaurar | Usuário sem permissão no banco | Use `sudo mysql` (root) para restaurar |
| Qualquer falha | | **Não apague nada no PC.** Refaça a partir da seção 3 passo 1 |
