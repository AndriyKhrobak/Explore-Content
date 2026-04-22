import { NextResponse } from 'next/server';
import { getJob, putJob } from '@/lib/jobs';
import { getProject } from '@/lib/vizard';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const job = getJob(id);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  if (job.status !== 'processing' || job.mock) {
    return NextResponse.json(publicView(job));
  }

  if (!job.vizardProjectId) {
    putJob({ ...job, status: 'failed', error: 'Missing Vizard project ID' });
    return NextResponse.json(publicView(getJob(id)!));
  }

  try {
    const { status, clips } = await getProject(job.vizardProjectId);
    const updated = { ...job, status, clips };
    putJob(updated);
    return NextResponse.json(publicView(updated));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    putJob({ ...job, status: 'failed', error: message });
    return NextResponse.json(publicView(getJob(id)!));
  }
}

function publicView(job: ReturnType<typeof getJob> & object) {
  return {
    id: job.id,
    status: job.status,
    mock: job.mock,
    platforms: job.platforms,
    videoUrl: job.videoUrl,
    clips: job.clips,
    error: job.error,
  };
}
