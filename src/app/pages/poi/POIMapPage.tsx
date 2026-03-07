import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import { canApprove as checkApprove, canEdit as checkEdit, canDelete as checkDelete, canCreate as checkCreate } from '../../lib/permissions';

import { usePOIData, type CreatePoiForm } from './hooks/usePOIData';
import { usePOIMap } from './hooks/usePOIMap';
import { poiApi } from '../../lib/poi-api';
import { POISidebar } from './components/POISidebar';
import { POICreateForm } from './components/POICreateForm';
import { POIAdminOps } from './components/POIAdminOps';
import { POIDetailPanel } from './components/POIDetailPanel';
import { POIBulkToolbar } from './components/POIBulkToolbar';
import { POIImportExport } from './components/POIImportExport';

/* ── Page ───────────────────────────────────────── */

export function POIMapPage() {
  const { user } = useAuth();

  const canDoApprove = user ? checkApprove(user.role, 'poi_map') : false;
  const canDoCreate  = user ? checkCreate(user.role, 'poi_map') : false;
  const canDoEdit    = user ? checkEdit(user.role, 'poi_map') : false;
  const canDoDelete  = user ? checkDelete(user.role, 'poi_map') : false;

  /* ── Data ─────────────────────────────────────── */

  const {
    loading, search, categoryFilter, kindFilter, statusFilter, selected,
    mapMarkers, sidebarPois, sidebarTotal, sidebarHasMore, loadingMore,
    confirmAction, poiKinds, poiTypes, dropoffZoneTypes, roadAccessTypes,
    setSearch, setCategoryFilter, setKindFilter, setStatusFilter, setSelected, setConfirmAction,
    createPoi, updatePoi, loadMore,
    executeConfirmAction,
    verifyAnchor, setDefaultAnchor, deleteAnchor, createAnchor, updateAnchor,
    deleteMedia, addMedia,
    adminResync, adminCleanup, adminBackfill,
    bulkVerify, bulkDeactivate, bulkReactivate, bulkDelete,
    fetchPois,
  } = usePOIData();

  /* ── UI state ─────────────────────────────────── */

  const [createMode, setCreateMode] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [mapClickCoords, setMapClickCoords] = useState<{ lat: number; lng: number } | null>(null);

  /* ── Bulk selection state ─────────────────────── */

  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleBulkMode = useCallback(() => {
    setBulkMode(prev => {
      if (prev) setSelectedIds(new Set()); // clear on exit
      return !prev;
    });
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllFiltered = useCallback(() => {
    setSelectedIds(new Set(sidebarPois.map(p => p.id)));
  }, [sidebarPois]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBulkVerify = useCallback(async (ids: string[]) => {
    await bulkVerify(ids);
    clearSelection();
  }, [bulkVerify, clearSelection]);

  const handleBulkDeactivate = useCallback(async (ids: string[]) => {
    await bulkDeactivate(ids);
    clearSelection();
  }, [bulkDeactivate, clearSelection]);

  const handleBulkReactivate = useCallback(async (ids: string[]) => {
    await bulkReactivate(ids);
    clearSelection();
  }, [bulkReactivate, clearSelection]);

  const handleBulkDelete = useCallback(async (ids: string[]) => {
    await bulkDelete(ids);
    clearSelection();
  }, [bulkDelete, clearSelection]);

  /* ── Map ──────────────────────────────────────── */

  // Client-side cache: once a POI detail is fetched, keep it so switching back is instant
  const detailCache = useRef<Record<string, any>>({});

  // Keep cache in sync when selected changes externally (e.g. after anchor/media update refresh)
  useEffect(() => {
    if (selected?.id) {
      detailCache.current[selected.id] = selected;
    }
  }, [selected]);

  const selectPoiById = useCallback(async (poi: any) => {
    const id = poi.id;
    if (detailCache.current[id]) {
      setSelected(detailCache.current[id]);
    } else {
      setSelected(poi);
    }
    setCreateMode(false);
    try {
      const full = await poiApi.getPoi(id);
      detailCache.current[id] = full;
      setSelected((prev: any) => prev?.id === id ? full : prev);
    } catch { /* keep whatever we already have */ }
  }, [setSelected]);

  const handleSelectPoi = useCallback(async (poi: any) => {
    selectPoiById(poi);
  }, [selectPoiById]);

  // Ref to hold showDraggableMarker so handleMapClick can use it without TDZ issues
  const showDraggableMarkerRef = useRef<(lat: number, lng: number) => void>(() => {});

  const handleMapClick = useCallback((lngLat: { lat: number; lng: number }) => {
    if (createMode) {
      showDraggableMarkerRef.current(lngLat.lat, lngLat.lng);
    }
  }, [createMode]);

  const { mapContainer, mapLoaded, flyTo, setCrosshair, showDraggableMarker, hideDraggableMarker, dragCoords } = usePOIMap({
    markers: mapMarkers,
    onSelectPoi: handleSelectPoi,
    onMapClick: handleMapClick,
  });

  // Keep ref in sync
  useEffect(() => { showDraggableMarkerRef.current = showDraggableMarker; }, [showDraggableMarker]);

  /* ── Anchor placement ─────────────────────────── */

  const [anchorPlacing, setAnchorPlacing] = useState(false);
  const [anchorEditing, setAnchorEditing] = useState(false);
  // Refs to track marker state for synchronous checks in useEffect
  const anchorPlacingRef = useRef(false);
  const anchorEditingRef = useRef(false);

  const handleStartAnchorPlace = useCallback(() => {
    if (!selected) return;
    anchorPlacingRef.current = true;
    setAnchorPlacing(true);
    showDraggableMarker(Number(selected.centerLat), Number(selected.centerLng));
  }, [selected, showDraggableMarker]);

  const handleCancelAnchorPlace = useCallback(() => {
    anchorPlacingRef.current = false;
    anchorEditingRef.current = false;
    setAnchorPlacing(false);
    setAnchorEditing(false);
    hideDraggableMarker();
  }, [hideDraggableMarker]);

  // Show draggable marker at an anchor's current position when editing
  const handleStartAnchorEdit = useCallback((anchor: { pointLat: number; pointLng: number }) => {
    anchorEditingRef.current = true;
    setAnchorEditing(true);
    showDraggableMarker(Number(anchor.pointLat), Number(anchor.pointLng));
  }, [showDraggableMarker]);

  const handleCancelAnchorEdit = useCallback(() => {
    anchorEditingRef.current = false;
    setAnchorEditing(false);
    hideDraggableMarker();
  }, [hideDraggableMarker]);

  /* ── Create-mode: show draggable marker ────────── */

  useEffect(() => {
    setCrosshair(createMode);
    if (createMode && mapLoaded) {
      // Place a draggable marker at map center
      const mapCenter = { lat: 9.85, lng: 126.05 }; // default Siargao center
      showDraggableMarker(mapCenter.lat, mapCenter.lng);
    } else if (!createMode) {
      // Only hide if not in anchor placing or editing mode (use refs for synchronous check)
      if (!anchorPlacingRef.current && !anchorEditingRef.current) hideDraggableMarker();
    }
  }, [createMode, mapLoaded, setCrosshair, showDraggableMarker, hideDraggableMarker]);

  /* ── Fly to selected POI ──────────────────────── */

  const handleSidebarSelect = useCallback(async (poi: any) => {
    handleCancelAnchorPlace();
    flyTo(Number(poi.centerLat), Number(poi.centerLng));
    selectPoiById(poi);
  }, [selectPoiById, flyTo, handleCancelAnchorPlace]);

  /* ── Create submit ────────────────────────────── */

  const handleCreate = useCallback(async (form: CreatePoiForm) => {
    const newPoi = await createPoi(form);
    setCreateMode(false);
    setMapClickCoords(null);
    hideDraggableMarker();
    // Auto-select and fly-to the newly created POI
    if (newPoi) {
      flyTo(Number(newPoi.centerLat), Number(newPoi.centerLng));
      selectPoiById(newPoi);
    }
  }, [createPoi, flyTo, selectPoiById, hideDraggableMarker]);

  /* ── Categories for sidebar chips ─────────────── */

  const categories = poiTypes.length > 0
    ? poiTypes
    : [
        { id: 'restaurant', label: 'Restaurant' },
        { id: 'mall', label: 'Mall' },
        { id: 'attraction', label: 'Attraction' },
      ];

  /* ── Render ───────────────────────────────────── */

  return (
    <div className="absolute inset-0 flex bg-[var(--background)]">
      {/* Sidebar */}
      <POISidebar
        pois={sidebarPois}
        totalCount={sidebarTotal}
        hasMore={sidebarHasMore}
        loadingMore={loadingMore}
        onLoadMore={loadMore}
        search={search}
        onSearchChange={setSearch}
        kindFilter={kindFilter}
        onKindChange={setKindFilter}
        kinds={poiKinds}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        categories={categories}
        selected={selected}
        onSelect={handleSidebarSelect}
        canEdit={canDoEdit}
        canCreate={canDoCreate}
        onCreateClick={() => { setCreateMode(!createMode); setSelected(null); setMapClickCoords(null); }}
        onAdminToggle={() => setShowAdmin(!showAdmin)}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        bulkMode={bulkMode}
        onToggleBulkMode={toggleBulkMode}
      >
        {/* Injected panels */}
        {showAdmin && (
          <>
            <POIAdminOps
              onResync={adminResync}
              onCleanup={adminCleanup}
              onBackfill={adminBackfill}
            />
            <div className="px-4 py-3 border-b border-[var(--border)] bg-blue-50/50 dark:bg-blue-950/30">
              <POIImportExport onImportComplete={fetchPois} />
            </div>
          </>
        )}
        {createMode && (
          <POICreateForm
            poiKinds={poiKinds}
            poiTypes={poiTypes}
            onCancel={() => { setCreateMode(false); setMapClickCoords(null); hideDraggableMarker(); }}
            onSubmit={handleCreate}
            mapCoords={dragCoords}
          />
        )}
      </POISidebar>

      {/* Map + overlays */}
      <div className="flex-1 relative h-full">
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 dark:bg-black/30">
            <Loader2 size={28} className="animate-spin text-[var(--primary)]" />
          </div>
        )}

        {/* Map container */}
        <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

        {/* Create-mode banner */}
        {createMode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-blue-600 text-white text-[13px] rounded-lg shadow-lg flex items-center gap-2" style={{ fontWeight: 500 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            Drag the blue pin or click the map to set location
          </div>
        )}

        {/* Anchor placement banner */}
        {anchorPlacing && !anchorEditing && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-blue-600 text-white text-[13px] rounded-lg shadow-lg flex items-center gap-2" style={{ fontWeight: 500 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            Drag the blue pin to set anchor location
          </div>
        )}

        {/* Anchor edit banner */}
        {anchorEditing && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-indigo-600 text-white text-[13px] rounded-lg shadow-lg flex items-center gap-2" style={{ fontWeight: 500 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            Drag the blue pin to reposition anchor
          </div>
        )}

        {/* Detail panel */}
        {selected && !createMode && (
          <POIDetailPanel
            poi={selected}
            onClose={() => { setSelected(null); handleCancelAnchorPlace(); }}
            onConfirmAction={setConfirmAction}
            onUpdatePoi={updatePoi}
            canApprove={canDoApprove}
            canEdit={canDoEdit}
            canDelete={canDoDelete}
            onVerifyAnchor={verifyAnchor}
            onSetDefaultAnchor={setDefaultAnchor}
            onDeleteAnchor={deleteAnchor}
            onCreateAnchor={createAnchor}
            onUpdateAnchor={updateAnchor}
            onDeleteMedia={deleteMedia}
            onAddMedia={addMedia}
            poiKinds={poiKinds}
            poiTypes={poiTypes}
            dropoffZoneTypes={dropoffZoneTypes}
            roadAccessTypes={roadAccessTypes}
            anchorPlacing={anchorPlacing}
            anchorDragCoords={dragCoords}
            onStartAnchorPlace={handleStartAnchorPlace}
            onCancelAnchorPlace={handleCancelAnchorPlace}
            onConfirmAnchorPlace={handleCancelAnchorPlace}
            onStartAnchorEdit={handleStartAnchorEdit}
            onCancelAnchorEdit={handleCancelAnchorEdit}
          />
        )}

        {/* Bulk toolbar */}
        <POIBulkToolbar
          selectedIds={selectedIds}
          totalFiltered={sidebarPois.length}
          onSelectAll={selectAllFiltered}
          onClearSelection={clearSelection}
          onBulkVerify={handleBulkVerify}
          onBulkDeactivate={handleBulkDeactivate}
          onBulkReactivate={handleBulkReactivate}
          onBulkDelete={handleBulkDelete}
        />
      </div>

      {/* Confirm dialog */}
      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={executeConfirmAction}
        title={confirmAction ? `${confirmAction.type.charAt(0).toUpperCase() + confirmAction.type.slice(1)} POI` : ''}
        message={confirmAction ? `Are you sure you want to ${confirmAction.type} "${confirmAction.target.name}"?` : ''}
        confirmLabel={confirmAction?.type === 'delete' ? 'Delete' : 'Confirm'}
        variant={confirmAction?.type === 'delete' ? 'danger' : 'default'}
      />
    </div>
  );
}
