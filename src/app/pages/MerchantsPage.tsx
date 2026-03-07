import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  CheckCircle, XCircle, Eye, RefreshCw, AlertCircle, Loader2,
  Store, Clock, FileText, CreditCard, MapPin, Play,
  Ban, ExternalLink, ShieldCheck, Pencil, Save, X, Lock,
  DollarSign, Percent, Star, ScrollText, FileSignature, StickyNote, Package,
  Plus, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronRight, Wrench,
  Upload, ImageIcon,
} from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { FilterBar } from '../components/shared/FilterBar';
import { StatusBadge } from '../components/shared/StatusBadge';
import { DetailDrawer } from '../components/shared/DetailDrawer';
import { DataTable, type Column } from '../components/shared/DataTable';
import { useAuth } from '../context/AuthContext';
import { canApprove, canEdit, canExport } from '../lib/permissions';
import { useApiQuery } from '../hooks/useApiQuery';
import { api } from '../lib/api';
import {
  fetchMerchants, fetchPendingMerchants, fetchMerchantStats,
  reviewMerchant, toggleMerchantStatus, updateMerchant,
  fetchRentalCategories, fetchMerchantTemplates,
  adminCreateTemplate, adminUpdateTemplate, adminDeleteTemplate,
  fetchTemplateUnits, adminCreateUnit, adminUpdateUnit, adminDeleteUnit,
  type ApiMerchant, type MerchantStats, type MerchantSearchParams,
  type UpdateMerchantPayload, type RentalCategory, type RentalTemplate,
  type CreateTemplatePayload, type AdminUnit, type CreateUnitPayload,
} from '../lib/merchants-api';
import type { PaginatedResponse } from '../lib/users-api';
import { BookingsTab, PromoCodesTab, ExtensionsTab, DamageReportsTab } from './MerchantDrawerTabs';

/* ── helpers ─────────────────────────────────────────────────── */
function getMerchantStatus(m: ApiMerchant): string {
  if (m.verificationStatus === 'PENDING') return 'pending';
  if (m.verificationStatus === 'REJECTED') return 'rejected';
  if (!m.isActive) return 'suspended';
  return 'active';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function peso(value: string | number): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!n || n === 0) return '₱0';
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

const DOC_LABELS: Record<string, string> = {
  business_permit: 'Business Permit',
  valid_id: 'Valid ID',
  dti_certificate: 'DTI Certificate',
  sec_registration: 'SEC Registration',
  bir_certificate: 'BIR Certificate',
  mayors_permit: "Mayor's Permit",
  proof_of_address: 'Proof of Address',
};

/* ── role-permission label helper ────────────────────────────── */
function RoleBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded" style={{ fontWeight: 500 }}>
      <Lock size={8} /> {label}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════ */
