# Архітектура

## Загальна ідея

Сервіс бере довге відео → викликає AI-кліпер, який знаходить "віральні"
моменти → нарізає вертикальні кліпи з авто-субтитрами → публікує на
YouTube Shorts, TikTok та Instagram Reels.

Оркестрація — **n8n** (low-code платформа автоматизації). Логіка живе у
одному workflow-файлі, тому не потрібен сервер-бекенд.

## Чому Vizard.ai

Вимога була "найкращий за ціною-якістю". Короткий порівняльний аналіз:

| Сервіс       | API   | Віральний скоринг | Ціна (нижчий тариф) | Якість |
|--------------|-------|-------------------|---------------------|--------|
| Opus Clip    | ні*   | так               | $19/міс             | висока |
| **Vizard.ai**| **так** | **так**         | **~$16/міс**        | висока |
| Klap.app     | так   | ні (лише TS)      | $29/міс             | середня|
| SubMagic     | ні    | ні                | $10/міс             | лише субтитри |
| 2Short       | ні    | так               | $10/міс             | середня |

*Opus Clip пропонує API лише на Enterprise-рівні, без публічного price.*

**Vizard.ai** обрано тому що:
1. Публічний REST API (HTTP Request nodes у n8n → без кастом-інтеграції).
2. Приймає YouTube-URL напряму (не треба завантажувати відео локально).
3. Повертає `viralScore` (0–100) для фільтрації.
4. Авто-субтитри й вертикальний кроп вбудовано.

## Потік даних (детально)

### 1. Webhook-trigger

Приймає POST JSON (див. [`README.md`](../README.md) → "Вхідні дані").
`responseMode = responseNode` — n8n відповідає синхронно через окремий
`Respond to Webhook` у кінці workflow, щоб клієнт отримав результати
публікації, а не 200 OK одразу.

### 2. Vizard: Create Project

```
POST https://elb-api.vizard.ai/hvizard-server-front/open-api/v1/project/create
Headers: VIZARDAI_API_KEY (через Header Auth credential)
Body:
{
  "lang": "en",
  "preferLength": [1, 2],          // 1 = <30s, 2 = 30-60s
  "videoUrl": "<original-url>",
  "videoType": 2,                  // 2 = YouTube, 1 = direct URL
  "subtitleSwitch": 1,
  "headlineSwitch": 1,
  "maxClipNumber": maxClips * 2    // беремо з запасом, потім фільтруємо
}
```

Повертає `{ data: { projectId } }`. Обробка асинхронна — треба polling.

### 3. Polling-цикл (Wait → Get Status → If)

Vizard відповідає кодом `2000` коли обробка завершена. Інші коди
(`1000` — processing) означають "чекай далі".

```
Wait 60s → Vizard Get Status → If code == 2000 ?
  ├─ True  → переходимо до фільтрації
  └─ False → назад у Wait (цикл)
```

**Обмеження:** у n8n немає вбудованого ліміту на кількість ітерацій;
додайте захист від нескінченного циклу (наприклад, окремий лічильник
через `Set`-ноду, якщо це важливо).

### 4. Filter Top Clips (Code node)

Vizard повертає `data.videos[]`. Код:
1. Відфільтровує кліпи з `viralScore >= minViralScore`.
2. Сортує за `viralScore` спадаючи.
3. Бере перші `maxClips` штук.
4. Повертає їх як окремі items n8n (кожен кліп → окремий item).

### 5. Loop Over Clips (Split in Batches, batchSize = 1)

Ітерує по кожному кліпу послідовно. Необхідно, щоб обмежити
паралельні upload'и (API-ліміти платформ).

Вихід `0` (done) → `Respond`.
Вихід `1` (item) → обробка наступного кліпу.

### 6. Download Clip

Vizard повертає `clipUrl` — публічний URL на hosted-mp4. Завантажуємо як
binary (`responseFormat: file`), щоб передати у YouTube-ноду.

Для TikTok/IG посилання передається напряму (PULL_FROM_URL / video_url).

### 7. Платформ-гілки (паралельно)

Після `Download Clip` розгалужуємось на три `If`-ноди, які перевіряють
`platforms.includes(...)`. Кожна гілка незалежна.

#### 7a. YouTube Shorts

Вбудована нода `n8n-nodes-base.youTube` з `resource=video, operation=upload`.
Завантажує `binary.data`. Для того щоб відео стало Shorts, YouTube сам
визначає за форматом (вертикальне + ≤60с). Додавати `#shorts` у опис
рекомендовано (але не критично).

