# Explore-Content

Автоматизація створення Shorts/Reels/TikTok-кліпів із довгих відео.

Сервіс приймає посилання на довге відео, використовує **Vizard.ai** для
автоматичного знаходження "віральних" моментів, нарізає їх у вертикальні
кліпи 8–60 с з авто-субтитрами та публікує на YouTube Shorts, TikTok і
Instagram Reels.

Дві частини:

- **Next.js web-app** (`app/`) — темний SaaS-інтерфейс, деплоїться на Vercel.
  У `VIZARD_API_KEY`-порожньому стані працює як демо (mock-кліпи).
- **n8n workflow** (`workflows/clip-video-to-shorts.json`) — автоматизація
  публікації на всі 3 платформи. Підключається на наступному етапі.

## Демо-режим vs production

| Стан | Що робить UI |
|------|--------------|
| `VIZARD_API_KEY` не заданий | Показує 3 mock-кліпи з фейковими тайтлами і скорингом. |
| `VIZARD_API_KEY` заданий | Дзвонить у Vizard, поллить статус, показує реальні кліпи з посиланнями. |
| + n8n webhook (майбутнє) | Додатково публікує кожен кліп на обрані платформи. |

## Швидкий запуск локально

```bash
npm install
npm run dev
# → http://localhost:3000
```

Без `VIZARD_API_KEY` працює у mock-режимі. З ключем (`.env.local`):

```env
VIZARD_API_KEY=your-key-from-vizard.ai-settings
```

## Деплой на Vercel

1. Push цю гілку на GitHub.
2. https://vercel.com → `Add New` → `Project` → Import цей репо.
3. Framework auto-detect: **Next.js** (нічого не змінюйте).
4. **Environment Variables** (опційно): додайте `VIZARD_API_KEY` якщо
   хочете живі кліпи одразу. Без неї деплой все одно запрацює у демо-режимі.
5. `Deploy`. Через ~60с отримуєте `https://<project>.vercel.app`.

Альтернатива через CLI:

```bash
npm install -g vercel
vercel            # перший раз лінкує проект
vercel --prod     # прод-деплой
```

## API

Web-UI дзвонить на ці роути; їх можна викликати й напряму.

### `POST /api/clip/start`

```json
{
  "videoUrl": "https://www.youtube.com/watch?v=...",
  "platforms": ["youtube", "tiktok", "instagram"],
  "maxClips": 3
}
```

Відповідь: `{ "id": "job_xxx", "mock": false }`.

### `GET /api/clip/status?id=<job_id>`

```json
{
  "id": "job_xxx",
  "status": "processing" | "ready" | "failed",
  "mock": false,
  "platforms": ["youtube", "tiktok", "instagram"],
  "clips": [
    { "clipId": "...", "title": "...", "viralScore": 92,
      "videoUrl": "https://...", "startSec": 45, "endSec": 73, "durationSec": 28 }
  ]
}
```

Клієнт поллить `status` кожні 8 секунд доки не `ready`/`failed`.

> **Важливо про Vercel serverless:** job-store — in-memory Map, тому
> після холодного старту функції job'и "губляться". Для production
> переведіть на Vercel KV або Upstash Redis (5 хвилин роботи, див.
> `lib/jobs.ts` — один map-об'єкт).

## Потік n8n workflow (публікація)

```
Webhook → Vizard → poll → filter top clips → loop →
  ├─ YouTube Shorts (youTube node)
  ├─ TikTok (Content Posting API)
  └─ Instagram Reels (Graph API)
```

Наразі не підключений до web-UI — запускається як окремий pipeline через
свій webhook URL. На v2 web-UI передаватиме `job_id` у n8n або сам UI
викликатиме webhook після `status=ready`.

## Авторські права — важливо

Сервіс **не обходить** copyright. Безпечні сценарії:

1. **Власні довгі відео** — ваш канал, ваші стріми, ваші подкасти.
2. **Creative Commons** — YouTube-фільтр `Creative Commons`, із атрибуцією.
3. **Явний дозвіл автора** — партнерство/афіліат.

"Fair use" автоматично не захищає. Content ID / Audible Magic / Rights
Manager ловлять збіги навіть при кроппінгу, зміні швидкості та мірроренні.

Деталі у [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Структура репозиторію

```
.
├── app/                              — Next.js App Router
│   ├── layout.tsx, page.tsx, globals.css
│   └── api/clip/{start,status}/route.ts
├── components/
│   └── ClipForm.tsx                  — клієнтська форма з поллінгом
├── lib/
│   ├── vizard.ts                     — клієнт Vizard API (+ mock)
│   └── jobs.ts                       — in-memory job store
├── workflows/
│   └── clip-video-to-shorts.json     — n8n workflow (імпортується у n8n UI)
├── docs/
│   ├── ARCHITECTURE.md
│   └── SETUP.md
├── .env.example
├── tailwind.config.ts, next.config.ts, tsconfig.json
└── package.json
```

## Roadmap

- [x] **v0**: Темний SaaS-UI + mock-режим + real-Vizard на Vercel.
- [ ] **v1**: Підключити n8n webhook → публікація після вибору клієнтом.
- [ ] **v2**: Persistent store (Vercel KV) замість in-memory Map.
- [ ] **v3**: AI-асистент обирає відео-джерела за темою.
- [ ] **v4**: Планувальник постингу (часові слоти, черга).
- [ ] **v5**: Аналітика + зворотний зв'язок ("що залетіло — генеруй ще такого").
