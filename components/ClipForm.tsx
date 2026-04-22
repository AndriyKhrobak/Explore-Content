'use client';

import { useEffect, useRef, useState } from 'react';
import type { VizardClip } from '@/lib/vizard';

type Platform = 'youtube' | 'tiktok' | 'instagram';

type StatusResponse = {
  id: string;
  status: 'processing' | 'ready' | 'failed';
  mock: boolean;
  platforms: Platform[];
  clips: VizardClip[];
  error?: string;
};

const PLATFORM_LABELS: Record<Platform, string> = {
  youtube: 'YouTube Shorts',
  tiktok: 'TikTok',
  instagram: 'Instagram Reels',
};

export function ClipForm() {
  const [videoUrl, setVideoUrl] = useState('');
  const [platforms, setPlatforms] = useState<Set<Platform>>(
    new Set(['youtube', 'tiktok', 'instagram']),
  );
  const [maxClips, setMaxClips] = useState(3);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  function togglePlatform(p: Platform) {
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  async function poll(id: string) {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/clip/status?id=${encodeURIComponent(id)}`);
        const data = (await res.json()) as StatusResponse;
        setResult(data);
        if (data.status !== 'processing') {
          if (pollRef.current) window.clearInterval(pollRef.current);
          setSubmitting(false);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Polling failed';
        setError(msg);
        if (pollRef.current) window.clearInterval(pollRef.current);
        setSubmitting(false);
      }
    }, 8000);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/clip/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl,
          platforms: Array.from(platforms),
          maxClips,
        }),
      });
      const data = (await res.json()) as { id?: string; mock?: boolean; error?: string };
      if (!res.ok || !data.id) {
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      const statusRes = await fetch(`/api/clip/status?id=${encodeURIComponent(data.id)}`);
      const statusData = (await statusRes.json()) as StatusResponse;
      setResult(statusData);

      if (statusData.status === 'processing') {
        poll(data.id);
      } else {
        setSubmitting(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full">
      <form
        onSubmit={onSubmit}
        className="w-full rounded-2xl border border-line bg-bg-panel/60 p-6 backdrop-blur-sm shadow-2xl"
      >
        <label className="block text-sm font-medium text-neutral-300">
          Посилання на відео
          <input
            type="url"
            required
            placeholder="https://www.youtube.com/watch?v=..."
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            className="mt-2 w-full rounded-lg border border-line bg-bg-elevated px-4 py-3 text-neutral-100 placeholder-neutral-500 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </label>

        <fieldset className="mt-6">
          <legend className="text-sm font-medium text-neutral-300">Платформи</legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(Object.keys(PLATFORM_LABELS) as Platform[]).map((p) => {
              const active = platforms.has(p);
              return (
                <button
                  type="button"
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={`rounded-lg border px-4 py-3 text-sm font-medium transition ${
                    active
                      ? 'border-accent bg-accent/10 text-white'
                      : 'border-line bg-bg-elevated text-neutral-400 hover:border-neutral-600 hover:text-neutral-200'
                  }`}
                >
                  {PLATFORM_LABELS[p]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="mt-6 block text-sm font-medium text-neutral-300">
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
          disabled={submitting || platforms.size === 0}
          className="mt-6 w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/30 transition enabled:hover:bg-accent-glow disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Обробляємо…' : 'Згенерувати кліпи'}
        </button>

        {error && (
          <p className="mt-4 rounded-lg border border-red-900/50 bg-red-950/50 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}
      </form>

      {result && <ResultPanel result={result} />}
    </div>
  );
}

function ResultPanel({ result }: { result: StatusResponse }) {
  if (result.status === 'processing') {
    return (
      <div className="mt-6 rounded-2xl border border-line bg-bg-panel/60 p-6 text-sm text-neutral-400">
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

  if (result.status === 'failed') {
    return (
      <div className="mt-6 rounded-2xl border border-red-900/50 bg-red-950/30 p-6 text-sm text-red-300">
        <p className="font-medium text-red-200">Не вдалося отримати кліпи</p>
        <p className="mt-1">{result.error ?? 'Невідома помилка.'}</p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {result.mock && (
        <div className="rounded-lg border border-yellow-900/50 bg-yellow-950/30 px-4 py-3 text-xs text-yellow-300">
          Mock-режим: VIZARD_API_KEY не налаштовано. Показано демо-кліпи.
        </div>
      )}

      <div className="rounded-2xl border border-line bg-bg-panel/60 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">
            Знайдено {result.clips.length} {result.clips.length === 1 ? 'кліп' : 'кліпів'}
          </h3>
          <span className="text-xs text-neutral-500">
            Платформи: {result.platforms.join(', ')}
          </span>
        </div>

        <ul className="space-y-3">
          {result.clips.map((clip) => (
            <li
              key={clip.clipId}
              className="flex items-start justify-between gap-4 rounded-lg border border-line bg-bg-elevated px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-100">{clip.title}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {formatTime(clip.startSec)} → {formatTime(clip.endSec)} · {clip.durationSec}s
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <ScorePill score={clip.viralScore} />
                {clip.videoUrl && !result.mock && (
                  <a
                    href={clip.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-accent hover:text-accent-glow"
                  >
                    Відкрити
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
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
