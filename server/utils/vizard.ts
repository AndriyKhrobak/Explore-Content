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
  code?: number;
  data?: unknown;
  message?: string;
  projectId?: string | number;
};

type QueryResponse = {
  code?: number;
  data?: unknown;
  message?: string;
  videos?: unknown;
  errorInfo?: unknown;
};

function apiKey(): string | null {
  const key = useRuntimeConfig().vizardApiKey;
  return key && key.length > 0 ? key : null;
}

export function isVizardConfigured(): boolean {
  return Boolean(apiKey());
}

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

/**
 * Vizard does not accept YouTube playlist URLs. Strips extraneous params
 * like `&list=...&index=...&t=...` and returns a canonical watch URL.
 */
export function normalizeVideoUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host.includes('youtube.com') && u.pathname === '/watch') {
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/watch?v=${v}`;
    }
    if (host === 'youtu.be') {
      const videoId = u.pathname.slice(1).split('/')[0];
      if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
    }
    return url;
  } catch {
    return url;
  }
}

function extractProjectId(res: CreateResponse): string | undefined {
  if (!res) return undefined;
  // Shape 1: { data: { projectId } }
  if (typeof res.data === 'object' && res.data !== null) {
    const d = res.data as Record<string, unknown>;
    if (d.projectId !== undefined) return String(d.projectId);
    if (d.project_id !== undefined) return String(d.project_id);
    if (d.id !== undefined) return String(d.id);
  }
  // Shape 2: data is directly the ID (string or number)
  if (typeof res.data === 'string' || typeof res.data === 'number') {
    return String(res.data);
  }
  // Shape 3: top-level projectId
  if (res.projectId !== undefined) return String(res.projectId);
  return undefined;
}

export async function vizardCreateProject(input: {
  videoUrl: string;
}): Promise<{ projectId: string }> {
  const key = apiKey();
  if (!key) throw new Error('VIZARD_API_KEY not configured');

  const normalizedUrl = normalizeVideoUrl(input.videoUrl);
  const videoType = detectVideoType(normalizedUrl);

  // Vizard auto-detects language from transcription and chooses the
  // optimal number of clips based on video content. No need to force.
  const body = {
    lang: 'auto',
    preferLength: [1, 2],
    videoUrl: normalizedUrl,
    videoType,
    subtitleSwitch: 1,
    headlineSwitch: 1,
  };

  console.log('[vizard.create] request:', JSON.stringify(body));

  let res: CreateResponse;
  try {
    res = await $fetch<CreateResponse>(`${VIZARD_BASE}/project/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', VIZARDAI_API_KEY: key },
      body,
    });
  } catch (err) {
    // $fetch throws on non-2xx. Extract the response body if present.
    const asErr = err as { data?: unknown; status?: number; statusCode?: number; message?: string };
    const status = asErr.status ?? asErr.statusCode;
    console.error('[vizard.create] HTTP error', status, 'body:', JSON.stringify(asErr.data));
    const detail = asErr.data ? JSON.stringify(asErr.data) : asErr.message;
    throw new Error(`Vizard HTTP ${status ?? '?'}: ${detail}`);
  }

  console.log('[vizard.create] response:', JSON.stringify(res));

  const projectId = extractProjectId(res);
  if (!projectId) {
    const detail = JSON.stringify({ code: res.code, message: res.message, data: res.data });
    throw new Error(`Vizard create: no projectId in response. ${detail}`);
  }
  return { projectId };
}

