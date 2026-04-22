import type { VizardClip } from './vizard';

export type JobStatus = 'processing' | 'ready' | 'failed';

export type Job = {
  id: string;
  videoUrl: string;
  platforms: string[];
  maxClips: number;
  status: JobStatus;
  clips: VizardClip[];
  vizardProjectId?: string;
  mock: boolean;
  createdAt: number;
  error?: string;
};

type Store = Map<string, Job>;

const globalForStore = globalThis as unknown as { __jobs?: Store };
const store: Store = globalForStore.__jobs ?? new Map();
if (!globalForStore.__jobs) globalForStore.__jobs = store;

export function putJob(job: Job): void {
  store.set(job.id, job);
}

export function getJob(id: string): Job | undefined {
  return store.get(id);
}

export function newJobId(): string {
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
