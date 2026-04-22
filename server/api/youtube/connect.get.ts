export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const projectId = typeof query.projectId === 'string' ? query.projectId : null;
  if (!projectId) {
    throw createError({ statusCode: 400, statusMessage: 'projectId is required' });
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw createError({ statusCode: 404, statusMessage: 'Project not found' });

  const origin = getRequestURL(event).origin;

  if (!isOAuthConfigured()) {
    if (isDemoConnectEnabled()) {
      await prisma.youTubeConnection.upsert({
        where: { projectId },
        create: {
          projectId,
          accessToken: 'demo-access-token',
          expiresAt: new Date(Date.now() + 3600_000),
          channelTitle: 'Demo Channel',
          channelId: 'demo-channel-id',
        },
        update: {
          accessToken: 'demo-access-token',
          expiresAt: new Date(Date.now() + 3600_000),
        },
      });
      return sendRedirect(event, `/project/${projectId}?connected=demo`, 302);
    }
    throw createError({
      statusCode: 500,
      statusMessage:
        'Google OAuth not configured (set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)',
    });
  }

  return sendRedirect(event, buildAuthUrl(origin, projectId), 302);
});
