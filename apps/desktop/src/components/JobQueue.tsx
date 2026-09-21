import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { BackgroundJob, JobQueueStats } from "@solopractice/shared/desktop";

export function JobQueue() {
  const [jobs, setJobs] = useState<BackgroundJob[]>([]);
  const [stats, setStats] = useState<JobQueueStats>({
    pending: 0,
    inProgress: 0,
    completed: 0,
    failed: 0,
  });

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadJobs() {
    try {
      const result = await invoke<{ jobs: BackgroundJob[]; stats: JobQueueStats }>(
        "get_job_queue"
      );
      setJobs(result.jobs);
      setStats(result.stats);
    } catch (error) {
      console.error("Failed to load jobs:", error);
      setJobs(getMockJobs());
      setStats({ pending: 1, inProgress: 1, completed: 2, failed: 0 });
    }
  }

  return (
    <div className="h-full flex flex-col">
      <header className="p-4 border-b border-border">
        <h1 className="text-xl font-semibold">Background Jobs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Transcription and SOAP drafts process here
        </p>
      </header>

      <div className="p-4 grid grid-cols-4 gap-4">
        <StatCard label="Pending" value={stats.pending} color="muted" />
        <StatCard label="In Progress" value={stats.inProgress} color="warning" />
        <StatCard label="Completed" value={stats.completed} color="success" />
        <StatCard label="Failed" value={stats.failed} color="destructive" />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {jobs.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No jobs in queue
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border bg-muted/50">
        <p className="text-xs text-muted-foreground">
          Jobs run in the background using local whisper.cpp and Ollama.
          The UI remains responsive during processing.
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "muted" | "warning" | "success" | "destructive";
}) {
  const colorClasses = {
    muted: "text-muted-foreground",
    warning: "text-warning",
    success: "text-success",
    destructive: "text-destructive",
  };

  return (
    <div className="p-3 rounded-lg border border-border">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className={`text-xs ${colorClasses[color]}`}>{label}</p>
    </div>
  );
}

function JobCard({ job }: { job: BackgroundJob }) {
  const statusColors = {
    pending: "bg-muted text-muted-foreground",
    queued: "bg-muted text-muted-foreground",
    in_progress: "bg-warning/10 text-warning",
    completed: "bg-success/10 text-success",
    failed: "bg-destructive/10 text-destructive",
    cancelled: "bg-muted text-muted-foreground",
  };

  const typeLabels = {
    transcription: "Transcription",
    soap_draft: "SOAP Draft",
    superbill_pdf: "Superbill PDF",
    backup: "Backup",
  };

  return (
    <div className="p-3 rounded-lg border border-border">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium">{typeLabels[job.type]}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(job.createdAt as string).toLocaleString()}
          </p>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${statusColors[job.status]}`}
        >
          {job.status.replace("_", " ")}
        </span>
      </div>

      {job.status === "in_progress" && job.progress !== undefined && (
        <div className="mt-2">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-warning transition-all duration-300"
              style={{ width: `${job.progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{job.progress}%</p>
        </div>
      )}

      {job.error && (
        <p className="mt-2 text-xs text-destructive">{job.error}</p>
      )}
    </div>
  );
}

function getMockJobs(): BackgroundJob[] {
  return [
    {
      id: "job-1" as any,
      type: "transcription",
      status: "in_progress",
      progress: 45,
      payload: {
        type: "transcription",
        sessionId: "session-1" as any,
        recordingId: "rec-1" as any,
        audioFilePath: "/recordings/session-1.wav",
        modelSize: "base",
      },
      attempts: 1,
      maxAttempts: 3,
      createdAt: new Date(Date.now() - 120000),
      startedAt: new Date(Date.now() - 60000),
    },
    {
      id: "job-2" as any,
      type: "soap_draft",
      status: "pending",
      payload: {
        type: "soap_draft",
        sessionId: "session-1" as any,
        clientId: "client-1" as any,
        transcriptId: "trans-1" as any,
        transcriptContent: "...",
      },
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(Date.now() - 60000),
    },
    {
      id: "job-3" as any,
      type: "transcription",
      status: "completed",
      payload: {
        type: "transcription",
        sessionId: "session-0" as any,
        recordingId: "rec-0" as any,
        audioFilePath: "/recordings/session-0.wav",
      },
      result: {
        type: "transcription",
        transcriptId: "trans-0" as any,
        wordCount: 1523,
        durationSeconds: 45,
      },
      attempts: 1,
      maxAttempts: 3,
      createdAt: new Date(Date.now() - 3600000),
      startedAt: new Date(Date.now() - 3540000),
      completedAt: new Date(Date.now() - 3500000),
    },
  ];
}
