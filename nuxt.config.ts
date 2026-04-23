export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  modules: ['@nuxtjs/tailwindcss'],
  css: ['~/assets/css/tailwind.css'],
  typescript: { strict: true },

  app: {
    head: {
      title: 'Explore Content — AI Shorts Generator',
      htmlAttrs: { lang: 'uk' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'Нарізає довгі відео на віральні Shorts / TikTok / Reels за допомогою AI.',
        },
        {
          name: 'tiktok-developers-site-verification',
          content: '7Tj0y7Yu4ou9JLGKNGnFG3x34NoTDbaY',
        },
      ],
    },
  },

  runtimeConfig: {
    vizardApiKey: process.env.VIZARD_API_KEY,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    googleRedirectUri: process.env.GOOGLE_REDIRECT_URI,
    demoYoutubeConnect: process.env.DEMO_YOUTUBE_CONNECT === 'true',
    public: {},
  },

  nitro: {
    preset: process.env.VERCEL ? 'vercel' : undefined,
    // Workaround: Nitro's node-file-trace strips vue/index.mjs when copying
    // deps to the Vercel function bundle, crashing every request with
    // ERR_MODULE_NOT_FOUND. Inlining Vue bundles it into the function itself.
    externals: {
      inline: [
        'vue',
        '@vue/runtime-core',
        '@vue/runtime-dom',
        '@vue/server-renderer',
        '@vue/shared',
        '@vue/reactivity',
      ],
    },
  },
});
