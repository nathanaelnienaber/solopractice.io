import { create } from 'zustand';

export type JobType = 'transcript' | 'soap';
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface Job {
  id: string;
  type: JobType;
  sessionLocalId: number;
  status: JobStatus;
  progress: number;
  model: string;
  error?: string;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
}

interface JobQueueState {
  pendingJobs: Job[];
  processingJob: Job | null;
  completedJobs: Job[];

  // Actions
  queueJob: (job: Omit<Job, 'id' | 'status' | 'progress' | 'queuedAt'>) => string;
  startJob: (jobId: string) => void;
  updateJobProgress: (jobId: string, progress: number) => void;
  completeJob: (jobId: string) => void;
  failJob: (jobId: string, error: string) => void;
  clearCompletedJobs: () => void;
}

let jobIdCounter = 0;

export const useJobQueueStore = create<JobQueueState>((set, get) => ({
  pendingJobs: [],
  processingJob: null,
  completedJobs: [],

  queueJob: (jobData) => {
    const id = `job_${++jobIdCounter}_${Date.now()}`;
    const job: Job = {
      ...jobData,
      id,
      status: 'queued',
      progress: 0,
      queuedAt: new Date().toISOString(),
    };

    set((state) => ({
      pendingJobs: [...state.pendingJobs, job],
    }));

    // Auto-start if nothing is processing
    const { processingJob } = get();
    if (!processingJob) {
      setTimeout(() => get().startJob(id), 100);
    }

    return id;
  },

  startJob: (jobId) =>
    set((state) => {
      const job = state.pendingJobs.find((j) => j.id === jobId);
      if (!job) return state;

      return {
        pendingJobs: state.pendingJobs.map((j) =>
          j.id === jobId
            ? { ...j, status: 'processing' as JobStatus, startedAt: new Date().toISOString() }
            : j
        ),
        processingJob: { ...job, status: 'processing', startedAt: new Date().toISOString() },
      };
    }),

  updateJobProgress: (jobId, progress) =>
    set((state) => ({
      pendingJobs: state.pendingJobs.map((j) => (j.id === jobId ? { ...j, progress } : j)),
      processingJob:
        state.processingJob?.id === jobId ? { ...state.processingJob, progress } : state.processingJob,
    })),

  completeJob: (jobId) =>
    set((state) => {
      const job = state.pendingJobs.find((j) => j.id === jobId);
      if (!job) return state;

      const completedJob: Job = {
        ...job,
        status: 'completed',
        progress: 100,
        completedAt: new Date().toISOString(),
      };

      // Find next job to process
      const remainingJobs = state.pendingJobs.filter((j) => j.id !== jobId);
      const nextJob = remainingJobs.find((j) => j.status === 'queued');

      return {
        pendingJobs: remainingJobs.map((j) =>
          j.id === jobId ? completedJob : j
        ),
        processingJob: nextJob
          ? { ...nextJob, status: 'processing', startedAt: new Date().toISOString() }
          : null,
        completedJobs: [...state.completedJobs, completedJob],
      };
    }),

  failJob: (jobId, error) =>
    set((state) => {
      const job = state.pendingJobs.find((j) => j.id === jobId);
      if (!job) return state;

      const failedJob: Job = {
        ...job,
        status: 'failed',
        error,
        completedAt: new Date().toISOString(),
      };

      const remainingJobs = state.pendingJobs.filter((j) => j.id !== jobId);
      const nextJob = remainingJobs.find((j) => j.status === 'queued');

      return {
        pendingJobs: remainingJobs,
        processingJob: nextJob
          ? { ...nextJob, status: 'processing', startedAt: new Date().toISOString() }
          : null,
        completedJobs: [...state.completedJobs, failedJob],
      };
    }),

  clearCompletedJobs: () => set({ completedJobs: [] }),
}));
