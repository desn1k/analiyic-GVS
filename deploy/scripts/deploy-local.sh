#!/usr/bin/env bash
# Автоматическое развёртывание GVS Analytics на Ubuntu для работы в локальной сети
# (без домена и сертификата — доступ по IP-адресу сервера).
#
# Использование:
#   sudo GVS_BRANCH=claude/hydraulic-water-quality-analytics-qsog90 ./deploy-local.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

require_root "$@"

LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
if [[ -z "$LAN_IP" ]]; then
  echo "Не удалось определить IP-адрес в локальной сети, используется '_' (любой адрес)." >&2
fi
SERVER_NAME="${LAN_IP:-_}"

install_base_packages
create_app_user
fetch_code
setup_backend
install_systemd_service
build_frontend
write_nginx_site "$SERVER_NAME"

echo "==> Файрвол (ufw)"
if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH || true
  ufw allow 'Nginx Full' || true
  ufw --force enable || true
fi

print_status

echo
if [[ -n "$LAN_IP" ]]; then
  echo "==> Готово! Сайт доступен в локальной сети по адресу: http://$LAN_IP/"
else
  echo "==> Готово! Сайт доступен по адресу сервера: http://<IP-сервера>/"
fi
