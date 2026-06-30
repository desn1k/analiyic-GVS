#!/usr/bin/env bash
# Автоматическое развёртывание GVS Analytics на Ubuntu с доменом и HTTPS (Let's Encrypt).
#
# Использование:
#   sudo GVS_BRANCH=claude/hydraulic-water-quality-analytics-qsog90 ./deploy-prod.sh <домен> <email>
#
# Пример:
#   sudo GVS_BRANCH=claude/hydraulic-water-quality-analytics-qsog90 ./deploy-prod.sh gvs.example.com admin@example.com
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"

if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
  echo "Использование: sudo $0 <домен> <email>" >&2
  echo "Пример: sudo $0 gvs.example.com admin@example.com" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

require_root "$@"

install_base_packages
apt-get install -y certbot python3-certbot-nginx

create_app_user
fetch_code
setup_backend
set_env CORS_ORIGINS "https://$DOMAIN" "$SRC_DIR/backend/.env"
install_systemd_service
build_frontend
write_nginx_site "$DOMAIN"

echo "==> Файрвол (ufw)"
if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH || true
  ufw allow 'Nginx Full' || true
  ufw --force enable || true
fi

echo "==> Выпуск сертификата Let's Encrypt для $DOMAIN"
certbot --nginx -d "$DOMAIN" -m "$EMAIL" --agree-tos --redirect --non-interactive

print_status

echo
echo "==> Готово! Сайт доступен по адресу: https://$DOMAIN/"
