import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProjectClient } from '@/components/ProjectClient';
import { getProject, latestJob } from '@/lib/projects';
import { isOAuthConfigured } from '@/lib/youtube';

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) notFound();

  const youtubeOAuthConfigured = isOAuthConfigured();
  const job = latestJob(project);

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg-base">
      <div className="absolute inset-0 bg-hero-glow" aria-hidden />
      <div className="absolute inset-0 grid-bg" aria-hidden />

      <div className="relative mx-auto max-w-3xl px-6 py-12">
        <nav className="mb-8 flex items-center justify-between text-sm">
          <Link
            href="/"
            className="text-neutral-400 transition hover:text-white"
          >
            ← Всі проекти
          </Link>
          <span className="text-neutral-500">ID: {project.id}</span>
        </nav>

        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-white">{project.name}</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Створено {new Date(project.createdAt).toLocaleString('uk')}
          </p>
        </header>

        <ProjectClient
          projectId={project.id}
          initialYoutube={
            project.youtube
              ? {
                  connected: true,
                  channelTitle: project.youtube.channelTitle,
                  channelId: project.youtube.channelId,
                }
              : { connected: false }
          }
          initialJob={
            job
              ? {
                  id: job.id,
                  videoUrl: job.videoUrl,
                  status: job.status,
                  mock: job.mock,
                  clips: job.clips,
                  error: job.error,
                }
              : null
          }
          initialUploads={project.uploads}
          youtubeOAuthConfigured={youtubeOAuthConfigured}
        />
      </div>
    </main>
  );
}
