export default defineEventHandler(async () => {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      youtube: { select: { channelTitle: true } },
      _count: { select: { jobs: true, uploads: true } },
    },
  });

  return {
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      createdAt: p.createdAt,
      channelTitle: p.youtube?.channelTitle ?? null,
      jobsCount: p._count.jobs,
      uploadsCount: p._count.uploads,
    })),
  };
});
