import { useState } from 'react';
import { CheckSquare, Trash2, EyeOff, Power, ShieldCheck, Loader2, X } from 'lucide-react';

/* ── Props ──────────────────────────────────────── */

interface POIBulkToolbarProps {
  selectedIds: Set<string>;
  totalFiltered: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkVerify: (ids: string[]) => Promise<void>;
  onBulkDeactivate: (ids: string[]) => Promise<void>;
  onBulkReactivate: (ids: string[]) => Promise<void>;
  onBulkDelete: (ids: string[]) => Promise<void>;
}

/* ── Component ──────────────────────────────────── */

export function POIBulkToolbar({
  selectedIds,
  totalFiltered,
  onSelectAll,
  onClearSelection,
  onBulkVerify,
  onBulkDeactivate,
  onBulkReactivate,
  onBulkDelete,
}: POIBulkToolbarProps) {
  const [running, setRunning] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const count = selectedIds.size;

  if (count === 0) return null;

  async function execute(action: string, fn: (ids: string[]) => Promise<void>) {
    setRunning(action);
    setConfirmAction(null);
    try {
      await fn(Array.from(selectedIds));
    } finally {
      setRunning(null);
    }
  }

  const isAllSelected = count >= totalFiltered && totalFiltered > 0;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-5 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl backdrop-blur-sm">
      {/* Count badge */}
      <div className="flex items-center gap-2">
        <CheckSquare size={14} className="text-[var(--primary)]" />
        <span className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>
          {count} selected
        </span>
      </div>

      {/* Select all / Clear */}
      <div className="flex items-center gap-1 border-l border-[var(--border)] pl-3">
        {!isAllSelected && (
          <button
            onClick={onSelectAll}
            className="px-2.5 py-1.5 text-[11px] rounded-lg bg-[var(--accent)] text-[var(--foreground)] hover:bg-[var(--accent)]/80 transition-colors"
            style={{ fontWeight: 500 }}
          >
            Select all {totalFiltered}
          </button>
        )}
        <button
          onClick={onClearSelection}
          className="p-1.5 rounded-lg hover:bg-[var(--accent)] text-[var(--muted-foreground)] transition-colors"
          aria-label="Clear selection"
        >
          <X size={14} />
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-[var(--border)]" />

      {/* Confirm-delete dialog overlay */}
      {confirmAction === 'delete' ? (
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-red-600 dark:text-red-400" style={{ fontWeight: 500 }}>
            Delete {count} POIs permanently?
          </span>
          <button
            onClick={() => execute('delete', onBulkDelete)}
            disabled={running !== null}
            className="px-3 py-1.5 text-[11px] rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
            style={{ fontWeight: 600 }}
          >
            {running === 'delete' ? <Loader2 size={12} className="animate-spin" /> : 'Confirm Delete'}
          </button>
          <button
            onClick={() => setConfirmAction(null)}
            className="px-2.5 py-1.5 text-[11px] rounded-lg bg-[var(--accent)] text-[var(--foreground)] hover:bg-[var(--accent)]/80 transition-colors"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
        </div>
      ) : confirmAction === 'deactivate' ? (
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-amber-600 dark:text-amber-400" style={{ fontWeight: 500 }}>
            Deactivate {count} POIs?
          </span>
          <button
            onClick={() => execute('deactivate', onBulkDeactivate)}
            disabled={running !== null}
            className="px-3 py-1.5 text-[11px] rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
            style={{ fontWeight: 600 }}
          >
            {running === 'deactivate' ? <Loader2 size={12} className="animate-spin" /> : 'Confirm'}
          </button>
          <button
            onClick={() => setConfirmAction(null)}
            className="px-2.5 py-1.5 text-[11px] rounded-lg bg-[var(--accent)] text-[var(--foreground)] hover:bg-[var(--accent)]/80 transition-colors"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
        </div>
      ) : (
        /* Action buttons */
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => execute('verify', onBulkVerify)}
            disabled={running !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors disabled:opacity-50"
            style={{ fontWeight: 500 }}
          >
            {running === 'verify' ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
            Verify
          </button>
          <button
            onClick={() => setConfirmAction('deactivate')}
            disabled={running !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors disabled:opacity-50"
            style={{ fontWeight: 500 }}
          >
            <EyeOff size={12} />
            Deactivate
          </button>
          <button
            onClick={() => execute('reactivate', onBulkReactivate)}
            disabled={running !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors disabled:opacity-50"
            style={{ fontWeight: 500 }}
          >
            {running === 'reactivate' ? <Loader2 size={12} className="animate-spin" /> : <Power size={12} />}
            Reactivate
          </button>
          <button
            onClick={() => setConfirmAction('delete')}
            disabled={running !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-lg bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 transition-colors disabled:opacity-50"
            style={{ fontWeight: 500 }}
          >
            <Trash2 size={12} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
