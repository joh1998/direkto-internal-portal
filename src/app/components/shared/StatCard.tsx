import { ArrowUp, ArrowDown } from 'lucide-react';
import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: number;
  icon?: ReactNode;
  prefix?: string;
}

export function StatCard({ label, value, delta, icon, prefix = '' }: StatCardProps) {
  const formatted = typeof value === 'number'
    ? prefix + value.toLocaleString()
    : prefix + value;

  return (
    <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>
            {label}
          </p>
          <p className="text-[24px] tracking-tight text-[var(--foreground)]" style={{ fontWeight: 600 }}>
            {formatted}
          </p>
        </div>
        {icon && (
          <div className="w-9 h-9 rounded-lg bg-[var(--accent)] flex items-center justify-center text-[var(--muted-foreground)]" aria-hidden="true">
            {icon}
          </div>
        )}
      </div>
      {delta !== undefined && (
        <div className="flex items-center gap-1 mt-2">
          {delta >= 0 ? (
            <ArrowUp size={12} className="text-emerald-600" aria-hidden="true" />
          ) : (
            <ArrowDown size={12} className="text-red-600" aria-hidden="true" />
          )}
          <span
            className={`text-[12px] ${delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
            style={{ fontWeight: 500 }}
          >
            {Math.abs(delta)}%
          </span>
          <span className="text-[12px] text-[var(--muted-foreground)]">vs last month</span>
        </div>
      )}
    </div>
  );
}