export function MerchantsPage() {
  const { user } = useAuth();
  const role = user?.role;

  /* ── Role-derived permission flags ─────────────────────────── */
  const canDoApprove = role ? canApprove(role, 'merchants') : false;
  const canDoEdit    = role ? canEdit(role, 'merchants') : false;
  const canDoExport  = role ? canExport(role, 'merchants') : false;

  // Commission-specific: SUPER_ADMIN and MERCHANT_MANAGER can override commission
  const canEditCommission = role === 'SUPER_ADMIN' || role === 'MERCHANT_MANAGER';
  // Payout edit: same as canDoEdit (SUPER_ADMIN, MERCHANT_MANAGER, OPS_MANAGER)
  const canEditPayout = canDoEdit;

  /* ── tab state ─────────────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState<'onboarding' | 'all'>('all');

  /* ── list / filter state ───────────────────────────────────── */
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [municipalityFilter, setMunicipalityFilter] = useState('all');
  const [page, setPage] = useState(1);

  /* ── drawer state ──────────────────────────────────────────── */
  const [selected, setSelected] = useState<ApiMerchant | null>(null);
  const [merchantStats, setMerchantStats] = useState<MerchantStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [rentalCategories, setRentalCategories] = useState<RentalCategory[]>([]);
  const [merchantTemplates, setMerchantTemplates] = useState<RentalTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  /* ── edit mode state ───────────────────────────────────────── */
  const [editMode, setEditMode] = useState<'commission' | 'payout' | null>(null);
  const [editCommissionOverride, setEditCommissionOverride] = useState('');
  const [editBankName, setEditBankName] = useState('');
  const [editAccountNumber, setEditAccountNumber] = useState('');
  const [editAccountName, setEditAccountName] = useState('');
  const [editGcashNumber, setEditGcashNumber] = useState('');
  const [editFeatured, setEditFeatured] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  /* ── action dialog state ───────────────────────────────────── */
  const [actionModal, setActionModal] = useState<{
    type: 'approve' | 'reject' | 'suspend' | 'reactivate';
    target: ApiMerchant;
  } | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  /* ── template create/edit modal state ──────────────────────── */
  const [templateModal, setTemplateModal] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplCategoryId, setTplCategoryId] = useState<number | ''>('');
  const [tplDescription, setTplDescription] = useState('');
  const [tplDailyRate, setTplDailyRate] = useState('');
  const [tplWeeklyRate, setTplWeeklyRate] = useState('');
  const [tplMonthlyRate, setTplMonthlyRate] = useState('');
  const [tplFeatures, setTplFeatures] = useState('');
  const [tplCancellationPolicy, setTplCancellationPolicy] = useState('');
  const [tplPhotos, setTplPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [tplUploading, setTplUploading] = useState(false);
  function resetTemplateForm() {
    setTplName('');
    setTplCategoryId('');
    setTplDescription('');
    setTplDailyRate('');
    setTplWeeklyRate('');
    setTplMonthlyRate('');
    setTplFeatures('');
    setTplCancellationPolicy('');
    tplPhotos.forEach(p => URL.revokeObjectURL(p.preview));
    setTplPhotos([]);
  }

  function openCreateTemplate() {
    resetTemplateForm();
    setTemplateModal(true);
  }

  async function handleCreateTemplate() {
    if (!selected || !tplName.trim() || !tplCategoryId || !tplDescription.trim() || !tplDailyRate) return;

    setTemplateSaving(true);
    try {
      // Upload photos first if any
      let photoUrls: string[] = [];
      if (tplPhotos.length > 0) {
        setTplUploading(true);
        try {
          const files = tplPhotos.map(p => p.file);
          const results = await api.uploadFiles(files, 'templates');
          photoUrls = results.map(r => r.url);
        } catch (uploadErr: any) {
          toast.error(`Photo upload failed: ${uploadErr?.message || 'Unknown error'}`);
          setTplUploading(false);
          setTemplateSaving(false);
          return;
        }
        setTplUploading(false);
      }

      const payload: CreateTemplatePayload = {
        name: tplName.trim(),
        categoryId: Number(tplCategoryId),
        description: tplDescription.trim(),
        baseDailyRate: parseFloat(tplDailyRate),
      };
      if (tplWeeklyRate) payload.baseWeeklyRate = parseFloat(tplWeeklyRate);
      if (tplMonthlyRate) payload.baseMonthlyRate = parseFloat(tplMonthlyRate);
      if (tplFeatures.trim()) payload.features = tplFeatures.split(',').map(f => f.trim()).filter(Boolean);
      if (tplCancellationPolicy.trim()) payload.cancellationPolicy = tplCancellationPolicy.trim();
      if (photoUrls.length > 0) payload.templatePhotos = photoUrls;

      const result = await adminCreateTemplate(selected.id, payload);
      if (result.success) {
        toast.success(`Template "${tplName}" created successfully`);
        setTemplateModal(false);
        resetTemplateForm();
        // Reload templates
        setTemplatesLoading(true);
        fetchMerchantTemplates(selected.id)
          .then(setMerchantTemplates)
          .catch(() => {})
          .finally(() => setTemplatesLoading(false));
        // Reload merchant to update counts
        refetch();
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create template');
    } finally {
      setTemplateSaving(false);
    }
  }

  async function handleToggleTemplate(templateId: number, currentlyActive: boolean) {
    if (!selected) return;
    try {
      await adminUpdateTemplate(selected.id, templateId, { isActive: !currentlyActive });
      toast.success(`Template ${currentlyActive ? 'deactivated' : 'activated'}`);
      // Reload templates
      setTemplatesLoading(true);
      fetchMerchantTemplates(selected.id)
        .then(setMerchantTemplates)
        .catch(() => {})
        .finally(() => setTemplatesLoading(false));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to toggle template');
    }
  }

  async function handleDeleteTemplate(templateId: number, templateName: string) {
    if (!selected) return;
    if (!confirm(`Delete template "${templateName}"? This will soft-delete it.`)) return;
    try {
      await adminDeleteTemplate(selected.id, templateId);
      toast.success(`Template "${templateName}" deleted`);
      // Reload templates
      setTemplatesLoading(true);
      fetchMerchantTemplates(selected.id)
        .then(setMerchantTemplates)
        .catch(() => {})
        .finally(() => setTemplatesLoading(false));
      refetch();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete template');
    }
  }

  /* ── unit management state ─────────────────────────────────── */
  const [expandedTemplateId, setExpandedTemplateId] = useState<number | null>(null);
  const [templateUnits, setTemplateUnits] = useState<AdminUnit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitModal, setUnitModal] = useState(false);
  const [unitSaving, setUnitSaving] = useState(false);
  const [unitTemplateId, setUnitTemplateId] = useState<number | null>(null);
  // unit form fields
  const [uNumber, setUNumber] = useState('');
  const [uName, setUName] = useState('');
  const [uPlate, setUPlate] = useState('');
  const [uSerial, setUSerial] = useState('');
  const [uColor, setUColor] = useState('');
  const [uYear, setUYear] = useState('');
  const [uCondition, setUCondition] = useState<'EXCELLENT' | 'GOOD' | 'FAIR'>('EXCELLENT');
  const [uDailyRate, setUDailyRate] = useState('');
  const [uWeeklyRate, setUWeeklyRate] = useState('');
  const [uMonthlyRate, setUMonthlyRate] = useState('');
  const [uDeposit, setUDeposit] = useState('');
  const [uReplacement, setUReplacement] = useState('');
  const [uDeliveryAvailable, setUDeliveryAvailable] = useState(false);
  const [uDeliveryFee, setUDeliveryFee] = useState('');
  const [uPhotos, setUPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [uUploading, setUUploading] = useState(false);
  function resetUnitForm() {
    setUNumber(''); setUName(''); setUPlate(''); setUSerial('');
    setUColor(''); setUYear(''); setUCondition('EXCELLENT');
    setUDailyRate(''); setUWeeklyRate(''); setUMonthlyRate('');
    setUDeposit(''); setUReplacement('');
    setUDeliveryAvailable(false); setUDeliveryFee('');
    uPhotos.forEach(p => URL.revokeObjectURL(p.preview));
    setUPhotos([]);
  }

  function openCreateUnit(templateId: number, template: RentalTemplate) {
    resetUnitForm();
    setUnitTemplateId(templateId);
    // Pre-fill rates from template
    setUDailyRate(template.baseDailyRate || '');
    if (template.baseWeeklyRate) setUWeeklyRate(template.baseWeeklyRate);
    if (template.baseMonthlyRate) setUMonthlyRate(template.baseMonthlyRate);
    setUnitModal(true);
  }

  async function loadTemplateUnits(templateId: number) {
    if (!selected) return;
    if (expandedTemplateId === templateId) {
      setExpandedTemplateId(null);
      return;
    }
    setExpandedTemplateId(templateId);
    setUnitsLoading(true);
    try {
      const res = await fetchTemplateUnits(selected.id, templateId);
      setTemplateUnits(res.data);
    } catch { setTemplateUnits([]); }
    finally { setUnitsLoading(false); }
  }

  async function handleCreateUnit() {
    if (!selected || !unitTemplateId || !uNumber.trim() || !uDailyRate || !uDeposit || !uReplacement) return;
    setUnitSaving(true);
    try {
      // Upload photos first if any
      let photoUrls: string[] = [];
      if (uPhotos.length > 0) {
        setUUploading(true);
        try {
          const files = uPhotos.map(p => p.file);
          const results = await api.uploadFiles(files, 'units');
          photoUrls = results.map(r => r.url);
        } catch (uploadErr: any) {
          toast.error(`Photo upload failed: ${uploadErr?.message || 'Unknown error'}`);
          setUUploading(false);
          setUnitSaving(false);
          return;
        }
        setUUploading(false);
      }

      const payload: CreateUnitPayload = {
        unitNumber: uNumber.trim(),
        condition: uCondition,
        dailyRate: parseFloat(uDailyRate),
        depositAmount: parseFloat(uDeposit),
        replacementValue: parseFloat(uReplacement),
      };
      if (uName.trim()) payload.unitName = uName.trim();
      if (uPlate.trim()) payload.plateNumber = uPlate.trim();
      if (uSerial.trim()) payload.serialNumber = uSerial.trim();
      if (uColor.trim()) payload.color = uColor.trim();
      if (uYear) payload.year = parseInt(uYear);
      if (uWeeklyRate) payload.weeklyRate = parseFloat(uWeeklyRate);
      if (uMonthlyRate) payload.monthlyRate = parseFloat(uMonthlyRate);
      // Auto-use merchant's business address as pickup location
      if (selected.businessAddress) payload.pickupAddress = selected.businessAddress;
      if (uDeliveryAvailable) {
        payload.deliveryAvailable = true;
        if (uDeliveryFee) payload.deliveryFee = parseFloat(uDeliveryFee);
      }
      if (photoUrls.length > 0) payload.photos = photoUrls;

      const result = await adminCreateUnit(selected.id, unitTemplateId, payload);
      if (result.success) {
        toast.success(`Unit "${uNumber}" created`);
        setUnitModal(false);
        resetUnitForm();
        // Reload units for this template
        const res = await fetchTemplateUnits(selected.id, unitTemplateId);
        setTemplateUnits(res.data);
        // Reload templates + merchant to update counts
        fetchMerchantTemplates(selected.id).then(setMerchantTemplates).catch(() => {});
        refetch();
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create unit');
    } finally { setUnitSaving(false); }
  }

  async function handleToggleUnit(unitId: number, currentlyAvailable: boolean) {
    if (!selected) return;
    try {
      await adminUpdateUnit(selected.id, unitId, { isAvailable: !currentlyAvailable });
      toast.success(`Unit ${currentlyAvailable ? 'marked unavailable' : 'marked available'}`);
      if (expandedTemplateId) {
        const res = await fetchTemplateUnits(selected.id, expandedTemplateId);
        setTemplateUnits(res.data);
      }
    } catch (err: any) { toast.error(err?.message || 'Failed to toggle unit'); }
  }

  async function handleDeleteUnit(unitId: number, unitNumber: string) {
    if (!selected) return;
    if (!confirm(`Delete unit "${unitNumber}"?`)) return;
    try {
      await adminDeleteUnit(selected.id, unitId);
      toast.success(`Unit "${unitNumber}" deleted`);
      if (expandedTemplateId) {
        const res = await fetchTemplateUnits(selected.id, expandedTemplateId);
        setTemplateUnits(res.data);
      }
      fetchMerchantTemplates(selected.id).then(setMerchantTemplates).catch(() => {});
      refetch();
    } catch (err: any) { toast.error(err?.message || 'Failed to delete unit'); }
  }

  /* ── API: all merchants ────────────────────────────────────── */
  const params: MerchantSearchParams = { search: search || undefined, page, limit: 20 };
  if (statusFilter === 'pending') params.verificationStatus = 'PENDING';
  else if (statusFilter === 'rejected') params.verificationStatus = 'REJECTED';
  else if (statusFilter === 'active') params.status = 'ACTIVE';
  else if (statusFilter === 'suspended') params.status = 'INACTIVE';
  if (municipalityFilter !== 'all') params.municipality = municipalityFilter;

  const { data, isLoading, error, refetch } = useApiQuery<PaginatedResponse<ApiMerchant>>(
    () => fetchMerchants(params),
    [search, statusFilter, municipalityFilter, page],
    { enabled: activeTab === 'all' },
  );

  const allMerchants = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;
  const municipalities = [...new Set(allMerchants.map(m => m.municipality).filter(Boolean))].sort();

  /* ── API: pending queue ────────────────────────────────────── */
  const {
    data: pendingList,
    isLoading: pendingLoading,
    error: pendingError,
    refetch: refetchPending,
  } = useApiQuery<ApiMerchant[]>(
    () => fetchPendingMerchants(),
    [],
    { enabled: activeTab === 'onboarding' },
  );
  const pendingMerchants = pendingList ?? [];

  /* ── Fetch stats when drawer opens ─────────────────────────── */
  const loadStats = useCallback(async (merchantId: number) => {
    setStatsLoading(true);
    setMerchantStats(null);
    try {
      const stats = await fetchMerchantStats(merchantId);
      setMerchantStats(stats);
    } catch {
      // stats are supplementary
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selected) {
      loadStats(selected.id);
      setEditMode(null);
      // Load templates for rental tab
      setTemplatesLoading(true);
      setMerchantTemplates([]);
      fetchMerchantTemplates(selected.id)
        .then(setMerchantTemplates)
        .catch(() => {})
        .finally(() => setTemplatesLoading(false));
    } else {
      setMerchantStats(null);
      setEditMode(null);
      setMerchantTemplates([]);
    }
  }, [selected, loadStats]);

  /* ── Load rental categories once ───────────────────────────── */
  useEffect(() => {
    fetchRentalCategories()
      .then(setRentalCategories)
      .catch(() => {});
  }, []);

  /* ── Enter edit mode helpers ───────────────────────────────── */
  function enterCommissionEdit(m: ApiMerchant) {
    setEditCommissionOverride(m.commissionRateOverride ? String(parseFloat(m.commissionRateOverride)) : '');
    setEditFeatured(m.isFeatured);
    setEditMode('commission');
  }

  function enterPayoutEdit(m: ApiMerchant) {
    setEditBankName(m.bankName || '');
    setEditAccountNumber(m.accountNumber || '');
    setEditAccountName(m.accountName || '');
    setEditGcashNumber(m.gcashNumber || '');
    setEditMode('payout');
  }

  function cancelEdit() {
    setEditMode(null);
  }

  /* ── Save commission overrides ─────────────────────────────── */
  async function saveCommissionEdit() {
    if (!selected) return;
    setEditSaving(true);
    try {
      const payload: UpdateMerchantPayload = {};
      const overrideVal = editCommissionOverride.trim();
      payload.commissionRateOverride = overrideVal === '' ? null : parseFloat(overrideVal);

      if (typeof payload.commissionRateOverride === 'number' && (isNaN(payload.commissionRateOverride) || payload.commissionRateOverride < 0 || payload.commissionRateOverride > 100)) {
        toast.error('Commission override must be between 0 and 100');
        setEditSaving(false);
        return;
      }

      if (editFeatured !== selected.isFeatured) {
        payload.isFeatured = editFeatured;
      }

      const updated = await updateMerchant(selected.id, payload);
      setSelected(updated);
      setEditMode(null);
      toast.success('Commission settings updated');
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update commission');
    } finally {
      setEditSaving(false);
    }
  }

  /* ── Save payout info ──────────────────────────────────────── */
  async function savePayoutEdit() {
    if (!selected) return;
    setEditSaving(true);
    try {
      const payload: UpdateMerchantPayload = {};
      if (editBankName !== (selected.bankName || '')) payload.bankName = editBankName;
      if (editAccountNumber !== (selected.accountNumber || '')) payload.accountNumber = editAccountNumber;
      if (editAccountName) payload.accountName = editAccountName;
      if (editGcashNumber !== (selected.gcashNumber || '')) payload.gcashNumber = editGcashNumber;

      if (Object.keys(payload).length === 0) {
        toast.info('No changes to save');
        setEditMode(null);
        setEditSaving(false);
        return;
      }

      const updated = await updateMerchant(selected.id, payload);
      setSelected(updated);
      setEditMode(null);
      toast.success('Payout details updated');
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update payout');
    } finally {
      setEditSaving(false);
    }
  }

  /* ── action execution ──────────────────────────────────────── */
  async function executeAction() {
    if (!actionModal) return;
    const { type, target } = actionModal;
    const notes = actionNotes.trim();

    if (!notes) {
      toast.error('Please provide notes/reason');
      return;
    }

    setActionLoading(true);
    try {
      if (type === 'approve') {
        await reviewMerchant(target.id, 'APPROVED', notes);
      } else if (type === 'reject') {
        await reviewMerchant(target.id, 'REJECTED', notes);
      } else if (type === 'suspend') {
        await toggleMerchantStatus(target.id, 'SUSPENDED', notes);
      } else if (type === 'reactivate') {
        await toggleMerchantStatus(target.id, 'ACTIVE', notes);
      }

      const labels = {
        approve: 'approved', reject: 'rejected',
        suspend: 'suspended', reactivate: 'reactivated',
      };
      toast.success(`${target.businessName} has been ${labels[type]}`);
      setActionModal(null);
      setActionNotes('');
      setSelected(null);
      refetch();
      refetchPending();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  }

  /* ── shared table columns ──────────────────────────────────── */
  const columns: Column<ApiMerchant>[] = [
    {
      key: 'name',
      label: 'Merchant',
      sortable: true,
      sortValue: (m) => m.businessName,
      render: (m) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
            <Store size={14} className="text-[var(--primary)]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>{m.businessName}</p>
              {m.isFeatured && <Star size={11} className="text-amber-500 fill-amber-500" />}
            </div>
            <p className="text-[11px] text-[var(--muted-foreground)]">{m.contactPerson} · {m.municipality || 'N/A'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      sortValue: (m) => m.businessType || '',
      render: (m) => (
        <span className="text-[12px] px-2 py-0.5 rounded-full bg-[var(--accent)] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>
          {m.businessType || 'N/A'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      sortValue: (m) => getMerchantStatus(m),
      render: (m) => <StatusBadge status={getMerchantStatus(m)} />,
    },
    {
      key: 'revenue',
      label: 'Revenue',
      align: 'right' as const,
      sortable: true,
      sortValue: (m) => parseFloat(m.totalRevenue) || 0,
      render: (m) => {
        const r = parseFloat(m.totalRevenue) || 0;
        return <span className="text-[13px] tabular-nums text-[var(--foreground)]">{r > 0 ? peso(r) : '—'}</span>;
      },
    },
    {
      key: 'commission',
      label: 'Commission',
      align: 'right' as const,
      sortable: true,
      sortValue: (m) => parseFloat(m.commissionRateOverride || m.contractedCommissionRate) || 0,
      render: (m) => {
        const hasOverride = m.commissionRateOverride !== null && m.commissionRateOverride !== undefined;
        const rate = hasOverride ? parseFloat(m.commissionRateOverride!) : parseFloat(m.contractedCommissionRate);
        return (
          <span className={`text-[13px] tabular-nums ${hasOverride ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--foreground)]'}`}>
            {rate || 0}%
            {hasOverride && <span className="text-[9px] ml-0.5 opacity-60">ovr</span>}
          </span>
        );
      },
    },
    {
      key: 'bookings',
      label: 'Bookings',
      align: 'right' as const,
      sortable: true,
      sortValue: (m) => m.totalBookings,
      render: (m) => (
        <span className="text-[13px] tabular-nums text-[var(--foreground)]">
          {m.totalBookings > 0 ? m.totalBookings.toLocaleString() : '—'}
        </span>
      ),
    },
  ];

  /* ── Onboarding columns ────────────────────────────────────── */
  const onboardingColumns: Column<ApiMerchant>[] = [
    {
      key: 'name',
      label: 'Merchant',
      sortable: true,
      sortValue: (m) => m.businessName,
      render: (m) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
            <Clock size={14} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>{m.businessName}</p>
            <p className="text-[11px] text-[var(--muted-foreground)]">{m.contactPerson}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (m) => (
        <span className="text-[12px] px-2 py-0.5 rounded-full bg-[var(--accent)] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>
          {m.businessType || 'N/A'}
        </span>
      ),
    },
    {
      key: 'municipality',
      label: 'Location',
      render: (m) => (
        <div className="flex items-center gap-1 text-[12px] text-[var(--muted-foreground)]">
          <MapPin size={12} />
          {m.municipality || 'N/A'}
        </div>
      ),
    },
    {
      key: 'contact',
      label: 'Contact',
      render: (m) => (
        <div>
          <p className="text-[12px] text-[var(--foreground)]">{m.contactEmail}</p>
          <p className="text-[11px] text-[var(--muted-foreground)]">{m.contactPhone}</p>
        </div>
      ),
    },
    {
      key: 'applied',
      label: 'Applied',
      sortable: true,
      sortValue: (m) => new Date(m.createdAt).getTime(),
      render: (m) => (
        <span className="text-[12px] text-[var(--muted-foreground)]">{timeAgo(m.createdAt)}</span>
      ),
    },
  ];

  /* ── Drawer tab content builders ───────────────────────────── */

  /* ─── Overview Tab ─────────────────────────────────────────── */
  function buildOverviewTab(m: ApiMerchant) {
    return (
      <div className="space-y-6">
        {/* Status + date */}
        <div className="flex items-center gap-3 flex-wrap">
          <StatusBadge status={getMerchantStatus(m)} size="md" />
          {m.isFeatured && (
            <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full" style={{ fontWeight: 500 }}>
              <Star size={10} className="fill-amber-500" /> Featured
            </span>
          )}
          <span className="text-[12px] text-[var(--muted-foreground)]">
            Applied {formatDate(m.createdAt)}
          </span>
          {m.verifiedAt && (
            <span className="text-[12px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <ShieldCheck size={12} /> Verified {formatDate(m.verifiedAt)}
            </span>
          )}
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Contact Person', value: m.contactPerson },
            { label: 'Business Type', value: m.businessType || 'N/A' },
            { label: 'Email', value: m.contactEmail },
            { label: 'Phone', value: m.contactPhone },
            { label: 'Address', value: m.businessAddress || 'N/A' },
            { label: 'Municipality', value: m.municipality || 'N/A' },
            { label: 'Registration #', value: m.businessRegistrationNumber || 'N/A' },
            {
              label: 'Effective Commission',
              value: m.commissionRateOverride
                ? `${parseFloat(m.commissionRateOverride)}% (override)`
                : `${parseFloat(m.contractedCommissionRate) || 0}%`,
            },
          ].map(item => (
            <div key={item.label}>
              <p className="text-[11px] text-[var(--muted-foreground)] mb-0.5" style={{ fontWeight: 500 }}>
                {item.label}
              </p>
              <p className="text-[13px] text-[var(--foreground)]">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Revenue', value: peso(m.totalRevenue) },
            { label: 'Bookings', value: m.totalBookings.toLocaleString() },
            {
              label: 'Rating',
              value: parseFloat(m.averageRating) > 0
                ? `${parseFloat(m.averageRating).toFixed(1)} ★`
                : '—',
            },
          ].map(card => (
            <div key={card.label} className="bg-[var(--accent)]/50 rounded-lg p-3">
              <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>{card.label}</p>
              <p className="text-[18px] mt-1 text-[var(--foreground)]" style={{ fontWeight: 600 }}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Live monthly stats */}
        {statsLoading && (
          <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-[12px]">Loading monthly stats…</span>
          </div>
        )}
        {merchantStats && (
          <div>
            <p className="text-[12px] text-[var(--muted-foreground)] mb-2" style={{ fontWeight: 600 }}>This Month</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-900">
                <p className="text-[11px] text-blue-600 dark:text-blue-400" style={{ fontWeight: 500 }}>Monthly Revenue</p>
                <p className="text-[16px] mt-1 text-blue-700 dark:text-blue-300" style={{ fontWeight: 600 }}>
                  {peso(merchantStats.thisMonth.revenue)}
                </p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-900">
                <p className="text-[11px] text-blue-600 dark:text-blue-400" style={{ fontWeight: 500 }}>Monthly Bookings</p>
                <p className="text-[16px] mt-1 text-blue-700 dark:text-blue-300" style={{ fontWeight: 600 }}>
                  {merchantStats.thisMonth.bookings}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Location */}
        {(m.latitude && m.longitude) && (
          <div>
            <p className="text-[12px] text-[var(--muted-foreground)] mb-2" style={{ fontWeight: 600 }}>
              <MapPin size={12} className="inline mr-1" />Location
            </p>
            <div className="p-3 bg-[var(--accent)]/50 rounded-lg space-y-1">
              <p className="text-[12px] text-[var(--foreground)]">
                {m.latitude}, {m.longitude}
              </p>
              <a
                href={`https://www.google.com/maps?q=${m.latitude},${m.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-[var(--primary)] hover:underline"
                style={{ fontWeight: 500 }}
              >
                <ExternalLink size={10} /> Open in Google Maps
              </a>
            </div>
          </div>
        )}

        {/* Notes */}
        {m.notes && (
          <div>
            <p className="text-[12px] text-[var(--muted-foreground)] mb-2" style={{ fontWeight: 600 }}>
              <StickyNote size={12} className="inline mr-1" />Admin Notes
            </p>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-[12px] text-amber-800 dark:text-amber-200 whitespace-pre-wrap" style={{ lineHeight: 1.6 }}>
                {m.notes}
              </p>
            </div>
          </div>
        )}

        {/* Policies */}
        {(m.cancellationPolicy || m.termsAndConditions) && (
          <div>
            <p className="text-[12px] text-[var(--muted-foreground)] mb-2" style={{ fontWeight: 600 }}>
              <ScrollText size={12} className="inline mr-1" />Policies
            </p>
            <div className="space-y-3">
              {m.cancellationPolicy && (
                <div className="p-3 bg-[var(--accent)]/50 rounded-lg">
                  <p className="text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Cancellation Policy</p>
                  <p className="text-[12px] text-[var(--foreground)] whitespace-pre-wrap" style={{ lineHeight: 1.5 }}>
                    {m.cancellationPolicy}
                  </p>
                </div>
              )}
              {m.termsAndConditions && (
                <div className="p-3 bg-[var(--accent)]/50 rounded-lg">
                  <p className="text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Terms & Conditions</p>
                  <p className="text-[12px] text-[var(--foreground)] whitespace-pre-wrap" style={{ lineHeight: 1.5 }}>
                    {m.termsAndConditions}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Role info notice */}
        {!canDoEdit && (
          <div className="flex items-center gap-2 p-3 bg-[var(--accent)]/50 rounded-lg text-[var(--muted-foreground)]">
            <Lock size={14} />
            <span className="text-[12px]">
              You have <strong>view-only</strong> access. Contact a Merchant Manager or Super Admin to edit.
            </span>
          </div>
        )}
      </div>
    );
  }

  /* ─── Documents Tab ────────────────────────────────────────── */
  function buildDocumentsTab(m: ApiMerchant) {
    const docs = m.documents && typeof m.documents === 'object'
      ? Object.entries(m.documents as Record<string, string>)
      : [];

    return (
      <div className="space-y-4">
        {docs.length === 0 ? (
          <div className="text-center py-8">
            <FileText size={32} className="mx-auto text-[var(--muted-foreground)]/50 mb-3" />
            <p className="text-[13px] text-[var(--muted-foreground)]">No documents uploaded</p>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
              The merchant has not submitted any verification documents yet.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-[var(--muted-foreground)]" style={{ fontWeight: 600 }}>
                {docs.length} document{docs.length !== 1 ? 's' : ''} on file
              </p>
              {!canDoEdit && <RoleBadge label="View only" />}
            </div>
            {docs.map(([key, url]) => (
              <div
                key={key}
                className="flex items-center justify-between p-3 bg-[var(--accent)]/50 rounded-lg border border-[var(--border)]"
              >
                <div className="flex items-center gap-3">
                  <FileText size={16} className="text-[var(--muted-foreground)]" />
                  <div>
                    <p className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>
                      {DOC_LABELS[key] || key.replace(/_/g, ' ')}
                    </p>
                    <p className="text-[11px] text-[var(--muted-foreground)] font-mono truncate max-w-[200px]">{url}</p>
                  </div>
                </div>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[12px] text-[var(--primary)] hover:underline"
                  style={{ fontWeight: 500 }}
                >
                  View <ExternalLink size={10} />
                </a>
              </div>
            ))}
          </>
        )}
      </div>
    );
  }

  /* ─── Commission Tab (with inline edit) ────────────────────── */
  function buildCommissionTab(m: ApiMerchant) {
    const isEditing = editMode === 'commission';

    return (
      <div className="space-y-4">
        {/* Header with edit button */}
        <div className="flex items-center justify-between">
          <p className="text-[12px] text-[var(--muted-foreground)]" style={{ fontWeight: 600 }}>Commission & Pricing</p>
          {canEditCommission && !isEditing && (
            <button
              onClick={() => enterCommissionEdit(m)}
              className="flex items-center gap-1 text-[12px] text-[var(--primary)] hover:underline"
              style={{ fontWeight: 500 }}
            >
              <Pencil size={11} /> Edit
            </button>
          )}
          {!canEditCommission && <RoleBadge label="View only" />}
        </div>

        {/* Contracted Rate (always read-only — set at approval/bulk time) */}
        <div className="p-3 bg-[var(--accent)]/50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Percent size={12} className="text-[var(--muted-foreground)]" />
            <p className="text-[12px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Contracted Rate</p>
          </div>
          <p className="text-[20px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>
            {parseFloat(m.contractedCommissionRate) || 0}%
          </p>
          <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">Set during merchant approval</p>
        </div>

        {/* Contract Info */}
        <div className="p-3 bg-[var(--accent)]/30 rounded-lg border border-dashed border-[var(--border)]">
          <div className="flex items-center gap-2 mb-2">
            <FileSignature size={12} className="text-[var(--muted-foreground)]" />
            <p className="text-[12px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Contract Details</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Signed Date</p>
              <p className="text-[12px] text-[var(--foreground)]">
                {m.contractSignedDate ? formatDate(m.contractSignedDate) : 'Not signed'}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Contract Document</p>
              {m.contractDocumentUrl ? (
                <a
                  href={m.contractDocumentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[12px] text-[var(--primary)] hover:underline"
                  style={{ fontWeight: 500 }}
                >
                  <ExternalLink size={10} /> View Contract
                </a>
              ) : (
                <p className="text-[12px] text-[var(--foreground)]">No document</p>
              )}
            </div>
          </div>
        </div>

        {/* Override Rate — editable */}
        {isEditing ? (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border-2 border-amber-300 dark:border-amber-800">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={12} className="text-amber-600 dark:text-amber-400" />
              <p className="text-[12px] text-amber-700 dark:text-amber-300" style={{ fontWeight: 600 }}>Commission Override</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={editCommissionOverride}
                onChange={(e) => setEditCommissionOverride(e.target.value)}
                placeholder="Leave empty to remove override"
                className="flex-1 px-3 py-2 text-[13px] bg-white dark:bg-[var(--card)] border border-amber-300 dark:border-amber-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-400/40 text-[var(--foreground)]"
              />
              <span className="text-[14px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>%</span>
            </div>
            <p className="text-[10px] text-amber-600/70 dark:text-amber-400/60 mt-1.5">
              Set a custom rate for this merchant. Leave empty to use the contracted rate.
            </p>

            {/* Featured toggle */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-amber-200 dark:border-amber-800">
              <button
                onClick={() => setEditFeatured(!editFeatured)}
                className={`relative w-9 h-5 rounded-full transition-colors ${editFeatured ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${editFeatured ? 'translate-x-4' : ''}`} />
              </button>
              <span className="text-[12px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>
                Featured Merchant {editFeatured && <Star size={10} className="inline text-amber-500 fill-amber-500 ml-0.5" />}
              </span>
            </div>

            {/* Save / Cancel */}
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={saveCommissionEdit}
                disabled={editSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
                style={{ fontWeight: 500 }}
              >
                {editSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                {editSaving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] border border-[var(--border)] rounded-lg hover:bg-[var(--accent)] text-[var(--foreground)] transition-colors"
                style={{ fontWeight: 500 }}
              >
                <X size={12} /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {m.commissionRateOverride ? (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign size={12} className="text-amber-600 dark:text-amber-400" />
                  <p className="text-[12px] text-amber-600 dark:text-amber-400" style={{ fontWeight: 500 }}>Override Rate (Active)</p>
                </div>
                <p className="text-[20px] text-amber-700 dark:text-amber-300" style={{ fontWeight: 600 }}>
                  {parseFloat(m.commissionRateOverride)}%
                </p>
                <p className="text-[10px] text-amber-500 mt-0.5">
                  This overrides the contracted rate of {parseFloat(m.contractedCommissionRate)}%
                </p>
              </div>
            ) : (
              <div className="p-3 bg-[var(--accent)]/30 rounded-lg border border-dashed border-[var(--border)]">
                <p className="text-[12px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>No Commission Override</p>
                <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">Using contracted rate</p>
              </div>
            )}

            {/* Featured status */}
            <div className="flex items-center gap-2 p-3 bg-[var(--accent)]/50 rounded-lg">
              <Star size={14} className={m.isFeatured ? 'text-amber-500 fill-amber-500' : 'text-[var(--muted-foreground)]'} />
              <span className="text-[12px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>
                {m.isFeatured ? 'Featured Merchant' : 'Not Featured'}
              </span>
            </div>
          </>
        )}

        {/* Pending Payout */}
        <div className="p-3 bg-[var(--accent)]/50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard size={12} className="text-[var(--muted-foreground)]" />
            <p className="text-[12px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Pending Payout</p>
          </div>
          <p className="text-[16px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>{peso(m.pendingPayout)}</p>
        </div>

        {m.launchBonusEndDate && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900">
            <p className="text-[12px] text-blue-600 dark:text-blue-400 mb-1" style={{ fontWeight: 500 }}>
              Launch Bonus Until
            </p>
            <p className="text-[13px] text-blue-700 dark:text-blue-300">{formatDate(m.launchBonusEndDate)}</p>
            <p className="text-[11px] text-blue-500 mt-1">
              0% commission during the launch bonus period
            </p>
          </div>
        )}

        {/* Inventory overview */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="p-3 bg-[var(--accent)]/50 rounded-lg">
            <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Total Items</p>
            <p className="text-[16px] mt-1 text-[var(--foreground)]" style={{ fontWeight: 600 }}>{m.totalItems}</p>
          </div>
          <div className="p-3 bg-[var(--accent)]/50 rounded-lg">
            <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Active Items</p>
            <p className="text-[16px] mt-1 text-[var(--foreground)]" style={{ fontWeight: 600 }}>{m.activeItems}</p>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Payout Tab (with inline edit) ────────────────────────── */
  function buildPayoutTab(m: ApiMerchant) {
    const hasBankInfo = m.bankName || m.accountNumber;
    const hasGcash = m.gcashNumber;
    const isEditing = editMode === 'payout';

    return (
      <div className="space-y-4">
        {/* Header with edit button */}
        <div className="flex items-center justify-between">
          <p className="text-[12px] text-[var(--muted-foreground)]" style={{ fontWeight: 600 }}>Payout Details</p>
          {canEditPayout && !isEditing && (
            <button
              onClick={() => enterPayoutEdit(m)}
              className="flex items-center gap-1 text-[12px] text-[var(--primary)] hover:underline"
              style={{ fontWeight: 500 }}
            >
              <Pencil size={11} /> Edit
            </button>
          )}
          {!canEditPayout && <RoleBadge label="View only" />}
        </div>

        {isEditing ? (
          <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border-2 border-blue-300 dark:border-blue-800">
            <p className="text-[12px] text-blue-700 dark:text-blue-300" style={{ fontWeight: 600 }}>Edit Bank & GCash Details</p>

            {/* Bank fields */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Bank Name</label>
                <input
                  type="text"
                  value={editBankName}
                  onChange={(e) => setEditBankName(e.target.value)}
                  placeholder="e.g. BDO, BPI, UnionBank"
                  className="w-full px-3 py-2 text-[13px] bg-white dark:bg-[var(--card)] border border-blue-300 dark:border-blue-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-400/40 text-[var(--foreground)]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Account Number</label>
                <input
                  type="text"
                  value={editAccountNumber}
                  onChange={(e) => setEditAccountNumber(e.target.value)}
                  placeholder="Bank account number"
                  className="w-full px-3 py-2 text-[13px] font-mono bg-white dark:bg-[var(--card)] border border-blue-300 dark:border-blue-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-400/40 text-[var(--foreground)]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Account Name</label>
                <input
                  type="text"
                  value={editAccountName}
                  onChange={(e) => setEditAccountName(e.target.value)}
                  placeholder="Account holder name"
                  className="w-full px-3 py-2 text-[13px] bg-white dark:bg-[var(--card)] border border-blue-300 dark:border-blue-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-400/40 text-[var(--foreground)]"
                />
              </div>
              <div className="pt-2 border-t border-blue-200 dark:border-blue-800">
                <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>GCash Number</label>
                <input
                  type="text"
                  value={editGcashNumber}
                  onChange={(e) => setEditGcashNumber(e.target.value)}
                  placeholder="09XX XXX XXXX"
                  className="w-full px-3 py-2 text-[13px] font-mono bg-white dark:bg-[var(--card)] border border-blue-300 dark:border-blue-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-400/40 text-[var(--foreground)]"
                />
              </div>
            </div>

            {/* Save / Cancel */}
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={savePayoutEdit}
                disabled={editSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                style={{ fontWeight: 500 }}
              >
                {editSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                {editSaving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] border border-[var(--border)] rounded-lg hover:bg-[var(--accent)] text-[var(--foreground)] transition-colors"
                style={{ fontWeight: 500 }}
              >
                <X size={12} /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Bank Details */}
            <div>
              <p className="text-[12px] text-[var(--muted-foreground)] mb-2" style={{ fontWeight: 600 }}>Bank Details</p>
              {hasBankInfo ? (
                <div className="p-4 bg-[var(--accent)]/50 rounded-lg space-y-3">
                  {[
                    { label: 'Bank Name', value: m.bankName },
                    { label: 'Account Number', value: m.accountNumber },
                    { label: 'Account Name', value: m.accountName },
                  ].map(item => (
                    <div key={item.label}>
                      <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>{item.label}</p>
                      <p className="text-[13px] text-[var(--foreground)] font-mono">{item.value || 'N/A'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-[12px] text-amber-600 dark:text-amber-400" style={{ fontWeight: 500 }}>
                    No bank details provided
                  </p>
                  <p className="text-[11px] text-amber-500 mt-0.5">
                    Merchant has not submitted bank account information for payouts.
                  </p>
                </div>
              )}
            </div>

            {/* GCash */}
            <div>
              <p className="text-[12px] text-[var(--muted-foreground)] mb-2" style={{ fontWeight: 600 }}>GCash</p>
              {hasGcash ? (
                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900">
                  <p className="text-[11px] text-blue-600 dark:text-blue-400" style={{ fontWeight: 500 }}>GCash Number</p>
                  <p className="text-[14px] text-blue-700 dark:text-blue-300 font-mono" style={{ fontWeight: 600 }}>
                    {m.gcashNumber}
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-[var(--accent)]/50 rounded-lg">
                  <p className="text-[12px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>
                    No GCash number on file
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Payout summary (always visible) */}
        <div>
          <p className="text-[12px] text-[var(--muted-foreground)] mb-2" style={{ fontWeight: 600 }}>Payout Summary</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-900">
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400" style={{ fontWeight: 500 }}>Total Revenue</p>
              <p className="text-[16px] mt-1 text-emerald-700 dark:text-emerald-300" style={{ fontWeight: 600 }}>
                {peso(m.totalRevenue)}
              </p>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900">
              <p className="text-[11px] text-amber-600 dark:text-amber-400" style={{ fontWeight: 500 }}>Pending Payout</p>
              <p className="text-[16px] mt-1 text-amber-700 dark:text-amber-300" style={{ fontWeight: 600 }}>
                {peso(m.pendingPayout)}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Rentals Tab ───────────────────────────────────────────── */
  function buildRentalsTab(m: ApiMerchant) {
    // Group templates by category
    const categoryMap = new Map<string, RentalTemplate[]>();
    for (const t of merchantTemplates) {
      const catName = (t as any).categoryName || 'Uncategorized';
      if (!categoryMap.has(catName)) categoryMap.set(catName, []);
      categoryMap.get(catName)!.push(t);
    }

    // Build parent→children tree from categories
    const parentCategories = rentalCategories.filter(c => !c.parentCategoryId);
    const childCategories = rentalCategories.filter(c => c.parentCategoryId);

    // Only leaf categories (children) or parentless categories are selectable for templates
    const leafCategories = childCategories.length > 0 ? childCategories : parentCategories;

    return (
      <div className="space-y-4">
        {/* Inventory summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-[var(--accent)]/50 rounded-lg">
            <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Total Items</p>
            <p className="text-[18px] mt-1 text-[var(--foreground)]" style={{ fontWeight: 600 }}>{m.totalItems}</p>
          </div>
          <div className="p-3 bg-[var(--accent)]/50 rounded-lg">
            <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Active Items</p>
            <p className="text-[18px] mt-1 text-[var(--foreground)]" style={{ fontWeight: 600 }}>{m.activeItems}</p>
          </div>
        </div>

        {/* Templates header with Create button */}
        <div className="flex items-center justify-between">
          <p className="text-[12px] text-[var(--muted-foreground)]" style={{ fontWeight: 600 }}>
            <Package size={12} className="inline mr-1" />Rental Templates ({merchantTemplates.length})
          </p>
          {canDoEdit && m.verificationStatus === 'APPROVED' && (
            <button
              onClick={openCreateTemplate}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              style={{ fontWeight: 500 }}
            >
              <Plus size={12} /> Create Template
            </button>
          )}
        </div>

        {/* Templates list */}
        {templatesLoading ? (
          <div className="flex items-center gap-2 py-4 text-[var(--muted-foreground)]">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-[12px]">Loading templates…</span>
          </div>
        ) : merchantTemplates.length === 0 ? (
          <div className="text-center py-6 bg-[var(--accent)]/30 rounded-lg border border-dashed border-[var(--border)]">
            <Package size={24} className="mx-auto text-[var(--muted-foreground)]/40 mb-2" />
            <p className="text-[12px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>No rental templates</p>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
              {canDoEdit && m.verificationStatus === 'APPROVED'
                ? 'Click "Create Template" to add the first listing.'
                : 'This merchant has not created any rental listings yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {[...categoryMap.entries()].map(([catName, templates]) => (
              <div key={catName} className="border border-[var(--border)] rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-[var(--accent)]/50 border-b border-[var(--border)]">
                  <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 600 }}>
                    {catName} ({templates.length})
                  </p>
                </div>
                <div className="divide-y divide-[var(--border)]">
                  {templates.map(t => (
                    <div key={t.id}>
                      {/* Template row — clickable to expand units */}
                      <div
                        className="px-3 py-2 flex items-center justify-between gap-2 cursor-pointer hover:bg-[var(--accent)]/30 transition-colors"
                        onClick={() => loadTemplateUnits(t.id)}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {expandedTemplateId === t.id
                            ? <ChevronDown size={12} className="text-[var(--muted-foreground)] shrink-0" />
                            : <ChevronRight size={12} className="text-[var(--muted-foreground)] shrink-0" />
                          }
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] text-[var(--foreground)] truncate" style={{ fontWeight: 500 }}>{t.name}</p>
                            {t.description && (
                              <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5 line-clamp-1">{t.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                          <span className="text-[12px] text-[var(--foreground)] font-mono" style={{ fontWeight: 500 }}>
                            {peso(t.baseDailyRate)}/day
                          </span>
                          {canDoEdit && (
                            <>
                              <button
                                onClick={() => handleToggleTemplate(t.id, t.isActive)}
                                className="p-1 rounded hover:bg-[var(--accent)] transition-colors"
                                title={t.isActive ? 'Deactivate' : 'Activate'}
                              >
                                {t.isActive
                                  ? <ToggleRight size={14} className="text-emerald-500" />
                                  : <ToggleLeft size={14} className="text-gray-400" />
                                }
                              </button>
                              <button
                                onClick={() => handleDeleteTemplate(t.id, t.name)}
                                className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                                title="Delete template"
                              >
                                <Trash2 size={12} className="text-red-400" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Expanded units section */}
                      {expandedTemplateId === t.id && (
                        <div className="bg-[var(--accent)]/20 border-t border-[var(--border)] px-3 py-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 600 }}>
                              <Wrench size={10} className="inline mr-1" />Units ({templateUnits.length})
                            </p>
                            {canDoEdit && m.verificationStatus === 'APPROVED' && (
                              <button
                                onClick={() => openCreateUnit(t.id, t)}
                                className="flex items-center gap-1 px-2 py-1 text-[10px] bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                                style={{ fontWeight: 500 }}
                              >
                                <Plus size={10} /> Add Unit
                              </button>
                            )}
                          </div>

                          {unitsLoading ? (
                            <div className="flex items-center gap-2 py-3 text-[var(--muted-foreground)]">
                              <Loader2 size={12} className="animate-spin" />
                              <span className="text-[11px]">Loading units…</span>
                            </div>
                          ) : templateUnits.length === 0 ? (
                            <div className="text-center py-4 border border-dashed border-[var(--border)] rounded-lg">
                              <Wrench size={18} className="mx-auto text-[var(--muted-foreground)]/40 mb-1" />
                              <p className="text-[11px] text-[var(--muted-foreground)]">No units yet. Add physical inventory for this template.</p>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {templateUnits.map(u => (
                                <div key={u.id} className="flex items-center justify-between gap-2 p-2 bg-[var(--card)] rounded-lg border border-[var(--border)]">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <p className="text-[12px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>
                                        #{u.unitNumber}
                                      </p>
                                      {u.unitName && (
                                        <span className="text-[10px] text-[var(--muted-foreground)]">— {u.unitName}</span>
                                      )}
                                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                                        u.isAvailable
                                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                          : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400'
                                      }`} style={{ fontWeight: 600 }}>
                                        {u.isAvailable ? 'AVAILABLE' : u.availabilityStatus}
                                      </span>
                                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                                        u.condition === 'EXCELLENT' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                          : u.condition === 'GOOD' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                                      }`} style={{ fontWeight: 500 }}>
                                        {u.condition}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 text-[10px] text-[var(--muted-foreground)]">
                                      <span>{peso(u.dailyRate)}/day</span>
                                      <span>Deposit: {peso(u.depositAmount)}</span>
                                      {u.color && <span>Color: {u.color}</span>}
                                      {u.plateNumber && <span>Plate: {u.plateNumber}</span>}
                                      {u.totalBookings > 0 && <span>{u.totalBookings} bookings</span>}
                                    </div>
                                  </div>
                                  {canDoEdit && (
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        onClick={() => handleToggleUnit(u.id, u.isAvailable)}
                                        className="p-1 rounded hover:bg-[var(--accent)] transition-colors"
                                        title={u.isAvailable ? 'Mark unavailable' : 'Mark available'}
                                      >
                                        {u.isAvailable
                                          ? <ToggleRight size={14} className="text-emerald-500" />
                                          : <ToggleLeft size={14} className="text-gray-400" />
                                        }
                                      </button>
                                      <button
                                        onClick={() => handleDeleteUnit(u.id, u.unitNumber)}
                                        className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                                        title="Delete unit"
                                      >
                                        <Trash2 size={12} className="text-red-400" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Available Categories */}
        <div>
          <p className="text-[12px] text-[var(--muted-foreground)] mb-2" style={{ fontWeight: 600 }}>
            Available Rental Categories ({rentalCategories.length})
          </p>
          {parentCategories.length === 0 ? (
            <p className="text-[11px] text-[var(--muted-foreground)]">No categories configured.</p>
          ) : (
            <div className="space-y-2">
              {parentCategories.map(parent => {
                const children = childCategories.filter(c => c.parentCategoryId === parent.id);
                return (
                  <div key={parent.id} className="p-3 bg-[var(--accent)]/30 rounded-lg">
                    <p className="text-[12px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>{parent.name}</p>
                    {parent.description && (
                      <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{parent.description}</p>
                    )}
                    {children.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {children.map(child => (
                          <span
                            key={child.id}
                            className="text-[10px] px-2 py-0.5 bg-[var(--card)] border border-[var(--border)] rounded-full text-[var(--muted-foreground)]"
                            style={{ fontWeight: 500 }}
                          >
                            {child.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Build drawer tabs ─────────────────────────────────────── */
  const drawerTabs = selected ? [
    { id: 'overview', label: 'Overview', content: buildOverviewTab(selected) },
    { id: 'documents', label: 'Documents', content: buildDocumentsTab(selected) },
    { id: 'commission', label: 'Commission', content: buildCommissionTab(selected) },
    { id: 'rentals', label: 'Rentals', content: buildRentalsTab(selected) },
    { id: 'payout', label: 'Payout', content: buildPayoutTab(selected) },
    ...(selected.verificationStatus === 'APPROVED' ? [
      { id: 'bookings', label: 'Bookings', content: <BookingsTab merchant={selected} canEdit={canDoEdit} /> },
      { id: 'promos', label: 'Promos', content: <PromoCodesTab merchant={selected} canEdit={canDoEdit} /> },
      { id: 'extensions', label: 'Extensions', content: <ExtensionsTab merchant={selected} canEdit={canDoEdit} /> },
      { id: 'damage', label: 'Damage', content: <DamageReportsTab merchant={selected} canEdit={canDoEdit} /> },
    ] : []),
  ] : undefined;

  /* ── Drawer actions based on merchant state + role ──────────── */
  function buildDrawerActions(m: ApiMerchant) {
    // Show nothing if user can't approve OR edit
    if (!canDoApprove && !canDoEdit) return undefined;

    return (
      <div className="flex items-center gap-2 w-full">
        {canDoApprove && m.verificationStatus === 'PENDING' && (
          <>
            <button
              onClick={() => { setActionModal({ type: 'approve', target: m }); setActionNotes(''); }}
              className="flex-1 py-2 text-[13px] bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5"
              style={{ fontWeight: 500 }}
            >
              <CheckCircle size={14} /> Approve
            </button>
            <button
              onClick={() => { setActionModal({ type: 'reject', target: m }); setActionNotes(''); }}
              className="flex-1 py-2 text-[13px] border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors flex items-center justify-center gap-1.5"
              style={{ fontWeight: 500 }}
            >
              <XCircle size={14} /> Reject
            </button>
          </>
        )}
        {canDoEdit && m.verificationStatus === 'APPROVED' && m.isActive && (
          <button
            onClick={() => { setActionModal({ type: 'suspend', target: m }); setActionNotes(''); }}
            className="py-2 px-4 text-[13px] border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors flex items-center gap-1.5"
            style={{ fontWeight: 500 }}
          >
            <Ban size={14} /> Suspend Merchant
          </button>
        )}
        {canDoEdit && m.verificationStatus === 'APPROVED' && !m.isActive && (
          <button
            onClick={() => { setActionModal({ type: 'reactivate', target: m }); setActionNotes(''); }}
            className="py-2 px-4 text-[13px] bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
            style={{ fontWeight: 500 }}
          >
            <Play size={14} /> Reactivate Merchant
          </button>
        )}
      </div>
    );
  }

  /* ── Action modal config ───────────────────────────────────── */
  const ACTION_CONFIG: Record<string, { title: string; message: string; confirmLabel: string; variant: 'danger' | 'default' }> = {
    approve: {
      title: 'Approve Merchant',
      message: `Approve ${actionModal?.target?.businessName}? This will create a POI and allow them to receive orders immediately.`,
      confirmLabel: 'Approve',
      variant: 'default',
    },
    reject: {
      title: 'Reject Application',
      message: `Reject ${actionModal?.target?.businessName}? Provide a reason below so the merchant knows why.`,
      confirmLabel: 'Reject',
      variant: 'danger',
    },
    suspend: {
      title: 'Suspend Merchant',
      message: `Suspend ${actionModal?.target?.businessName}? They will not be able to receive orders. Their POI will also be deactivated.`,
      confirmLabel: 'Suspend',
      variant: 'danger',
    },
    reactivate: {
      title: 'Reactivate Merchant',
      message: `Reactivate ${actionModal?.target?.businessName}? They will start receiving orders again.`,
      confirmLabel: 'Reactivate',
      variant: 'default',
    },
  };

  const modalConfig = actionModal ? ACTION_CONFIG[actionModal.type] : null;

  /* ── Render ────────────────────────────────────────────────── */
  const activeRefetch = activeTab === 'all' ? refetch : refetchPending;
  const activeError = activeTab === 'all' ? error : pendingError;
  const activeLoading = activeTab === 'all' ? isLoading : pendingLoading;
  const activeData = activeTab === 'all' ? data : pendingList;

  return (
    <div className="p-6">
      {/* Header */}
      <PageHeader
        title="Merchants"
        description={
          activeTab === 'all'
            ? `${total} total merchants`
            : `${pendingMerchants.length} pending applications`
        }
        actions={
          <div className="flex items-center gap-2">
            {/* Role indicator */}
            {role && (
              <span className="text-[11px] text-[var(--muted-foreground)] bg-[var(--accent)] px-2 py-1 rounded" style={{ fontWeight: 500 }}>
                {canDoEdit ? '✏️ Can edit' : canDoApprove ? '✅ Can approve' : '👁 View only'}
              </span>
            )}
            <button
              onClick={() => activeRefetch()}
              className="flex items-center gap-2 px-3 py-2 text-[13px] bg-[var(--card)] border border-[var(--border)] rounded-lg hover:bg-[var(--accent)] transition-colors text-[var(--foreground)]"
              style={{ fontWeight: 500 }}
            >
              <RefreshCw size={14} aria-hidden="true" />
              Refresh
            </button>
          </div>
        }
      />

      {/* ── Tabs: All Merchants / Onboarding ─────────────────── */}
      <div className="flex gap-1 mb-4 p-1 bg-[var(--accent)] rounded-lg w-fit">
        {([
          { key: 'all' as const, label: 'All Merchants', icon: Store },
          { key: 'onboarding' as const, label: 'Onboarding', icon: Clock },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setPage(1); setSearch(''); setStatusFilter('all'); setMunicipalityFilter('all'); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[13px] rounded-md transition-colors ${
              activeTab === tab.key
                ? 'bg-[var(--card)] shadow-sm text-[var(--foreground)]'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
            style={{ fontWeight: 500 }}
          >
            <tab.icon size={14} />
            {tab.label}
            {tab.key === 'onboarding' && pendingMerchants.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-full" style={{ fontWeight: 600 }}>
                {pendingMerchants.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Filters (only for All Merchants tab) ─────────────── */}
      {activeTab === 'all' && (
        <FilterBar
          searchPlaceholder="Search by name, email, or phone..."
          searchValue={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          filters={[
            {
              key: 'status',
              label: 'Status',
              options: [
                { label: 'Active', value: 'active' },
                { label: 'Pending', value: 'pending' },
                { label: 'Suspended', value: 'suspended' },
                { label: 'Rejected', value: 'rejected' },
              ],
              value: statusFilter,
              onChange: (v) => { setStatusFilter(v); setPage(1); },
            },
            ...(municipalities.length > 0 ? [{
              key: 'municipality',
              label: 'Municipality',
              options: municipalities.map(m => ({ label: m, value: m })),
              value: municipalityFilter,
              onChange: (v: string) => { setMunicipalityFilter(v); setPage(1); },
            }] : []),
          ]}
        />
      )}

      {/* ── Error state ──────────────────────────────────────── */}
      {activeError && (
        <div className="mt-4 flex items-center gap-2 p-4 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900">
          <AlertCircle size={16} />
          <span className="text-[13px]">{activeError}</span>
          <button onClick={() => activeRefetch()} className="ml-auto text-[13px] underline" style={{ fontWeight: 500 }}>Retry</button>
        </div>
      )}

      {/* ── Loading state ────────────────────────────────────── */}
      {activeLoading && !activeData && (
        <div className="mt-8 flex items-center justify-center gap-2 text-[var(--muted-foreground)]">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-[13px]">Loading merchants…</span>
        </div>
      )}

      {/* ── All Merchants table ──────────────────────────────── */}
      {activeTab === 'all' && (!activeLoading || data) && (
        <div className="mt-4">
          <DataTable
            data={allMerchants}
            columns={columns}
            keyExtractor={(m) => String(m.id)}
            onRowClick={(m) => setSelected(m)}
            pageSize={20}
            emptyTitle="No merchants found"
            emptyMessage="Try adjusting your filters."
            rowActions={(m) => (
              <div className="flex items-center justify-center gap-1">
                <button
                  onClick={() => setSelected(m)}
                  className="p-1.5 rounded-md hover:bg-[var(--accent)]"
                  aria-label={`View ${m.businessName}`}
                >
                  <Eye size={14} className="text-[var(--muted-foreground)]" />
                </button>
                {canDoApprove && m.verificationStatus === 'PENDING' && (
                  <>
                    <button
                      onClick={() => { setActionModal({ type: 'approve', target: m }); setActionNotes(''); }}
                      className="p-1.5 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950"
                      aria-label={`Approve ${m.businessName}`}
                    >
                      <CheckCircle size={14} className="text-emerald-600" />
                    </button>
                    <button
                      onClick={() => { setActionModal({ type: 'reject', target: m }); setActionNotes(''); }}
                      className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950"
                      aria-label={`Reject ${m.businessName}`}
                    >
                      <XCircle size={14} className="text-red-600" />
                    </button>
                  </>
                )}
              </div>
            )}
          />
        </div>
      )}

      {/* ── Onboarding queue ─────────────────────────────────── */}
      {activeTab === 'onboarding' && (!pendingLoading || pendingList) && (
        <div className="mt-4">
          {pendingMerchants.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-4">
                <CheckCircle size={28} className="text-emerald-500" />
              </div>
              <h3 className="text-[15px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>All caught up!</h3>
              <p className="text-[13px] text-[var(--muted-foreground)] mt-1">
                No pending merchant applications to review.
              </p>
            </div>
          ) : (
            <DataTable
              data={pendingMerchants}
              columns={onboardingColumns}
              keyExtractor={(m) => String(m.id)}
              onRowClick={(m) => setSelected(m)}
              pageSize={50}
              emptyTitle="No pending merchants"
              emptyMessage=""
              rowActions={(m) => (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSelected(m)}
                    className="p-1.5 rounded-md hover:bg-[var(--accent)]"
                    aria-label={`Review ${m.businessName}`}
                  >
                    <Eye size={14} className="text-[var(--muted-foreground)]" />
                  </button>
                  {canDoApprove && (
                    <>
                      <button
                        onClick={() => { setActionModal({ type: 'approve', target: m }); setActionNotes(''); }}
                        className="p-1.5 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950"
                        aria-label={`Approve ${m.businessName}`}
                      >
                        <CheckCircle size={14} className="text-emerald-600" />
                      </button>
                      <button
                        onClick={() => { setActionModal({ type: 'reject', target: m }); setActionNotes(''); }}
                        className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950"
                        aria-label={`Reject ${m.businessName}`}
                      >
                        <XCircle size={14} className="text-red-600" />
                      </button>
                    </>
                  )}
                </div>
              )}
            />
          )}
        </div>
      )}

      {/* ── Detail Drawer ────────────────────────────────────── */}
      <DetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.businessName || 'Merchant'}
        subtitle={selected ? `${selected.publicId} · ${selected.municipality || ''}` : ''}
        width="520px"
        tabs={drawerTabs}
        actions={selected ? buildDrawerActions(selected) : undefined}
      />

      {/* ── Action Modal (with notes input) ──────────────────── */}
      {actionModal && modalConfig && (
        <>
          <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-50" onClick={() => setActionModal(null)} aria-hidden="true" />
          <div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[460px] bg-[var(--card)] rounded-2xl shadow-2xl z-50 overflow-hidden"
            role="alertdialog"
            aria-modal="true"
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  modalConfig.variant === 'danger'
                    ? 'bg-red-50 dark:bg-red-950'
                    : 'bg-emerald-50 dark:bg-emerald-950'
                }`}>
                  {modalConfig.variant === 'danger'
                    ? <AlertCircle size={18} className="text-red-600 dark:text-red-400" />
                    : <CheckCircle size={18} className="text-emerald-600 dark:text-emerald-400" />
                  }
                </div>
                <div className="flex-1">
                  <h3 className="text-[15px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>
                    {modalConfig.title}
                  </h3>
                  <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5 font-mono">
                    {actionModal.target.publicId}
                  </p>
                  <p className="text-[13px] text-[var(--muted-foreground)] mt-2" style={{ lineHeight: 1.6 }}>
                    {modalConfig.message}
                  </p>

                  {/* Notes textarea */}
                  <div className="mt-4">
                    <label htmlFor="action-notes" className="block text-[12px] text-[var(--muted-foreground)] mb-1.5" style={{ fontWeight: 500 }}>
                      {actionModal.type === 'approve' ? 'Approval Notes' : 'Reason / Notes'} *
                    </label>
                    <textarea
                      id="action-notes"
                      value={actionNotes}
                      onChange={(e) => setActionNotes(e.target.value)}
                      placeholder={
                        actionModal.type === 'approve'
                          ? 'e.g. Documents verified, all requirements met'
                          : actionModal.type === 'reject'
                          ? 'e.g. Missing business permit, incomplete registration'
                          : actionModal.type === 'suspend'
                          ? 'e.g. Multiple customer complaints, policy violation'
                          : 'e.g. Issue resolved, merchant reinstated'
                      }
                      rows={3}
                      className="w-full px-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)] resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 bg-[var(--accent)]/50 border-t border-[var(--border)]">
              <button
                onClick={() => { setActionModal(null); setActionNotes(''); }}
                className="px-4 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] transition-colors text-[var(--foreground)]"
                style={{ fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                onClick={executeAction}
                disabled={actionLoading || !actionNotes.trim()}
                className={`px-4 py-2 text-[13px] rounded-lg text-white transition-colors disabled:opacity-50 flex items-center gap-1.5 ${
                  modalConfig.variant === 'danger'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
                style={{ fontWeight: 500 }}
              >
                {actionLoading && <Loader2 size={14} className="animate-spin" />}
                {actionLoading ? 'Processing...' : modalConfig.confirmLabel}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Create Template Modal ────────────────────────────── */}
      {templateModal && selected && (
        <>
          <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-50" onClick={() => setTemplateModal(false)} aria-hidden="true" />
          <div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] max-h-[85vh] bg-[var(--card)] rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col"
            role="dialog"
            aria-modal="true"
          >
            <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <h3 className="text-[15px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>
                  Create Rental Template
                </h3>
                <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                  For {selected.businessName}
                </p>
              </div>
              <button onClick={() => setTemplateModal(false)} className="p-1.5 rounded-lg hover:bg-[var(--accent)]">
                <X size={16} className="text-[var(--muted-foreground)]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Template Name */}
              <div>
                <label className="block text-[12px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>
                  Template Name *
                </label>
                <input
                  type="text"
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  placeholder="e.g. Honda Click 125 — Daily Rental"
                  className="w-full px-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-[12px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>
                  Category *
                </label>
                <select
                  value={tplCategoryId}
                  onChange={(e) => setTplCategoryId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]"
                >
                  <option value="">Select a category…</option>
                  {rentalCategories
                    .filter(c => !c.parentCategoryId)
                    .map(parent => {
                      const children = rentalCategories.filter(c => c.parentCategoryId === parent.id);
                      if (children.length === 0) {
                        return (
                          <option key={parent.id} value={parent.id}>
                            {parent.name}
                          </option>
                        );
                      }
                      return (
                        <optgroup key={parent.id} label={parent.name}>
                          {children.map(child => (
                            <option key={child.id} value={child.id}>
                              {child.name}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[12px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>
                  Description * <span className="text-[10px]">(min 10 chars)</span>
                </label>
                <textarea
                  value={tplDescription}
                  onChange={(e) => setTplDescription(e.target.value)}
                  placeholder="Describe the rental item, condition, what's included…"
                  rows={3}
                  className="w-full px-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)] resize-none"
                />
              </div>

              {/* Pricing */}
              <div>
                <label className="block text-[12px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>
                  Pricing (PHP)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-[var(--muted-foreground)] mb-0.5">Daily Rate *</label>
                    <input
                      type="number"
                      value={tplDailyRate}
                      onChange={(e) => setTplDailyRate(e.target.value)}
                      placeholder="500"
                      min="1"
                      className="w-full px-2.5 py-1.5 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[var(--muted-foreground)] mb-0.5">Weekly Rate</label>
                    <input
                      type="number"
                      value={tplWeeklyRate}
                      onChange={(e) => setTplWeeklyRate(e.target.value)}
                      placeholder="3000"
                      min="1"
                      className="w-full px-2.5 py-1.5 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[var(--muted-foreground)] mb-0.5">Monthly Rate</label>
                    <input
                      type="number"
                      value={tplMonthlyRate}
                      onChange={(e) => setTplMonthlyRate(e.target.value)}
                      placeholder="10000"
                      min="1"
                      className="w-full px-2.5 py-1.5 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]"
                    />
                  </div>
                </div>
              </div>

              {/* Features */}
              <div>
                <label className="block text-[12px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>
                  Features <span className="text-[10px]">(comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={tplFeatures}
                  onChange={(e) => setTplFeatures(e.target.value)}
                  placeholder="e.g. Automatic, Helmet included, USB charging"
                  className="w-full px-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]"
                />
              </div>

              {/* Cancellation Policy */}
              <div>
                <label className="block text-[12px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>
                  Cancellation Policy
                </label>
                <textarea
                  value={tplCancellationPolicy}
                  onChange={(e) => setTplCancellationPolicy(e.target.value)}
                  placeholder="e.g. Free cancellation up to 24h before pickup"
                  rows={2}
                  className="w-full px-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)] resize-none"
                />
              </div>

              {/* Photos */}
              <div>
                <label className="block text-[12px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>
                  Photos <span className="text-[10px]">(up to 10 images)</span>
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tplPhotos.map((p, i) => (
                    <div key={i} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-[var(--border)]">
                      <img src={p.preview} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          URL.revokeObjectURL(p.preview);
                          setTplPhotos(prev => prev.filter((_, idx) => idx !== i));
                        }}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <X size={14} className="text-white" />
                      </button>
                      {i === 0 && (
                        <span className="absolute bottom-0 left-0 right-0 bg-emerald-600 text-white text-[8px] text-center py-0.5">Main</span>
                      )}
                    </div>
                  ))}
                  {tplPhotos.length < 10 && (
                    <label className="w-16 h-16 rounded-lg border-2 border-dashed border-[var(--border)] hover:border-[var(--ring)] flex flex-col items-center justify-center cursor-pointer transition-colors">
                      <Upload size={14} className="text-[var(--muted-foreground)]" />
                      <span className="text-[8px] text-[var(--muted-foreground)] mt-0.5">Add</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          const remaining = 10 - tplPhotos.length;
                          const toAdd = files.slice(0, remaining).map(file => ({
                            file,
                            preview: URL.createObjectURL(file),
                          }));
                          setTplPhotos(prev => [...prev, ...toAdd]);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>
                {tplPhotos.length > 0 && (
                  <p className="text-[10px] text-[var(--muted-foreground)]">First image = main photo. Drag-to-reorder coming soon.</p>
                )}
              </div>
            </div>

            {/* Validation hints */}
            {(() => {
              const missing: string[] = [];
              if (!tplName.trim()) missing.push('Name');
              if (!tplCategoryId) missing.push('Category');
              if (tplDescription.trim().length < 10) missing.push(`Description (${tplDescription.trim().length}/10 chars)`);
              if (!tplDailyRate) missing.push('Daily Rate');
              if (missing.length > 0) return (
                <div className="px-6 py-2 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-200 dark:border-amber-900/50">
                  ⚠️ Required: {missing.join(' · ')}
                </div>
              );
              return null;
            })()}

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 bg-[var(--accent)]/50 border-t border-[var(--border)]">
              <button
                onClick={() => setTemplateModal(false)}
                className="px-4 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] transition-colors text-[var(--foreground)]"
                style={{ fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTemplate}
                disabled={templateSaving || !tplName.trim() || !tplCategoryId || tplDescription.trim().length < 10 || !tplDailyRate}
                className="px-4 py-2 text-[13px] rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                style={{ fontWeight: 500 }}
              >
                {(templateSaving || tplUploading) && <Loader2 size={14} className="animate-spin" />}
                {tplUploading ? 'Uploading photos…' : templateSaving ? 'Creating…' : 'Create Template'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Create Unit Modal ────────────────────────────────── */}
      {unitModal && selected && (
        <>
          <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-50" onClick={() => setUnitModal(false)} aria-hidden="true" />
          <div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] max-h-[85vh] bg-[var(--card)] rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col"
            role="dialog" aria-modal="true"
          >
            <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <h3 className="text-[15px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>Add Rental Unit</h3>
                <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">Physical inventory for {selected.businessName}</p>
              </div>
              <button onClick={() => setUnitModal(false)} className="p-1.5 rounded-lg hover:bg-[var(--accent)]">
                <X size={16} className="text-[var(--muted-foreground)]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Unit Identity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Unit Number *</label>
                  <input type="text" value={uNumber} onChange={e => setUNumber(e.target.value)} placeholder="e.g. MC-001"
                    className="w-full px-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]" />
                </div>
                <div>
                  <label className="block text-[12px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Unit Name</label>
                  <input type="text" value={uName} onChange={e => setUName(e.target.value)} placeholder="e.g. Red Honda Click"
                    className="w-full px-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]" />
                </div>
              </div>

              {/* Vehicle Details */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[12px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Plate Number</label>
                  <input type="text" value={uPlate} onChange={e => setUPlate(e.target.value)} placeholder="ABC-1234"
                    className="w-full px-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]" />
                </div>
                <div>
                  <label className="block text-[12px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Color</label>
                  <input type="text" value={uColor} onChange={e => setUColor(e.target.value)} placeholder="Red"
                    className="w-full px-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]" />
                </div>
                <div>
                  <label className="block text-[12px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Year</label>
                  <input type="number" value={uYear} onChange={e => setUYear(e.target.value)} placeholder="2024" min="1990" max="2030"
                    className="w-full px-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Serial Number</label>
                  <input type="text" value={uSerial} onChange={e => setUSerial(e.target.value)} placeholder="VIN / Serial"
                    className="w-full px-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]" />
                </div>
                <div>
                  <label className="block text-[12px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Condition *</label>
                  <select value={uCondition} onChange={e => setUCondition(e.target.value as any)}
                    className="w-full px-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]">
                    <option value="EXCELLENT">Excellent</option>
                    <option value="GOOD">Good</option>
                    <option value="FAIR">Fair</option>
                  </select>
                </div>
              </div>

              {/* Pricing */}
              <div>
                <label className="block text-[12px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Pricing (PHP)</label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-[var(--muted-foreground)] mb-0.5">Daily Rate *</label>
                    <input type="number" value={uDailyRate} onChange={e => setUDailyRate(e.target.value)} placeholder="500" min="1"
                      className="w-full px-2.5 py-1.5 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[var(--muted-foreground)] mb-0.5">Weekly Rate</label>
                    <input type="number" value={uWeeklyRate} onChange={e => setUWeeklyRate(e.target.value)} placeholder="3000" min="1"
                      className="w-full px-2.5 py-1.5 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[var(--muted-foreground)] mb-0.5">Monthly Rate</label>
                    <input type="number" value={uMonthlyRate} onChange={e => setUMonthlyRate(e.target.value)} placeholder="10000" min="1"
                      className="w-full px-2.5 py-1.5 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]" />
                  </div>
                </div>
              </div>

              {/* Deposit & Replacement */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Deposit Amount (PHP) *</label>
                  <input type="number" value={uDeposit} onChange={e => setUDeposit(e.target.value)} placeholder="2000" min="0"
                    className="w-full px-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]" />
                </div>
                <div>
                  <label className="block text-[12px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Replacement Value (PHP) *</label>
                  <input type="number" value={uReplacement} onChange={e => setUReplacement(e.target.value)} placeholder="80000" min="1"
                    className="w-full px-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]" />
                </div>
              </div>

              {/* Unit Photos */}
              <div>
                <label className="block text-[12px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>
                  Unit Photos <span className="text-[10px]">(up to 10 images)</span>
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {uPhotos.map((p, i) => (
                    <div key={i} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-[var(--border)]">
                      <img src={p.preview} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          URL.revokeObjectURL(p.preview);
                          setUPhotos(prev => prev.filter((_, idx) => idx !== i));
                        }}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <X size={14} className="text-white" />
                      </button>
                      {i === 0 && (
                        <span className="absolute bottom-0 left-0 right-0 bg-blue-600 text-white text-[8px] text-center py-0.5">Main</span>
                      )}
                    </div>
                  ))}
                  {uPhotos.length < 10 && (
                    <label className="w-16 h-16 rounded-lg border-2 border-dashed border-[var(--border)] hover:border-[var(--ring)] flex flex-col items-center justify-center cursor-pointer transition-colors">
                      <Upload size={14} className="text-[var(--muted-foreground)]" />
                      <span className="text-[8px] text-[var(--muted-foreground)] mt-0.5">Add</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          const remaining = 10 - uPhotos.length;
                          const toAdd = files.slice(0, remaining).map(file => ({
                            file,
                            preview: URL.createObjectURL(file),
                          }));
                          setUPhotos(prev => [...prev, ...toAdd]);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>
                {uPhotos.length > 0 && (
                  <p className="text-[10px] text-[var(--muted-foreground)]">First image = main photo</p>
                )}
              </div>

              {/* Pickup & Delivery */}
              <div>
                <label className="block text-[12px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Pickup Location</label>
                <div className="w-full px-3 py-2 text-[13px] bg-[var(--accent)]/50 border border-[var(--border)] rounded-lg text-[var(--foreground)]">
                  📍 {selected?.businessAddress || 'No address set'}
                </div>
                <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">Uses merchant's registered business address</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={uDeliveryAvailable} onChange={e => setUDeliveryAvailable(e.target.checked)}
                    className="rounded border-[var(--border)]" />
                  <span className="text-[12px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>Delivery available</span>
                </label>
                {uDeliveryAvailable && (
                  <div className="flex-1">
                    <input type="number" value={uDeliveryFee} onChange={e => setUDeliveryFee(e.target.value)} placeholder="Delivery fee (PHP)" min="0"
                      className="w-full px-2.5 py-1.5 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]" />
                  </div>
                )}
              </div>
            </div>

            {/* Validation hints */}
            {(() => {
              const missing: string[] = [];
              if (!uNumber.trim()) missing.push('Unit Number');
              if (!uDailyRate) missing.push('Daily Rate');
              if (!uDeposit) missing.push('Deposit');
              if (!uReplacement) missing.push('Replacement Value');
              if (missing.length > 0) return (
                <div className="px-6 py-2 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-200 dark:border-amber-900/50">
                  ⚠️ Required: {missing.join(' · ')}
                </div>
              );
              return null;
            })()}

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 bg-[var(--accent)]/50 border-t border-[var(--border)]">
              <button onClick={() => setUnitModal(false)}
                className="px-4 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] transition-colors text-[var(--foreground)]"
                style={{ fontWeight: 500 }}>Cancel</button>
              <button
                onClick={handleCreateUnit}
                disabled={unitSaving || !uNumber.trim() || !uDailyRate || !uDeposit || !uReplacement}
                className="px-4 py-2 text-[13px] rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                style={{ fontWeight: 500 }}
              >
                {(unitSaving || uUploading) && <Loader2 size={14} className="animate-spin" />}
                {uUploading ? 'Uploading photos…' : unitSaving ? 'Creating…' : 'Add Unit'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}