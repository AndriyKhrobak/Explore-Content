import type { VizardClip } from '~/server/utils/vizard';

const UPLOAD_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Idempotent: creates one Upload row per clip if none exists yet for the
 * given (jobId, clipId). First clip is scheduled for `now`, each next is
 * spaced by 30 minutes. Returns count of newly created rows.
 */
export async function scheduleClipsForJob(args: {
  projectId: string;
  jobId: string;
  clips: VizardClip[];
  startAt?: Date;
}): Promise<number> {
  const { projectId, jobId, clips, startAt = new Date() } = args;
  if (clips.length === 0) return 0;

  const existing = await prisma.upload.findMany({
    where: { jobId },
    select: { clipId: true },
  });
  const existingIds = new Set(existing.map((u) => u.clipId));

  const toCreate = clips
    .filter((c) => !existingIds.has(c.clipId))
    .map((c, i) => ({
      projectId,
      jobId,
      clipId: c.clipId,
      status: 'scheduled' as const,
      scheduledAt: new Date(startAt.getTime() + i * UPLOAD_INTERVAL_MS),
    }));

  if (toCreate.length === 0) return 0;

  await prisma.upload.createMany({ data: toCreate });
  return toCreate.length;
}
