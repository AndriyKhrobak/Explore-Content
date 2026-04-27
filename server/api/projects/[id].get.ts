export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' });

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      youtube: true,
      googleCredentials: true,
      jobs: { orderBy: { createdAt: 'asc' } },
      uploads: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!project) {
    throw createError({ statusCode: 404, statusMessage: 'Project not found' });
  }

  const envHasCreds = isEnvOAuthConfigured();
  const projectCreds = project.googleCredentials;

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
    googleCredentials: {
      hasProjectCreds: Boolean(projectCreds),
      hasEnvFallback: envHasCreds,
      clientIdMasked: projectCreds ? maskClientId(projectCreds.clientId) : null,
    },
    jobs: project.jobs.map((j) => ({
      id: j.id,
      videoUrl: j.videoUrl,
      status: j.status,
      mock: j.mock,
      clips: j.clips,
      error: j.error,
      createdAt: j.createdAt,
    })),
    uploads: project.uploads.map((u) => ({
      id: u.id,
      clipId: u.clipId,
      status: u.status,
      scheduledAt: u.scheduledAt,
      youtubeVideoId: u.youtubeVideoId,
      youtubeUrl: u.youtubeUrl,
      error: u.error,
      createdAt: u.createdAt,
    })),
  };
});

function maskClientId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 12)}…${id.slice(-6)}`;
}
