import { useState } from 'react';
import { RefreshCw, Database, Layers, Loader2 } from 'lucide-react';

/* ── Props ──────────────────────────────────────── */

interface POIAdminOpsProps {
  onResync: () => Promise<void>;
  onCleanup: () => Promise<void>;
  onBackfill: () => Promise<void>;
}

/* ── Component ──────────────────────────────────── */

export function POIAdminOps({ onResync, onCleanup, onBackfill }: POIAdminOpsProps) {
  const [running, setRunning] = useState<string | null>(null);

  const ops = [
    { key: 'resync',   label: 'Resync Typesense',  icon: <RefreshCw size={12} />, action: onResync },
    { key: 'cleanup',  label: 'Cleanup Outbox',     icon: <Database size={12} />,  action: onCleanup },
    { key: 'backfill', label: 'Merchant Backfill',  icon: <Layers size={12} />,    action: onBackfill },
  ];

  async function run(key: string, action: () => Promise<void>) {
    setRunning(key);
    try { await action(); } finally { setRunning(null); }
  }

  return (
    <div className="px-4 py-3 border-b border-[var(--border)] bg-amber-50/50 dark:bg-amber-950/30 space-y-2">
      <p className="text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-2" style={{ fontWeight: 600 }}>
        Admin Operations
      </p>
      {ops.map(op => (
        <button
          key={op.key}
          onClick={() => run(op.key, op.action)}
          disabled={running !== null}
          className="flex items-center gap-2 w-full px-3 py-2 text-[12px] bg-[var(--card)] border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950 transition-colors text-left disabled:opacity-50"
          style={{ fontWeight: 500 }}
        >
          {running === op.key ? <Loader2 size={12} className="animate-spin" /> : op.icon}
          <span className="flex-1">{op.label}</span>
        </button>
      ))}
    </div>
  );
}
