export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' });

  const body = await readBody<{ name?: string; description?: string | null }>(event);

  const data: { name?: string; description?: string | null } = {};

  if (body?.name !== undefined) {
    const name = body.name.trim();
    if (!name) throw createError({ statusCode: 400, statusMessage: 'name cannot be empty' });
    if (name.length > 80) throw createError({ statusCode: 400, statusMessage: 'name too long (max 80)' });
    data.name = name;
  }

  if (body?.description !== undefined) {
    if (body.description === null || body.description.trim() === '') {
      data.description = null;
    } else {
      const desc = body.description.trim();
      if (desc.length > 500) {
        throw createError({ statusCode: 400, statusMessage: 'description too long (max 500)' });
      }
      data.description = desc;
    }
  }

  if (Object.keys(data).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'no fields to update' });
  }

  try {
    const project = await prisma.project.update({
      where: { id },
      data,
      select: { id: true, name: true, description: true },
    });
    return project;
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Project not found' });
  }
});
