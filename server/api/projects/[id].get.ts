export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' });

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      youtube: true,
      jobs: { orderBy: { createdAt: 'asc' } },
      uploads: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!project) {
    throw createError({ statusCode: 404, statusMessage: 'Project not found' });
  }

  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    youtube: project.youtube
      ? {
          connected: true,
          channelTitle: project.youtube.channelTitle,
          channelId: project.youtube.channelId,
          channelThumbnailUrl: project.youtube.channelThumbnailUrl,
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
  };
});
