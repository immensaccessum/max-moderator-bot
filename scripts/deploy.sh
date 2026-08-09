#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Локальные настройки деплоя (не коммитить): cp .env.deploy.example .env.deploy
if [[ -f "$ROOT/.env.deploy" ]]; then
  # shellcheck disable=SC1091
  set -a
  source "$ROOT/.env.deploy"
  set +a
fi

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing $name. Copy .env.deploy.example to .env.deploy and fill in your server settings." >&2
    exit 1
  fi
}

require_var DEPLOY_HOST
require_var DEPLOY_PORT
require_var DEPLOY_DIR
require_var DEPLOY_DOMAIN

REMOTE_HOST="$DEPLOY_HOST"
REMOTE_PORT="$DEPLOY_PORT"
REMOTE_USER="${DEPLOY_USER:-root}"
REMOTE_DIR="$DEPLOY_DIR"
WEB_PORT="${DEPLOY_WEB_PORT:-3010}"
DOMAIN="$DEPLOY_DOMAIN"
HESTIA_USER="${HESTIA_USER:-}"
SSH_IDENTITY="${DEPLOY_SSH_IDENTITY:-$HOME/.ssh/id_ed25519}"
# IP для listen в nginx/Hestia (часто совпадает с DEPLOY_HOST)
DEPLOY_BIND_IP="${DEPLOY_BIND_IP:-$DEPLOY_HOST}"
# Старый proxy_pass в шаблоне Hestia, который нужно заменить (зависит от установки)
DEPLOY_NGINX_OLD_PROXY="${DEPLOY_NGINX_OLD_PROXY:-}"

SSH_OPTS=(-o StrictHostKeyChecking=no -p "$REMOTE_PORT")
if [[ -f "$SSH_IDENTITY" ]]; then
  SSH_OPTS+=(-i "$SSH_IDENTITY")
fi

ssh_cmd() {
  ssh "${SSH_OPTS[@]}" "$REMOTE_USER@$REMOTE_HOST" "$@"
}

rsync_cmd() {
  rsync -az --delete \
    --exclude node_modules \
    --exclude .git \
    --exclude data \
    --exclude .env \
    --exclude .env.deploy \
    -e "ssh ${SSH_OPTS[*]}" \
    "$@"
}

echo "→ sync project to $REMOTE_HOST:$REMOTE_DIR"
ssh_cmd "mkdir -p '$REMOTE_DIR'"
rsync_cmd "$ROOT/" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"

if [[ -f "$ROOT/.env" ]]; then
  echo "→ upload .env"
  BOT_TOKEN="$(grep '^BOT_TOKEN=' "$ROOT/.env" | cut -d= -f2-)"
  OWNER_ID="$(grep '^OWNER_ID=' "$ROOT/.env" | cut -d= -f2- || true)"
  WEB_ADMIN_TOKEN="$(grep '^WEB_ADMIN_TOKEN=' "$ROOT/.env" | cut -d= -f2- || true)"
  ssh_cmd "cat > '$REMOTE_DIR/.env' <<ENVEOF
BOT_TOKEN=$BOT_TOKEN
OWNER_ID=$OWNER_ID
WEB_ENABLED=true
WEB_HOST=127.0.0.1
WEB_PORT=$WEB_PORT
WEB_PUBLIC_URL=https://$DOMAIN
WEB_INIT_DATA_MAX_AGE_SEC=3600
WEB_ADMIN_TOKEN=$WEB_ADMIN_TOKEN
DB_PATH=$REMOTE_DIR/data/bot.db
TZ=Europe/Moscow
LOG_LEVEL=info
ENVEOF"
fi

if [[ "${DEPLOY_DB:-}" == "1" && -f "$ROOT/data/bot.db" ]]; then
  echo "→ upload local database"
  ssh_cmd "mkdir -p '$REMOTE_DIR/data'"
  scp "${SSH_OPTS[@]}" "$ROOT/data/bot.db" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/data/bot.db"
fi

echo "→ install, build, pm2"
ssh_cmd "bash -lc '
  source /root/.nvm/nvm.sh
  cd \"$REMOTE_DIR\"
  npm ci
  npm run build
  npm prune --omit=dev
  export NODE_BIN=\$(which node)
  pm2 delete max-moderator-bot 2>/dev/null || true
  pm2 start ecosystem.config.cjs
  pm2 save
'"

if [[ -n "$HESTIA_USER" ]]; then
  echo "→ configure nginx/ssl for $DOMAIN (Hestia)"
  ssh_cmd "bash -lc '
    set -e
    H=/usr/local/hestia/bin
    if [[ ! -d /home/$HESTIA_USER/conf/web/$DOMAIN ]]; then
      \$H/v-add-web-domain $HESTIA_USER $DOMAIN $DEPLOY_BIND_IP || true
    fi
    if [[ ! -f /home/$HESTIA_USER/conf/web/$DOMAIN/ssl/$DOMAIN.pem ]]; then
      \$H/v-add-letsencrypt-domain $HESTIA_USER $DOMAIN || true
    fi
    cat > /home/$HESTIA_USER/conf/web/$DOMAIN/nginx.ssl.conf <<\"NGINXEOF\"
server {
listen      $DEPLOY_BIND_IP:443 ssl;
server_name $DOMAIN ;

ssl_certificate     /home/$HESTIA_USER/conf/web/$DOMAIN/ssl/$DOMAIN.pem;
ssl_certificate_key /home/$HESTIA_USER/conf/web/$DOMAIN/ssl/$DOMAIN.key;

location / {
    proxy_pass      http://127.0.0.1:$WEB_PORT;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \"upgrade\";
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
}
}
NGINXEOF
    if [[ -n \"$DEPLOY_NGINX_OLD_PROXY\" ]]; then
      python3 - <<\"PY\"
from pathlib import Path
path = Path(\"/home/$HESTIA_USER/conf/web/$DOMAIN/nginx.conf\")
text = path.read_text()
needle = \"location / {\\n\\t\\tproxy_pass $DEPLOY_NGINX_OLD_PROXY;\"
if needle in text and \"127.0.0.1:$WEB_PORT\" not in text:
    replacement = \"\"\"location / {
    proxy_pass      http://127.0.0.1:$WEB_PORT;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \"upgrade\";
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;

\t\tlocation ~*\"\"\"
    path.write_text(text.replace(needle, replacement, 1))
PY
    fi
    rm -f /home/$HESTIA_USER/conf/web/$DOMAIN/nginx.conf_custom
    \$H/v-restart-web || systemctl reload nginx
  '"
else
  echo "→ HESTIA_USER not set, skipping nginx/ssl configuration"
fi

echo "✅ Deployed: https://$DOMAIN/ (backend :$WEB_PORT)"
