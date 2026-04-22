# Налаштування

## 1. n8n інстанція

Потрібна n8n версії **1.50+** (через ноду `Set` v3.4 та `If` v2.3).

### Варіанти хостингу

- **n8n Cloud** — `$24/міс`, найпростіше (https://n8n.io → Sign up).
- **Self-hosted (Docker)** — безкоштовно, але треба VPS і публічний
  URL для webhook'ів:

  ```bash
  docker run -d --restart unless-stopped \
    --name n8n \
    -p 5678:5678 \
    -e N8N_HOST=your-domain.com \
    -e WEBHOOK_URL=https://your-domain.com/ \
    -e N8N_ENCRYPTION_KEY=<random-32-char-string> \
    -v ~/.n8n:/home/node/.n8n \
    docker.n8n.io/n8nio/n8n
  ```

  Публічний URL обов'язковий — інакше Vizard callback'и та сторонні
  OAuth redirect'и не працюватимуть. Найпростіше — Cloudflare Tunnel
  або Caddy reverse proxy з Let's Encrypt.

## 2. Імпорт workflow

1. Відкрийте n8n → `Workflows` → кнопка `Import from File`.
2. Виберіть `workflows/clip-video-to-shorts.json`.
3. Workflow імпортується з усіма нодами, але з **не активованими**
   credential'ами. У кожній ноді, де є червоний індикатор, треба
   прив'язати відповідний credential (див. п. 3).

## 3. Credentials

### 3.1 Vizard.ai

1. Зареєструйтесь на https://vizard.ai → виберіть Lite або Creator план.
2. `Settings` → `API` → `Generate API Key`.
3. У n8n: `Credentials` → `New` → `Header Auth`:
   - Name: `Vizard API Key`
   - Header Name: `VIZARDAI_API_KEY`
   - Header Value: (ваш ключ)
4. У workflow-нодах `Vizard: Create Project` та `Vizard: Get Status`
   прив'яжіть цей credential.

### 3.2 YouTube OAuth2

1. https://console.cloud.google.com → створіть проект.
2. `APIs & Services` → `Library` → увімкніть **YouTube Data API v3**.
3. `APIs & Services` → `Credentials` → `Create Credentials` → `OAuth client ID`:
   - Type: `Web application`
   - Authorized redirect URIs: `https://<n8n-domain>/rest/oauth2-credential/callback`
4. `Credentials` (n8n) → `New` → `YouTube OAuth2 API`:
   - Client ID / Client Secret: з Google Cloud
   - Натисніть `Sign in with Google` → авторизуйте потрібний канал.

### 3.3 TikTok OAuth2

1. https://developers.tiktok.com/ → `Manage apps` → створіть застосунок.
2. Додайте продукт **Content Posting API**.
3. Продукт має пройти review TikTok перед тим як `video.publish` scope
   буде доступний. Без нього кліпи потраплятимуть у "Inbox" (draft) і
   користувач публікує вручну.
4. Redirect URI: `https://<n8n-domain>/rest/oauth2-credential/callback`.
5. `Credentials` (n8n) → `New` → `OAuth2 API` (generic):
   - Grant Type: `Authorization Code`
   - Authorization URL: `https://www.tiktok.com/v2/auth/authorize/`
   - Access Token URL: `https://open.tiktokapis.com/v2/oauth/token/`
   - Client ID / Secret: з TikTok Developers
   - Scope: `video.publish,video.upload` (якщо `video.publish` не
     схвалений — тільки `video.upload`)
   - Authentication: `Body`

### 3.4 Instagram Graph API

1. https://developers.facebook.com/ → створіть Business App.
2. Додайте продукт **Facebook Login** та **Instagram Graph API**.
3. Перейдіть у бізнес-верифікацію (займає 1-5 днів; для тестування
   достатньо Development mode).
4. Підключіть IG Business/Creator акаунт до Facebook Page (у Facebook
   Business Suite).
5. Отримайте `INSTAGRAM_BUSINESS_ACCOUNT_ID`:
   ```
   GET https://graph.facebook.com/v20.0/me/accounts?access_token=<page-token>
   ```
   → знайдіть свій `page_id` → далі:
   ```
   GET https://graph.facebook.com/v20.0/<page_id>?fields=instagram_business_account&access_token=<page-token>
   ```
   → `instagram_business_account.id` — це `INSTAGRAM_BUSINESS_ACCOUNT_ID`.
6. Додайте змінну середовища до n8n (Docker `-e INSTAGRAM_BUSINESS_ACCOUNT_ID=...`
   або у Cloud → Settings → Environment Variables).
7. `Credentials` (n8n) → `New` → `OAuth2 API`:
   - Grant Type: `Authorization Code`
   - Authorization URL: `https://www.facebook.com/v20.0/dialog/oauth`
   - Access Token URL: `https://graph.facebook.com/v20.0/oauth/access_token`
   - Client ID / Secret: з Facebook App
   - Scope: `instagram_basic,instagram_content_publish,pages_read_engagement`
   - Authentication: `Body`

## 4. Активація та тестування

1. Відкрийте імпортований workflow.
2. Натисніть **Active** (toggle у верхньому правому куті).
3. Скопіюйте Production webhook URL з ноди `Webhook`:
   `https://<n8n-domain>/webhook/clip-video`
4. Протестуйте:

   ```bash
   curl -X POST https://<n8n-domain>/webhook/clip-video \
     -H "Content-Type: application/json" \
     -d '{
       "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
       "platforms": ["youtube"],
       "maxClips": 1,
       "minViralScore": 50
     }'
   ```

   Workflow займе ~2-5 хв (залежить від довжини вхідного відео).

5. Тестуйте спочатку з **однією платформою** (`youtube`) — перевірите
   базовий потік. Потім додавайте `tiktok` та `instagram` по одній.

## 5. Моніторинг

- `Executions` tab у n8n — історія запусків, деталі кожної ноди,
  помилки.
- Помилкові executions можна перезапустити через `Retry execution`.
- Для production радимо налаштувати `Error Workflow` (нода
  `Error Trigger`) → Telegram/Slack сповіщення при падіннях.

## 6. Типові проблеми

| Симптом                                             | Причина / фікс |
|-----------------------------------------------------|----------------|
| Vizard повертає `code: 1004`                        | невалідний `videoUrl` — перевірте, що відео публічне |
| Polling цикл виконується >20 разів                  | Vizard завис; додайте timeout (Set counter + If i>20 → Error) |
| YouTube upload: `quotaExceeded`                     | денний квот 10k одиниць; upload коштує 1600; максимум ~6 upload/день |
| TikTok: `scope not authorized`                      | застосунок не пройшов review; використовуйте Inbox mode |
| IG: `media not ready` при публікації                | відео ще обробляється; збільште `IG: Wait for Processing` до 90с |
| IG: `OAuthException: #10 Application does not have permission` | відсутній `instagram_content_publish` scope |
