import { NextResponse } from 'next/server';
import { findJob, getProject, newId, upsertUpload } from '@/lib/projects';
import { uploadVideo } from '@/lib/youtube';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = {
  projectId?: string;
  jobId?: string;
  clipIds?: string[];
  privacyStatus?: 'public' | 'unlisted' | 'private';
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { projectId, jobId, clipIds = [], privacyStatus = 'private' } = body;

  if (!projectId || !jobId || clipIds.length === 0) {
    return NextResponse.json(
      { error: 'projectId, jobId and at least one clipId are required' },
      { status: 400 },
    );
  }

  const project = getProject(projectId);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  if (!project.youtube) {
    return NextResponse.json({ error: 'YouTube is not connected' }, { status: 400 });
  }

  const job = findJob(projectId, jobId);
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  if (job.status !== 'ready') {
    return NextResponse.json({ error: 'Job is not ready yet' }, { status: 400 });
  }

  const selected = job.clips.filter((c) => clipIds.includes(c.clipId));
  if (selected.length === 0) {
    return NextResponse.json({ error: 'No matching clips found' }, { status: 400 });
  }

  const results: Array<{ clipId: string; ok: boolean; youtubeUrl?: string; error?: string }> = [];

  for (const clip of selected) {
    const upload = {
      id: newId('upl'),
      clipId: clip.clipId,
      status: 'uploading' as const,
      createdAt: Date.now(),
    };
    upsertUpload(projectId, upload);

    if (job.mock) {
      const mockUrl = `https://youtu.be/mock-${clip.clipId}`;
      upsertUpload(projectId, {
        ...upload,
        status: 'completed',
        youtubeVideoId: `mock-${clip.clipId}`,
        youtubeUrl: mockUrl,
      });
      results.push({ clipId: clip.clipId, ok: true, youtubeUrl: mockUrl });
      continue;
    }

    try {
      const { videoId, url } = await uploadVideo({
        connection: project.youtube,
        clipUrl: clip.videoUrl,
        title: clip.title,
        description: `${clip.title}\n\n#shorts\n\nGenerated from: ${job.videoUrl}`,
        privacyStatus,
      });
      upsertUpload(projectId, {
        ...upload,
        status: 'completed',
        youtubeVideoId: videoId,
        youtubeUrl: url,
      });
      results.push({ clipId: clip.clipId, ok: true, youtubeUrl: url });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      upsertUpload(projectId, { ...upload, status: 'failed', error: message });
      results.push({ clipId: clip.clipId, ok: false, error: message });
    }
  }

  return NextResponse.json({ results });
}
