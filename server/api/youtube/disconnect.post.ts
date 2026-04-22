export default defineEventHandler(async (event) => {
  const body = await readBody<{ projectId?: string }>(event);
  const projectId = body?.projectId;

  if (!projectId) {
    throw createError({ statusCode: 400, statusMessage: 'projectId is required' });
  }

  const connection = await prisma.youTubeConnection.findUnique({
    where: { projectId },
  });

  if (!connection) {
    return { ok: true, alreadyDisconnected: true };
  }

  if (connection.refreshToken) {
    await revokeToken(connection.refreshToken);
  } else {
    await revokeToken(connection.accessToken);
  }

  await prisma.youTubeConnection.delete({ where: { projectId } });

  return { ok: true };
});
