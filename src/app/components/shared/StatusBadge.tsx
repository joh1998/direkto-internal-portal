import { CheckCircle, Clock, XCircle, AlertTriangle, MinusCircle, Zap, Info } from 'lucide-react';
import type { ReactNode } from 'react';

interface StatusBadgeProps {
  status: string;
  label?: string;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<string, { bg: string; icon: ReactNode }> = {
  active:      { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800', icon: <Zap size={10} /> },
  completed:   { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800', icon: <CheckCircle size={10} /> },
  confirmed:   { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800', icon: <CheckCircle size={10} /> },
  verified:    { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800', icon: <CheckCircle size={10} /> },
  approved:    { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800', icon: <CheckCircle size={10} /> },
  pending:     { bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800', icon: <Clock size={10} /> },
  suspended:   { bg: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800', icon: <AlertTriangle size={10} /> },
  banned:      { bg: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800', icon: <XCircle size={10} /> },
  rejected:    { bg: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800', icon: <XCircle size={10} /> },
  failed:      { bg: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800', icon: <XCircle size={10} /> },
  cancelled:   { bg: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-700', icon: <MinusCircle size={10} /> },
  inactive:    { bg: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-700', icon: <MinusCircle size={10} /> },
  deactivated: { bg: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-700', icon: <MinusCircle size={10} /> },
  expired:     { bg: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800', icon: <AlertTriangle size={10} /> },
  info:        { bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800', icon: <Info size={10} /> },
  warning:     { bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800', icon: <AlertTriangle size={10} /> },
  success:     { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800', icon: <CheckCircle size={10} /> },
  error:       { bg: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800', icon: <XCircle size={10} /> },
};

const DEFAULT_CONFIG = { bg: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-700', icon: <MinusCircle size={10} /> };

export function StatusBadge({ status, label, size = 'sm' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status.toLowerCase()] || DEFAULT_CONFIG;
  const sizeClass = size === 'sm' ? 'text-[11px] px-2 py-0.5 gap-1' : 'text-[12px] px-2.5 py-1 gap-1.5';

  return (
    <span
      className={`inline-flex items-center rounded-full border capitalize ${config.bg} ${sizeClass}`}
      style={{ fontWeight: 500 }}
      role="status"
    >
      <span className="shrink-0" aria-hidden="true">{config.icon}</span>
      {label || status}
    </span>
  );
}
