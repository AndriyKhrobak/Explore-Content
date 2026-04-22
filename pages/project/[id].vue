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
  youtube: { connected: boolean; channelTitle?: string | null; channelId?: string | null };
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

// Flash banner auto-clear
onMounted(() => {
  if (connectedFlash.value || oauthError.value) {
    setTimeout(() => {
      void navigateTo(`/project/${projectId.value}`, { replace: true });
    }, 4000);
  }
});

// === Generate clips form ===
const videoUrl = ref('');
const maxClips = ref(3);
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
        maxClips: maxClips.value,
      },
    });
    await refresh();
  } catch (err: unknown) {
    generateError.value = err instanceof Error ? err.message : 'Unknown error';
  } finally {
    generating.value = false;
  }
}

// === Polling while processing ===
let pollHandle: ReturnType<typeof setInterval> | null = null;

watchEffect(() => {
  if (pollHandle) {
    clearInterval(pollHandle);
    pollHandle = null;
  }
  if (latestJob.value?.status === 'processing') {
    pollHandle = setInterval(() => {
      void refresh();
    }, 8000);
  }
});

onBeforeUnmount(() => {
  if (pollHandle) clearInterval(pollHandle);
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
        <h2 class="text-base font-semibold text-white">Крок 1: Підключіть YouTube</h2>
        <p class="mt-2 text-sm text-neutral-400">
          Авторизуйте доступ, щоб сервіс міг завантажувати кліпи на ваш канал.
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
          Підключити YouTube
        </a>
      </section>

      <section v-else class="rounded-2xl border border-line bg-bg-panel/60 p-6">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h2 class="text-base font-semibold text-white">YouTube підключено</h2>
            <p class="mt-1 text-sm text-neutral-400">
              Канал: <span class="text-neutral-200">{{ youtube.channelTitle || 'Unknown' }}</span>
            </p>
          </div>
          <span class="rounded-full bg-green-900/40 px-3 py-1 text-xs font-medium text-green-300">
            Активний
          </span>
        </div>
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
          <label class="block text-sm font-medium text-neutral-300">
            Кількість кліпів: <span class="text-white">{{ maxClips }}</span>
            <input
              v-model.number="maxClips"
              type="range"
              min="1"
              max="10"
              class="mt-2 w-full accent-accent"
            />
          </label>
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
        <div class="flex items-center gap-3">
          <span class="relative flex h-2 w-2">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span class="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          Vizard обробляє відео. Це може зайняти 2–5 хвилин.
        </div>
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
                  ✓ на YouTube
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
                ? 'Завантажуємо…'
                : `Завантажити обрані (${selected.size}) на YouTube`
            }}
          </button>
        </div>
        <p
          v-if="uploadError"
          class="mt-4 rounded-lg border border-red-900/50 bg-red-950/50 px-4 py-3 text-sm text-red-300"
        >
          {{ uploadError }}
        </p>
      </section>
    </div>
  </main>
</template>
