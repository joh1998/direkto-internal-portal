import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { poiApi, type POI, type POIAnchor, type MapMarker, type POIKind, type POIStatus } from '../../../lib/poi-api';

/* ── Types ──────────────────────────────────────── */

export type ConfirmActionType = 'verify' | 'deactivate' | 'reactivate' | 'delete';

export interface ConfirmAction {
  type: ConfirmActionType;
  target: POI;
}

export interface CreatePoiForm {
  id: string;
  name: string;
  displayName: string;
  kind: string;
  type: string;
  address: string;
  barangay: string;
  city: string;
  province: string;
  centerLat: number;
  centerLng: number;
  serviceAreaId: string;
  visibility: 'public' | 'private' | 'ops_only';
  tags: string;
  isIslandHotspot: boolean;
  isTouristArea: boolean;
  // Detail fields
  oneLiner: string;
  descriptionShort: string;
  descriptionLong: string;
  visitHint: string;
  accessHint: string;
  status: POIStatus;
  contactPhone: string;
  website: string;
  priceLevel: string;
  coverImageUrl: string;
}

export const EMPTY_CREATE_FORM: CreatePoiForm = {
  id: '',
  name: '',
  displayName: '',
  kind: 'attraction',
  type: '',
  address: '',
  barangay: '',
  city: '',
  province: '',
  centerLat: 9.8500,
  centerLng: 126.0500,
  serviceAreaId: '',
  visibility: 'public',
  tags: '',
  isIslandHotspot: false,
  isTouristArea: false,
  oneLiner: '',
  descriptionShort: '',
  descriptionLong: '',
  visitHint: '',
  accessHint: '',
  status: 'unknown',
  contactPhone: '',
  website: '',
  priceLevel: '',
  coverImageUrl: '',
};

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
}

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

/* ── Hook ───────────────────────────────────────── */

