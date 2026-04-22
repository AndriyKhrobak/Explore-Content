export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' });

  const body = await readBody<{ name?: string }>(event);
  const name = (body?.name ?? '').trim();

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' });
  }
  if (name.length > 80) {
    throw createError({ statusCode: 400, statusMessage: 'name too long (max 80)' });
  }

  try {
    const project = await prisma.project.update({
      where: { id },
      data: { name },
      select: { id: true, name: true },
    });
    return project;
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Project not found' });
  }
});
