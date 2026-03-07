// ── Merchant Detail Page ─────────────────────────────────────
// Full-page merchant view at /merchants/:id
// Sidebar tabs → content area. Replaces the old drawer approach.
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  ArrowLeft, Loader2, Store, Star, CheckCircle, XCircle,
  Ban, Play, AlertCircle,
  LayoutDashboard, FileText, DollarSign, CreditCard, Package,
  Calendar, Tag, ArrowRightLeft, Shield,
} from 'lucide-react';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { canApprove, canEdit as canEditPerm } from '../../lib/permissions';
import {
  fetchMerchantById,
  type ApiMerchant,
} from '../../lib/merchants-api';
import { getMerchantStatus } from './helpers';
import { ActionModal, type ActionType } from './components/ActionModal';

// Tab components
import { OverviewTab } from './tabs/OverviewTab';
import { DocumentsTab } from './tabs/DocumentsTab';
import { CommissionTab } from './tabs/CommissionTab';
import { PayoutTab } from './tabs/PayoutTab';
import { RentalsTab } from './tabs/RentalsTab';
import { BookingsTab } from './tabs/BookingsTab';
import { PromosTab } from './tabs/PromosTab';
import { ExtensionsTab } from './tabs/ExtensionsTab';
import { DamageTab } from './tabs/DamageTab';

