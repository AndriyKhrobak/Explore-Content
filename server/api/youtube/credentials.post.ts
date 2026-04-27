export default defineEventHandler(async (event) => {
  const body = await readBody<{
    projectId?: string;
    clientId?: string;
    clientSecret?: string;
  }>(event);

  const projectId = body?.projectId?.trim();
  const clientId = body?.clientId?.trim();
  const clientSecret = body?.clientSecret?.trim();

  if (!projectId || !clientId || !clientSecret) {
    throw createError({
      statusCode: 400,
      statusMessage: 'projectId, clientId and clientSecret are required',
    });
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw createError({ statusCode: 404, statusMessage: 'Project not found' });

  const saved = await prisma.googleClientCredentials.upsert({
    where: { projectId },
    create: { projectId, clientId, clientSecret },
    update: { clientId, clientSecret },
  });

  return {
    ok: true,
    credentialsId: saved.id,
    clientIdMasked: maskClientId(saved.clientId),
  };
});

function maskClientId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 12)}…${id.slice(-6)}`;
}
