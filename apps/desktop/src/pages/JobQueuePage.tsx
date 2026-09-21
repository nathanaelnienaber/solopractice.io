import { useJobQueueStore, type Job } from '../stores/jobQueueStore';
import { format, formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

export function JobQueuePage() {
  const { pendingJobs, completedJobs, clearCompletedJobs } = useJobQueueStore();

  const activeJobs = pendingJobs.filter((j) => j.status !== 'completed');
  const allJobs = [...pendingJobs, ...completedJobs].sort(
    (a, b) => new Date(b.queuedAt).getTime() - new Date(a.queuedAt).getTime()
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Background Jobs</h1>
        {completedJobs.length > 0 && (
          <button onClick={clearCompletedJobs} className="btn-secondary text-sm">
            Clear Completed
          </button>
        )}
      </div>

      <div className="clinical-warning">
        <strong>Local Processing Only:</strong> All transcription (Whisper) and SOAP generation
        (Ollama) runs locally on this device. Audio and clinical text never leave your computer.
        Processing may be slow depending on hardware.
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <StatCard
          label="Active Jobs"
          value={activeJobs.length}
          color={activeJobs.length > 0 ? 'blue' : 'gray'}
        />
        <StatCard
          label="Completed"
          value={completedJobs.filter((j) => j.status === 'completed').length}
          color="green"
        />
        <StatCard
          label="Failed"
          value={completedJobs.filter((j) => j.status === 'failed').length}
          color="red"
        />
      </div>

      {allJobs.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">
            No jobs in queue. Jobs are created when you record a session.
          </p>
        </div>
      ) : (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Job History</h2>
          <div className="space-y-3">
            {allJobs.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">How It Works</h2>
        <div className="space-y-4 text-sm text-gray-600">
          <div className="flex gap-3">
            <span className="text-lg">🎤</span>
            <div>
              <p className="font-medium text-gray-900">1. Recording</p>
              <p>Audio is saved locally as a WAV file. Never uploaded.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-lg">📝</span>
            <div>
              <p className="font-medium text-gray-900">2. Transcription (Whisper)</p>
              <p>
                Local speech-to-text using whisper.cpp. Runs in background — may take 5-15 minutes
                for a 45-minute session depending on your CPU.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-lg">📋</span>
            <div>
              <p className="font-medium text-gray-900">3. SOAP Draft (Ollama)</p>
              <p>
                Local LLM generates a SOAP note draft from the transcript. You review and edit
                before finalizing.
              </p>
            </div>
          </div>
        </div>
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
  color: 'blue' | 'green' | 'red' | 'gray';
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    gray: 'bg-gray-50 text-gray-700 border-gray-200',
  };

  return (
    <div className={clsx('card border', colors[color])}>
      <p className="text-sm">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

function JobRow({ job }: { job: Job }) {
  const statusColors: Record<string, string> = {
    queued: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  };

  const typeLabels = {
    transcript: '📝 Transcription',
    soap: '📋 SOAP Generation',
  };

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-4">
        <div className="w-32">
          <span className={clsx('text-xs px-2 py-1 rounded', statusColors[job.status])}>
            {job.status}
          </span>
        </div>
        <div>
          <p className="font-medium text-gray-900">{typeLabels[job.type]}</p>
          <p className="text-sm text-gray-500">
            Session #{job.sessionLocalId} · {job.model}
          </p>
        </div>
      </div>

      <div className="text-right">
        {job.status === 'processing' && (
          <div className="w-32">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${job.progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">{job.progress}%</p>
          </div>
        )}

        {job.status === 'completed' && job.completedAt && (
          <p className="text-xs text-gray-500">
            Completed {formatDistanceToNow(new Date(job.completedAt), { addSuffix: true })}
          </p>
        )}

        {job.status === 'failed' && job.error && (
          <p className="text-xs text-red-600 max-w-xs truncate" title={job.error}>
            {job.error}
          </p>
        )}

        {job.status === 'queued' && (
          <p className="text-xs text-gray-500">
            Queued {formatDistanceToNow(new Date(job.queuedAt), { addSuffix: true })}
          </p>
        )}
      </div>
    </div>
  );
}
