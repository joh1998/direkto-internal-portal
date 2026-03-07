import { useState } from 'react';
import { toast } from 'sonner';
import { Download, FileSpreadsheet, Clock, CheckCircle2, Calendar } from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';

interface ExportJob {
  id: string;
  name: string;
  description: string;
  lastExported?: string;
  status: 'idle' | 'exporting' | 'done';
  supportsDateRange: boolean;
}

const EXPORTS: ExportJob[] = [
  { id: 'e1', name: 'Merchants Report', description: 'All merchants with status, revenue, and commission data', lastExported: '2 hours ago', status: 'idle', supportsDateRange: false },
  { id: 'e2', name: 'Bookings Report', description: 'Complete booking history with statuses and fare data', lastExported: '1 day ago', status: 'idle', supportsDateRange: true },
  { id: 'e3', name: 'Commission Report', description: 'Detailed commission breakdown by merchant and tier', lastExported: '3 days ago', status: 'idle', supportsDateRange: true },
];

export function ExportPage() {
  const [jobs, setJobs] = useState(EXPORTS);

  function startExport(id: string) {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status: 'exporting' as const } : j));
    toast.info('Export started. This may take a moment...');

    setTimeout(() => {
      setJobs(prev => prev.map(j => j.id === id ? { ...j, status: 'done' as const, lastExported: 'Just now' } : j));
      toast.success('Export complete! Your CSV is ready for download.');
    }, 2500);
  }

  return (
    <div className="p-6 max-w-[800px]">
      <PageHeader
        title="Exports"
        description="Download CSV reports for analysis"
      />

      <div className="space-y-3">
        {jobs.map(job => (
          <div key={job.id} className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent)] flex items-center justify-center shrink-0" aria-hidden="true">
                  <FileSpreadsheet size={18} className="text-[var(--muted-foreground)]" />
                </div>
                <div>
                  <h3 className="text-[14px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>{job.name}</h3>
                  <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">{job.description}</p>
                  {job.supportsDateRange && (
                    <div className="flex items-center gap-2 mt-2">
                      <Calendar size={12} className="text-[var(--muted-foreground)]" aria-hidden="true" />
                      <input
                        type="date"
                        className="px-2 py-1 text-[12px] bg-[var(--input-background)] border border-[var(--border)] rounded-md outline-none text-[var(--foreground)]"
                        aria-label="From date"
                      />
                      <span className="text-[11px] text-[var(--muted-foreground)]">to</span>
                      <input
                        type="date"
                        className="px-2 py-1 text-[12px] bg-[var(--input-background)] border border-[var(--border)] rounded-md outline-none text-[var(--foreground)]"
                        aria-label="To date"
                      />
                    </div>
                  )}
                  {job.lastExported && (
                    <div className="flex items-center gap-1 mt-2 text-[11px] text-[var(--muted-foreground)]">
                      <Clock size={10} aria-hidden="true" />
                      Last exported: {job.lastExported}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => startExport(job.id)}
                disabled={job.status === 'exporting'}
                className={`flex items-center gap-2 px-4 py-2 text-[13px] rounded-lg transition-all shrink-0 ${
                  job.status === 'done'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800'
                    : job.status === 'exporting'
                    ? 'bg-[var(--accent)] text-[var(--muted-foreground)]'
                    : 'bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90'
                }`}
                style={{ fontWeight: 500 }}
              >
                {job.status === 'exporting' ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-[var(--muted-foreground)] border-t-transparent rounded-full animate-spin" />
                    Generating...
                  </>
                ) : job.status === 'done' ? (
                  <>
                    <CheckCircle2 size={14} aria-hidden="true" />
                    Download
                  </>
                ) : (
                  <>
                    <Download size={14} aria-hidden="true" />
                    Generate CSV
                  </>
                )}
              </button>
            </div>

            {/* Progress bar */}
            {job.status === 'exporting' && (
              <div className="mt-4">
                <div className="h-1.5 bg-[var(--accent)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--primary)] rounded-full animate-pulse" style={{ width: '60%' }} />
                </div>
                <p className="text-[11px] text-[var(--muted-foreground)] mt-1">Generating report...</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}