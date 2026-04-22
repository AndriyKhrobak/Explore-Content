import { NextResponse } from 'next/server';
import { createProject as createVizardProject, isConfigured, mockClips } from '@/lib/vizard';
import { getProject, newId, upsertJob } from '@/lib/projects';

export const runtime = 'nodejs';

type Body = {
  projectId?: string;
  videoUrl?: string;
  maxClips?: number;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { projectId, videoUrl, maxClips = 3 } = body;

  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }
  if (!videoUrl || typeof videoUrl !== 'string') {
    return NextResponse.json({ error: 'videoUrl is required' }, { status: 400 });
  }
  try {
    new URL(videoUrl);
  } catch {
    return NextResponse.json({ error: 'videoUrl must be a valid URL' }, { status: 400 });
  }

  const project = getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const jobId = newId('job');
  const clampedMax = Math.max(1, Math.min(10, Math.floor(maxClips)));

  if (!isConfigured()) {
    upsertJob(projectId, {
      id: jobId,
      videoUrl,
      status: 'ready',
      clips: mockClips(clampedMax),
      mock: true,
      createdAt: Date.now(),
    });
    return NextResponse.json({ id: jobId, mock: true });
  }

  try {
    const { projectId: vizardProjectId } = await createVizardProject({
      videoUrl,
      maxClips: clampedMax,
    });
    upsertJob(projectId, {
      id: jobId,
      videoUrl,
      status: 'processing',
      clips: [],
      vizardProjectId,
      mock: false,
      createdAt: Date.now(),
    });
    return NextResponse.json({ id: jobId, mock: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
