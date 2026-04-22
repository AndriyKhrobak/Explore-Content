# Explore-Content

Автоматизація створення вертикальних Shorts із довгих YouTube-відео:
вставляєте посилання → AI (**Vizard.ai**) знаходить найкращі моменти
та віддає кліпи з субтитрами → вибираєте які публікувати → сервіс
завантажує їх на ваш YouTube-канал через Data API.

Деплоїться на Vercel. Без API-ключів працює як демо (mock-кліпи +
симуляція YouTube-підключення) — можна одразу побачити весь UX.

## Флоу користувача

1. **`/`** — поле "Назва проекту" + кнопка `Створити`.
2. **`/project/[id]`** — стан 1: кнопка `Підключити YouTube`
   (OAuth через Google, якщо `GOOGLE_CLIENT_ID` заданий — інакше
   симуляція).
3. **Стан 2**: поле YouTube-URL + слайдер кількості кліпів + кнопка
   `Згенерувати кліпи`. Запит іде у Vizard.
4. **Стан 3**: список кліпів з чекбоксами, віральним скорингом
   (0–100) і таймкодами. Вибираєте + обираєте приватність
   (private/unlisted/public) + `Завантажити обрані на YouTube`.

## Режими роботи

| ENV | UI | Що реально відбувається |
|-----|----|-------------------------|
| Нічого | Демо | mock-кліпи, фейкове підключення YouTube, fake upload URL |
| `VIZARD_API_KEY` | Part-real | Справжні кліпи з Vizard, але YouTube симулюється |
| + `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Production | Все справжнє — реальні відео летять на ваш канал |

## Швидкий запуск локально

```bash
npm install
npm run dev
# → http://localhost:3000
```

Без жодних env-змінних UI працює повністю як демо. Для реальних API
створіть `.env.local` з шаблоном `.env.example`.

## Деплой на Vercel

1. Push цю гілку на GitHub.
2. https://vercel.com → `Add New → Project` → імпорт репозиторію.
3. Framework: **Next.js** (auto-detect).
4. `Environment Variables`:
   - `VIZARD_API_KEY` (опційно — для реальних кліпів).
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (опційно — для
     реального YouTube upload).
5. `Deploy` → `https://<project>.vercel.app`.

Після деплою: у Google Cloud Console додайте
`https://<project>.vercel.app/api/youtube/callback` до Authorized
redirect URIs OAuth-клієнта.

## Налаштування Google OAuth (для production)

1. https://console.cloud.google.com → створіть проект.
2. `APIs & Services → Library` → enable **YouTube Data API v3**.
3. `APIs & Services → OAuth consent screen` → External → заповніть
   мінімум (app name, support email). На Testing додайте свій email у
   `Test users`, щоб могти авторизуватись без review.
4. `APIs & Services → Credentials → Create OAuth client ID`:
   - Type: **Web application**
   - Authorized redirect URIs:
     - `http://localhost:3000/api/youtube/callback`
     - `https://<your-vercel>.vercel.app/api/youtube/callback`
5. Збережіть Client ID + Client Secret у env.

## API (внутрішнє)

- `POST /api/projects` — створити проект (`{ name }`).
- `GET  /api/projects/:id` — отримати стан проекту (кліпи, uploads, YT).
- `GET  /api/youtube/connect?projectId=…` — редірект у Google OAuth.
- `GET  /api/youtube/callback?code&state` — callback, зберігає токен.
- `POST /api/clip/start` — Vizard create (`{ projectId, videoUrl, maxClips }`).
- `GET  /api/clip/status?projectId&id` — полінг статусу, повертає кліпи.
- `POST /api/clip/upload` — YouTube upload
  (`{ projectId, jobId, clipIds[], privacyStatus }`).

## Архітектурні нотатки

- **Persistence:** in-memory `Map` у `lib/projects.ts`. Для Vercel
  serverless це означає що дані зникають між холодними стартами.
  Для реального prod-у переведіть на Vercel KV або Upstash Redis
  (~30 рядків — замінити `Map` на KV-клієнт).
- **YouTube upload:** multipart/related через Data API `videos.insert`.
  Одна request скачує кліп у Buffer і лупить у Google. Вертикальне
  відео ≤60 с → YouTube сам перетворює у Short. Клавіша `maxDuration`
  у роуті = 60с (Vercel Pro потрібен).
- **Vizard:** `project/create` + поллінг `project/query/{id}` поки
  `code === 2000`. Клієнт поллить `/api/clip/status` кожні 8 секунд.
- **OAuth refresh:** токен автоматично оновлюється через
  `refresh_token` перед upload (`ensureFreshToken`).

## Безпека та копірайт

Сервіс **не обходить** Content ID. Використовуйте тільки:

1. Власні відео (ваш канал, подкасти, стріми).
2. Creative Commons з атрибуцією.
3. Відео з явним дозволом автора.

## Структура репозиторію

```
app/
├── page.tsx                           — лендінг + форма створення
├── project/[id]/page.tsx              — сторінка проекту (server)
└── api/
    ├── projects/                      — CRUD проектів
    ├── youtube/{connect,callback}/    — OAuth 2.0 flow
    └── clip/{start,status,upload}/    — Vizard + YouTube upload

components/
├── CreateProjectForm.tsx              — форма на лендінгу
└── ProjectClient.tsx                  — стейт-машина сторінки проекту

lib/
├── vizard.ts                          — Vizard API + mock
├── youtube.ts                         — OAuth + Data API upload
└── projects.ts                        — in-memory store

workflows/
└── clip-video-to-shorts.json          — n8n workflow (TikTok+IG на майбутнє)

docs/
├── ARCHITECTURE.md
└── SETUP.md                           — для n8n, не для web-app
```

## Roadmap

- [x] **v0**: UI + mock-режим.
- [x] **v1**: Створення проектів + YouTube OAuth + upload через Data API.
- [ ] **v2**: Vercel KV замість in-memory Map (щоб дані не губились).
- [ ] **v3**: TikTok + Instagram upload у web-app (зараз лише у n8n JSON).
- [ ] **v4**: Планувальник (черга публікацій + часові слоти).
- [ ] **v5**: AI-асистент шукає джерела за темою/контекстом.
- [ ] **v6**: Аналітика переглядів + feedback loop.
