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
  status: 'scheduled' | 'pending' | 'uploading' | 'completed' | 'failed';
  scheduledAt: string | null;
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

// === Inline edit of project name ===
const editingName = ref(false);
const editedName = ref('');
const savingName = ref(false);
const nameError = ref<string | null>(null);
const nameInputRef = ref<HTMLInputElement | null>(null);

function startEditName() {
  editedName.value = project.value?.name ?? '';
  nameError.value = null;
  editingName.value = true;
  nextTick(() => {
    nameInputRef.value?.focus();
    nameInputRef.value?.select();
  });
}

function cancelEditName() {
  editingName.value = false;
  nameError.value = null;
}

async function saveName() {
  const next = editedName.value.trim();
  if (!next || next === project.value?.name) {
    cancelEditName();
    return;
  }
  savingName.value = true;
  nameError.value = null;
  try {
    await $fetch(`/api/projects/${projectId.value}`, {
      method: 'PATCH',
      body: { name: next },
    });
    await refresh();
    editingName.value = false;
  } catch (err) {
    nameError.value = err instanceof Error ? err.message : 'Не вдалося зберегти';
  } finally {
    savingName.value = false;
  }
}

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

const hasActiveQueue = computed(() =>
  (project.value?.uploads ?? []).some(
    (u) => u.status === 'scheduled' || u.status === 'uploading',
  ),
);

watchEffect(() => {
  if (pollHandle) {
    clearInterval(pollHandle);
    pollHandle = null;
  }
  if (tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
  const isProcessing = latestJob.value?.status === 'processing';
  if (isProcessing) {
    // Kick an immediate sync on mount/reload — important for users who come
    // back after closing the tab. The DB might be stale even if Vizard finished.
    void syncStatus();
    pollHandle = setInterval(() => {
      void syncStatus();
    }, 10000);
  } else if (hasActiveQueue.value) {
    // Cron does the actual work; we just refresh the project view to reflect
    // status changes (scheduled → uploading → completed).
    pollHandle = setInterval(() => {
      void refresh();
    }, 15000);
  }
  if (isProcessing || hasActiveQueue.value) {
    tickHandle = setInterval(() => {
      now.value = Date.now();
    }, 1000);
  }
});

onBeforeUnmount(() => {
  if (pollHandle) clearInterval(pollHandle);
  if (tickHandle) clearInterval(tickHandle);
});

// === Auto-publish queue ===
// Vizard finishes → backend creates Upload rows with status='scheduled' and
// staggered scheduledAt (now, +30m, +60m, ...). Vercel Cron processes them.
function uploadForClip(clipId: string): Upload | undefined {
  return uploads.value.find((u) => u.clipId === clipId);
}

function untilScheduled(iso: string | null): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - now.value;
  if (ms <= 0) return 'зараз';
  const totalMin = Math.ceil(ms / 60000);
  if (totalMin < 60) return `через ${totalMin} хв`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `через ${h} год` : `через ${h} год ${m} хв`;
}

