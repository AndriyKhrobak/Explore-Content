<script setup lang="ts">
const { data: status } = await useFetch('/api/status', {
  key: 'landing-status',
  default: () => ({ vizardReady: false, youtubeReady: false }),
});

const name = ref('');
const submitting = ref(false);
const errorMsg = ref<string | null>(null);

async function onSubmit() {
  errorMsg.value = null;
  submitting.value = true;
  try {
    const res = await $fetch<{ id: string; name: string }>('/api/projects', {
      method: 'POST',
      body: { name: name.value },
    });
    await navigateTo(`/project/${res.id}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    errorMsg.value = message;
    submitting.value = false;
  }
}
</script>

<template>
  <main class="relative min-h-screen overflow-hidden bg-bg-base">
    <div class="absolute inset-0 bg-hero-glow" aria-hidden />
    <div class="absolute inset-0 grid-bg" aria-hidden />

    <div class="relative mx-auto flex max-w-2xl flex-col items-center px-6 py-20 sm:py-28">
      <div class="flex flex-wrap items-center justify-center gap-2">
        <span class="inline-flex items-center gap-2 rounded-full border border-line bg-bg-panel/60 px-3 py-1 text-xs text-neutral-400">
          <span
            :class="['h-1.5 w-1.5 rounded-full', status.vizardReady ? 'bg-green-400' : 'bg-yellow-400']"
            aria-hidden
          />
          Vizard: {{ status.vizardReady ? 'готово' : 'demo' }}
        </span>
        <span class="inline-flex items-center gap-2 rounded-full border border-line bg-bg-panel/60 px-3 py-1 text-xs text-neutral-400">
          <span
            :class="['h-1.5 w-1.5 rounded-full', status.youtubeReady ? 'bg-green-400' : 'bg-yellow-400']"
            aria-hidden
          />
          YouTube OAuth: {{ status.youtubeReady ? 'готово' : 'demo' }}
        </span>
      </div>

      <h1 class="mt-6 text-center text-4xl font-bold tracking-tight text-white sm:text-5xl">
        Довгі відео → <span class="text-accent-glow">віральні Shorts</span>
      </h1>

      <p class="mt-4 max-w-xl text-center text-base text-neutral-400">
        Створіть проект, підключіть YouTube і отримуйте автоматично нарізані
        вертикальні кліпи з авто-субтитрами.
      </p>

      <form
        class="mt-10 w-full rounded-2xl border border-line bg-bg-panel/60 p-6 shadow-2xl backdrop-blur-sm"
        @submit.prevent="onSubmit"
      >
        <label class="block text-sm font-medium text-neutral-300">
          Назва проекту
          <input
            v-model="name"
            type="text"
            required
            autofocus
            placeholder="Наприклад, AI Podcast Shorts"
            maxlength="80"
            class="mt-2 w-full rounded-lg border border-line bg-bg-elevated px-4 py-3 text-neutral-100 placeholder-neutral-500 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </label>

        <button
          type="submit"
          :disabled="submitting || !name.trim()"
          class="mt-4 w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/30 transition enabled:hover:bg-accent-glow disabled:cursor-not-allowed disabled:opacity-50"
        >
          {{ submitting ? 'Створюємо…' : 'Створити проект' }}
        </button>

        <p
          v-if="errorMsg"
          class="mt-4 rounded-lg border border-red-900/50 bg-red-950/50 px-4 py-3 text-sm text-red-300"
        >
          {{ errorMsg }}
        </p>
      </form>

      <ol class="mt-12 w-full space-y-3 text-sm text-neutral-400">
        <li
          v-for="(text, i) in [
            'Створюєте проект і даєте йому назву',
            'Підключаєте YouTube-акаунт (OAuth)',
            'Вставляєте YouTube URL → AI знаходить кращі моменти',
            'Вибираєте кліпи й публікуєте одним кліком',
          ]"
          :key="i"
          class="flex items-start gap-3 rounded-lg border border-line bg-bg-panel/40 px-4 py-3"
        >
          <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent-glow">
            {{ i + 1 }}
          </span>
          <span>{{ text }}</span>
        </li>
      </ol>
    </div>
  </main>
</template>
