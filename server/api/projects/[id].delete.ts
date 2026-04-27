export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' });

  try {
    await prisma.project.delete({ where: { id } });
    return { ok: true };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'P2025') {
      throw createError({ statusCode: 404, statusMessage: 'Project not found' });
    }
    throw err;
  }
});
