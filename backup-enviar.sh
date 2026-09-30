#!/usr/bin/env bash
# Gera o backup e envia pra fora da VPS (Cloudflare R2 via rclone).
#
# Uso (a partir de qualquer pasta):
#   backup-enviar.sh diario      # .sql + .tar.gz, envia a pasta backups/
#   backup-enviar.sh horario     # so o .sql, envia backups/ e copia os
#                                # arquivos de cliente de forma incremental
#
# Variaveis opcionais:
#   RCLONE_REMOTE  destino do rclone (padrao: "r2crypt:" - remote com crypt)
#   SERVER_DIR     pasta do backend (padrao: a pasta deste script)
set -euo pipefail

MODO="${1:-diario}"
case "$MODO" in diario|horario) ;; *) echo "Uso: $0 diario|horario" >&2; exit 2;; esac

SERVER_DIR="${SERVER_DIR:-$(cd "$(dirname "$0")" && pwd)}"
REMOTE="${RCLONE_REMOTE:-r2crypt:}"
cd "$SERVER_DIR"

# Um backup por vez: se o anterior ainda roda, este pula (nao empilha).
exec 9>"${TMPDIR:-/tmp}/hapvida-backup.lock"
if ! flock -n 9; then
  echo "[$(date '+%F %T')] Backup anterior ainda em andamento - pulando."
  exit 0
fi

echo "[$(date '+%F %T')] Backup $MODO..."
if [ "$MODO" = "horario" ]; then
  node backup.js --horario
else
  node backup.js
fi

# "copy" (nunca "sync"): apagar algo aqui nao apaga la fora.
rclone copy "$SERVER_DIR/backups/$MODO" "${REMOTE}backups/$MODO"

if [ "$MODO" = "horario" ]; then
  # Documentos e fotos: envia so o que e novo (rapido, sem recompactar).
  for pasta in uploads documentos-privados; do
    [ -d "$pasta" ] && rclone copy "$SERVER_DIR/$pasta" "${REMOTE}arquivos/$pasta"
  done
fi
echo "[$(date '+%F %T')] Backup $MODO concluido."
