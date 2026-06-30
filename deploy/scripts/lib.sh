# Shared helpers for deploy-prod.sh / deploy-local.sh. Sourced, not executed directly.

REPO_URL="${GVS_REPO_URL:-https://github.com/desn1k/analiyic-GVS.git}"
BRANCH="${GVS_BRANCH:-claude/hydraulic-water-quality-analytics-qsog90}"
APP_USER="${GVS_APP_USER:-gvs}"
APP_DIR="${GVS_APP_DIR:-/opt/gvs}"
SRC_DIR="$APP_DIR/app"

require_root() {
  if [[ $EUID -ne 0 ]]; then
    echo "Запустите скрипт с правами root: sudo $0 $*" >&2
    exit 1
  fi
}

install_base_packages() {
  echo "==> Установка системных пакетов"
  apt-get update -y
  apt-get install -y python3-venv python3-pip git curl

  # В окружениях без поддержки IPv6 (контейнеры, некоторые VPS) штатный
  # сайт nginx по умолчанию слушает [::]:80, из-за чего postinst-скрипт
  # пакета падает при первом запуске. Ставим nginx отдельно и, если он
  # всё же не стартовал по этой причине, чиним конфиг и доводим установку
  # до конца.
  if ! apt-get install -y nginx; then
    sed -i '/listen \[::\]/d' /etc/nginx/sites-available/default 2>/dev/null || true
    dpkg --configure -a
  fi
  if ! systemctl is-active --quiet nginx; then
    sed -i '/listen \[::\]/d' /etc/nginx/sites-available/default 2>/dev/null || true
    systemctl restart nginx || true
  fi

  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    if curl -fsSL https://deb.nodesource.com/setup_20.x | bash -; then
      apt-get install -y nodejs
    else
      echo "==> NodeSource недоступен (нет DNS/сети), ставим Node.js из репозитория Ubuntu" >&2
      apt-get install -y nodejs npm
    fi
  fi
}

create_app_user() {
  echo "==> Сервисный пользователь $APP_USER"
  id -u "$APP_USER" &>/dev/null || useradd -r -m -d "$APP_DIR" -s /usr/sbin/nologin "$APP_USER"
  mkdir -p "$APP_DIR/data"
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
}

fetch_code() {
  echo "==> Получение кода ($REPO_URL, ветка $BRANCH)"
  if [[ -d "$SRC_DIR/.git" ]]; then
    sudo -u "$APP_USER" git -C "$SRC_DIR" fetch origin "$BRANCH"
    sudo -u "$APP_USER" git -C "$SRC_DIR" checkout "$BRANCH"
    sudo -u "$APP_USER" git -C "$SRC_DIR" reset --hard "origin/$BRANCH"
  else
    sudo -u "$APP_USER" git clone --branch "$BRANCH" "$REPO_URL" "$SRC_DIR"
  fi
}

# set_env KEY VALUE FILE — заменяет существующую (в т.ч. закомментированную)
# строку KEY=... или дописывает новую.
set_env() {
  local key="$1" val="$2" file="$3"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$file"
  elif grep -q "^# *${key}=" "$file" 2>/dev/null; then
    sed -i "s|^# *${key}=.*|${key}=${val}|" "$file"
  else
    echo "${key}=${val}" >> "$file"
  fi
}

setup_backend() {
  echo "==> Бэкенд: venv + зависимости"
  cd "$SRC_DIR/backend"
  sudo -u "$APP_USER" python3 -m venv venv
  sudo -u "$APP_USER" ./venv/bin/pip install --upgrade pip -q
  sudo -u "$APP_USER" ./venv/bin/pip install -r requirements.txt -q

  [[ -f .env ]] || sudo -u "$APP_USER" cp .env.example .env
  set_env DATABASE_URL "sqlite:////$APP_DIR/data/gvs.db" .env
}

install_systemd_service() {
  echo "==> systemd-сервис gvs-backend"
  cat > /etc/systemd/system/gvs-backend.service <<EOF
[Unit]
Description=GVS Analytics backend (FastAPI/uvicorn)
After=network.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$SRC_DIR/backend
EnvironmentFile=$SRC_DIR/backend/.env
ExecStart=$SRC_DIR/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now gvs-backend
  systemctl restart gvs-backend
}

build_frontend() {
  echo "==> Сборка фронтенда"
  cd "$SRC_DIR/frontend"
  sudo -u "$APP_USER" npm ci --silent
  sudo -u "$APP_USER" npm run build --silent
}

write_nginx_site() {
  local server_name="$1"
  echo "==> nginx: server_name=$server_name"
  cat > /etc/nginx/sites-available/gvs <<EOF
server {
    listen 80;
    server_name $server_name;

    root $SRC_DIR/frontend/dist;
    index index.html;
    client_max_body_size 25m;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        try_files \$uri /index.html;
    }
}
EOF
  ln -sf /etc/nginx/sites-available/gvs /etc/nginx/sites-enabled/gvs
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl reload nginx
}

print_status() {
  echo
  echo "==> Статус бэкенда:"
  systemctl --no-pager status gvs-backend | head -5
  echo
  echo "==> Проверка API:"
  curl -s http://127.0.0.1:8000/api/health || echo "API не отвечает"
  echo
}
