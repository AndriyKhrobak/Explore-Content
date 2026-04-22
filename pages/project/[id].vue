<script setup lang="ts">
type Clip = {
  clipId: string;
  title: string;
  viralScore: number;
  videoUrl: string;
  startSec: number;
  endSec: number;
  durationSec: number;
};

type Job = {
  id: string;
  videoUrl: string;
  status: 'processing' | 'ready' | 'failed';
  mock: boolean;
  clips: Clip[];
  error: string | null;
  createdAt: string;
};

type Upload = {
  id: string;
  clipId: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  youtubeVideoId: string | null;
  youtubeUrl: string | null;
  error: string | null;
  createdAt: string;
};

type Project = {
  id: string;
  name: string;
  createdAt: string;
  youtube: {
    connected: boolean;
    channelTitle?: string | null;
    channelId?: string | null;
    channelThumbnailUrl?: string | null;
  };
  jobs: Job[];
  uploads: Upload[];
};

const route = useRoute();
const projectId = computed(() => route.params.id as string);

const { data: project, refresh, error } = await useFetch<Project>(
  () => `/api/projects/${projectId.value}`,
  { key: () => `project-${projectId.value}` },
);

if (error.value || !project.value) {
  throw createError({ statusCode: 404, statusMessage: 'Project not found' });
}

const latestJob = computed<Job | null>(() => {
  const jobs = project.value?.jobs ?? [];
  return jobs[jobs.length - 1] ?? null;
});

const uploads = computed<Upload[]>(() => project.value?.uploads ?? []);
const youtube = computed(() => project.value!.youtube);

const connectedFlash = computed(() => route.query.connected as string | undefined);
const oauthError = computed(() => route.query.error as string | undefined);

const disconnecting = ref(false);
const disconnectError = ref<string | null>(null);

async function onDisconnect() {
  if (!confirm('Відключити YouTube-акаунт від цього проекту?')) return;
  disconnectError.value = null;
  disconnecting.value = true;
  try {
    await $fetch('/api/youtube/disconnect', {
      method: 'POST',
      body: { projectId: projectId.value },
    });
    await refresh();
  } catch (err) {
    disconnectError.value = err instanceof Error ? err.message : 'Disconnect failed';
  } finally {
    disconnecting.value = false;
  }
}

// Flash banner auto-clear
onMounted(() => {
  if (connectedFlash.value || oauthError.value) {
    setTimeout(() => {
      void navigateTo(`/project/${projectId.value}`, { replace: true });
    }, 4000);
  }
});

// === Generate clips form ===
// Vizard auto-detects language and picks the optimal number of clips
// based on video content — users just paste a URL.
const videoUrl = ref('');
const generating = ref(false);
const generateError = ref<string | null>(null);

async function onGenerate() {
  generateError.value = null;
  generating.value = true;
  try {
    await $fetch('/api/clip/start', {
      method: 'POST',
      body: {
        projectId: projectId.value,
        videoUrl: videoUrl.value,
      },
    });
    await refresh();
  } catch (err: unknown) {
    generateError.value = err instanceof Error ? err.message : 'Unknown error';
  } finally {
    generating.value = false;
  }
}

// === Clip preview modal ===
const previewClip = ref<Clip | null>(null);
function openPreview(clip: Clip) {
  previewClip.value = clip;
}
function closePreview() {
  previewClip.value = null;
}

// === Polling while processing + elapsed timer ===
// /api/clip/status triggers a fresh fetch from Vizard and updates the DB.
// /api/projects/[id] only reads DB — calling it alone would never flip a
// job from 'processing' to 'ready' unless clip/status was called first.
let pollHandle: ReturnType<typeof setInterval> | null = null;
let tickHandle: ReturnType<typeof setInterval> | null = null;
const now = ref(Date.now());
const syncing = ref(false);