#### 7b. TikTok Content Posting API

```
POST https://open.tiktokapis.com/v2/post/publish/inbox/video/init/
Body: { "source_info": { "source": "PULL_FROM_URL", "video_url": "<clipUrl>" } }
```

**Примітка:** для повного auto-publish потрібен скоуп `video.publish` і
`source_info.source = "PULL_FROM_URL"`. Якщо `video.publish` не схвалений
(потребує TikTok review), кліпи попадають у Inbox — користувач завершує
публікацію вручну через TikTok-застосунок.

Workflow ініціює завантаження; статус публікації можна опитати через
`/v2/post/publish/status/fetch/` (додайте Wait + HTTP Request якщо треба).

#### 7c. Instagram Reels (Graph API)

Двокрокова публікація:

```
1. POST /v20.0/{IG_USER_ID}/media
   ?media_type=REELS
   &video_url=<clipUrl>
   &caption=<caption>
   &share_to_feed=true
   → { id: "<creation-id>" }

2. Почекати 30-60с (Instagram обробляє відео)

3. POST /v20.0/{IG_USER_ID}/media_publish
   ?creation_id=<creation-id>
   → { id: "<published-media-id>" }
```

**Вимоги:**
- IG-акаунт має бути Business або Creator.
- Прив'язаний до Facebook Page.
- Застосунок у Facebook Developers з дозволами
  `instagram_basic`, `instagram_content_publish`, `pages_read_engagement`.
- `INSTAGRAM_BUSINESS_ACCOUNT_ID` — env var з ID IG-бізнес акаунту.

### 8. Merge Per-Clip Results

Збирає результати з трьох гілок назад у один потік, щоб передати у
`Loop Over Clips` (наступна ітерація).

### 9. Respond

Після завершення циклу (`Loop` output 0) формує JSON з підсумком і
відсилає клієнту.

## Авторські права — технічні межі

Цей workflow **технічно** дозволить вам нарізати й опублікувати
будь-яке відео, куди у вас є доступ. Це не означає, що вам це
**дозволено юридично**.

### Безпечні варіанти

1. **Власний контент** — ваші стріми/подкасти/лекції/вебінари.
2. **Creative Commons** — YouTube-фільтр `Search filter → Creative Commons`.
   Використовуйте атрибуцію у описі кліпу (ім'я автора + URL оригіналу).
3. **Ліцензований контент** — явна згода автора (партнерство).

### Не безпечні варіанти

- "Реакції" на чужі відео без візуального/аудіо коментаря.
- Кліпи з Netflix/Disney/Amazon та інших підписних платформ.
- Популярні подкасти без дозволу (Joe Rogan, Lex Fridman тощо).
- Кліпи новинних каналів (CNN, BBC, Reuters) — всі під агресивним
  Content ID.

YouTube Content ID блокує автоматично, TikTok має Commercial Music
Library + ручну модерацію, Instagram використовує Audible Magic +
Facebook Rights Manager. Всі три легко ідентифікують збіги навіть при
кроппінгу/швидкості/міррорі.

## Roadmap — v2: AI пошук джерел

Користувач згадав "зробимо систему аналізу та пошуку потрібних відео
відносно контексту". План:

```
Chat Trigger (тема+контекст)
    ▼
AI Agent (GPT/Claude)
    │ Tools:
    │   - YouTube Search (Data API v3, order=viewCount)
    │   - RSS fetch (feedparser через HTTP)
    │   - YouTube Most Replayed (unofficial /heatmap endpoint)
    ▼
Shortlist 5-10 candidate URLs
    ▼
(користувач затверджує через /approve webhook)
    ▼
Feed URLs into clip-video-to-shorts workflow
```

Це окремий workflow, який викликає поточний через n8n
`Execute Workflow` node.

## Вартість (приблизна, за 100 кліпів/міс)

| Компонент         | Ціна                              |
|-------------------|-----------------------------------|
| Vizard Lite       | $16/міс (до 50 хв / міс)          |
| Vizard Creator    | $32/міс (до 200 хв / міс)         |
| n8n Cloud Starter | $24/міс (5k executions) або self-hosted безкоштовно |
| YouTube API       | Безкоштовно (10k quota/день)      |
| TikTok API        | Безкоштовно (rate limit)          |
| IG Graph API      | Безкоштовно (25 API-calls/годину) |

Очікувано **$40-56/міс** при self-hosted n8n для обсягу ~100 кліпів.
