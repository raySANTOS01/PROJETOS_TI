# Deploy na VPS

Arquitetura: VPS Ubuntu 24.04 → firewall (ufw) → WireGuard → Nginx → Node (PM2) → MySQL.
Nada fica público: a única porta aberta pra internet é a do WireGuard (51820/udp).
Dentro da VPN a VPS tem o endereço **10.10.0.1**, e é por ele que tudo é acessado.

Este guia assume que o repositório **já tem as correções** (seed só com admin, `db:deploy`,
`backup.js` com modos diário/horário, `backup-enviar.sh`, `server.js`, `auth.middleware.js`
e `upload.middleware.js` corrigidos). Se não tiver, **não comece**: o seed antigo criaria
contas com senhas fracas e contas desativadas continuariam acessando.

---

## 0. Antes de começar

**No seu PC**

- [ ] Arquivos corrigidos aplicados, commit e push feitos.
- [ ] Repositório do GitHub **privado**.
- [ ] `git ls-files | grep -Ei '\.env$|uploads|documentos-privados|backups'` não retorna nada.
- [ ] `client/.env.production` existe com URLs relativas (`VITE_API_URL=/api` e `VITE_SOCKET_URL=` vazio) e está no Git.
- [ ] Testes locais feitos (login, permissões, solicitação com anexo, TV em tempo real, `backup.js`, restaurar o `.sql` num banco de teste).
- [ ] As senhas do `seed.js` antigo foram consideradas comprometidas (estão no histórico do Git). Nunca use nenhuma delas.
- [ ] **Não leve o dump do seu banco de testes para a VPS.** A produção nasce de um banco novo: `db:deploy` + `seed`.

**Anote num gerenciador de senhas (FORA da VPS)** — você vai gerar estes itens ao longo do guia:

| Item | Por quê |
|---|---|
| `DADOS_SENSIVEIS_CHAVE` | Sem ela, CPF, documentos e backups ficam ilegíveis para sempre |
| `JWT_SECRET` | Se perder, gere outro (todos só precisam logar de novo) |
| Senha do banco (`hapvida_app`) | Fica no `.env` |
| Conteúdo completo do `server/.env` | Para recriar numa VPS nova |
| Chave privada do servidor WireGuard e o `wg0.conf` | Com elas, os aparelhos continuam valendo se você trocar de VPS |
| Senha e *salt* do `rclone crypt` | Sem elas você não abre os backups |
| Chaves de acesso do R2 | Para reconfigurar o `rclone` |
| Senha de app do Gmail | Para o envio de e-mail |

---

## 1. Usuário, sistema e fuso horário

```bash
ssh root@IP_PUBLICO_DA_VPS
adduser deploy && usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
exit
ssh deploy@IP_PUBLICO_DA_VPS
sudo apt update && sudo apt upgrade -y
sudo timedatectl set-timezone America/Sao_Paulo
timedatectl | grep "Time zone"
```

O fuso importa por dois motivos: o **cron** (horários dos backups) e o **próprio
sistema**, que usa a hora local do servidor para decidir o mês do ranking e o dia
de vencimento das parcelas. Mantenha `America/Sao_Paulo` (o mesmo em que você testou).

## 2. WireGuard

```bash
sudo apt install -y wireguard qrencode
sudo -i
cd /etc/wireguard && umask 077
wg genkey | tee server_privada.key | wg pubkey > server_publica.key
```

`/etc/wireguard/wg0.conf` (ainda como root):

```ini
[Interface]
PrivateKey = <conteúdo de server_privada.key>
Address = 10.10.0.1/24
ListenPort = 51820

# um [Peer] por dispositivo (celular de vendedor, PC do backoffice, TV)
[Peer]
# Ray - notebook
PublicKey = <chave pública do dispositivo>
AllowedIPs = 10.10.0.2/32
```

```bash
systemctl enable --now wg-quick@wg0
exit
```

Guarde uma cópia de `server_privada.key` e do `wg0.conf` fora da VPS.

**Config do dispositivo** (cole no app WireGuard, ou gere QR com
`qrencode -t ansiutf8 < arquivo.conf`):

