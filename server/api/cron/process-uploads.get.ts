import type { VizardClip } from '~/server/utils/vizard';

export const maxDuration = 60;

/**
 * Vercel Cron entry point. Runs every minute via vercel.json.
 *
 * Picks up Upload rows where status='scheduled' AND scheduledAt <= now,
 * runs the YouTube upload, marks them completed/failed.
 *
 * Auth: if CRON_SECRET env is set, requires "Authorization: Bearer <secret>"
 * (Vercel Cron sends this automatically). Without the env var, allows any
 * caller — useful for manual trigger / local dev.
 */
export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig();
  const secret = cfg.cronSecret;
  if (secret) {
    const auth = getRequestHeader(event, 'authorization');
    if (auth !== `Bearer ${secret}`) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
    }
  }

  const now = new Date();
  const due = await prisma.upload.findMany({
    where: { status: 'scheduled', scheduledAt: { lte: now } },
    orderBy: { scheduledAt: 'asc' },
    take: 5,
    include: {
      job: { select: { id: true, videoUrl: true, clips: true, mock: true } },
      project: { include: { youtube: true } },
    },
  });

  if (due.length === 0) {
    return { processed: 0 };
  }

  console.log('[cron.uploads] processing', due.length, 'due uploads');

  const results: Array<{ id: string; ok: boolean; reason?: string }> = [];

  for (const upload of due) {
    const ctx = `[cron.uploads] ${upload.id} clip=${upload.clipId}`;
    try {
      if (!upload.project.youtube) {
        await prisma.upload.update({
          where: { id: upload.id },
          data: { status: 'failed', error: 'YouTube not connected' },
        });
        results.push({ id: upload.id, ok: false, reason: 'no_youtube' });
        continue;
      }

      const clips = (upload.job.clips as unknown as VizardClip[]) ?? [];
      const clip = clips.find((c) => c.clipId === upload.clipId);
      if (!clip) {
        await prisma.upload.update({
          where: { id: upload.id },
          data: { status: 'failed', error: 'Clip not found in job' },
        });
        results.push({ id: upload.id, ok: false, reason: 'no_clip' });
        continue;
      }

      const isDemo = upload.project.youtube.accessToken === 'demo-access-token';
      const shouldSimulate = upload.job.mock || isDemo;

      await prisma.upload.update({
        where: { id: upload.id },
        data: { status: 'uploading' },
      });

      if (shouldSimulate) {
        const simulatedUrl = `https://youtu.be/demo-${clip.clipId}`;
        await prisma.upload.update({
          where: { id: upload.id },
          data: {
            status: 'completed',
            youtubeVideoId: `demo-${clip.clipId}`,
            youtubeUrl: simulatedUrl,
          },
        });
        results.push({ id: upload.id, ok: true });
        console.log(`${ctx} SIMULATED → ${simulatedUrl}`);
        continue;
      }

      const creds = await getProjectOAuthCreds(upload.projectId);
      if (!creds) {
        await prisma.upload.update({
          where: { id: upload.id },
          data: {
            status: 'failed',
            error: 'Google OAuth credentials missing for this project',
          },
        });
        results.push({ id: upload.id, ok: false, reason: 'no_creds' });
        continue;
      }

      const { videoId, url } = await uploadVideoToYouTube({
        connection: upload.project.youtube,
        creds,
        clipUrl: clip.videoUrl,
        title: clip.title,
        description: [
          clip.title,
          '',
          '#Shorts #viral #ai',
          '',
          `Source: ${upload.job.videoUrl}`,
        ].join('\n'),
        privacyStatus: 'public',
      });
      await prisma.upload.update({
        where: { id: upload.id },
        data: { status: 'completed', youtubeVideoId: videoId, youtubeUrl: url },
      });
      results.push({ id: upload.id, ok: true });
      console.log(`${ctx} OK → ${url}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      console.error(`${ctx} FAILED:`, message);
      await prisma.upload.update({
        where: { id: upload.id },
        data: { status: 'failed', error: message },
      });
      results.push({ id: upload.id, ok: false, reason: message });
    }
  }

  return { processed: due.length, results };
});
