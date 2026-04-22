import { ClipForm } from '@/components/ClipForm';
import { isConfigured } from '@/lib/vizard';

export default function HomePage() {
  const configured = isConfigured();

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg-base">
      <div className="absolute inset-0 bg-hero-glow" aria-hidden />
      <div className="absolute inset-0 grid-bg" aria-hidden />

      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-6 py-20 sm:py-28">
        <div className="inline-flex items-center gap-2 rounded-full border border-line bg-bg-panel/60 px-3 py-1 text-xs text-neutral-400">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          {configured ? 'Vizard API підключено' : 'Демо-режим (без API-ключа)'}
        </div>

        <h1 className="mt-6 text-center text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Довгі відео → <span className="text-accent-glow">віральні Shorts</span>
        </h1>

        <p className="mt-4 max-w-xl text-center text-base text-neutral-400">
          Вставте посилання на відео. AI знайде найкращі моменти, наріже у
          вертикальні кліпи з субтитрами й опублікує на YouTube Shorts, TikTok
          та Instagram Reels.
        </p>

        <div className="mt-10 w-full">
          <ClipForm />
        </div>

        <footer className="mt-16 text-center text-xs text-neutral-600">
          <p>
            Налаштування та архітектура у{' '}
            <a
              href="https://github.com/andriykhrobak/explore-content/blob/main/docs/ARCHITECTURE.md"
              className="text-neutral-400 hover:text-neutral-200"
            >
              docs/ARCHITECTURE.md
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
