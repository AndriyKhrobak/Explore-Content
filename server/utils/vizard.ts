const VIZARD_BASE = 'https://elb-api.vizard.ai/hvizard-server-front/open-api/v1';

export type VizardClip = {
  clipId: string;
  title: string;
  viralScore: number;
  videoUrl: string;
  startSec: number;
  endSec: number;
  durationSec: number;
};

type CreateResponse = {
  code: number;
  data?: { projectId: string };
  message?: string;
};

type QueryResponse = {
  code: number;
  data?: {
    videos?: Array<{
      videoId?: string;
      id?: string;
      videoUrl: string;
      title?: string;
      viralScore?: number;
      startSec?: number;
      endSec?: number;
    }>;
  };
  message?: string;
};

function apiKey(): string | null {
  const key = useRuntimeConfig().vizardApiKey;
  return key && key.length > 0 ? key : null;
}

export function isVizardConfigured(): boolean {
  return Boolean(apiKey());
}

export type VizardLang = 'en' | 'uk' | 'ru' | 'pl' | 'de' | 'fr' | 'es' | 'it' | 'pt' | 'nl' | 'ja' | 'ko' | 'zh';

export const VIZARD_LANGUAGES: Array<{ code: VizardLang; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'uk', label: 'Українська' },
  { code: 'ru', label: 'Русский' },
  { code: 'pl', label: 'Polski' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'zh', label: '中文' },
];

// Vizard videoType codes per their docs.
const VIDEO_TYPE = {
  GOOGLE_DRIVE: 1,
  YOUTUBE: 2,
  VIMEO: 3,
  STREAMYARD: 4,
  REMOTE_FILE: 5,
} as const;

export function detectVideoType(url: string): number {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host.includes('youtube.com') || host.includes('youtu.be')) return VIDEO_TYPE.YOUTUBE;
    if (host.includes('drive.google.com')) return VIDEO_TYPE.GOOGLE_DRIVE;
    if (host.includes('vimeo.com')) return VIDEO_TYPE.VIMEO;
    if (host.includes('streamyard.com')) return VIDEO_TYPE.STREAMYARD;
    return VIDEO_TYPE.REMOTE_FILE;
  } catch {
    return VIDEO_TYPE.REMOTE_FILE;
  }
}

export async function vizardCreateProject(input: {
  videoUrl: string;
  maxClips: number;
  lang?: VizardLang;
}): Promise<{ projectId: string }> {
  const key = apiKey();
  if (!key) throw new Error('VIZARD_API_KEY not configured');

  const videoType = detectVideoType(input.videoUrl);

  const res = await $fetch<CreateResponse>(`${VIZARD_BASE}/project/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', VIZARDAI_API_KEY: key },
    body: {
      lang: input.lang ?? 'en',
      preferLength: [1, 2],
      videoUrl: input.videoUrl,
      videoType,
      subtitleSwitch: 1,
      headlineSwitch: 1,
      maxClipNumber: input.maxClips,
    },
  });

  if (!res.data?.projectId) {
    throw new Error(res.message || `Vizard create failed (code ${res.code})`);
  }
  return { projectId: res.data.projectId };
}

export async function vizardGetProject(
  projectId: string,
): Promise<{ status: 'processing' | 'ready' | 'failed'; clips: VizardClip[] }> {
  const key = apiKey();
  if (!key) throw new Error('VIZARD_API_KEY not configured');

  const res = await $fetch<QueryResponse>(`${VIZARD_BASE}/project/query/${projectId}`, {
    headers: { VIZARDAI_API_KEY: key },
  });

  if (res.code === 1000) return { status: 'processing', clips: [] };
  if (res.code !== 2000) return { status: 'failed', clips: [] };

  const clips: VizardClip[] = (res.data?.videos ?? []).map((v) => ({
    clipId: String(v.videoId ?? v.id ?? ''),
    title: v.title ?? 'Untitled clip',
    viralScore: v.viralScore ?? 0,
    videoUrl: v.videoUrl,
    startSec: v.startSec ?? 0,
    endSec: v.endSec ?? 0,
    durationSec: (v.endSec ?? 0) - (v.startSec ?? 0),
  }));

  return { status: 'ready', clips };
}

export function mockClips(count: number): VizardClip[] {
  const titles = [
    'Момент, який вразив аудиторію',
    'Несподіваний поворот у розмові',
    'Головна ідея за 30 секунд',
    'Найсмішніша частина епізоду',
    'Контрінтуїтивний інсайт',
  ];
  return Array.from({ length: Math.min(count, titles.length) }, (_, i) => ({
    clipId: `mock-${i + 1}`,
    title: titles[i],
    viralScore: 95 - i * 4,
    videoUrl: `https://example.com/mock-clip-${i + 1}.mp4`,
    startSec: i * 120,
    endSec: i * 120 + 28,
    durationSec: 28,
  }));
}
