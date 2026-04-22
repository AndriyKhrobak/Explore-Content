import { CreateProjectForm } from '@/components/CreateProjectForm';
import { isConfigured } from '@/lib/vizard';
import { isOAuthConfigured } from '@/lib/youtube';

export default function HomePage() {
  const vizardReady = isConfigured();
  const youtubeReady = isOAuthConfigured();

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg-base">
      <div className="absolute inset-0 bg-hero-glow" aria-hidden />
      <div className="absolute inset-0 grid-bg" aria-hidden />

      <div className="relative mx-auto flex max-w-2xl flex-col items-center px-6 py-20 sm:py-28">
        <StatusChips vizardReady={vizardReady} youtubeReady={youtubeReady} />

        <h1 className="mt-6 text-center text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Довгі відео → <span className="text-accent-glow">віральні Shorts</span>
        </h1>

        <p className="mt-4 max-w-xl text-center text-base text-neutral-400">
          Створіть проект, підключіть YouTube і отримуйте автоматично нарізані
          вертикальні кліпи з авто-субтитрами.
        </p>

        <div className="mt-10 w-full">
          <CreateProjectForm />
        </div>

        <ol className="mt-12 w-full space-y-3 text-sm text-neutral-400">
          <Step n={1} text="Створюєте проект і даєте йому назву" />
          <Step n={2} text="Підключаєте YouTube-акаунт (OAuth)" />
          <Step n={3} text="Вставляєте YouTube URL → AI знаходить кращі моменти" />
          <Step n={4} text="Вибираєте кліпи й публікуєте одним кліком" />
        </ol>
      </div>
    </main>
  );
}

function StatusChips({ vizardReady, youtubeReady }: { vizardReady: boolean; youtubeReady: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Chip label="Vizard" ready={vizardReady} />
      <Chip label="YouTube OAuth" ready={youtubeReady} />
    </div>
  );
}

function Chip({ label, ready }: { label: string; ready: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-bg-panel/60 px-3 py-1 text-xs text-neutral-400">
      <span
        className={`h-1.5 w-1.5 rounded-full ${ready ? 'bg-green-400' : 'bg-yellow-400'}`}
        aria-hidden
      />
      {label}: {ready ? 'готово' : 'demo'}
    </span>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-line bg-bg-panel/40 px-4 py-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent-glow">
        {n}
      </span>
      <span>{text}</span>
    </li>
  );
}
