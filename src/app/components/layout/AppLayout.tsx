import { Outlet, Navigate } from 'react-router';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { Toaster } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';

export function AppLayout() {
  const { isAuthenticated, isInitializing } = useAuth();

  // Show loading spinner while restoring session from token
  if (isInitializing) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-[var(--primary)]" />
          <p className="text-[13px] text-[var(--muted-foreground)]">Loading…</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--background)]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 relative overflow-hidden">
          <Outlet />
        </main>
      </div>
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
