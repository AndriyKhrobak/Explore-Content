# Explore-Content

Nuxt 3 + Prisma + Supabase Postgres. Сервіс бере посилання на довге
YouTube-відео → Vizard.ai знаходить "віральні" моменти → публікує
обрані кліпи на YouTube Shorts через Data API.

## Флоу користувача

1. **`/`** — інпут назви проекту + кнопка `Створити`.
2. **`/project/[id]`** — стан 1: `Підключити YouTube` (OAuth 2.0).
3. Стан 2: YouTube-URL + слайдер кількості + `Згенерувати кліпи` (Vizard).
4. Стан 3: список кліпів з чекбоксами → `Завантажити обрані на YouTube`.

## Стек

| Шар | Технологія |
|-----|------------|
| Frontend | Vue 3 + Nuxt 3 (App Router + Nitro) |
| Styling | Tailwind CSS v3 |
| ORM | Prisma 6 |
| DB | Supabase Postgres (pooler для serverless) |
| Hosting | Vercel (Nitro-preset) |
| APIs | Vizard.ai (кліпер), YouTube Data API v3 (upload) |

## Швидкий запуск локально

### 1. Клонування + залежності

```bash
git clone <repo>
cd Explore-Content
npm install
```

### 2. Supabase (створення БД)

1. https://supabase.com → `New project` → виберіть регіон (eu-central-1
   для України) → задайте пароль БД.
2. `Settings → Database → Connection string → URI (Transaction pooler)`
   → скопіюйте рядок для `DATABASE_URL`.
3. `Connection string → URI (Session pooler)` → скопіюйте для
   `DIRECT_URL`. Це `5432` порт замість `6543`.
4. Створіть `.env`:

   ```bash
   cp .env.example .env
   # → вставте обидва рядки
   ```

### 3. Міграції

```bash
npx prisma migrate dev --name init
```

