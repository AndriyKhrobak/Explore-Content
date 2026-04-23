<script setup lang="ts">
useHead({ title: 'Terms of Service — Explore Content' });
</script>

<template>
  <main class="relative min-h-screen bg-bg-base">
    <div class="relative mx-auto max-w-2xl px-6 py-16">
      <NuxtLink to="/" class="mb-8 inline-block text-sm text-neutral-400 hover:text-white">
        ← Home
      </NuxtLink>

      <article class="prose prose-invert prose-neutral max-w-none text-neutral-300">
        <h1 class="text-3xl font-bold text-white">Terms of Service</h1>
        <p class="text-sm text-neutral-500">Last updated: April 2026</p>

        <h2 class="mt-8 text-xl font-semibold text-white">What the service does</h2>
        <p>
          Explore Content (“the service”) takes a long-form video URL you
          provide, sends it to Vizard AI to generate short vertical clips, and
          — if you choose — uploads the resulting clips to your connected
          YouTube and/or TikTok account.
        </p>

        <h2 class="mt-8 text-xl font-semibold text-white">Your responsibilities</h2>
        <ul class="list-disc pl-6">
          <li>
            You may only submit videos that you own or have permission to
            process. Do not submit content that infringes copyright, violates
            platform rules, or is illegal.
          </li>
          <li>
            You are responsible for what gets published under your social
            accounts via the service. You can review clips before uploading.
          </li>
          <li>
            You must comply with the terms of any third-party platform you
            connect (YouTube Terms of Service, TikTok Community Guidelines).
          </li>
        </ul>

        <h2 class="mt-8 text-xl font-semibold text-white">Account connection</h2>
        <p>
          Connecting a social account grants the service permission to act on
          your behalf for the sole purpose of uploading clips you've selected.
          You can disconnect at any time to revoke these permissions.
        </p>

        <h2 class="mt-8 text-xl font-semibold text-white">Availability</h2>
        <p>
          The service is provided as-is, without warranty of any kind. We may
          throttle, suspend, or terminate access at any time, especially if
          third-party APIs we depend on (Vizard, YouTube, TikTok) change their
          terms or rate limits.
        </p>

        <h2 class="mt-8 text-xl font-semibold text-white">Limitation of liability</h2>
        <p>
          We are not liable for lost uploads, takedowns, strikes on your
          social accounts, clip quality, or any indirect or consequential
          damages resulting from use of the service.
        </p>

        <h2 class="mt-8 text-xl font-semibold text-white">Changes</h2>
        <p>
          These terms may be updated. The “Last updated” date at the top
          reflects the most recent revision.
        </p>

        <h2 class="mt-8 text-xl font-semibold text-white">Contact</h2>
        <p>
          Questions: open an issue at
          <a href="https://github.com/AndriyKhrobak/Explore-Content" class="text-accent-glow underline">github.com/AndriyKhrobak/Explore-Content</a>.
        </p>
      </article>
    </div>
  </main>
</template>
