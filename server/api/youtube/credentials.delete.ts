export default defineEventHandler(async (event) => {
  const body = await readBody<{ projectId?: string }>(event);
  const projectId = body?.projectId;

  if (!projectId) {
    throw createError({ statusCode: 400, statusMessage: 'projectId is required' });
  }

  // If a YouTube connection exists for this project, refuse: the saved
  // refresh token would become orphaned and impossible to refresh once the
  // OAuth client is gone. Force the user to disconnect first.
  const conn = await prisma.youTubeConnection.findUnique({ where: { projectId } });
  if (conn) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Disconnect the YouTube account before removing credentials',
    });
  }

  const existing = await prisma.googleClientCredentials.findUnique({ where: { projectId } });
  if (!existing) return { ok: true, alreadyRemoved: true };

  await prisma.googleClientCredentials.delete({ where: { projectId } });
  return { ok: true };
});
