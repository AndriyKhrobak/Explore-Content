import type { VizardClip } from '~/server/utils/vizard';

export const maxDuration = 60;

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    projectId?: string;
    jobId?: string;
    clipIds?: string[];
    privacyStatus?: 'public' | 'unlisted' | 'private';
  }>(event);

  const { projectId, jobId, clipIds = [], privacyStatus = 'private' } = body ?? {};

  if (!projectId || !jobId || clipIds.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'projectId, jobId and at least one clipId are required',
    });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { youtube: true },
  });
  if (!project) throw createError({ statusCode: 404, statusMessage: 'Project not found' });
  if (!project.youtube) {
    throw createError({ statusCode: 400, statusMessage: 'YouTube is not connected' });
  }

  const job = await prisma.job.findFirst({ where: { id: jobId, projectId } });
  if (!job) throw createError({ statusCode: 404, statusMessage: 'Job not found' });
  if (job.status !== 'ready') {
    throw createError({ statusCode: 400, statusMessage: 'Job is not ready yet' });
  }

  const allClips = (job.clips as unknown as VizardClip[]) ?? [];
  const selected = allClips.filter((c) => clipIds.includes(c.clipId));
  if (selected.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No matching clips found' });
  }

  const results: Array<{
    clipId: string;
    ok: boolean;
    youtubeUrl?: string;
    error?: string;
    demo?: boolean;
  }> = [];

  const isDemoConnection = project.youtube.accessToken === 'demo-access-token';
  const shouldSimulate = job.mock || isDemoConnection;

  console.log('[clip.upload] job:', jobId, 'clips:', selected.length, 'mode:', shouldSimulate ? 'SIMULATE' : 'REAL');

  for (const clip of selected) {
    const upload = await prisma.upload.create({
      data: {
        projectId,
        jobId,
        clipId: clip.clipId,
        status: 'uploading',
      },
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
      results.push({
        clipId: clip.clipId,
        ok: true,
        youtubeUrl: simulatedUrl,
        demo: true,
      });
      continue;
    }

    try {
      console.log('[clip.upload] real upload:', clip.clipId, clip.videoUrl);
      const { videoId, url } = await uploadVideoToYouTube({
        connection: project.youtube,
        clipUrl: clip.videoUrl,
        title: clip.title,
        description: [
          clip.title,
          '',
          '#Shorts #viral #ai',
          '',
          `Source: ${job.videoUrl}`,
        ].join('\n'),
        privacyStatus,
      });
      await prisma.upload.update({
        where: { id: upload.id },
        data: { status: 'completed', youtubeVideoId: videoId, youtubeUrl: url },
      });
      results.push({ clipId: clip.clipId, ok: true, youtubeUrl: url });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      console.error('[clip.upload] real upload failed:', clip.clipId, message);
      await prisma.upload.update({
        where: { id: upload.id },
        data: { status: 'failed', error: message },
      });
      results.push({ clipId: clip.clipId, ok: false, error: message });
    }
  }

  return { results };
});
