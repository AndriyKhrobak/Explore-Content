export default defineEventHandler(async (event) => {
  const body = await readBody<{
    projectId?: string;
    videoUrl?: string;
  }>(event);

  const { projectId, videoUrl } = body ?? {};

  if (!projectId) throw createError({ statusCode: 400, statusMessage: 'projectId required' });
  if (!videoUrl) throw createError({ statusCode: 400, statusMessage: 'videoUrl required' });
  try {
    new URL(videoUrl);
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'videoUrl must be a valid URL' });
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw createError({ statusCode: 404, statusMessage: 'Project not found' });

  if (!isVizardConfigured()) {
    const job = await prisma.job.create({
      data: {
        projectId,
        videoUrl,
        status: 'ready',
        mock: true,
        clips: mockClips(3) as unknown as object,
      },
    });
    return { id: job.id, mock: true };
  }

  try {
    const { projectId: vizardProjectId } = await vizardCreateProject({ videoUrl });
    const job = await prisma.job.create({
      data: {
        projectId,
        videoUrl,
        status: 'processing',
        vizardProjectId,
        mock: false,
        clips: [] as unknown as object,
      },
    });
    return { id: job.id, mock: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    throw createError({ statusCode: 502, statusMessage: message });
  }
});