const elapsedLabel = computed(() => {
  const job = latestJob.value;
  if (!job || job.status !== 'processing') return '';
  const startMs = new Date(job.createdAt).getTime();
  const seconds = Math.max(0, Math.floor((now.value - startMs) / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
});

async function syncStatus() {
  const job = latestJob.value;
  if (!job || job.status !== 'processing') return;
  if (syncing.value) return;
  syncing.value = true;
  try {
    await $fetch('/api/clip/status', {
      params: { projectId: projectId.value, id: job.id },
    });
    await refresh();
  } catch {
    // Silently continue — next tick will retry.
  } finally {
    syncing.value = false;
  }
}

watchEffect(() => {
  if (pollHandle) {
    clearInterval(pollHandle);
    pollHandle = null;
  }
  if (tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
  if (latestJob.value?.status === 'processing') {
    // Kick an immediate sync on mount/reload — important for users who come
    // back after closing the tab. The DB might be stale even if Vizard finished.
    void syncStatus();
    pollHandle = setInterval(() => {
      void syncStatus();
    }, 10000);
    tickHandle = setInterval(() => {
      now.value = Date.now();
    }, 1000);
  }
});

onBeforeUnmount(() => {
  if (pollHandle) clearInterval(pollHandle);
  if (tickHandle) clearInterval(tickHandle);
});

// === Clip selection + upload ===
const selected = ref<Set<string>>(new Set());
const privacy = ref<'public' | 'unlisted' | 'private'>('private');
const uploading = ref(false);
const uploadError = ref<string | null>(null);

function toggleClip(clipId: string) {
  const next = new Set(selected.value);
  if (next.has(clipId)) next.delete(clipId);
  else next.add(clipId);
  selected.value = next;
}

function uploadForClip(clipId: string): Upload | undefined {
  return uploads.value.find((u) => u.clipId === clipId);
}

async function onUpload() {
  if (!latestJob.value || selected.value.size === 0) return;
  uploadError.value = null;
  uploading.value = true;
  try {
    await $fetch('/api/clip/upload', {
      method: 'POST',
      body: {
        projectId: projectId.value,
        jobId: latestJob.value.id,
        clipIds: Array.from(selected.value),
        privacyStatus: privacy.value,
      },
    });
    selected.value = new Set();
    await refresh();
  } catch (err: unknown) {
    uploadError.value = err instanceof Error ? err.message : 'Upload failed';
  } finally {
    uploading.value = false;
  }
}

function formatTime(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Convert a YouTube watch URL into an embeddable iframe URL.
 * Returns null for non-YouTube URLs so we fall back to <video>.
 */
function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host.includes('youtube.com') && u.pathname === '/watch') {
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    return null;
  } catch {
    return null;
  }
}

const sourceEmbedUrl = computed(() =>
  latestJob.value ? toEmbedUrl(latestJob.value.videoUrl) : null,
);

function scoreColor(score: number) {
  const hue = Math.round((score / 100) * 140);
  return {
    backgroundColor: `hsl(${hue}, 70%, 18%)`,
    color: `hsl(${hue}, 90%, 65%)`,
  };
}
</script>

<template>
  <main class="relative min-h-screen overflow-hidden bg-bg-base">
    <div class="absolute inset-0 bg-hero-glow" aria-hidden />
    <div class="absolute inset-0 grid-bg" aria-hidden />

    <div class="relative mx-auto max-w-3xl px-6 py-12">
      <nav class="mb-8 flex items-center justify-between text-sm">
        <NuxtLink to="/" class="text-neutral-400 transition hover:text-white">
          ← Всі проекти
        </NuxtLink>
        <span class="text-neutral-500">ID: {{ project!.id }}</span>
      </nav>

      <header class="mb-10">
        <h1 class="text-3xl font-bold tracking-tight text-white">{{ project!.name }}</h1>
        <p class="mt-2 text-sm text-neutral-400">
          Створено {{ new Date(project!.createdAt).toLocaleString('uk') }}
        </p>
      </header>

      <!-- Flash banners -->
      <div
        v-if="connectedFlash"
        class="mb-6 rounded-lg border border-green-900/50 bg-green-950/30 px-4 py-3 text-sm text-green-300"
      >
        YouTube-акаунт підключено{{ connectedFlash === 'demo' ? ' (демо-режим)' : '' }}.
      </div>
      <div
        v-if="oauthError"
        class="mb-6 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300"
      >
        Помилка OAuth: {{ oauthError }}
      </div>

      <!-- Step 1: YouTube -->
      <section
        v-if="!youtube.connected"
        class="rounded-2xl border border-line bg-bg-panel/60 p-6"
      >
        <h2 class="text-base font-semibold text-white">Крок 1: Підключіть YouTube Shorts</h2>
        <p class="mt-2 text-sm text-neutral-400">
          Авторизуйте доступ до вашого YouTube-каналу, щоб сервіс міг
          публікувати Shorts автоматично.
        </p>
        <a
          :href="`/api/youtube/connect?projectId=${project!.id}`"
          class="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/30 transition hover:bg-accent-glow"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path
              d="M23.498 6.186a3.008 3.008 0 0 0-2.117-2.13C19.505 3.5 12 3.5 12 3.5s-7.505 0-9.381.557A3.008 3.008 0 0 0 .502 6.186C0 8.071 0 12 0 12s0 3.929.502 5.814a3.008 3.008 0 0 0 2.117 2.13C4.495 20.5 12 20.5 12 20.5s7.505 0 9.381-.557a3.008 3.008 0 0 0 2.117-2.13C24 15.929 24 12 24 12s0-3.929-.502-5.814zM9.75 15.568V8.432L15.818 12 9.75 15.568z"
            />
          </svg>
          Підключити YouTube Shorts
        </a>
      </section>

      <section v-else class="rounded-2xl border border-line bg-bg-panel/60 p-6">
        <div class="flex items-center gap-4">
          <div
            class="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-line bg-bg-elevated"
          >
            <img
              v-if="youtube.channelThumbnailUrl"
              :src="youtube.channelThumbnailUrl"
              :alt="youtube.channelTitle || 'YouTube channel'"
              class="h-full w-full object-cover"
              referrerpolicy="no-referrer"
            />
            <div
              v-else
              class="flex h-full w-full items-center justify-center text-neutral-500"
              aria-hidden
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M23.498 6.186a3.008 3.008 0 0 0-2.117-2.13C19.505 3.5 12 3.5 12 3.5s-7.505 0-9.381.557A3.008 3.008 0 0 0 .502 6.186C0 8.071 0 12 0 12s0 3.929.502 5.814a3.008 3.008 0 0 0 2.117 2.13C4.495 20.5 12 20.5 12 20.5s7.505 0 9.381-.557a3.008 3.008 0 0 0 2.117-2.13C24 15.929 24 12 24 12s0-3.929-.502-5.814zM9.75 15.568V8.432L15.818 12 9.75 15.568z"
                />
              </svg>
            </div>
          </div>

          <div class="min-w-0 flex-1">
            <h2 class="truncate text-base font-semibold text-white">
              {{ youtube.channelTitle || 'YouTube-канал' }}
            </h2>
            <p class="mt-0.5 flex items-center gap-2 text-xs text-neutral-400">
              <span class="inline-flex h-1.5 w-1.5 rounded-full bg-green-400" aria-hidden />
              Підключено
              <a
                v-if="youtube.channelId"
                :href="`https://www.youtube.com/channel/${youtube.channelId}`"
                target="_blank"
                rel="noreferrer"
                class="text-neutral-500 hover:text-neutral-300"
              >
                відкрити →
              </a>
            </p>
          </div>

          <button
            type="button"
            :disabled="disconnecting"
            class="shrink-0 rounded-lg border border-line bg-bg-elevated px-3 py-2 text-xs font-medium text-neutral-300 transition hover:border-red-900/50 hover:bg-red-950/30 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
            @click="onDisconnect"
          >
            {{ disconnecting ? '…' : 'Відключити' }}
          </button>
        </div>
        <p
          v-if="disconnectError"
          class="mt-4 rounded-lg border border-red-900/50 bg-red-950/50 px-4 py-3 text-sm text-red-300"
        >
          {{ disconnectError }}
        </p>
      </section>

      <!-- Step 2: Generate clips -->
      <section v-if="youtube.connected" class="mt-6 rounded-2xl border border-line bg-bg-panel/60 p-6">
        <h2 class="text-base font-semibold text-white">Крок 2: Згенерувати кліпи</h2>
        <form class="mt-4 space-y-4" @submit.prevent="onGenerate">
          <label class="block text-sm font-medium text-neutral-300">
            Посилання на YouTube-відео
            <input
              v-model="videoUrl"
              type="url"
              required
              placeholder="https://www.youtube.com/watch?v=..."
              class="mt-2 w-full rounded-lg border border-line bg-bg-elevated px-4 py-3 text-neutral-100 placeholder-neutral-500 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </label>
          <p class="text-xs text-neutral-500">
            AI автоматично визначить мову та оптимальну кількість Shorts на
            основі контенту відео.
          </p>
          <button
            type="submit"
            :disabled="generating || !videoUrl"
            class="w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/30 transition enabled:hover:bg-accent-glow disabled:cursor-not-allowed disabled:opacity-50"
          >
            {{ generating ? 'Надсилаємо…' : 'Згенерувати кліпи' }}
          </button>
        </form>
        <p
          v-if="generateError"
          class="mt-4 rounded-lg border border-red-900/50 bg-red-950/50 px-4 py-3 text-sm text-red-300"
        >
          {{ generateError }}
        </p>
      </section>

      <!-- Job status -->
      <div
        v-if="latestJob?.status === 'processing'"
        class="mt-6 rounded-2xl border border-line bg-bg-panel/60 p-6 text-sm text-neutral-400"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <span class="relative flex h-2 w-2">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span class="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            <span>
              Vizard обробляє відео…
              <span class="ml-1 font-mono text-neutral-300">{{ elapsedLabel }}</span>
            </span>
          </div>
          <div class="flex items-center gap-3">
            <button
              type="button"
              :disabled="syncing"
              class="rounded-md border border-line bg-bg-elevated px-3 py-1 text-xs text-neutral-300 transition hover:border-accent hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              @click="syncStatus"
            >
              {{ syncing ? 'Перевіряємо…' : 'Перевірити зараз' }}
            </button>
            <a
              href="https://vizard.ai/dashboard"
              target="_blank"
              rel="noreferrer"
              class="text-xs text-neutral-500 hover:text-neutral-300"
            >
              Dashboard ↗
            </a>
          </div>
        </div>
        <p class="mt-3 text-xs text-neutral-500">
          Коротке відео (~5 хв) обробляється 2–4 хвилини. Година відео — до
          15–20 хвилин. Можете закрити вкладку — прогрес зберігається у БД,
          поверніться пізніше на цю сторінку.
        </p>
      </div>

      <div
        v-else-if="latestJob?.status === 'failed'"
        class="mt-6 rounded-2xl border border-red-900/50 bg-red-950/30 p-6 text-sm text-red-300"
      >
        <p class="font-medium text-red-200">Не вдалося отримати кліпи</p>
        <p class="mt-1">{{ latestJob.error || 'Невідома помилка.' }}</p>
      </div>

      <div
        v-else-if="latestJob?.mock"
        class="mt-6 rounded-lg border border-yellow-900/50 bg-yellow-950/30 px-4 py-3 text-xs text-yellow-300"
      >
        Mock-режим: VIZARD_API_KEY не налаштовано. Показано демо-кліпи.
      </div>

      <!-- Source video preview -->
      <section
        v-if="latestJob?.status === 'ready' && latestJob.clips.length > 0"
        class="mt-6 rounded-2xl border border-line bg-bg-panel/60 p-6"
      >
        <div class="mb-4 flex items-center justify-between gap-3">
          <h3 class="text-base font-semibold text-white">Вихідне відео</h3>
          <a
            :href="latestJob.videoUrl"
            target="_blank"
            rel="noreferrer"
            class="shrink-0 text-xs text-neutral-500 hover:text-neutral-300"
          >
            відкрити на YouTube ↗
          </a>
        </div>
        <div class="overflow-hidden rounded-lg border border-line bg-black">
          <div class="relative aspect-video w-full">
            <iframe
              v-if="sourceEmbedUrl"
              :src="sourceEmbedUrl"
              class="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
              referrerpolicy="strict-origin-when-cross-origin"
            />
            <video
              v-else
              :src="latestJob.videoUrl"
              controls
              class="absolute inset-0 h-full w-full"
            />
          </div>
        </div>
      </section>

      <!-- Step 3: Select & upload clips -->
      <section
        v-if="latestJob?.status === 'ready' && latestJob.clips.length > 0"
        class="mt-6 rounded-2xl border border-line bg-bg-panel/60 p-6"
      >
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-base font-semibold text-white">Виберіть кліпи для завантаження</h3>
          <span class="text-xs text-neutral-500">Обрано {{ selected.size }}</span>
        </div>

        <ul class="space-y-2">
          <li v-for="clip in latestJob.clips" :key="clip.clipId">
            <label
              :class="[
                'flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition',
                selected.has(clip.clipId)
                  ? 'border-accent bg-accent/10'
                  : 'border-line bg-bg-elevated hover:border-neutral-600',
              ]"
            >
              <input
                type="checkbox"
                :checked="selected.has(clip.clipId)"
                class="mt-1 h-4 w-4 cursor-pointer accent-accent"
                @change="toggleClip(clip.clipId)"
              />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-neutral-100">{{ clip.title }}</p>
                <p class="mt-1 text-xs text-neutral-500">
                  {{ formatTime(clip.startSec) }} → {{ formatTime(clip.endSec) }} ·
                  {{ clip.durationSec }}s
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-3">
                <button
                  v-if="!latestJob.mock"
                  type="button"
                  class="rounded-full border border-line bg-bg-base px-2.5 py-1 text-xs font-medium text-neutral-300 transition hover:border-accent hover:text-white"
                  title="Переглянути кліп"
                  @click.prevent.stop="openPreview(clip)"
                >
                  ▶ Превью
                </button>

                <span
                  class="rounded-full px-2.5 py-1 text-xs font-semibold"
                  :style="scoreColor(clip.viralScore)"
                >
                  {{ clip.viralScore }}
                </span>

                <a
                  v-if="uploadForClip(clip.clipId)?.status === 'completed'"
                  :href="uploadForClip(clip.clipId)!.youtubeUrl!"
                  target="_blank"
                  rel="noreferrer"
                  class="rounded-full bg-green-900/40 px-2.5 py-1 text-xs font-medium text-green-300 hover:bg-green-900/60"
                >
                  ✓ опубліковано
                </a>
                <span
                  v-else-if="uploadForClip(clip.clipId)?.status === 'failed'"
                  :title="uploadForClip(clip.clipId)?.error || undefined"
                  class="rounded-full bg-red-900/40 px-2.5 py-1 text-xs font-medium text-red-300"
                >
                  помилка
                </span>
                <span
                  v-else-if="uploadForClip(clip.clipId)"
                  class="rounded-full bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-300"
                >
                  вантажу…
                </span>
              </div>
            </label>
          </li>
        </ul>

        <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label class="text-sm text-neutral-400">
            Приватність:
            <select
              v-model="privacy"
              class="ml-1 rounded border border-line bg-bg-elevated px-2 py-1 text-neutral-200 outline-none"
            >
              <option value="private">private</option>
              <option value="unlisted">unlisted</option>
              <option value="public">public</option>
            </select>
          </label>
          <button
            type="button"
            :disabled="uploading || selected.size === 0"
            class="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/30 transition enabled:hover:bg-accent-glow disabled:cursor-not-allowed disabled:opacity-50"
            @click="onUpload"
          >
            {{
              uploading
                ? 'Публікуємо Shorts…'
                : `Опублікувати як Shorts (${selected.size})`
            }}
          </button>
        </div>

        <p
          v-if="youtube.channelId === 'demo-channel-id'"
          class="mt-4 rounded-lg border border-yellow-900/50 bg-yellow-950/30 px-4 py-3 text-xs text-yellow-300"
        >
          Demo-підключення: Shorts позначаються як опубліковані у БД, але
          на справжній канал не летять. Додайте GOOGLE_CLIENT_ID та
          GOOGLE_CLIENT_SECRET у Vercel env vars щоб увімкнути реальну
          публікацію.
        </p>

        <p
          v-if="uploadError"
          class="mt-4 rounded-lg border border-red-900/50 bg-red-950/50 px-4 py-3 text-sm text-red-300"
        >
          {{ uploadError }}
        </p>
      </section>
    </div>

    <!-- Clip preview modal -->
    <div
      v-if="previewClip"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      @click.self="closePreview"
      @keydown.esc="closePreview"
    >
      <div class="relative w-full max-w-md rounded-2xl border border-line bg-bg-panel shadow-2xl">
        <button
          type="button"
          aria-label="Закрити"
          class="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-bg-base/80 text-neutral-300 transition hover:bg-bg-base hover:text-white"
          @click="closePreview"
        >
          ×
        </button>
        <div class="aspect-[9/16] overflow-hidden rounded-t-2xl bg-black">
          <video
            :src="previewClip.videoUrl"
            controls
            autoplay
            playsinline
            class="h-full w-full"
          />
        </div>
        <div class="p-5">
          <h3 class="text-sm font-semibold text-white">{{ previewClip.title }}</h3>
          <p class="mt-1 text-xs text-neutral-500">
            {{ formatTime(previewClip.startSec) }} → {{ formatTime(previewClip.endSec) }} ·
            {{ previewClip.durationSec }}s · скоринг
            <span
              class="ml-1 rounded-full px-2 py-0.5 text-xs font-semibold"
              :style="scoreColor(previewClip.viralScore)"
            >
              {{ previewClip.viralScore }}
            </span>
          </p>
        </div>
      </div>
    </div>
  </main>
</template>