// === Delete project ===
const deleting = ref(false);
async function onDeleteProject() {
  if (!confirm(`Видалити проект "${project.value?.name}"? Усі кліпи та публікації зникнуть.`)) return;
  deleting.value = true;
  try {
    await $fetch(`/api/projects/${projectId.value}`, { method: 'DELETE' });
    await navigateTo('/');
  } catch (err) {
    deleting.value = false;
    alert(err instanceof Error ? err.message : 'Не вдалося видалити');
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
        <div class="flex items-center gap-3">
          <span class="text-neutral-500">ID: {{ project!.id }}</span>
          <button
            type="button"
            :disabled="deleting"
            class="rounded-md border border-line bg-bg-elevated px-2.5 py-1 text-xs text-neutral-400 transition hover:border-red-900/50 hover:bg-red-950/30 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
            @click="onDeleteProject"
          >
            {{ deleting ? '…' : 'Видалити' }}
          </button>
        </div>
      </nav>

      <header class="mb-10">
        <div v-if="!editingName" class="group flex items-center gap-3">
          <h1 class="text-3xl font-bold tracking-tight text-white">
            {{ project!.name }}
          </h1>
          <button
            type="button"
            class="rounded-md p-1.5 text-neutral-500 opacity-0 transition hover:bg-bg-panel hover:text-white group-hover:opacity-100 focus:opacity-100"
            aria-label="Редагувати назву"
            @click="startEditName"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </button>
        </div>
        <form v-else class="flex items-center gap-2" @submit.prevent="saveName">
          <input
            ref="nameInputRef"
            v-model="editedName"
            type="text"
            maxlength="80"
            required
            :disabled="savingName"
            class="flex-1 rounded-lg border border-accent bg-bg-elevated px-3 py-2 text-2xl font-bold tracking-tight text-white outline-none focus:ring-2 focus:ring-accent/30"
            @keydown.esc="cancelEditName"
          />
          <button
            type="submit"
            :disabled="savingName || !editedName.trim() || editedName.trim() === project!.name"
            class="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white transition enabled:hover:bg-accent-glow disabled:cursor-not-allowed disabled:opacity-50"
          >
            {{ savingName ? '…' : 'Зберегти' }}
          </button>
          <button
            type="button"
            :disabled="savingName"
            class="rounded-lg border border-line bg-bg-elevated px-3 py-2 text-sm text-neutral-300 transition hover:border-neutral-600"
            @click="cancelEditName"
          >
            Скасувати
          </button>
        </form>
        <p
          v-if="nameError"
          class="mt-2 text-xs text-red-400"
        >
          {{ nameError }}
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

      <!-- Step 1: Platforms -->
      <div class="space-y-3">
        <PlatformCard
          platform="youtube"
          :connected="youtube.connected"
          :channel-title="youtube.channelTitle"
          :channel-url="youtube.channelId ? `https://www.youtube.com/channel/${youtube.channelId}` : null"
          :connect-href="`/api/youtube/connect?projectId=${project!.id}`"
          :disabled="disconnecting"
          @disconnect="onDisconnect"
        />
        <PlatformCard platform="tiktok" :connected="false" coming-soon />
      </div>
      <p
        v-if="disconnectError"
        class="mt-4 rounded-lg border border-red-900/50 bg-red-950/50 px-4 py-3 text-sm text-red-300"
      >
        {{ disconnectError }}
      </p>

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

      <!-- Step 3: Auto-publish queue -->
      <section
        v-if="latestJob?.status === 'ready' && latestJob.clips.length > 0"
        class="mt-6 rounded-2xl border border-line bg-bg-panel/60 p-6"
      >
        <div class="mb-2 flex items-center justify-between">
          <h3 class="text-base font-semibold text-white">Авто-публікація на YouTube Shorts</h3>
          <span class="text-xs text-neutral-500">{{ latestJob.clips.length }} кліпів</span>
        </div>
        <p class="mb-5 text-xs text-neutral-500">
          Перший кліп публікується одразу, наступні — з інтервалом 30 хвилин.
          Можете закрити вкладку — все відбувається на сервері.
        </p>

        <ul class="space-y-2">
          <li v-for="clip in latestJob.clips" :key="clip.clipId">
            <div
              class="flex items-start gap-3 rounded-lg border border-line bg-bg-elevated px-4 py-3"
            >
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
                  @click="openPreview(clip)"
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
                  v-else-if="uploadForClip(clip.clipId)?.status === 'uploading'"
                  class="rounded-full bg-accent/20 px-2.5 py-1 text-xs font-medium text-accent-glow"
                >
                  вантажу…
                </span>
                <span
                  v-else-if="uploadForClip(clip.clipId)?.status === 'scheduled'"
                  class="rounded-full bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-400"
                >
                  {{ untilScheduled(uploadForClip(clip.clipId)!.scheduledAt) }}
                </span>
                <span
                  v-else
                  class="rounded-full bg-neutral-800/50 px-2.5 py-1 text-xs font-medium text-neutral-500"
                >
                  у черзі
                </span>
              </div>
            </div>
          </li>
        </ul>

        <p
          v-if="youtube.channelId === 'demo-channel-id'"
          class="mt-4 rounded-lg border border-yellow-900/50 bg-yellow-950/30 px-4 py-3 text-xs text-yellow-300"
        >
          Demo-підключення: Shorts позначаються як опубліковані у БД, але
          на справжній канал не летять. Додайте GOOGLE_CLIENT_ID та
          GOOGLE_CLIENT_SECRET у Vercel env vars щоб увімкнути реальну
          публікацію.
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
