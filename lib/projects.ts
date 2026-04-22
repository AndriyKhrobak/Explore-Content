import type { VizardClip } from './vizard';

export type YouTubeConnection = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  channelTitle?: string;
  channelId?: string;
};

export type JobStatus = 'processing' | 'ready' | 'failed';

export type Job = {
  id: string;
  videoUrl: string;
  status: JobStatus;
  clips: VizardClip[];
  vizardProjectId?: string;
  mock: boolean;
  createdAt: number;
  error?: string;
};

export type Upload = {
  id: string;
  clipId: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  youtubeVideoId?: string;
  youtubeUrl?: string;
  error?: string;
  createdAt: number;
};

export type Project = {
  id: string;
  name: string;
  createdAt: number;
  youtube?: YouTubeConnection;
  jobs: Job[];
  uploads: Upload[];
};

type Store = Map<string, Project>;

const globalForStore = globalThis as unknown as { __projects?: Store };
const store: Store = globalForStore.__projects ?? new Map();
if (!globalForStore.__projects) globalForStore.__projects = store;

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createProject(name: string): Project {
  const project: Project = {
    id: newId('proj'),
    name: name.trim() || 'Untitled project',
    createdAt: Date.now(),
    jobs: [],
    uploads: [],
  };
  store.set(project.id, project);
  return project;
}

export function getProject(id: string): Project | undefined {
  return store.get(id);
}

export function updateProject(id: string, patch: (p: Project) => Project): Project | undefined {
  const current = store.get(id);
  if (!current) return undefined;
  const next = patch(current);
  store.set(id, next);
  return next;
}

export function findJob(projectId: string, jobId: string): Job | undefined {
  return getProject(projectId)?.jobs.find((j) => j.id === jobId);
}

export function upsertJob(projectId: string, job: Job): Project | undefined {
  return updateProject(projectId, (p) => {
    const idx = p.jobs.findIndex((j) => j.id === job.id);
    const jobs = idx === -1 ? [...p.jobs, job] : p.jobs.map((j) => (j.id === job.id ? job : j));
    return { ...p, jobs };
  });
}

export function upsertUpload(projectId: string, upload: Upload): Project | undefined {
  return updateProject(projectId, (p) => {
    const idx = p.uploads.findIndex((u) => u.id === upload.id);
    const uploads =
      idx === -1 ? [...p.uploads, upload] : p.uploads.map((u) => (u.id === upload.id ? upload : u));
    return { ...p, uploads };
  });
}

export function latestJob(project: Project): Job | undefined {
  return project.jobs[project.jobs.length - 1];
}