export async function vizardGetProject(
  projectId: string,
): Promise<{ status: 'processing' | 'ready' | 'failed'; clips: VizardClip[] }> {
  const key = apiKey();
  if (!key) throw new Error('VIZARD_API_KEY not configured');

  let res: QueryResponse;
  try {
    res = await $fetch<QueryResponse>(`${VIZARD_BASE}/project/query/${projectId}`, {
      headers: { VIZARDAI_API_KEY: key },
    });
  } catch (err) {
    const asErr = err as { data?: unknown; status?: number; statusCode?: number };
    const status = asErr.status ?? asErr.statusCode;
    console.error('[vizard.query] HTTP error', status, 'body:', JSON.stringify(asErr.data));
    return { status: 'failed', clips: [] };
  }

  console.log('[vizard.query] response code:', res.code, 'keys:', Object.keys(res ?? {}));
  // Log first clip's shape only (full response can be huge).
  const sampleVideos = extractVideosArray(res);
  if (sampleVideos.length > 0) {
    console.log('[vizard.query] sample clip keys:', Object.keys(sampleVideos[0] as object));
    console.log('[vizard.query] sample clip:', String(JSON.stringify(sampleVideos[0])).slice(0, 500));
  } else {
    console.log('[vizard.query] no videos in response. data:', String(JSON.stringify(res.data)).slice(0, 500));
  }

  // Vizard status codes: 1000=processing, 2000=ready. Everything else = failed.
  if (res.code === 1000) return { status: 'processing', clips: [] };
  if (res.code !== 2000) return { status: 'failed', clips: [] };

  const clips = sampleVideos.map(normalizeClip).filter((c) => c.videoUrl);

  if (clips.length === 0) {
    console.warn('[vizard.query] code=2000 but 0 clips parsed. Full data:', String(JSON.stringify(res.data)));
  }

  return { status: 'ready', clips };
}

type RawClip = Record<string, unknown>;

/**
 * Vizard has returned several response shapes over time. Handle all:
 * - data.videos: [...]
 * - data.clips: [...]
 * - data as array
 * - videos at top level
 */
function extractVideosArray(res: QueryResponse): RawClip[] {
  if (Array.isArray(res.videos)) return res.videos as RawClip[];
  const d = res.data;
  if (Array.isArray(d)) return d as RawClip[];
  if (d && typeof d === 'object') {
    const obj = d as Record<string, unknown>;
    if (Array.isArray(obj.videos)) return obj.videos as RawClip[];
    if (Array.isArray(obj.clips)) return obj.clips as RawClip[];
  }
  return [];
}

/**
 * Map a Vizard clip object (any known shape) → our VizardClip.
 * Fields change between API versions: ms-based vs sec-based times,
 * videoId vs id vs clipId, videoUrl vs url, etc.
 */
function normalizeClip(raw: RawClip): VizardClip {
  const pick = <T>(keys: string[], coerce?: (v: unknown) => T): T | undefined => {
    for (const k of keys) {
      const v = raw[k];
      if (v !== undefined && v !== null) return coerce ? coerce(v) : (v as T);
    }
    return undefined;
  };

  const toNum = (v: unknown): number => (typeof v === 'number' ? v : Number(v)) || 0;
  const toStr = (v: unknown): string => String(v);

  const clipId = pick<string>(['videoId', 'id', 'clipId', 'projectId'], toStr) ?? '';
  const videoUrl = pick<string>(['videoUrl', 'url', 'video_url', 'downloadUrl'], toStr) ?? '';
  const title = pick<string>(['title', 'headline', 'name'], toStr) ?? 'Untitled clip';
  const viralScore = pick<number>(['viralScore', 'score', 'virality_score'], toNum) ?? 0;

  // Duration: prefer ms values if present (Vizard newer API uses ms).
  const msStart = pick<number>(['videoMsStartTime', 'startMs'], toNum);
  const msEnd = pick<number>(['videoMsEndTime', 'endMs'], toNum);
  const msDuration = pick<number>(['videoMsDuration', 'durationMs'], toNum);

  let startSec: number;
  let endSec: number;
  if (msStart !== undefined && msEnd !== undefined) {
    startSec = Math.round(msStart / 1000);
    endSec = Math.round(msEnd / 1000);
  } else {
    startSec = pick<number>(['startSec', 'startTime', 'start'], toNum) ?? 0;
    endSec = pick<number>(['endSec', 'endTime', 'end'], toNum) ?? 0;
  }

  let durationSec = endSec - startSec;
  if (!durationSec && msDuration) durationSec = Math.round(msDuration / 1000);
  if (durationSec < 0) durationSec = 0;

  return { clipId, title, viralScore, videoUrl, startSec, endSec, durationSec };
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