```ini
[Interface]
PrivateKey = <chave privada do dispositivo>
Address = 10.10.0.2/32

[Peer]
PublicKey = <conteúdo de server_publica.key>
Endpoint = IP_PUBLICO_DA_VPS:51820
AllowedIPs = 10.10.0.0/24
PersistentKeepalive = 25
```

- **Um aparelho = um par de chaves = um IP.** Nunca reutilize a config em dois aparelhos.
- Se tiver um domínio, use o nome no `Endpoint` no lugar do IP: numa emergência
  (trocar de VPS) você só aponta o nome para o IP novo.

## 3. Firewall

```bash
sudo apt install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 51820/udp                                  # WireGuard (única porta pública)
sudo ufw allow in on wg0 to any port 80 proto tcp         # sistema, só por dentro da VPN
sudo ufw allow in on wg0 to any port 22 proto tcp         # SSH por dentro da VPN
sudo ufw allow 22/tcp                                     # SSH público - TEMPORÁRIO
sudo ufw enable
sudo ufw status verbose
```

**Teste a VPN antes de fechar qualquer coisa:** ligue o túnel no seu notebook,
abra **outro terminal** e entre com `ssh deploy@10.10.0.1`. Só depois feche o SSH
público (passo final do checklist): `sudo ufw delete allow 22/tcp`.
Se você se trancar para fora, use o console de emergência do painel da HostGator.

## 4. Node, MySQL, Nginx, PM2

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs mysql-server nginx git rclone
sudo npm install -g pm2
sudo mysql_secure_installation
```

No `mysql_secure_installation`, se perguntar para trocar a senha do root, responda
**não** (no Ubuntu o root usa `sudo mysql`). Remova usuários anônimos e o banco de teste.

## 5. Segredos

Gere três valores (rode 3 vezes: senha do banco, `JWT_SECRET` e `DADOS_SENSIVEIS_CHAVE`):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Guarde os três no gerenciador de senhas **agora**.

## 6. Banco e usuário da aplicação

```bash
sudo mysql
```

```sql
CREATE DATABASE hapvida_ranking CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'hapvida_app'@'localhost' IDENTIFIED BY 'SENHA_DO_BANCO';
GRANT ALL PRIVILEGES ON hapvida_ranking.* TO 'hapvida_app'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 7. Código (repositório privado → deploy key)

Crie uma chave só de leitura para a VPS:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/deploy_github -N ""
cat ~/.ssh/deploy_github.pub
```

No GitHub: repositório → **Settings → Deploy keys → Add deploy key**, cole a chave
pública e **não** marque "Allow write access". Depois:

```bash
printf 'Host github.com\n  IdentityFile ~/.ssh/deploy_github\n  IdentitiesOnly yes\n' >> ~/.ssh/config
cd /home/deploy
git clone git@github.com:SEU_USUARIO/SEU_REPO.git hapvida-ranking
cd hapvida-ranking
npm install            # na raiz: instala server e client juntos (use install, não "npm ci")
```

## 8. .env do servidor

```bash
cp server/.env.example server/.env
nano server/.env
chmod 600 server/.env
```

```ini
DATABASE_URL="mysql://hapvida_app:SENHA_DO_BANCO@localhost:3306/hapvida_ranking"
PORT=3333
HOST=127.0.0.1
NODE_ENV=production
CLIENT_URL="http://10.10.0.1"
JWT_SECRET="<segredo gerado 2>"
JWT_EXPIRES_IN="30d"
DADOS_SENSIVEIS_CHAVE="<segredo gerado 3>"

# E-mail (Gmail com senha de app - ver seção 13)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="conta.dedicada@gmail.com"
SMTP_PASS="<senha de app de 16 letras, sem espaços>"
SMTP_FROM="Ranking Vida Saude <conta.dedicada@gmail.com>"

