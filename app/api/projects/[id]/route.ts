import { NextResponse } from 'next/server';
import { getProject } from '@/lib/projects';

export const runtime = 'nodejs';

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const project = getProject(id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    youtube: project.youtube
      ? {
          connected: true,
          channelTitle: project.youtube.channelTitle,
          channelId: project.youtube.channelId,
        }
      : { connected: false },
    jobs: project.jobs.map((j) => ({
      id: j.id,
      videoUrl: j.videoUrl,
      status: j.status,
      mock: j.mock,
      clips: j.clips,
      error: j.error,
      createdAt: j.createdAt,
    })),
    uploads: project.uploads,
  });
}
