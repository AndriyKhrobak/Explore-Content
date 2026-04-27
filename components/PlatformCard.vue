<script setup lang="ts">
type Platform = 'youtube' | 'tiktok';

defineProps<{
  platform: Platform;
  connected: boolean;
  channelTitle?: string | null;
  channelUrl?: string | null;
  comingSoon?: boolean;
  connectHref?: string;
  disabled?: boolean;
}>();

defineEmits<{ disconnect: [] }>();

const LABELS: Record<Platform, string> = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
};
</script>

<template>
  <section class="rounded-2xl border border-line bg-bg-panel/60 p-5">
    <div class="flex items-center gap-4">
      <!-- Platform logo -->
      <div
        :class="[
          'relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full',
          platform === 'youtube' ? 'bg-[#FF0000]' : 'bg-black',
        ]"
        aria-hidden
      >
        <!-- YouTube play-button -->
        <svg
          v-if="platform === 'youtube'"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="white"
        >
          <path d="M23.498 6.186a3.008 3.008 0 0 0-2.117-2.13C19.505 3.5 12 3.5 12 3.5s-7.505 0-9.381.557A3.008 3.008 0 0 0 .502 6.186C0 8.071 0 12 0 12s0 3.929.502 5.814a3.008 3.008 0 0 0 2.117 2.13C4.495 20.5 12 20.5 12 20.5s7.505 0 9.381-.557a3.008 3.008 0 0 0 2.117-2.13C24 15.929 24 12 24 12s0-3.929-.502-5.814zM9.75 15.568V8.432L15.818 12 9.75 15.568z" />
        </svg>
        <!-- TikTok note -->
        <svg
          v-else
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="white"
        >
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.1z" />
        </svg>
      </div>

      <!-- Middle: channel info or "connect" prompt -->
      <div class="min-w-0 flex-1">
        <template v-if="connected">
          <a
            v-if="channelUrl"
            :href="channelUrl"
            target="_blank"
            rel="noreferrer"
            class="block truncate text-base font-semibold text-white hover:underline"
          >
            {{ channelTitle || 'Канал' }}
          </a>
          <p v-else class="truncate text-base font-semibold text-white">
            {{ channelTitle || 'Канал' }}
          </p>
          <p class="mt-0.5 flex items-center gap-2 text-xs text-neutral-500">
            <span class="inline-flex h-1.5 w-1.5 rounded-full bg-green-400" aria-hidden />
            <span>{{ LABELS[platform] }}</span>
            <span>·</span>
            <span>Підключено</span>
          </p>
        </template>

        <template v-else>
          <p class="text-base font-semibold text-white">{{ LABELS[platform] }}</p>
          <p class="mt-0.5 text-xs text-neutral-500">
            <template v-if="comingSoon">Скоро: автоматична публікація Shorts</template>
            <template v-else>Авторизуйте акаунт для публікації Shorts</template>
          </p>
        </template>
      </div>

      <!-- Right: action button -->
      <div class="shrink-0">
        <button
          v-if="connected"
          type="button"
          :disabled="disabled"
          class="rounded-lg border border-line bg-bg-elevated px-3 py-2 text-xs font-medium text-neutral-300 transition hover:border-red-900/50 hover:bg-red-950/30 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
          @click="$emit('disconnect')"
        >
          {{ disabled ? '…' : 'Відключити' }}
        </button>

        <span
          v-else-if="comingSoon"
          class="inline-flex items-center rounded-full border border-yellow-900/50 bg-yellow-950/30 px-3 py-1.5 text-xs font-medium text-yellow-300"
        >
          Скоро
        </span>

        <a
          v-else-if="connectHref && !disabled"
          :href="connectHref"
          class="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-accent/30 transition hover:bg-accent-glow"
        >
          Підключити
        </a>
        <span
          v-else-if="connectHref && disabled"
          class="inline-flex items-center gap-2 rounded-lg bg-neutral-800 px-4 py-2 text-xs font-semibold text-neutral-500"
        >
          Підключити
        </span>
      </div>
    </div>
  </section>
</template>
