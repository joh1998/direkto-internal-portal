import { AlertTriangle, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  objectId?: string;
  confirmLabel?: string;
  variant?: 'danger' | 'default';
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  objectId,
  confirmLabel = 'Confirm',
  variant = 'default',
  loading = false,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus the Cancel button on open (prevents Enter-to-destroy)
  useEffect(() => {
    if (open) {
      setTimeout(() => cancelRef.current?.focus(), 50);
    }
  }, [open]);

  // Escape to close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onClose();
      // Block Enter from triggering confirm — user must explicitly click
      if (e.key === 'Enter' && open) e.preventDefault();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-50" onClick={onClose} aria-hidden="true" />
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] bg-[var(--card)] rounded-2xl shadow-2xl z-50 overflow-hidden"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            {variant === 'danger' && (
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950 flex items-center justify-center shrink-0" aria-hidden="true">
                <AlertTriangle size={18} className="text-red-600 dark:text-red-400" />
              </div>
            )}
            <div className="flex-1">
              <h3 id="confirm-title" className="text-[15px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>{title}</h3>
              {objectId && (
                <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5 font-mono">{objectId}</p>
              )}
              <p id="confirm-message" className="text-[13px] text-[var(--muted-foreground)] mt-2" style={{ lineHeight: '1.6' }}>
                {message}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-[var(--accent)]"
              aria-label="Close dialog"
            >
              <X size={14} className="text-[var(--muted-foreground)]" />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 bg-[var(--accent)]/50 border-t border-[var(--border)]">
          <button
            ref={cancelRef}
            onClick={onClose}
            className="px-4 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] transition-colors text-[var(--foreground)]"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-[13px] rounded-lg text-white transition-colors disabled:opacity-50 ${
              variant === 'danger'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[var(--primary)] hover:bg-[var(--primary)]/90'
            }`}
            style={{ fontWeight: 500 }}
            tabIndex={-1}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}