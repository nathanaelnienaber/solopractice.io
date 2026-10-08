import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { BackgroundJob, JobQueueStats } from "@solopractice/shared/desktop";
import {
  Badge,
  EmptyState,
  PageBody,
  PageFooter,
  PageHeader,
  PageShell,
  Surface,
  type BadgeTone,
} from "./ui";

export function JobQueue() {
  const [jobs, setJobs] = useState<BackgroundJob[]>([]);
  const [stats, setStats] = useState<JobQueueStats>({
    pending: 0,
    inProgress: 0,
    completed: 0,
    failed: 0,
  });
  const [loadError, setLoadError] = useState<string | null>(null);

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
      setLoadError(null);
    } catch (error) {
      console.error("Failed to load jobs:", error);
      setLoadError(error instanceof Error ? error.message : String(error));
      setJobs([]);
      setStats({ pending: 0, inProgress: 0, completed: 0, failed: 0 });
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Background Jobs"
        description="Transcription and SOAP drafts process here"
      />

      <PageBody className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Pending" value={stats.pending} tone="neutral" />
          <StatCard label="In Progress" value={stats.inProgress} tone="warning" />
          <StatCard label="Completed" value={stats.completed} tone="success" />
          <StatCard label="Failed" value={stats.failed} tone="destructive" />
        </div>

        {loadError ? (
          <EmptyState
            title="Could not load jobs"
            description={loadError}
          />
        ) : jobs.length === 0 ? (
          <EmptyState
            title="No jobs in queue"
            description="When you stop a recording with transcription, jobs appear here."
          />
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </PageBody>

      <PageFooter>
        Jobs run locally with speech-to-text and drafting on this computer. The
        UI stays responsive while they work.
      </PageFooter>
    </PageShell>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: BadgeTone;
}) {
  return (
    <Surface className="p-3">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <Badge tone={tone} className="mt-1">
        {label}
      </Badge>
    </Surface>
  );
}

function JobCard({ job }: { job: BackgroundJob }) {
  const statusTone: Record<string, BadgeTone> = {
    pending: "neutral",
    queued: "neutral",
    in_progress: "warning",
    completed: "success",
    failed: "destructive",
    cancelled: "neutral",
  };

  const typeLabels: Record<string, string> = {
    transcription: "Transcription",
    soap_draft: "SOAP Draft",
    superbill_pdf: "Superbill PDF",
    backup: "Backup",
  };

  return (
    <Surface>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{typeLabels[job.type] ?? job.type}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(job.createdAt as string).toLocaleString()}
          </p>
        </div>
        <Badge tone={statusTone[job.status] ?? "neutral"}>
          {job.status.replace("_", " ")}
        </Badge>
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
    </Surface>
  );
}
