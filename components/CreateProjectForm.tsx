'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function CreateProjectForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.push(`/project/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full rounded-2xl border border-line bg-bg-panel/60 p-6 shadow-2xl backdrop-blur-sm"
    >
      <label className="block text-sm font-medium text-neutral-300">
        Назва проекту
        <input
          type="text"
          required
          autoFocus
          placeholder="Наприклад, AI Podcast Shorts"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-2 w-full rounded-lg border border-line bg-bg-elevated px-4 py-3 text-neutral-100 placeholder-neutral-500 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </label>

      <button
        type="submit"
        disabled={submitting || !name.trim()}
        className="mt-4 w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/30 transition enabled:hover:bg-accent-glow disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Створюємо…' : 'Створити проект'}
      </button>

      {error && (
        <p className="mt-4 rounded-lg border border-red-900/50 bg-red-950/50 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}
    </form>
  );
}
