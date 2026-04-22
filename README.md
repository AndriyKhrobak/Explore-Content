# Explore-Content

Автоматизація створення Shorts/Reels/TikTok-кліпів із довгих відео.

Сервіс приймає посилання на довге відео, використовує **Vizard.ai** для
автоматичного знаходження "віральних" моментів, нарізає їх у вертикальні
кліпи 8–60 с з авто-субтитрами та публікує на YouTube Shorts, TikTok та
Instagram Reels.

Реалізовано як n8n workflow (`workflows/clip-video-to-shorts.json`).

## Потік роботи

```
Webhook (POST /clip-video)
    │  { videoUrl, platforms[], maxClips, context? }
    ▼
Vizard.ai: Create Project (POST)
    │  videoUrl → projectId
    ▼
Wait 60s  ◄─────────────────┐
    │                        │
    ▼                        │
Vizard.ai: Get Project       │
    │                        │
    ▼                        │
  status == 2000? ──── no ───┘ (poll loop)
    │ yes
    ▼
Filter clips (top N by virality)
    │
    ▼
Loop Over Items (Split in Batches)
    │
    ├─► Download clip binary (HTTP Request)
    │
    ├─► If platforms ∋ "youtube"  → YouTube node (video/upload)
    ├─► If platforms ∋ "tiktok"   → HTTP Request (TikTok Content Posting API)
    └─► If platforms ∋ "instagram"→ HTTP Request (Instagram Graph API — Reels)
```

## Вхідні дані

```http
POST /webhook/clip-video
Content-Type: application/json

{
  "videoUrl": "https://www.youtube.com/watch?v=...",
  "platforms": ["youtube", "tiktok", "instagram"],
  "maxClips": 3,
  "minViralScore": 80,
  "context": "Фокус на найбільш інформативні моменти про AI"
}
```

- `videoUrl` — посилання на довге відео (YouTube, Vimeo, прямий mp4).
- `platforms` — куди публікувати (будь-яка комбінація).
- `maxClips` — скільки верхніх кліпів взяти (за віральним скорингом Vizard).
- `minViralScore` — нижня межа віральності (0–100), Vizard повертає значення.
- `context` — (майбутнє) для AI-фільтрації кліпів за темою.

## Авторські права — важливо

Workflow **не обходить** copyright. Ви несете відповідальність за вміст,
який завантажуєте. Безпечні сценарії:

1. **Власні довгі відео** — ваш канал, ваші стріми, ваші подкасти.
2. **Creative Commons** — використовуйте YouTube-фільтр `Creative Commons`
   і вказуйте атрибуцію у описі.
3. **Отриманий дозвіл** — явна письмова згода автора (партнерство, афіліат).

"Fair use" не працює автоматично — YouTube Content ID блокує кліпи
незалежно від трансформації. При бажанні робити "реакції/аналіз" потрібно
додавати власний голос/вебкам/коментарі, але ризик страйку залишається.

## Швидкий старт

1. Імпортуйте `workflows/clip-video-to-shorts.json` у вашу n8n інстанцію
   (Workflows → Import from File).
2. Скопіюйте `.env.example` → додайте свої креденшали у n8n Credentials:
   - `Vizard API` (Header Auth → `VIZARDAI_API_KEY`)
   - `YouTube OAuth2`
   - `TikTok OAuth2` (Content Posting API)
   - `Instagram Graph API` (Facebook OAuth2)
3. Увімкніть workflow, скопіюйте Production webhook URL.
4. POST JSON на цей URL — отримаєте список кліпів та статуси публікації.

Деталі: [`docs/SETUP.md`](docs/SETUP.md) та [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Структура репозиторію

```
.
├── README.md                          — цей файл
├── .env.example                       — шаблон секретів
├── workflows/
│   └── clip-video-to-shorts.json      — n8n workflow (імпортується напряму)
└── docs/
    ├── ARCHITECTURE.md                — детальний дизайн
    └── SETUP.md                       — покрокове налаштування
```

## Roadmap

- [ ] v1 (MVP): ручне передавання `videoUrl` через webhook, публікація на 3 платформи.
- [ ] v2: AI-асистент вибирає джерела за темою (RSS/YouTube search + LLM-фільтр).
- [ ] v3: Планувальник постингу (cron + розподіл за часовими слотами).
- [ ] v4: Аналітика (збір метрик переглядів з YouTube/TikTok/IG API).
- [ ] v5: Зворотний зв'язок AI на основі аналітики (що "залетіло" — роби ще такого).
