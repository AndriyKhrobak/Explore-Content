<script setup lang="ts">
useHead({ title: 'Privacy Policy — Explore Content' });
</script>

<template>
  <main class="relative min-h-screen bg-bg-base">
    <div class="relative mx-auto max-w-2xl px-6 py-16">
      <NuxtLink to="/" class="mb-8 inline-block text-sm text-neutral-400 hover:text-white">
        ← Home
      </NuxtLink>

      <article class="prose prose-invert prose-neutral max-w-none text-neutral-300">
        <h1 class="text-3xl font-bold text-white">Privacy Policy</h1>
        <p class="text-sm text-neutral-500">Last updated: April 2026</p>

        <h2 class="mt-8 text-xl font-semibold text-white">Who we are</h2>
        <p>
          Explore Content (“we”, “our”, “the service”) is an AI-assisted tool
          that turns long-form videos into short vertical clips and optionally
          publishes them to the user's connected social accounts (YouTube,
          TikTok).
        </p>

        <h2 class="mt-8 text-xl font-semibold text-white">Data we collect</h2>
        <ul class="list-disc pl-6">
          <li>
            <strong>Video source URLs</strong> you submit (e.g. a YouTube link).
          </li>
          <li>
            <strong>OAuth tokens</strong> issued by YouTube (Google) and TikTok
            when you connect an account. Stored encrypted at rest; used only to
            upload clips on your behalf.
          </li>
          <li>
            <strong>Public channel/profile info</strong> — name, avatar, channel
            ID — fetched once after connecting, so we can show the connected
            account in the UI.
          </li>
          <li>
            <strong>Clip metadata</strong> returned by Vizard AI — title, start
            and end timestamps, viral score — stored for the lifetime of the
            project.
          </li>
        </ul>

        <h2 class="mt-8 text-xl font-semibold text-white">Data we do not collect</h2>
        <ul class="list-disc pl-6">
          <li>No analytics, no tracking cookies, no ad pixels.</li>
          <li>We do not read your private videos, DMs, or comments.</li>
          <li>We do not sell or share data with third parties for marketing.</li>
        </ul>

        <h2 class="mt-8 text-xl font-semibold text-white">Third parties</h2>
        <p>
          The service relies on third-party APIs strictly to provide its core
          function:
        </p>
        <ul class="list-disc pl-6">
          <li>
            <strong>Vizard AI</strong> — processes your submitted video URL to
            produce short clips. Their privacy policy:
            <a href="https://vizard.ai/privacy" class="text-accent-glow underline">vizard.ai/privacy</a>.
          </li>
          <li>
            <strong>Google / YouTube</strong> — OAuth and upload API. Their
            policy:
            <a href="https://policies.google.com/privacy" class="text-accent-glow underline">policies.google.com/privacy</a>.
          </li>
          <li>
            <strong>TikTok</strong> — Login Kit and Content Posting API. Their
            policy:
            <a href="https://www.tiktok.com/legal/privacy-policy" class="text-accent-glow underline">tiktok.com/legal/privacy-policy</a>.
          </li>
          <li>
            <strong>Vercel</strong> — hosting. <strong>Supabase Postgres</strong> — database.
          </li>
        </ul>

        <h2 class="mt-8 text-xl font-semibold text-white">Your rights</h2>
        <p>
          You can disconnect any social account at any time — this revokes the
          stored OAuth token. You can delete your project at any time, which
          removes all associated jobs, uploads, and tokens from our database.
        </p>
        <p>
          To request deletion of any remaining data, contact us (see below).
        </p>

        <h2 class="mt-8 text-xl font-semibold text-white">Data retention</h2>
        <p>
          Project data (clips, upload history) is retained until you delete the
          project. OAuth tokens are retained until you disconnect the account.
          Vizard-generated clip files expire according to Vizard's retention
          policy (typically 7 days).
        </p>

        <h2 class="mt-8 text-xl font-semibold text-white">Contact</h2>
        <p>
          Questions about this policy: open an issue at
          <a href="https://github.com/AndriyKhrobak/Explore-Content" class="text-accent-glow underline">github.com/AndriyKhrobak/Explore-Content</a>.
        </p>
      </article>
    </div>
  </main>
</template>
