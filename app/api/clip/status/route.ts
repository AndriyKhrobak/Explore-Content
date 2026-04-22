import { NextResponse } from 'next/server';
import { findJob, getProject, upsertJob } from '@/lib/projects';
import { getProject as getVizardProject } from '@/lib/vizard';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const jobId = searchParams.get('id');

  if (!projectId || !jobId) {
    return NextResponse.json({ error: 'projectId and id are required' }, { status: 400 });
  }

  const project = getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const job = findJob(projectId, jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  if (job.status !== 'processing' || job.mock) {
    return NextResponse.json(publicView(job));
  }

  if (!job.vizardProjectId) {
    const failed = { ...job, status: 'failed' as const, error: 'Missing Vizard project ID' };
    upsertJob(projectId, failed);
    return NextResponse.json(publicView(failed));
  }

  try {
    const { status, clips } = await getVizardProject(job.vizardProjectId);
    const updated = { ...job, status, clips };
    upsertJob(projectId, updated);
    return NextResponse.json(publicView(updated));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const failed = { ...job, status: 'failed' as const, error: message };
    upsertJob(projectId, failed);
    return NextResponse.json(publicView(failed));
  }
}

function publicView(job: ReturnType<typeof findJob> & object) {
  return {
    id: job.id,
    status: job.status,
    mock: job.mock,
    videoUrl: job.videoUrl,
    clips: job.clips,
    error: job.error,
  };
}
