export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const projectId = typeof query.projectId === 'string' ? query.projectId : null;
  const jobId = typeof query.id === 'string' ? query.id : null;

  if (!projectId || !jobId) {
    throw createError({ statusCode: 400, statusMessage: 'projectId and id are required' });
  }

  const job = await prisma.job.findFirst({ where: { id: jobId, projectId } });
  if (!job) throw createError({ statusCode: 404, statusMessage: 'Job not found' });

  if (job.status !== 'processing' || job.mock) {
    return publicView(job);
  }

  if (!job.vizardProjectId) {
    const failed = await prisma.job.update({
      where: { id: jobId },
      data: { status: 'failed', error: 'Missing Vizard project ID' },
    });
    return publicView(failed);
  }

  try {
    const { status, clips } = await vizardGetProject(job.vizardProjectId);
    const updated = await prisma.job.update({
      where: { id: jobId },
      data: { status, clips: clips as unknown as object },
    });
    return publicView(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const failed = await prisma.job.update({
      where: { id: jobId },
      data: { status: 'failed', error: message },
    });
    return publicView(failed);
  }
});

function publicView(job: {
  id: string;
  status: string;
  mock: boolean;
  videoUrl: string;
  clips: unknown;
  error: string | null;
}) {
  return {
    id: job.id,
    status: job.status,
    mock: job.mock,
    videoUrl: job.videoUrl,
    clips: job.clips,
    error: job.error,
  };
}
