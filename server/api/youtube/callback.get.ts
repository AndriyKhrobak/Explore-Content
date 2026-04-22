export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const code = typeof query.code === 'string' ? query.code : null;
  const state = typeof query.state === 'string' ? query.state : null;
  const oauthError = typeof query.error === 'string' ? query.error : null;

  if (oauthError) {
    return sendRedirect(event, `/?error=${encodeURIComponent(oauthError)}`, 302);
  }
  if (!code || !state) {
    return sendRedirect(event, '/?error=missing_code_or_state', 302);
  }

  const project = await prisma.project.findUnique({ where: { id: state } });
  if (!project) {
    return sendRedirect(event, '/?error=project_not_found', 302);
  }

  try {
    const origin = getRequestURL(event).origin;
    const tokens = await exchangeCode(origin, code);
    await prisma.youTubeConnection.upsert({
      where: { projectId: state },
      create: {
        projectId: state,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        channelId: tokens.channelId,
        channelTitle: tokens.channelTitle,
        channelThumbnailUrl: tokens.channelThumbnailUrl,
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        channelId: tokens.channelId,
        channelTitle: tokens.channelTitle,
        channelThumbnailUrl: tokens.channelThumbnailUrl,
      },
    });
    return sendRedirect(event, `/project/${state}?connected=1`, 302);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'oauth_failed';
    return sendRedirect(event, `/project/${state}?error=${encodeURIComponent(msg)}`, 302);
  }
});