Це створить таблиці у Supabase. Перевірити можна через
`npx prisma studio` (відкриє GUI на http://localhost:5555).

### 4. Запуск

```bash
npm run dev
# → http://localhost:3000
```

Без `VIZARD_API_KEY` — mock-кліпи. Без `GOOGLE_CLIENT_ID` — симуляція
YouTube-підключення. Обидва додаються у `.env` коли готові.

## Деплой на Vercel

### А. Через Dashboard (рекомендовано)

1. **Push branch** у GitHub (вже зроблено для `claude/start-new-project-udKpD`).
2. https://vercel.com → `Add New → Project` → імпортуйте репо.
3. **Framework Preset:** auto-detect визначає `Nuxt.js` — нічого не змінюйте.
4. **Build command:** `npm run build` (дефолт підходить).
5. **Environment Variables** — додайте:

   ```
   DATABASE_URL         = <Supabase pooled URL, порт 6543>
   DIRECT_URL           = <Supabase direct URL, порт 5432>
   VIZARD_API_KEY       = <опційно>
   GOOGLE_CLIENT_ID     = <опційно>
   GOOGLE_CLIENT_SECRET = <опційно>
   ```

6. `Deploy`. Через ~60-90с отримуєте `https://<project>.vercel.app`.
7. **Після деплою:** додайте `https://<project>.vercel.app/api/youtube/callback`
   до Authorized redirect URIs у Google Cloud Console.

### Б. Через CLI

```bash
npm i -g vercel
vercel login
vercel link           # лінкує локальну папку до нового/існуючого проекту
vercel env pull       # підтягує env vars у .env.local
vercel --prod         # prod-деплой
```

## Google OAuth (BYO Client — рекомендований шлях)

Ідея: **кожен YouTube-акаунт = окремий проект у Google Cloud**, у Testing
mode, де власник цього GCP-проекту сам собі test user. Це обходить
вимогу Google verification + дає кожному акаунту власну квоту 10k
units/день (~6 upload/день). Працює з 1-100 акаунтами без сторонніх
аудитів.

Для **кожного** YouTube-акаунту повторити:

1. https://console.cloud.google.com → `New Project` (наприклад `yt-acc-01`).
2. `APIs & Services → Library` → enable **YouTube Data API v3**.
3. `APIs & Services → OAuth consent screen`:
   - User Type: **External**
   - App name, support email
   - Scopes → додайте `.../auth/youtube.upload` + `.../auth/youtube.readonly`
   - **Test users** → додайте Gmail-адресу цього YouTube-акаунту
4. `APIs & Services → Credentials → Create credentials → OAuth client ID`:
   - Type: **Web application**
   - Authorized redirect URIs:
     - `http://localhost:3000/api/youtube/callback`
     - `https://<your-vercel-url>/api/youtube/callback`
5. Скопіюйте `Client ID` + `Client secret`.
6. У застосунку → створіть Project → форма **"Google OAuth credentials"** на
   сторінці проекту → вставте обидва значення → `Зберегти`.
7. Натисніть `Підключити YouTube` → пройдіть OAuth під цим Gmail.

Креденшали зберігаються у БД (`GoogleClientCredentials`) і
завантажуються per-project під час OAuth + upload. Видалити можна
через UI (тільки після `Disconnect`).

### Обмеження Testing mode

- **Refresh token живе 7 днів** → раз на тиждень треба перепідключати
  кожен акаунт. Production verification знімає це, але для
  `youtube.upload` потрібен платний CASA-аудит ($).
- На consent screen юзер бачить попередження "App not verified" →
  `Advanced → Go to ... (unsafe)`.

### Env-fallback (опційно)

Якщо у `.env` задані `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` — вони
використовуються для проектів, де у БД немає власних креденшалів. Зручно
для локальної розробки під одним акаунтом без зайвої возні з UI.

## Auto-publish cron (через Supabase pg_cron)

Vercel Hobby plan дозволяє cron лише раз на добу. Тому `vercel.json`
**не використовується** — замість цього cron запускається з самого
Postgres через `pg_cron` + `pg_net` (доступні навіть на Free plan).

Одноразове налаштування у Supabase:

1. **Dashboard → Database → Extensions** → enable **`pg_cron`** і **`pg_net`**.
2. **SQL Editor → New query** → запусти SQL нижче, замінивши значення
   на свої:

   ```sql
   -- замініть BASE_URL на ваш домен Vercel
   -- замініть SECRET на значення CRON_SECRET з Vercel env vars
   SELECT cron.schedule(
     'process-uploads-every-minute',
     '* * * * *',
     $$
     SELECT net.http_get(
       url := 'https://YOUR-DOMAIN.vercel.app/api/cron/process-uploads',
       headers := '{"Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb
     );
     $$
   );
   ```

3. Перевірити що працює:
   ```sql
   SELECT * FROM cron.job;                   -- має бути 1 рядок
   SELECT * FROM cron.job_run_details        -- історія запусків
   ORDER BY start_time DESC LIMIT 10;
   ```

4. У Vercel **Settings → Environment Variables** додати
   `CRON_SECRET = <те саме значення що в SQL вище>`. Без нього
   endpoint доступний публічно (працюватиме, але без захисту).

Зупинити cron можна так: `SELECT cron.unschedule('process-uploads-every-minute');`

## API

| Метод | Шлях | Опис |
|-------|------|------|
| POST  | `/api/projects` | Створити проект (`{ name }`) |
| GET   | `/api/projects/:id` | Стан проекту + кліпи + uploads |
| GET   | `/api/youtube/connect?projectId=` | → Google OAuth (або демо) |
| GET   | `/api/youtube/callback` | OAuth callback → `/project/:id` |
| POST  | `/api/youtube/credentials` | Зберегти Client ID/Secret для проекту |
| DELETE | `/api/youtube/credentials` | Видалити (вимагає Disconnect спершу) |
| POST  | `/api/clip/start` | Vizard create (`{ projectId, videoUrl, maxClips }`) |
| GET   | `/api/clip/status?projectId=&id=` | Поллінг Vizard |
| POST  | `/api/clip/upload` | Upload у YT (`{ projectId, jobId, clipIds[], privacyStatus }`) |
| GET   | `/api/status` | Чи готові Vizard/YouTube креденшали |

## Структура

```
app.vue                         — root
pages/
├── index.vue                   — лендінг
└── project/[id].vue            — сторінка проекту
server/
├── api/
│   ├── projects/               — CRUD
│   ├── youtube/{connect,callback}.get.ts
│   ├── clip/{start,status,upload}.ts
│   └── status.get.ts
└── utils/
    ├── db.ts                   — Prisma singleton
    ├── vizard.ts               — Vizard API + mock
    └── youtube.ts              — OAuth + Data API upload
prisma/
└── schema.prisma               — Project, GoogleClientCredentials,
                                  YouTubeConnection, Job, Upload
workflows/
└── clip-video-to-shorts.json   — (legacy) n8n workflow для TikTok+IG
docs/
└── ARCHITECTURE.md             — історія архітектури
```

## Безпека та копірайт

Сервіс **не обходить** Content ID. Безпечні джерела:

1. Власні відео (ваш канал).
2. Creative Commons з атрибуцією.
3. Явний дозвіл автора.

## Roadmap

- [x] **v0**: Nuxt UI + Supabase persistence + mock/real toggle.
- [ ] **v1**: OAuth review від Google → можна публікувати під публічними акаунтами.
- [ ] **v2**: TikTok + Instagram Reels upload (зараз лише у n8n JSON).
- [ ] **v3**: Планувальник публікацій (часові слоти, черга).
- [ ] **v4**: Auth (Supabase Auth) → мульти-користувацький режим + RLS.
- [ ] **v5**: AI-асистент шукає джерела за темою (Claude/GPT).
- [ ] **v6**: Аналітика переглядів + feedback loop.
