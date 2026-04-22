'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { VizardClip } from '@/lib/vizard';
import type { Upload } from '@/lib/projects';

type YouTubeState = {
  connected: boolean;
  channelTitle?: string;
  channelId?: string;
};

type JobView = {
  id: string;
  videoUrl: string;
  status: 'processing' | 'ready' | 'failed';
  mock: boolean;
  clips: VizardClip[];
  error?: string;
};

type Props = {
  projectId: string;
  initialYoutube: YouTubeState;
  initialJob: JobView | null;
  initialUploads: Upload[];
  youtubeOAuthConfigured: boolean;
};

export function ProjectClient({
  projectId,
  initialYoutube,
  initialJob,
  initialUploads,
  youtubeOAuthConfigured,
}: Props) {
  const [youtube, setYoutube] = useState<YouTubeState>(initialYoutube);
  const [job, setJob] = useState<JobView | null>(initialJob);
  const [uploads, setUploads] = useState<Upload[]>(initialUploads);

  const searchParams = useSearchParams();
  const router = useRouter();
  const justConnected = searchParams.get('connected');
  const oauthError = searchParams.get('error');

  useEffect(() => {
    if (justConnected || oauthError) {
      const timer = setTimeout(() => router.replace(`/project/${projectId}`), 4000);
      return () => clearTimeout(timer);
    }
  }, [justConnected, oauthError, projectId, router]);

  async function refreshProject() {
    const res = await fetch(`/api/projects/${projectId}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = (await res.json()) as {
      youtube: YouTubeState;
      jobs: JobView[];
      uploads: Upload[];
    };
    setYoutube(data.youtube);
    setUploads(data.uploads);
    if (data.jobs.length > 0) setJob(data.jobs[data.jobs.length - 1]);
  }

  return (
    <div className="space-y-6">
      {justConnected && (
        <Banner tone="success">
          YouTube-акаунт підключено{justConnected === 'demo' ? ' (демо-режим)' : ''}.
        </Banner>
      )}
      {oauthError && <Banner tone="error">Помилка OAuth: {oauthError}</Banner>}

      <YouTubePanel
        projectId={projectId}
        state={youtube}
        oauthConfigured={youtubeOAuthConfigured}
      />

      {youtube.connected && (
        <ClipsPanel
          projectId={projectId}
          job={job}
          setJob={setJob}
          uploads={uploads}
          onRefresh={refreshProject}
        />
      )}
    </div>
  );
}

function YouTubePanel({
  projectId,
  state,
  oauthConfigured,
}: {
  projectId: string;
  state: YouTubeState;
  oauthConfigured: boolean;
}) {
  if (state.connected) {
    return (
      <section className="rounded-2xl border border-line bg-bg-panel/60 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white">YouTube підключено</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Канал: <span className="text-neutral-200">{state.channelTitle ?? 'Unknown'}</span>
            </p>
          </div>
          <span className="rounded-full bg-green-900/40 px-3 py-1 text-xs font-medium text-green-300">
            Активний
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-bg-panel/60 p-6">
      <h2 className="text-base font-semibold text-white">Крок 1: Підключіть YouTube</h2>
      <p className="mt-2 text-sm text-neutral-400">
        {oauthConfigured
          ? 'Авторизуйте доступ, щоб сервіс міг завантажувати кліпи на ваш канал через YouTube Data API.'
          : 'GOOGLE_CLIENT_ID не заданий — буде імітовано підключення (demo-режим).'}
      </p>
      <a
        href={`/api/youtube/connect?projectId=${projectId}`}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/30 transition hover:bg-accent-glow"
      >
        <YouTubeIcon />
        {oauthConfigured ? 'Підключити YouTube' : 'Симулювати підключення'}
      </a>
    </section>
  );
}

function ClipsPanel({
  projectId,
  job,
  setJob,
  uploads,
  onRefresh,
}: {
  projectId: string;
  job: JobView | null;
  setJob: (j: JobView | null) => void;
  uploads: Upload[];
  onRefresh: () => Promise<void>;
}) {
  const [videoUrl, setVideoUrl] = useState('');
  const [maxClips, setMaxClips] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [privacy, setPrivacy] = useState<'public' | 'unlisted' | 'private'>('private');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    if (!job || job.status !== 'processing') return;
    pollRef.current = window.setInterval(async () => {
      const res = await fetch(`/api/clip/status?projectId=${projectId}&id=${job.id}`);
      if (!res.ok) return;
      const data = (await res.json()) as JobView;
      setJob(data);
      if (data.status !== 'processing' && pollRef.current) {
        window.clearInterval(pollRef.current);
      }
    }, 8000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [job, projectId, setJob]);

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/clip/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, videoUrl, maxClips }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error ?? `HTTP ${res.status}`);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  function toggleClip(clipId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(clipId)) next.delete(clipId);
      else next.add(clipId);
      return next;
    });
  }

  async function onUpload() {
    if (!job || selected.size === 0) return;
    setUploading(true);
    setError(null);
    try {
      const res = await fetch('/api/clip/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          jobId: job.id,
          clipIds: Array.from(selected),
          privacyStatus: privacy,
        }),
      });
      const data = (await res.json()) as {
        results?: Array<{ clipId: string; ok: boolean; youtubeUrl?: string; error?: string }>;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSelected(new Set());
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-line bg-bg-panel/60 p-6">
        <h2 className="text-base font-semibold text-white">Крок 2: Згенерувати кліпи</h2>
        <form onSubmit={onGenerate} className="mt-4 space-y-4">
          <label className="block text-sm font-medium text-neutral-300">
            Посилання на YouTube-відео
            <input
              type="url"
              required
              placeholder="https://www.youtube.com/watch?v=..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="mt-2 w-full rounded-lg border border-line bg-bg-elevated px-4 py-3 text-neutral-100 placeholder-neutral-500 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </label>
          <label className="block text-sm font-medium text-neutral-300">
            Кількість кліпів: <span className="text-white">{maxClips}</span>
            <input
              type="range"
              min={1}
              max={10}
              value={maxClips}
              onChange={(e) => setMaxClips(Number(e.target.value))}
              className="mt-2 w-full accent-accent"
            />
          </label>
          <button
            type="submit"
            disabled={submitting || !videoUrl}
            className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/30 transition enabled:hover:bg-accent-glow disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Надсилаємо…' : 'Згенерувати кліпи'}
          </button>
        </form>
        {error && (
          <p className="mt-4 rounded-lg border border-red-900/50 bg-red-950/50 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}
      </div>

      {job && <JobPanel job={job} />}

      {job?.status === 'ready' && job.clips.length > 0 && (
        <div className="rounded-2xl border border-line bg-bg-panel/60 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-white">
              Виберіть кліпи для завантаження
            </h3>
            <span className="text-xs text-neutral-500">Обрано {selected.size}</span>
          </div>

          <ul className="space-y-2">
            {job.clips.map((clip) => {
              const checked = selected.has(clip.clipId);
              const uploadForClip = uploads.find((u) => u.clipId === clip.clipId);
              return (
                <li key={clip.clipId}>
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition ${
                      checked
                        ? 'border-accent bg-accent/10'
                        : 'border-line bg-bg-elevated hover:border-neutral-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleClip(clip.clipId)}
                      className="mt-1 h-4 w-4 cursor-pointer accent-accent"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-100">
                        {clip.title}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {formatTime(clip.startSec)} → {formatTime(clip.endSec)} ·{' '}
                        {clip.durationSec}s
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <ScorePill score={clip.viralScore} />
                      {uploadForClip && <UploadBadge upload={uploadForClip} />}
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="text-sm text-neutral-400">
              Приватність:{' '}
              <select
                value={privacy}
                onChange={(e) =>
                  setPrivacy(e.target.value as 'public' | 'unlisted' | 'private')
                }
                className="ml-1 rounded border border-line bg-bg-elevated px-2 py-1 text-neutral-200 outline-none"
              >
                <option value="private">private</option>
                <option value="unlisted">unlisted</option>
                <option value="public">public</option>
              </select>
            </label>

            <button
              type="button"
              onClick={onUpload}
              disabled={uploading || selected.size === 0}
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/30 transition enabled:hover:bg-accent-glow disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading
                ? 'Завантажуємо…'
                : `Завантажити обрані (${selected.size}) на YouTube`}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function JobPanel({ job }: { job: JobView }) {
  if (job.status === 'processing') {
    return (
      <div className="rounded-2xl border border-line bg-bg-panel/60 p-6 text-sm text-neutral-400">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          Vizard обробляє відео. Це може зайняти 2–5 хвилин.
        </div>
      </div>
    );
  }
  if (job.status === 'failed') {
    return (
      <div className="rounded-2xl border border-red-900/50 bg-red-950/30 p-6 text-sm text-red-300">
        <p className="font-medium text-red-200">Не вдалося отримати кліпи</p>
        <p className="mt-1">{job.error ?? 'Невідома помилка.'}</p>
      </div>
    );
  }
  if (job.mock) {
    return (
      <div className="rounded-lg border border-yellow-900/50 bg-yellow-950/30 px-4 py-3 text-xs text-yellow-300">
        Mock-режим: VIZARD_API_KEY не налаштовано. Показано демо-кліпи.
      </div>
    );
  }
  return null;
}

function UploadBadge({ upload }: { upload: Upload }) {
  if (upload.status === 'completed') {
    return (
      <a
        href={upload.youtubeUrl}
        target="_blank"
        rel="noreferrer"
        className="rounded-full bg-green-900/40 px-2.5 py-1 text-xs font-medium text-green-300 hover:bg-green-900/60"
      >
        ✓ на YouTube
      </a>
    );
  }
  if (upload.status === 'failed') {
    return (
      <span
        title={upload.error}
        className="rounded-full bg-red-900/40 px-2.5 py-1 text-xs font-medium text-red-300"
      >
        помилка
      </span>
    );
  }
  return (
    <span className="rounded-full bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-300">
      {upload.status === 'uploading' ? 'вантажу…' : 'очікує'}
    </span>
  );
}

function ScorePill({ score }: { score: number }) {
  const hue = Math.round((score / 100) * 140);
  return (
    <span
      className="rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{
        backgroundColor: `hsl(${hue}, 70%, 18%)`,
        color: `hsl(${hue}, 90%, 65%)`,
      }}
    >
      {score}
    </span>
  );
}

function formatTime(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function Banner({ children, tone }: { children: React.ReactNode; tone: 'success' | 'error' }) {
  const cls =
    tone === 'success'
      ? 'border-green-900/50 bg-green-950/30 text-green-300'
      : 'border-red-900/50 bg-red-950/30 text-red-300';
  return <div className={`rounded-lg border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

function YouTubeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M23.498 6.186a3.008 3.008 0 0 0-2.117-2.13C19.505 3.5 12 3.5 12 3.5s-7.505 0-9.381.557A3.008 3.008 0 0 0 .502 6.186C0 8.071 0 12 0 12s0 3.929.502 5.814a3.008 3.008 0 0 0 2.117 2.13C4.495 20.5 12 20.5 12 20.5s7.505 0 9.381-.557a3.008 3.008 0 0 0 2.117-2.13C24 15.929 24 12 24 12s0-3.929-.502-5.814zM9.75 15.568V8.432L15.818 12 9.75 15.568z" />
    </svg>
  );
}
