import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { StatusBadge } from '../components/shared/StatusBadge';
import { DetailDrawer } from '../components/shared/DetailDrawer';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { ROLE_LABELS } from '../lib/permissions';
import { useAuth } from '../context/AuthContext';
import { useApiQuery } from '../hooks/useApiQuery';
import {
  fetchTeamMembers, fetchActivityLogs, createTeamMember, updateTeamMember, deactivateTeamMember,
  type ApiTeamMember, type ApiActivityLog,
} from '../lib/team-api';

/* ── helpers ─────────────────────────────────────────────────── */
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

export function TeamPage() {
  const { user: currentAdmin } = useAuth();
  const [selected, setSelected] = useState<ApiTeamMember | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<ApiTeamMember | null>(null);
  const [newMember, setNewMember] = useState({ fullName: '', email: '', role: 'SUPPORT_AGENT', phone: '', department: '', jobTitle: '' });
  const [activeView, setActiveView] = useState<'members' | 'activity'>('members');
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ── API data ─────────────────────────────────────────────── */
  const { data: members, isLoading: membersLoading, error: membersError, refetch: refetchMembers } = useApiQuery<ApiTeamMember[]>(
    () => fetchTeamMembers(),
    [],
  );

  const { data: logs, isLoading: logsLoading, error: logsError, refetch: refetchLogs } = useApiQuery<ApiActivityLog[]>(
    () => fetchActivityLogs({ limit: 30 }),
    [],
    { enabled: activeView === 'activity' },
  );

  const teamMembers = members ?? [];
  const activityLogs = logs ?? [];

  /* ── actions ──────────────────────────────────────────────── */
  async function handleAdd() {
    if (!newMember.fullName || !newMember.email) return;
    setIsSubmitting(true);
    try {
      await createTeamMember({
        userId: 0, // backend may auto-assign or require a userId lookup
        fullName: newMember.fullName,
        email: newMember.email,
        role: newMember.role,
        phone: newMember.phone || undefined,
        department: newMember.department || undefined,
        jobTitle: newMember.jobTitle || undefined,
      });
      toast.success(`${newMember.fullName} added to the team`);
      setShowAdd(false);
      setNewMember({ fullName: '', email: '', role: 'SUPPORT_AGENT', phone: '', department: '', jobTitle: '' });
      refetchMembers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create member');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemove() {
    if (!removeConfirm) return;
    if (String(removeConfirm.id) === currentAdmin?.id) {
      toast.error("You cannot remove yourself from the team");
      setRemoveConfirm(null);
      return;
    }
    try {
      await deactivateTeamMember(removeConfirm.id);
      toast.success(`${removeConfirm.fullName} removed from the team`);
      setRemoveConfirm(null);
      setSelected(null);
      refetchMembers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member');
    }
  }

  async function handleRoleChange(member: ApiTeamMember, newRole: string) {
    if (String(member.id) === currentAdmin?.id) {
      toast.error("You cannot change your own role");
      return;
    }
    try {
      await updateTeamMember(member.id, { role: newRole });
      toast.success(`${member.fullName}'s role updated`);
      refetchMembers();
      setSelected(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update role');
    }
  }

  return (
    <div className="p-6 max-w-[1000px]">
      <PageHeader
        title="Team"
        description={`${teamMembers.length} team members`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => { refetchMembers(); if (activeView === 'activity') refetchLogs(); }}
              className="flex items-center gap-2 px-3 py-2 text-[13px] bg-[var(--card)] border border-[var(--border)] rounded-lg hover:bg-[var(--accent)] transition-colors text-[var(--foreground)]"
              style={{ fontWeight: 500 }}
            >
              <RefreshCw size={14} aria-hidden="true" />
              Refresh
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-3 py-2 text-[13px] bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:opacity-90 transition-colors"
              style={{ fontWeight: 500 }}
            >
              <Plus size={14} aria-hidden="true" />
              Add Member
            </button>
          </div>
        }
      />

      {/* View Tabs */}
      <div className="flex gap-1 mb-4 p-1 bg-[var(--accent)] rounded-lg w-fit">
        {[
          { key: 'members' as const, label: 'Members' },
          { key: 'activity' as const, label: 'Activity Log' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveView(tab.key)}
            className={`px-3 py-1.5 text-[13px] rounded-md transition-colors ${
              activeView === tab.key ? 'bg-[var(--card)] shadow-sm text-[var(--foreground)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
            style={{ fontWeight: 500 }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error states */}
      {(activeView === 'members' ? membersError : logsError) && (
        <div className="mb-4 flex items-center gap-2 p-4 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900">
          <AlertCircle size={16} />
          <span className="text-[13px]">{activeView === 'members' ? membersError : logsError}</span>
          <button onClick={() => activeView === 'members' ? refetchMembers() : refetchLogs()} className="ml-auto text-[13px] underline" style={{ fontWeight: 500 }}>Retry</button>
        </div>
      )}

      {activeView === 'members' ? (
        membersLoading && !members ? (
          <div className="mt-8 flex items-center justify-center gap-2 text-[var(--muted-foreground)]">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-[13px]">Loading team…</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teamMembers.map(m => (
              <div
                key={m.id}
                onClick={() => setSelected(m)}
                className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5 hover:shadow-sm transition-shadow cursor-pointer"
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-10 h-10 rounded-full bg-[var(--primary)] flex items-center justify-center text-[var(--primary-foreground)] text-[13px] shrink-0"
                    style={{ fontWeight: 600 }}
                    aria-hidden="true"
                  >
                    {getInitials(m.fullName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>
                      {m.fullName}
                      {String(m.id) === currentAdmin?.id && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400" style={{ fontWeight: 600 }}>You</span>
                      )}
                    </p>
                    <p className="text-[12px] text-[var(--muted-foreground)]">{m.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--accent)] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>
                        {ROLE_LABELS[m.role as keyof typeof ROLE_LABELS] || m.role}
                      </span>
                      <StatusBadge status={m.isActive ? 'active' : 'inactive'} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] text-[var(--muted-foreground)]">Last login</p>
                    <p className="text-[12px] text-[var(--foreground)]">{m.lastLoginAt ? timeAgo(m.lastLoginAt) : 'Never'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Activity Log */
        logsLoading && !logs ? (
          <div className="mt-8 flex items-center justify-center gap-2 text-[var(--muted-foreground)]">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-[13px]">Loading activity…</span>
          </div>
        ) : (
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
            {activityLogs.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-[13px] text-[var(--muted-foreground)]">No activity logs yet.</p>
              </div>
            ) : (
              activityLogs.map(a => (
                <div key={a.id} className="flex items-start gap-4 px-5 py-4 border-b border-[var(--border)] last:border-0">
                  <div
                    className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-[11px] text-[var(--muted-foreground)] shrink-0 mt-0.5"
                    style={{ fontWeight: 600 }}
                    aria-hidden="true"
                  >
                    {getInitials(a.adminName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-[var(--foreground)]">
                      <span style={{ fontWeight: 500 }}>{a.adminName}</span>
                    </p>
                    <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">{a.description}</p>
                  </div>
                  <span className="text-[11px] text-[var(--muted-foreground)] shrink-0">{timeAgo(a.createdAt)}</span>
                </div>
              ))
            )}
          </div>
        )
      )}

      {/* Add Member Drawer */}
      <DetailDrawer
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add Team Member"
        subtitle="Create a new admin user for the team"
        actions={
          <button
            onClick={handleAdd}
            disabled={!newMember.fullName || !newMember.email || isSubmitting}
            className="flex-1 py-2 text-[13px] bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:opacity-90 disabled:opacity-40"
            style={{ fontWeight: 500 }}
          >
            {isSubmitting ? 'Creating…' : 'Create Member'}
          </button>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="member-name" className="block text-[12px] text-[var(--muted-foreground)] mb-1.5" style={{ fontWeight: 500 }}>Full Name</label>
            <input
              id="member-name"
              value={newMember.fullName}
              onChange={e => setNewMember({ ...newMember, fullName: e.target.value })}
              className="w-full px-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]"
              placeholder="Enter full name"
            />
          </div>
          <div>
            <label htmlFor="member-email" className="block text-[12px] text-[var(--muted-foreground)] mb-1.5" style={{ fontWeight: 500 }}>Email</label>
            <input
              id="member-email"
              type="email"
              value={newMember.email}
              onChange={e => setNewMember({ ...newMember, email: e.target.value })}
              className="w-full px-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]"
              placeholder="email@direkto.com"
            />
          </div>
          <div>
            <label htmlFor="member-role" className="block text-[12px] text-[var(--muted-foreground)] mb-1.5" style={{ fontWeight: 500 }}>Role</label>
            <select
              id="member-role"
              value={newMember.role}
              onChange={e => setNewMember({ ...newMember, role: e.target.value })}
              className="w-full px-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none text-[var(--foreground)]"
            >
              {Object.entries(ROLE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="member-dept" className="block text-[12px] text-[var(--muted-foreground)] mb-1.5" style={{ fontWeight: 500 }}>Department</label>
            <input
              id="member-dept"
              value={newMember.department}
              onChange={e => setNewMember({ ...newMember, department: e.target.value })}
              className="w-full px-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]"
              placeholder="e.g. Operations"
            />
          </div>
          <div>
            <label htmlFor="member-title" className="block text-[12px] text-[var(--muted-foreground)] mb-1.5" style={{ fontWeight: 500 }}>Job Title</label>
            <input
              id="member-title"
              value={newMember.jobTitle}
              onChange={e => setNewMember({ ...newMember, jobTitle: e.target.value })}
              className="w-full px-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]"
              placeholder="e.g. Support Agent"
            />
          </div>
        </div>
      </DetailDrawer>

      {/* Member Detail */}
      <DetailDrawer
        open={!!selected && !showAdd}
        onClose={() => setSelected(null)}
        title={selected?.fullName || ''}
        subtitle={selected?.email}
        actions={
          selected && String(selected.id) !== currentAdmin?.id ? (
            <button
              onClick={() => setRemoveConfirm(selected)}
              className="py-2 px-4 text-[13px] border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950"
              style={{ fontWeight: 500 }}
            >
              <span className="flex items-center gap-1.5">
                <Trash2 size={12} aria-hidden="true" />
                Remove Member
              </span>
            </button>
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-6">
            {/* Self-indicator */}
            {String(selected.id) === currentAdmin?.id && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900">
                <span className="text-[12px] text-blue-600 dark:text-blue-400" style={{ fontWeight: 500 }}>👋 This is your account</span>
              </div>
            )}
            <div className="flex gap-2">
              <StatusBadge status={selected.isActive ? 'active' : 'inactive'} size="md" />
              <span className="text-[12px] px-2.5 py-1 rounded-full bg-[var(--accent)] text-[var(--foreground)]" style={{ fontWeight: 500 }}>
                {ROLE_LABELS[selected.role as keyof typeof ROLE_LABELS] || selected.role}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Last Login', value: selected.lastLoginAt ? timeAgo(selected.lastLoginAt) : 'Never' },
                { label: 'Joined', value: formatDate(selected.createdAt) },
                { label: 'Department', value: selected.department || 'N/A' },
                { label: 'Job Title', value: selected.jobTitle || 'N/A' },
                { label: 'Login Count', value: String(selected.loginCount) },
                { label: 'Phone', value: selected.phone || 'N/A' },
              ].map(i => (
                <div key={i.label}>
                  <p className="text-[11px] text-[var(--muted-foreground)] mb-0.5" style={{ fontWeight: 500 }}>{i.label}</p>
                  <p className="text-[13px] text-[var(--foreground)]">{i.value}</p>
                </div>
              ))}
            </div>
            {/* Only show role change for OTHER members, not yourself */}
            {String(selected.id) !== currentAdmin?.id ? (
              <div>
                <label htmlFor="edit-role" className="block text-[12px] text-[var(--muted-foreground)] mb-1.5" style={{ fontWeight: 500 }}>Change Role</label>
                <select
                  id="edit-role"
                  defaultValue={selected.role}
                  onChange={(e) => handleRoleChange(selected, e.target.value)}
                  className="w-full px-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none text-[var(--foreground)]"
                >
                  {Object.entries(ROLE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="p-3 bg-[var(--accent)]/50 rounded-lg">
                <p className="text-[12px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>
                  You cannot change your own role or remove yourself.
                </p>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>

      <ConfirmDialog
        open={!!removeConfirm}
        onClose={() => setRemoveConfirm(null)}
        onConfirm={handleRemove}
        title="Remove Team Member"
        objectId={removeConfirm ? String(removeConfirm.id) : undefined}
        message={`Are you sure you want to remove ${removeConfirm?.fullName}? They will lose all admin access immediately.`}
        confirmLabel="Remove Member"
        variant="danger"
      />
    </div>
  );
}