# Admin inicial (só para o "npm run seed"; apague depois)
SEED_ADMIN_1_NOME="Seu Nome"
SEED_ADMIN_1_EMAIL="seu@email.com"
SEED_ADMIN_1_SENHA="<senha forte, 10+ caracteres>"
```

- O servidor **recusa subir** sem `JWT_SECRET` ou sem `DADOS_SENSIVEIS_CHAVE`.
- O cliente não precisa de `.env` na VPS: o build usa `client/.env.production`, que já vem no Git
  (URLs relativas: o navegador fala com o Nginx, que repassa `/api`, `/uploads` e `/socket.io` ao Node).
- Mais de um admin: `SEED_ADMIN_2_NOME/EMAIL/SENHA` e assim por diante (até 10).

## 9. Tabelas e admin

```bash
cd /home/deploy/hapvida-ranking/server
npm run db:deploy      # gera o Prisma Client e cria as tabelas (prisma/migrations)
npm run seed           # cria só o(s) admin(s) do .env
nano .env              # APAGUE as linhas SEED_
```

- `db:deploy` nunca apaga dados.
- **Nunca rode `npm run setup`, `prisma migrate dev` ou `npm run limpar-tudo` na VPS.**
- Use o admin criado aqui para cadastrar/aprovar os demais usuários pelo sistema.

## 10. Build do frontend e PM2

```bash
cd /home/deploy/hapvida-ranking
npm run build -w client
NODE_ENV=production pm2 start src/server.js --name vidasaude --cwd /home/deploy/hapvida-ranking/server
pm2 save
pm2 startup            # copie e rode o comando que ele imprimir
pm2 install pm2-logrotate
```

- O `--cwd` é obrigatório: o servidor acha `.env`, `uploads/` e `documentos-privados/` pela pasta atual.
- Confira: `pm2 status` (online) e `ss -ltn | grep 3333` (deve mostrar **127.0.0.1**:3333, não 0.0.0.0).

## 11. Nginx

```bash
echo 'net.ipv4.ip_nonlocal_bind=1' | sudo tee /etc/sysctl.d/99-nonlocal-bind.conf
sudo sysctl --system
```

(sem isso o Nginx falha no boot se subir antes da interface da VPN)

`/etc/nginx/sites-available/vidasaude`:

```nginx
server {
    listen 10.10.0.1:80;
    server_name _;

    root /home/deploy/hapvida-ranking/client/dist;
    index index.html;

    # uploads de documentos: até 15 arquivos de 8MB por envio
    client_max_body_size 150m;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~ ^/(api|uploads)/ {
        proxy_pass http://127.0.0.1:3333;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3333;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 3600s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/vidasaude /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo chmod o+x /home/deploy          # Nginx precisa atravessar a pasta até o dist/
sudo nginx -t && sudo systemctl restart nginx
```

## 12. Backup (diário + de hora em hora) e envio para fora da VPS — *fora da primeira rodada*

Faça esta seção **depois** que o sistema estiver no ar e validado.

### 12.1 Cloudflare R2

1. No painel da Cloudflare → **R2** → crie o bucket privado `hapvida-backups`.
2. Crie um **API token** com *Object Read & Write*, restrito a esse bucket.
   Anote *Access Key ID*, *Secret Access Key* e o endpoint
   `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
3. **Regra de ciclo de vida (30 dias) SÓ para o prefixo `backups/`.**
   Se valer para o bucket todo, o R2 apagaria também os documentos de clientes
   (`arquivos/`) depois de 30 dias.

### 12.2 rclone (R2 + criptografia)

`~/.config/rclone/rclone.conf` (depois: `chmod 600 ~/.config/rclone/rclone.conf`):

```ini
[r2]
type = s3
provider = Cloudflare
access_key_id = SEU_ACCESS_KEY_ID
secret_access_key = SEU_SECRET
region = auto
endpoint = https://SEU_ACCOUNT_ID.r2.cloudflarestorage.com
acl = private
no_check_bucket = true
```

Crie o remote criptografado (o `backup.js` **não** cifra os arquivos):

```bash
rclone config
#  n) New remote     name> r2crypt     Storage> crypt
#  remote> r2:hapvida-backups
#  filename_encryption> standard      directory_name_encryption> true
#  Password> g (gerar)   Password2 (salt)> g (gerar)
```

**Guarde as duas senhas no gerenciador de senhas.** Sem elas o backup não abre.
Teste: `rclone lsd r2crypt:` e `echo teste > /tmp/t && rclone copy /tmp/t r2crypt:teste`.

### 12.3 Cron

```bash
chmod +x /home/deploy/hapvida-ranking/server/backup-enviar.sh
/home/deploy/hapvida-ranking/server/backup-enviar.sh diario     # teste manual
/home/deploy/hapvida-ranking/server/backup-enviar.sh horario    # teste manual
crontab -e
```

```
0 3 * * *      /home/deploy/hapvida-ranking/server/backup-enviar.sh diario  >> /home/deploy/backup.log 2>&1
0 8-19 * * 1-6 /home/deploy/hapvida-ranking/server/backup-enviar.sh horario >> /home/deploy/backup.log 2>&1
```

- **Diário (3h):** `.sql` + `.tar.gz` de `uploads/` e `documentos-privados/`; guarda os últimos 14 em `backups/diario/`.
- **Horário (8h–19h, seg–sáb):** só o `.sql` (guarda 72 em `backups/horario/`), e envia de forma incremental os arquivos de clientes para `arquivos/` no R2.
- O script usa `flock` (um backup por vez) e sai com erro se algo falhar. Confira o `backup.log` nos primeiros dias.
- Envia com `rclone copy` (nunca `sync`): apagar algo local não apaga no R2.

### 12.4 Teste a restauração (obrigatório, pelo menos uma vez)

```bash
mkdir -p /tmp/restore && rclone copy r2crypt:backups/diario /tmp/restore
mysql -u root -p -e "CREATE DATABASE teste_restore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql teste_restore < /tmp/restore/backup-hapvida_ranking-....sql
sudo mysql teste_restore -e "SHOW TABLES; SELECT COUNT(*) FROM corretores;"
sudo mysql -e "DROP DATABASE teste_restore;" && rm -rf /tmp/restore
```

## 13. E-mail (Gmail) — *fora da primeira rodada*

Faça esta seção **depois** que o sistema estiver no ar e validado. Enquanto isso, o "esqueci a senha" só imprime o código no log (`pm2 logs vidasaude`).

1. Use uma conta Gmail **dedicada** ao sistema.
2. Ative a verificação em duas etapas (myaccount.google.com/security).
3. Em myaccount.google.com/apppasswords crie uma senha de app e cole em `SMTP_PASS` (sem espaços).
4. `pm2 restart vidasaude --update-env`
5. Teste (com um e-mail de corretor cadastrado) e acompanhe o log:
   ```bash
   curl -s -XPOST http://10.10.0.1/api/auth/esqueci-senha \
     -H 'content-type: application/json' -d '{"email":"corretor@exemplo.com"}'
   pm2 logs vidasaude --lines 20      # falhas aparecem como "[email] Falha ao enviar"
   ```
   Se a porta 587 estiver bloqueada (`nc -zv smtp.gmail.com 587` falha), use `SMTP_PORT="465"`.

## 14. Checklist de validação

- [ ] VPN ligada, `http://10.10.0.1` abre a tela de login
- [ ] Login com o admin do seed funciona
- [ ] Linhas `SEED_` apagadas do `.env` e `ls -l server/.env` mostra `-rw-------`
- [ ] `ss -ltn | grep 3333` mostra `127.0.0.1:3333`
- [ ] Foto de perfil aparece depois de enviar (testa o `/uploads`)
- [ ] Anexar documento numa solicitação e abrir no backoffice (testa limite de upload)
- [ ] Aprovar uma venda de teste e ver a TV atualizar sozinha (testa o socket pelo Nginx)
- [ ] Desativar um corretor logado derruba o acesso dele na hora
- [ ] "Esqueci a senha" entrega o código por e-mail *(depois da seção 13)*
- [ ] `sudo reboot` e confirmar que WireGuard, MySQL, Nginx e PM2 voltam sozinhos
- [ ] `backup-enviar.sh diario` e `horario` terminam com código 0 e os arquivos aparecem no R2 *(depois da seção 12)*
- [ ] Restauração testada num banco de teste (seção 12.4) *(depois da seção 12)*
- [ ] Apagar a venda de teste com `npm run limpar-vendas` (**não** o `limpar-tudo`) antes de liberar pro time
- [ ] Testar `ssh deploy@10.10.0.1` com a VPN ligada e **só então** fechar o SSH público: `sudo ufw delete allow 22/tcp`

## 15. Atualizar depois (layout, correções)

No seu PC: altera, testa com `npm run dev`, faz commit e push. Na VPS:

```bash
cd /home/deploy/hapvida-ranking
./server/backup-enviar.sh diario         # backup ANTES de mexer em schema
git checkout -- package-lock.json        # o npm install altera o lockfile e travaria o pull
git pull
npm install                              # só se mudou dependência
npm run db:deploy -w server              # só se mudou o schema
npm run build -w client                  # se mudou o frontend
pm2 restart vidasaude --update-env       # se mudou o backend
```

- Mudança só de layout: `git pull` + `npm run build -w client` já basta, sem reiniciar nada.
- Mudança de schema: crie a migração no seu PC com `npx prisma migrate dev --name descricao`
  (gera a pasta em `prisma/migrations/`), faça commit dela, e na VPS rode `db:deploy`.

## 16. Se a VPS cair (runbook de restauração — 1 a 2 horas)

1. **Diagnostique antes de restaurar:** painel do provedor (VPS ligada? reinicie), console de
   emergência, `systemctl status nginx mysql wg-quick@wg0`, `pm2 status`, `df -h`, `free -h`.
2. **VPS nova (Ubuntu 24.04):** refaça as seções 1 a 4 e 7. No WireGuard, **restaure a chave
   e o `wg0.conf` antigos**: os aparelhos continuam valendo (só muda o `Endpoint`).
3. **Segredos:** recrie o `server/.env` com os valores do gerenciador de senhas. A
   `DADOS_SENSIVEIS_CHAVE` tem que ser **a mesma**.
4. **Banco:** crie o banco e o usuário (seção 6), **não rode o seed**, configure o `rclone`
   (12.2) e restaure o dump mais recente:
   ```bash
   rclone ls r2crypt:backups/horario | sort | tail -3        # escolha o mais novo
   rclone copy r2crypt:backups/horario/backup-XXXX.sql /tmp/
   mysql -u hapvida_app -p hapvida_ranking < /tmp/backup-XXXX.sql
   cd /home/deploy/hapvida-ranking/server && npm run db:deploy   # aplica migrações que faltarem
   ```
5. **Arquivos de clientes:**
   ```bash
   cd /home/deploy/hapvida-ranking/server
   rclone copy r2crypt:arquivos/uploads uploads
   rclone copy r2crypt:arquivos/documentos-privados documentos-privados
   ```
6. Seções 10 e 11 (build, PM2, Nginx) e 12.3 (cron).
7. Atualize o `Endpoint` de cada aparelho (ou o nome de domínio) e confira o checklist.

Perda máxima esperada: as vendas feitas depois do último backup horário (no máximo ~1 hora
de expediente).

## 17. Cadastrar e remover aparelhos na VPN

**Cadastrar um vendedor** (a chave privada nasce no aparelho dele e nunca sai de lá):

1. O vendedor instala o app **WireGuard**, toca em *Adicionar túnel vazio* (o app gera o
   par de chaves) e te envia **só a chave pública**.
2. Na VPS, reserve o próximo IP livre (anote numa planilha: nome, aparelho, IP, data) e
   adicione no `/etc/wireguard/wg0.conf`:
   ```ini
   [Peer]
   # Fulano - celular
   PublicKey = <chave pública que ele mandou>
   AllowedIPs = 10.10.0.5/32
   ```
3. Aplique sem derrubar os outros: `sudo bash -c 'wg syncconf wg0 <(wg-quick strip wg0)'`
4. Devolva a config para ele colar no app (seção 2, com `Address = 10.10.0.5/32` e a
   `PrivateKey` que o próprio app já preencheu).
5. Ele liga o túnel, abre `http://10.10.0.1`, faz o **cadastro** e espera você **aprovar**
   no painel admin.

**Remover (saiu da empresa / perdeu o celular):**

1. Apague o bloco `[Peer]` dele do `wg0.conf` e rode o mesmo `wg syncconf`.
2. Desative ou apague a conta dele no painel admin. O acesso cai na hora.

As duas ações são independentes: faça as duas.