const TABS = [
  { id: 'overview',    label: 'Overview',    icon: LayoutDashboard },
  { id: 'documents',   label: 'Documents',   icon: FileText },
  { id: 'commission',  label: 'Commission',  icon: DollarSign },
  { id: 'payout',      label: 'Payout',      icon: CreditCard },
  { id: 'rentals',     label: 'Rentals',     icon: Package },
  { id: 'bookings',    label: 'Bookings',    icon: Calendar },
  { id: 'promos',      label: 'Promos',      icon: Tag },
  { id: 'extensions',  label: 'Extensions',  icon: ArrowRightLeft },
  { id: 'damage',      label: 'Damage',      icon: Shield },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function MerchantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role;

  const canDoApprove = role ? canApprove(role, 'merchants') : false;
  const canDoEdit    = role ? canEditPerm(role, 'merchants') : false;
  const canEditCommission = role === 'SUPER_ADMIN' || role === 'MERCHANT_MANAGER';

  // ── Data ───────────────────────────────────────────────────
  const [merchant, setMerchant] = useState<ApiMerchant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Tab ────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // ── Action modal ───────────────────────────────────────────
  const [actionModal, setActionModal] = useState<{
    type: ActionType;
    target: ApiMerchant;
  } | null>(null);

  // ── Load merchant ──────────────────────────────────────────
  const loadMerchant = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const m = await fetchMerchantById(Number(id));
      setMerchant(m);
    } catch (err: any) {
      setError(err?.message || 'Failed to load merchant');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadMerchant(); }, [loadMerchant]);

  // ── Visible tabs (hide some for non-approved merchants) ────
  function visibleTabs() {
    if (!merchant) return TABS;
    const approved = merchant.verificationStatus === 'APPROVED';
    return TABS.filter(t => {
      if (['bookings', 'promos', 'extensions', 'damage'].includes(t.id)) return approved;
      return true;
    });
  }

  // ── Loading / Error states ─────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-[var(--muted-foreground)]" />
        <span className="ml-2 text-[var(--muted-foreground)]">Loading merchant…</span>
      </div>
    );
  }

  if (error || !merchant) {
    return (
      <div className="p-6">
        <button onClick={() => navigate('/merchants')} className="flex items-center gap-1.5 text-[13px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors mb-4">
          <ArrowLeft size={14} /> Back to Merchants
        </button>
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900">
          <AlertCircle size={16} />
          <span className="text-[13px]">{error || 'Merchant not found'}</span>
          <button onClick={loadMerchant} className="ml-auto text-[13px] underline" style={{ fontWeight: 500 }}>Retry</button>
        </div>
      </div>
    );
  }

  const m = merchant;

  return (
    <div className="flex h-full">
      {/* ── Sidebar ──────────────────────────────────────────── */}
      <div className="w-[240px] shrink-0 border-r border-[var(--border)] bg-[var(--card)] flex flex-col">
        {/* Back + merchant header */}
        <div className="p-4 border-b border-[var(--border)]">
          <button onClick={() => navigate('/merchants')} className="flex items-center gap-1.5 text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors mb-3">
            <ArrowLeft size={12} /> All Merchants
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
              <Store size={16} className="text-[var(--primary)]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[13px] text-[var(--foreground)] truncate" style={{ fontWeight: 600 }}>{m.businessName}</p>
                {m.isFeatured && <Star size={10} className="text-amber-500 fill-amber-500 shrink-0" />}
              </div>
              <p className="text-[10px] text-[var(--muted-foreground)] font-mono">{m.publicId}</p>
            </div>
          </div>
          <div className="mt-2">
            <StatusBadge status={getMerchantStatus(m)} size="sm" />
          </div>
        </div>

        {/* Tab navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {visibleTabs().map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] rounded-lg transition-colors text-left ${
                activeTab === tab.id
                  ? 'bg-[var(--accent)] text-[var(--foreground)]'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]/50 hover:text-[var(--foreground)]'
              }`}
              style={{ fontWeight: activeTab === tab.id ? 600 : 400 }}>
              <tab.icon size={14} className={activeTab === tab.id ? 'text-[var(--primary)]' : ''} />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Action buttons */}
        {(canDoApprove || canDoEdit) && (
          <div className="p-3 border-t border-[var(--border)] space-y-1.5">
            {canDoApprove && m.verificationStatus === 'PENDING' && (
              <>
                <button onClick={() => setActionModal({ type: 'approve', target: m })}
                  className="w-full py-2 text-[12px] bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5" style={{ fontWeight: 500 }}>
                  <CheckCircle size={13} /> Approve
                </button>
                <button onClick={() => setActionModal({ type: 'reject', target: m })}
                  className="w-full py-2 text-[12px] border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors flex items-center justify-center gap-1.5" style={{ fontWeight: 500 }}>
                  <XCircle size={13} /> Reject
                </button>
              </>
            )}
            {canDoEdit && m.verificationStatus === 'APPROVED' && m.isActive && (
              <button onClick={() => setActionModal({ type: 'suspend', target: m })}
                className="w-full py-2 text-[12px] border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors flex items-center justify-center gap-1.5" style={{ fontWeight: 500 }}>
                <Ban size={13} /> Suspend
              </button>
            )}
            {canDoEdit && m.verificationStatus === 'APPROVED' && !m.isActive && (
              <button onClick={() => setActionModal({ type: 'reactivate', target: m })}
                className="w-full py-2 text-[12px] bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5" style={{ fontWeight: 500 }}>
                <Play size={13} /> Reactivate
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Content area ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Tab heading */}
        <div className="mb-5">
          <h2 className="text-[17px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>
            {TABS.find(t => t.id === activeTab)?.label}
          </h2>
          <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">{m.businessName} · {m.municipality || ''}</p>
        </div>

        {/* Render active tab */}
        {activeTab === 'overview' && (
          <OverviewTab merchant={m} canEdit={canDoEdit} onUpdate={(updated) => setMerchant(updated)} />
        )}
        {activeTab === 'documents' && (
          <DocumentsTab merchant={m} canEdit={canDoEdit} onUpdate={(updated: ApiMerchant) => { setMerchant(updated); }} />
        )}
        {activeTab === 'commission' && (
          <CommissionTab merchant={m} canEditCommission={canEditCommission} onUpdate={(updated: ApiMerchant) => { setMerchant(updated); }} />
        )}
        {activeTab === 'payout' && (
          <PayoutTab merchant={m} canEditPayout={canDoEdit} onUpdate={(updated: ApiMerchant) => { setMerchant(updated); }} />
        )}
        {activeTab === 'rentals' && (
          <RentalsTab merchant={m} canEdit={canDoEdit} onRefreshMerchant={loadMerchant} />
        )}
        {activeTab === 'bookings' && (
          <BookingsTab merchant={m} canEdit={canDoEdit} />
        )}
        {activeTab === 'promos' && (
          <PromosTab merchant={m} canEdit={canDoEdit} />
        )}
        {activeTab === 'extensions' && (
          <ExtensionsTab merchant={m} canEdit={canDoEdit} />
        )}
        {activeTab === 'damage' && (
          <DamageTab merchant={m} canEdit={canDoEdit} />
        )}
      </div>

      {/* Action modal */}
      {actionModal && (
        <ActionModal
          type={actionModal.type}
          merchant={actionModal.target}
          onClose={() => setActionModal(null)}
          onComplete={() => { setActionModal(null); loadMerchant(); }}
        />
      )}
    </div>
  );
}