export function usePOIData() {
  /* ── Map markers (lightweight, ALL POIs) ────── */
  const [mapMarkers, setMapMarkers] = useState<MapMarker[]>([]);

  /* ── Sidebar list (paginated, server-filtered) ── */
  const [sidebarPois, setSidebarPois] = useState<POI[]>([]);
  const [sidebarTotal, setSidebarTotal] = useState(0);
  const [sidebarHasMore, setSidebarHasMore] = useState(false);
  const [sidebarOffset, setSidebarOffset] = useState(0);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<POI | null>(null);
  const selectedRef = useRef<POI | null>(null);
  // Keep ref always in sync so callbacks never have stale selected
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  /* Lookup tables from backend */
  const [poiKinds, setPoiKinds] = useState<POIKind[]>([]);
  const [poiTypes, setPoiTypes] = useState<{ id: string; label: string; kindId?: string }[]>([]);
  const [dropoffZoneTypes, setDropoffZoneTypes] = useState<{ id: string; label: string }[]>([]);
  const [roadAccessTypes, setRoadAccessTypes] = useState<{ id: string; label: string }[]>([]);
  const [kindFilter, setKindFilter] = useState('all');

  /* Guard against double-fetch (React Strict Mode / HMR) */
  const hasFetched = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Fetch map markers (lightweight, all) ─────── */

  const fetchMapMarkers = useCallback(async () => {
    try {
      const markers = await poiApi.getMapMarkers();
      if (Array.isArray(markers)) {
        setMapMarkers(markers);
      }
    } catch {
      // Fallback: map will just be empty
      setMapMarkers([]);
    }
  }, []);

  /* ── Fetch sidebar page (server-filtered) ─────── */

  const fetchSidebarPage = useCallback(async (
    params: { search?: string; type?: string; kind?: string; offset?: number; append?: boolean; isActive?: boolean; isVerified?: boolean }
  ) => {
    const { search: q, type, offset = 0, append = false } = params;
    try {
      if (!append) setLoading(true);
      else setLoadingMore(true);

      const query: Record<string, any> = { limit: PAGE_SIZE, offset };
      if (q) query.search = q;
      if (type && type !== 'all') query.type = type;
      if (params.kind && params.kind !== 'all') query.kind = params.kind;
      if (params.isActive !== undefined) query.isActive = params.isActive;
      if (params.isVerified !== undefined) query.isVerified = params.isVerified;

      const res = await poiApi.listPois(query);

      let page: POI[] = [];
      let total = 0;
      let hasMore = false;

      if (Array.isArray(res)) {
        page = res;
        total = res.length;
      } else if (res && Array.isArray((res as any).data)) {
        page = (res as any).data;
        total = (res as any).pagination?.total ?? page.length;
        hasMore = (res as any).pagination?.hasMore ?? false;
      }

      if (append) {
        setSidebarPois(prev => [...prev, ...page]);
      } else {
        setSidebarPois(page);
      }
      setSidebarTotal(total);
      setSidebarHasMore(hasMore);
      setSidebarOffset(offset + page.length);
    } catch {
      if (!append) {
        toast.error('Failed to load POIs');
        setSidebarPois([]);
        setSidebarTotal(0);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  /* ── Load more (infinite scroll) ──────────────── */

  /* ── Status filter → query params helper ───── */

  const statusParams = useCallback((status: string): { isActive?: boolean; isVerified?: boolean } => {
    switch (status) {
      case 'active':     return { isActive: true };
      case 'inactive':   return { isActive: false };
      case 'verified':   return { isVerified: true };
      case 'unverified': return { isVerified: false };
      default:           return {};
    }
  }, []);

  const loadMore = useCallback(() => {
    if (loadingMore || !sidebarHasMore) return;
    fetchSidebarPage({
      search: search || undefined,
      type: categoryFilter,
      kind: kindFilter,
      offset: sidebarOffset,
      append: true,
      ...statusParams(statusFilter),
    });
  }, [loadingMore, sidebarHasMore, fetchSidebarPage, search, categoryFilter, kindFilter, statusFilter, sidebarOffset, statusParams]);

  /* ── Refresh both streams ─────────────────────── */

  const fetchPois = useCallback(async () => {
    await Promise.all([
      fetchMapMarkers(),
      fetchSidebarPage({ search: search || undefined, type: categoryFilter, kind: kindFilter, ...statusParams(statusFilter) }),
    ]);
  }, [fetchMapMarkers, fetchSidebarPage, search, categoryFilter, kindFilter, statusFilter, statusParams]);

  const fetchPoiTypes = useCallback(async () => {
    try {
      const [kinds, types] = await Promise.all([
        poiApi.getPoiKinds(),
        poiApi.getPoiTypes(),
      ]);
      if (Array.isArray(kinds)) {
        setPoiKinds(kinds);
      }
      if (Array.isArray(types)) {
        setPoiTypes(types.map(t => ({ id: t.id, label: t.label, kindId: (t as any).kindId })));
      }
    } catch {
      setPoiKinds([
        { id: 'attraction', label: 'Tourist Spot', isActive: true, sortOrder: 0 },
        { id: 'essential', label: 'Essentials', isActive: true, sortOrder: 1 },
        { id: 'transport', label: 'Transport', isActive: true, sortOrder: 2 },
        { id: 'merchant', label: 'Shops & Services', isActive: true, sortOrder: 3 },
        { id: 'public_place', label: 'Public Place', isActive: true, sortOrder: 4 },
        { id: 'landmark', label: 'Landmark', isActive: true, sortOrder: 5 },
      ]);
      setPoiTypes([
        { id: 'beach', label: 'Beach', kindId: 'attraction' },
        { id: 'surf_spot', label: 'Surf Spot', kindId: 'attraction' },
        { id: 'restaurant', label: 'Restaurant', kindId: 'merchant' },
      ]);
    }
  }, []);

  const fetchLookups = useCallback(async () => {
    try {
      const [dzTypes, raTypes] = await Promise.all([
        poiApi.getDropoffZoneTypes(),
        poiApi.getRoadAccessTypes(),
      ]);
      if (Array.isArray(dzTypes)) setDropoffZoneTypes(dzTypes.map(t => ({ id: t.id, label: t.label })));
      if (Array.isArray(raTypes)) setRoadAccessTypes(raTypes.map(t => ({ id: t.id, label: t.label })));
    } catch {
      setDropoffZoneTypes([{ id: 'main_gate', label: 'Main Gate' }]);
      setRoadAccessTypes([{ id: 'all_vehicles', label: 'All Vehicles' }]);
    }
  }, []);

  /* ── Auto-fetch on mount (once) ───────────────── */

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchMapMarkers();
    fetchSidebarPage({});
    fetchPoiTypes();
    fetchLookups();
  }, [fetchMapMarkers, fetchSidebarPage, fetchPoiTypes, fetchLookups]);

  /* ── Debounced search → server-side filter ────── */

  useEffect(() => {
    // Skip on initial mount (hasFetched handles first load)
    if (!hasFetched.current) return;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchSidebarPage({
        search: search || undefined,
        type: categoryFilter,
        kind: kindFilter,
        ...statusParams(statusFilter),
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [search, categoryFilter, kindFilter, statusFilter, fetchSidebarPage, statusParams]);

  /* ── CRUD ─────────────────────────────────────── */

  const createPoi = useCallback(async (form: CreatePoiForm) => {
    const id = form.id.trim() || slugify(form.name);
    const tags = form.tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const newEntry = await poiApi.createPoi({
      id,
      name: form.name,
      displayName: form.displayName || undefined,
      kind: form.kind,
      type: form.type,
      centerLat: form.centerLat,
      centerLng: form.centerLng,
      fullAddress: form.address || undefined,
      barangay: form.barangay || undefined,
      city: form.city || undefined,
      province: form.province || undefined,
      serviceAreaId: form.serviceAreaId || undefined,
      country: 'PH',
      visibility: form.visibility,
      source: 'manual_curated',
      confidence: 1,
      priorityScore: 0,
      isIslandHotspot: form.isIslandHotspot,
      isTouristArea: form.isTouristArea,
      tags,
      status: form.status || 'unknown',
      oneLiner: form.oneLiner || undefined,
      descriptionShort: form.descriptionShort || undefined,
      descriptionLong: form.descriptionLong || undefined,
      visitHint: form.visitHint || undefined,
      accessHint: form.accessHint || undefined,
      contactPhone: form.contactPhone || undefined,
      website: form.website || undefined,
      priceLevel: form.priceLevel || undefined,
      coverImageUrl: form.coverImageUrl || undefined,
    } as any);
    // Update sidebar optimistically
    setSidebarPois(prev => [newEntry, ...prev]);
    setSidebarTotal(prev => prev + 1);
    // Refresh map markers to include the new POI
    fetchMapMarkers();
    toast.success(`POI "${form.name}" created`);
    return newEntry;
  }, [fetchMapMarkers]);

  const updatePoi = useCallback(async (id: string, data: Partial<POI>) => {
    const updated = await poiApi.updatePoi(id, data);
    setSidebarPois(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p));
    if (selectedRef.current?.id === id) setSelected(prev => prev ? { ...prev, ...updated } : prev);
    // Refresh map markers if name/coords/type changed
    fetchMapMarkers();
    return updated;
  }, [fetchMapMarkers]);

  /* ── Confirm Actions ──────────────────────────── */

  const executeConfirmAction = useCallback(async () => {
    if (!confirmAction) return;
    const { type, target } = confirmAction;
    try {
      if (type === 'verify') {
        await poiApi.verifyPoi(target.id);
        setSidebarPois(prev => prev.map(p => p.id === target.id ? { ...p, isVerified: true } : p));
        setMapMarkers(prev => prev.map(m => m.id === target.id ? { ...m, isVerified: true } : m));
        if (selectedRef.current?.id === target.id) setSelected(prev => prev ? { ...prev, isVerified: true } : prev);
        toast.success(`${target.name} verified`);
      } else if (type === 'deactivate') {
        await poiApi.deactivatePoi(target.id);
        setSidebarPois(prev => prev.map(p => p.id === target.id ? { ...p, isActive: false } : p));
        setMapMarkers(prev => prev.map(m => m.id === target.id ? { ...m, isActive: false } : m));
        if (selectedRef.current?.id === target.id) setSelected(prev => prev ? { ...prev, isActive: false } : prev);
        toast.success(`${target.name} deactivated`);
      } else if (type === 'reactivate') {
        await poiApi.reactivatePoi(target.id);
        setSidebarPois(prev => prev.map(p => p.id === target.id ? { ...p, isActive: true } : p));
        setMapMarkers(prev => prev.map(m => m.id === target.id ? { ...m, isActive: true } : m));
        if (selectedRef.current?.id === target.id) setSelected(prev => prev ? { ...prev, isActive: true } : prev);
        toast.success(`${target.name} reactivated`);
      } else if (type === 'delete') {
        await poiApi.deletePoi(target.id);
        setSidebarPois(prev => prev.filter(p => p.id !== target.id));
        setMapMarkers(prev => prev.filter(m => m.id !== target.id));
        setSidebarTotal(prev => prev - 1);
        setSelected(null);
        toast.success(`${target.name} deleted`);
      }
    } catch {
      toast.error(`Failed to ${type} POI`);
    }
    setConfirmAction(null);
  }, [confirmAction]);

  /* ── Anchor Actions ───────────────────────────── */

  // Helper: refresh selected POI from the server (uses ref to avoid stale closures)
  const refreshSelected = useCallback(async () => {
    const cur = selectedRef.current;
    if (!cur) return;
    const refreshed = await poiApi.getPoi(cur.id);
    setSelected(refreshed);
    setSidebarPois(prev => prev.map(p => p.id === refreshed.id ? refreshed : p));
  }, []);

  const verifyAnchor = useCallback(async (anchorId: string) => {
    await poiApi.verifyAnchor(anchorId);
    toast.success('Anchor verified');
    await refreshSelected();
  }, [refreshSelected]);

  const setDefaultAnchor = useCallback(async (anchorId: string) => {
    await poiApi.setDefaultAnchor(anchorId);
    toast.success('Anchor set as default');
    await refreshSelected();
  }, [refreshSelected]);

  const deleteAnchor = useCallback(async (anchorId: string) => {
    await poiApi.deleteAnchor(anchorId);
    toast.success('Anchor deleted');
    await refreshSelected();
  }, [refreshSelected]);

  const createAnchor = useCallback(async (data: {
    id: string; poiId: string; label: string; pointLat: number; pointLng: number;
    dropoffZoneType?: string; roadAccessType?: string;
    pickupNotes?: string; entranceSide?: string;
    requiresContact?: boolean; weatherBlocked?: boolean;
  }) => {
    await poiApi.createAnchor(data);
    toast.success('Anchor created');
    await refreshSelected();
  }, [refreshSelected]);

  const updateAnchor = useCallback(async (anchorId: string, data: Record<string, any>) => {
    await poiApi.updateAnchor(anchorId, data);
    toast.success('Anchor updated');
    await refreshSelected();
  }, [refreshSelected]);

  /* ── Media Actions ────────────────────────────── */

  const deleteMedia = useCallback(async (mediaId: number) => {
    await poiApi.deleteMedia(mediaId);
    toast.success('Media deleted');
    await refreshSelected();
  }, [refreshSelected]);

  const addMedia = useCallback(async (poiId: string, kind: 'cover' | 'gallery' | 'icon', url: string) => {
    await poiApi.addMedia(poiId, { kind, url });
    toast.success('Media added');
    await refreshSelected();
  }, [refreshSelected]);

  /* ── Admin Ops ────────────────────────────────── */

  const adminResync = useCallback(async () => {
    try {
      await poiApi.resyncTypesense();
      toast.success('Typesense resync complete');
    } catch { toast.error('Resync failed'); }
  }, []);

  const adminCleanup = useCallback(async () => {
    try {
      await poiApi.cleanupOutbox();
      toast.success('Outbox cleanup complete');
    } catch { toast.error('Cleanup failed'); }
  }, []);

  const adminBackfill = useCallback(async () => {
    try {
      await poiApi.merchantBackfill();
      toast.success('Merchant backfill complete');
    } catch { toast.error('Backfill failed'); }
  }, []);

  /* ── Bulk Operations ──────────────────────────── */

  const bulkVerify = useCallback(async (ids: string[]) => {
    try {
      const result = await poiApi.bulkVerify(ids);
      setSidebarPois(prev => prev.map(p => ids.includes(p.id) ? { ...p, isVerified: true } : p));
      setMapMarkers(prev => prev.map(m => ids.includes(m.id) ? { ...m, isVerified: true } : m));
      if (selectedRef.current && ids.includes(selectedRef.current.id)) setSelected(prev => prev ? { ...prev, isVerified: true } : prev);
      toast.success(`${result.verified} POIs verified`);
      if (result.notFound.length > 0) toast.warning(`${result.notFound.length} POIs not found`);
    } catch { toast.error('Bulk verify failed'); }
  }, []);

  const bulkDeactivate = useCallback(async (ids: string[]) => {
    try {
      const result = await poiApi.bulkDeactivate(ids);
      setSidebarPois(prev => prev.map(p => ids.includes(p.id) ? { ...p, isActive: false } : p));
      setMapMarkers(prev => prev.map(m => ids.includes(m.id) ? { ...m, isActive: false } : m));
      if (selectedRef.current && ids.includes(selectedRef.current.id)) setSelected(prev => prev ? { ...prev, isActive: false } : prev);
      toast.success(`${result.deactivated} POIs deactivated`);
      if (result.notFound.length > 0) toast.warning(`${result.notFound.length} POIs not found`);
    } catch { toast.error('Bulk deactivate failed'); }
  }, []);

  const bulkReactivate = useCallback(async (ids: string[]) => {
    try {
      const result = await poiApi.bulkReactivate(ids);
      setSidebarPois(prev => prev.map(p => ids.includes(p.id) ? { ...p, isActive: true } : p));
      setMapMarkers(prev => prev.map(m => ids.includes(m.id) ? { ...m, isActive: true } : m));
      if (selectedRef.current && ids.includes(selectedRef.current.id)) setSelected(prev => prev ? { ...prev, isActive: true } : prev);
      toast.success(`${result.reactivated} POIs reactivated`);
      if (result.notFound.length > 0) toast.warning(`${result.notFound.length} POIs not found`);
    } catch { toast.error('Bulk reactivate failed'); }
  }, []);

  const bulkDelete = useCallback(async (ids: string[]) => {
    try {
      const result = await poiApi.bulkDelete(ids);
      setSidebarPois(prev => prev.filter(p => !ids.includes(p.id)));
      setMapMarkers(prev => prev.filter(m => !ids.includes(m.id)));
      setSidebarTotal(prev => prev - result.deleted);
      if (selectedRef.current && ids.includes(selectedRef.current.id)) setSelected(null);
      toast.success(`${result.deleted} POIs deleted`);
      if (result.notFound.length > 0) toast.warning(`${result.notFound.length} POIs not found`);
    } catch { toast.error('Bulk delete failed'); }
  }, []);

  return {
    // state
    mapMarkers, sidebarPois, sidebarTotal, sidebarHasMore, loadingMore,
    loading, search, categoryFilter, kindFilter, statusFilter, selected,
    confirmAction, poiKinds, poiTypes, dropoffZoneTypes, roadAccessTypes,
    // setters
    setSearch, setCategoryFilter, setKindFilter, setStatusFilter, setSelected, setConfirmAction,
    // actions
    fetchPois, fetchMapMarkers, loadMore,
    createPoi, updatePoi,
    executeConfirmAction,
    verifyAnchor, setDefaultAnchor, deleteAnchor, createAnchor, updateAnchor,
    deleteMedia, addMedia,
    adminResync, adminCleanup, adminBackfill,
    // bulk
    bulkVerify, bulkDeactivate, bulkReactivate, bulkDelete,
  };
}
