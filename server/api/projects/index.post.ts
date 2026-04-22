export default defineEventHandler(async (event) => {
  const body = await readBody<{ name?: string }>(event);
  const name = (body?.name ?? '').trim();

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' });
  }
  if (name.length > 80) {
    throw createError({ statusCode: 400, statusMessage: 'name too long (max 80)' });
  }

  const project = await prisma.project.create({ data: { name } });
  return { id: project.id, name: project.name };
});
