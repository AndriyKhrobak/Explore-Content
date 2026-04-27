<script setup lang="ts">
const props = defineProps<{
  projectId: string;
  hasProjectCreds: boolean;
  hasEnvFallback: boolean;
  clientIdMasked: string | null;
  // Disable removal while a YouTube channel is connected — server enforces
  // this anyway, but hiding the button prevents user confusion.
  hasYouTubeConnection: boolean;
}>();

const emit = defineEmits<{ saved: []; removed: [] }>();

const editing = ref(!props.hasProjectCreds);
const clientId = ref('');
const clientSecret = ref('');
const showSecret = ref(false);
const saving = ref(false);
const removing = ref(false);
const error = ref<string | null>(null);

const redirectUri = computed(() => {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/api/youtube/callback`;
});

async function onSave() {
  error.value = null;
  const cid = clientId.value.trim();
  const cs = clientSecret.value.trim();
  if (!cid || !cs) {
    error.value = 'Введіть Client ID і Client Secret';
    return;
  }
  saving.value = true;
  try {
    await $fetch('/api/youtube/credentials', {
      method: 'POST',
      body: { projectId: props.projectId, clientId: cid, clientSecret: cs },
    });
    clientId.value = '';
    clientSecret.value = '';
    editing.value = false;
    emit('saved');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Не вдалося зберегти';
  } finally {
    saving.value = false;
  }
}

async function onRemove() {
  if (!confirm('Видалити збережені OAuth-креденшали для цього проекту?')) return;
  error.value = null;
  removing.value = true;
  try {
    await $fetch('/api/youtube/credentials', {
      method: 'DELETE',
      body: { projectId: props.projectId },
    });
    emit('removed');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Не вдалося видалити';
  } finally {
    removing.value = false;
  }
}

function startEdit() {
  clientId.value = '';
  clientSecret.value = '';
  error.value = null;
  editing.value = true;
}

function cancelEdit() {
  editing.value = false;
  error.value = null;
}
</script>

<template>
  <section class="rounded-2xl border border-line bg-bg-panel/60 p-5">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h3 class="text-base font-semibold text-white">Google OAuth credentials</h3>
        <p class="mt-1 text-xs text-neutral-500">
          Окремий Google Cloud project для цього YouTube-акаунта (у Testing
          mode, без верифікації). Client ID + Secret з
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noreferrer"
            class="text-accent hover:underline"
          >Google Cloud Console</a>.
        </p>
      </div>
      <span
        v-if="hasProjectCreds"
        class="shrink-0 rounded-full border border-green-900/50 bg-green-950/30 px-2.5 py-1 text-xs font-medium text-green-300"
      >
        ✓ збережено
      </span>
      <span
        v-else-if="hasEnvFallback"
        class="shrink-0 rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-xs font-medium text-neutral-400"
        title="Використовується GOOGLE_CLIENT_ID з env"
      >
        env-fallback
      </span>
      <span
        v-else
        class="shrink-0 rounded-full border border-yellow-900/50 bg-yellow-950/30 px-2.5 py-1 text-xs font-medium text-yellow-300"
      >
        потрібно додати
      </span>
    </div>

    <!-- Read-only state -->
    <div v-if="hasProjectCreds && !editing" class="mt-4 space-y-3">
      <div class="flex items-center justify-between rounded-lg border border-line bg-bg-elevated px-4 py-2.5 font-mono text-xs text-neutral-300">
        <span class="truncate">{{ clientIdMasked }}</span>
        <span class="ml-3 shrink-0 text-neutral-600">Client ID</span>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="rounded-lg border border-line bg-bg-elevated px-3 py-2 text-xs font-medium text-neutral-300 transition hover:border-accent hover:text-white"
          @click="startEdit"
        >
          Замінити
        </button>
        <button
          v-if="!hasYouTubeConnection"
          type="button"
          :disabled="removing"
          class="rounded-lg border border-line bg-bg-elevated px-3 py-2 text-xs font-medium text-neutral-300 transition hover:border-red-900/50 hover:bg-red-950/30 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
          @click="onRemove"
        >
          {{ removing ? '…' : 'Видалити' }}
        </button>
      </div>
    </div>

    <!-- Edit / first-time form -->
    <form v-else-if="editing" class="mt-4 space-y-3" @submit.prevent="onSave">
      <label class="block text-xs font-medium text-neutral-400">
        Client ID
        <input
          v-model="clientId"
          type="text"
          required
          autocomplete="off"
          spellcheck="false"
          placeholder="123456789-abc...apps.googleusercontent.com"
          class="mt-1.5 w-full rounded-lg border border-line bg-bg-elevated px-3 py-2 font-mono text-xs text-neutral-100 placeholder-neutral-600 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </label>
      <label class="block text-xs font-medium text-neutral-400">
        Client Secret
        <div class="relative mt-1.5">
          <input
            v-model="clientSecret"
            :type="showSecret ? 'text' : 'password'"
            required
            autocomplete="off"
            spellcheck="false"
            placeholder="GOCSPX-..."
            class="w-full rounded-lg border border-line bg-bg-elevated px-3 py-2 pr-16 font-mono text-xs text-neutral-100 placeholder-neutral-600 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
          <button
            type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-neutral-400 transition hover:text-white"
            @click="showSecret = !showSecret"
          >
            {{ showSecret ? 'Сховати' : 'Показати' }}
          </button>
        </div>
      </label>

      <div class="rounded-lg border border-neutral-800 bg-bg-elevated/50 px-3 py-2 text-xs text-neutral-500">
        <p class="font-medium text-neutral-300">Authorized redirect URI:</p>
        <code class="mt-1 block truncate font-mono text-[11px] text-accent">
          {{ redirectUri || 'https://<your-domain>/api/youtube/callback' }}
        </code>
        <p class="mt-1.5">
          Скопіюй цей URL у GCP → APIs & Services → Credentials → твій OAuth
          client → Authorized redirect URIs.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="submit"
          :disabled="saving || !clientId.trim() || !clientSecret.trim()"
          class="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white transition enabled:hover:bg-accent-glow disabled:cursor-not-allowed disabled:opacity-50"
        >
          {{ saving ? 'Зберігаємо…' : 'Зберегти' }}
        </button>
        <button
          v-if="hasProjectCreds"
          type="button"
          :disabled="saving"
          class="rounded-lg border border-line bg-bg-elevated px-3 py-2 text-xs text-neutral-300 transition hover:border-neutral-600"
          @click="cancelEdit"
        >
          Скасувати
        </button>
      </div>
    </form>

    <p
      v-if="error"
      class="mt-3 rounded-lg border border-red-900/50 bg-red-950/50 px-3 py-2 text-xs text-red-300"
    >
      {{ error }}
    </p>
  </section>
</template>
