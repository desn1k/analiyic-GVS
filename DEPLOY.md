# Развёртывание на Ubuntu (прод)

Стек: FastAPI + SQLite (бэкенд, порт 8000, только localhost) → nginx (порт 80/443,
отдаёт собранный фронтенд и проксирует `/api/*`).

Инструкция рассчитана на Ubuntu 22.04/24.04, права root через `sudo`.

## 1. Системные пакеты

```bash
sudo apt update
sudo apt install -y python3-venv python3-pip nginx git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## 2. Пользователь и каталоги

```bash
sudo useradd -r -m -d /opt/gvs -s /usr/sbin/nologin gvs
sudo mkdir -p /opt/gvs/data
sudo chown -R gvs:gvs /opt/gvs
```

## 3. Код

```bash
sudo -u gvs git clone <URL_РЕПОЗИТОРИЯ> /opt/gvs/app
sudo ln -s /opt/gvs/app/backend /opt/gvs/backend
sudo ln -s /opt/gvs/app/frontend /opt/gvs/frontend
```

(Либо просто клонируйте прямо в `/opt/gvs/app` и используйте пути
`/opt/gvs/app/backend`, `/opt/gvs/app/frontend` везде ниже — символьные ссылки
нужны только если хотите более короткие пути, как в `gvs-backend.service`.)

## 4. Бэкенд

```bash
cd /opt/gvs/backend
sudo -u gvs python3 -m venv venv
sudo -u gvs ./venv/bin/pip install -r requirements.txt

sudo -u gvs cp .env.example .env
sudo -u gvs nano .env   # проверьте DATABASE_URL (по умолчанию /opt/gvs/data/gvs.db)
```

Файл `.env` уже указывает БД на `/opt/gvs/data/gvs.db` — каталог `data` мы
создали на шаге 2, он переживёт обновления кода (`git pull`).

### systemd-сервис

```bash
sudo cp /opt/gvs/app/deploy/gvs-backend.service /etc/systemd/system/gvs-backend.service
sudo systemctl daemon-reload
sudo systemctl enable --now gvs-backend
sudo systemctl status gvs-backend   # должно быть active (running)
curl -s http://127.0.0.1:8000/api/health   # {"status":"ok"}
```

## 5. Сборка фронтенда

```bash
cd /opt/gvs/frontend
sudo -u gvs npm ci
sudo -u gvs npm run build   # результат в frontend/dist
```

Фронтенд собирается со ссылками на API через относительные пути (`/api/...`),
поэтому в проде он сам найдёт бэкенд через nginx-прокси — никакого
`VITE_API_BASE_URL` указывать не нужно.

## 6. nginx

```bash
sudo cp /opt/gvs/app/deploy/nginx-gvs.conf /etc/nginx/sites-available/gvs
sudo nano /etc/nginx/sites-available/gvs   # замените server_name на ваш домен/IP
sudo ln -s /etc/nginx/sites-available/gvs /etc/nginx/sites-enabled/gvs
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Откройте `http://<сервер>/` — должен открыться интерфейс аналитики.

## 7. HTTPS (если есть домен)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d gvs.example.com
```

Certbot сам пропишет 443 и редирект с 80, обновит `nginx-gvs.conf` под себя.

## 8. Файрвол

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Порт 8000 (бэкенд) наружу открывать не нужно — он слушает только `127.0.0.1`,
доступ к нему только через nginx-прокси.

## Обновление кода

```bash
cd /opt/gvs/app
sudo -u gvs git pull
sudo -u gvs /opt/gvs/backend/venv/bin/pip install -r backend/requirements.txt
sudo systemctl restart gvs-backend
cd frontend && sudo -u gvs npm ci && sudo -u gvs npm run build
```

## Бэкап

База — один файл SQLite: `/opt/gvs/data/gvs.db`. Регулярно копируйте его
(`cron` + `cp`/`sqlite3 .backup`) — этого достаточно для текущего объёма данных.

## Известные ограничения текущей версии

- Нет аутентификации — кто угодно с доступом к сайту может загружать отчёты и
  удалять периоды (`DELETE /api/reports/periods/{id}`). Для прод-окружения,
  доступного не только вам, стоит добавить хотя бы Basic Auth на уровне nginx:

  ```nginx
  location / {
      auth_basic "GVS";
      auth_basic_user_file /etc/nginx/.htpasswd;
      try_files $uri /index.html;
  }
  location /api/ {
      auth_basic "GVS";
      auth_basic_user_file /etc/nginx/.htpasswd;
      proxy_pass http://127.0.0.1:8000;
      ...
  }
  ```

  (создать пароль: `sudo apt install apache2-utils && sudo htpasswd -c /etc/nginx/.htpasswd admin`)
- SQLite подходит для одного сервера и умеренной нагрузки; при росте объёма
  отчётов/одновременных пользователей стоит перейти на PostgreSQL
  (поменять только `DATABASE_URL` и добавить драйвер `psycopg2` в
  `requirements.txt` — модели уже на SQLAlchemy).
