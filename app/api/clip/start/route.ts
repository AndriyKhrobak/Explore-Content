import { NextResponse } from 'next/server';
import { createProject, isConfigured, mockClips } from '@/lib/vizard';
import { newJobId, putJob } from '@/lib/jobs';

export const runtime = 'nodejs';

type Body = {
  videoUrl?: string;
  platforms?: string[];
  maxClips?: number;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { videoUrl, platforms = ['youtube', 'tiktok', 'instagram'], maxClips = 3 } = body;

  if (!videoUrl || typeof videoUrl !== 'string') {
    return NextResponse.json({ error: 'videoUrl is required' }, { status: 400 });
  }

  try {
    new URL(videoUrl);
  } catch {
    return NextResponse.json({ error: 'videoUrl must be a valid URL' }, { status: 400 });
  }

  const id = newJobId();
  const clampedMax = Math.max(1, Math.min(10, Math.floor(maxClips)));

  if (!isConfigured()) {
    putJob({
      id,
      videoUrl,
      platforms,
      maxClips: clampedMax,
      status: 'ready',
      clips: mockClips(clampedMax),
      mock: true,
      createdAt: Date.now(),
    });
    return NextResponse.json({ id, mock: true });
  }

  try {
    const { projectId } = await createProject({ videoUrl, maxClips: clampedMax });
    putJob({
      id,
      videoUrl,
      platforms,
      maxClips: clampedMax,
      status: 'processing',
      clips: [],
      vizardProjectId: projectId,
      mock: false,
      createdAt: Date.now(),
    });
    return NextResponse.json({ id, mock: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
