import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Bell, CheckCheck, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { notifications as mockNotifications, type Notification } from '../lib/mock-data';

export function NotificationsPage() {
  const [items, setItems] = useState(mockNotifications);
  const unreadCount = items.filter(n => !n.read).length;

  function markRead(id: string) {
    setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  function markAllRead() {
    setItems(prev => prev.map(n => ({ ...n, read: true })));
    toast.success('All notifications marked as read');
  }

  const icons: Record<string, ReactNode> = {
    info: <Info size={14} className="text-blue-500" aria-hidden="true" />,
    warning: <AlertTriangle size={14} className="text-amber-500" aria-hidden="true" />,
    success: <CheckCircle size={14} className="text-emerald-500" aria-hidden="true" />,
    error: <XCircle size={14} className="text-red-500" aria-hidden="true" />,
  };

  return (
    <div className="p-6 max-w-[700px]">
      <PageHeader
        title="Notifications"
        description={`${unreadCount} unread`}
        actions={
          unreadCount > 0 ? (
            <button
              onClick={markAllRead}
              className="flex items-center gap-2 px-3 py-2 text-[13px] bg-[var(--card)] border border-[var(--border)] rounded-lg hover:bg-[var(--accent)] text-[var(--foreground)]"
              style={{ fontWeight: 500 }}
            >
              <CheckCheck size={14} aria-hidden="true" />
              Mark all read
            </button>
          ) : undefined
        }
      />

      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
        {items.length === 0 ? (
          <div className="py-16 text-center">
            <Bell size={24} className="mx-auto text-[var(--muted-foreground)] mb-2" aria-hidden="true" />
            <p className="text-[14px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>No notifications</p>
            <p className="text-[13px] text-[var(--muted-foreground)] mt-1">You're all caught up.</p>
          </div>
        ) : (
          items.map(n => (
            <button
              key={n.id}
              onClick={() => markRead(n.id)}
              className={`w-full text-left flex items-start gap-4 px-5 py-4 border-b border-[var(--border)] last:border-0 transition-colors ${
                !n.read ? 'bg-blue-50/30 dark:bg-blue-950/20 hover:bg-blue-50/50 dark:hover:bg-blue-950/30' : 'hover:bg-[var(--accent)]/30'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {icons[n.type]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: n.read ? 400 : 500 }}>{n.title}</p>
                  {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" aria-label="Unread" />}
                </div>
                <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">{n.message}</p>
                <p className="text-[11px] text-[var(--muted-foreground)] mt-1">{n.time}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}