import { X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  width?: string;
  actions?: ReactNode;
  tabs?: Tab[];
}

export function DetailDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = '480px',
  actions,
  tabs,
}: DetailDrawerProps) {
  const [activeTab, setActiveTab] = useState(tabs?.[0]?.id || '');

  // Reset tab when drawer opens with new tabs
  useEffect(() => {
    if (open && tabs?.length) setActiveTab(tabs[0].id);
  }, [open, tabs]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Escape to close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 h-full bg-[var(--card)] border-l border-[var(--border)] shadow-2xl z-50 flex flex-col"
        style={{ width, maxWidth: '100vw' }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
          <div>
            <h2 className="text-[16px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>{title}</h2>
            {subtitle && (
              <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--accent)] transition-colors"
            aria-label="Close drawer"
          >
            <X size={16} className="text-[var(--muted-foreground)]" />
          </button>
        </div>

        {/* Tabs */}
        {tabs && tabs.length > 1 && (
          <div className="flex border-b border-[var(--border)] px-6 shrink-0" role="tablist">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2.5 text-[13px] border-b-2 transition-colors -mb-px ${
                  activeTab === tab.id
                    ? 'border-[var(--primary)] text-[var(--foreground)]'
                    : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
                style={{ fontWeight: 500 }}
                role="tab"
                aria-selected={activeTab === tab.id}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tabs && tabs.length > 0
            ? tabs.find(t => t.id === activeTab)?.content || children
            : children
          }
        </div>

        {/* Sticky Actions Footer */}
        {actions && (
          <div className="px-6 py-4 border-t border-[var(--border)] shrink-0 flex items-center gap-3 bg-[var(--card)]">
            {actions}
          </div>
        )}
      </div>
    </>
  );
}