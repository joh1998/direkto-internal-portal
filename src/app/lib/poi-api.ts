import { request } from './api';

/** Lightweight map marker (returned by /pois/map-markers) */
export interface MapMarker {
  id: string;
  name: string;
  kind: string;
  type: string;
  status: string;
  centerLat: number;
  centerLng: number;
  isVerified: boolean;
  isActive: boolean;
  coverImageUrl?: string;
}

export interface POIKind {
  id: string;
  label: string;
  eyebrowLabel?: string;
  iconUrl?: string;
  isActive: boolean;
  sortOrder: number;
}

export type POIStatus = 'open' | 'closed' | 'temporarily_closed' | 'seasonal' | 'unknown';

export const POI_STATUS_OPTIONS: { value: POIStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'temporarily_closed', label: 'Temporarily Closed' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'unknown', label: 'Unknown' },
];

export interface POI {
  id: string;
  name: string;
  displayName?: string;
  shortLabel?: string;
  kind: string;
  type: string;
  centerLat: number;
  centerLng: number;
  barangay?: string;
  city?: string;
  province?: string;
  country: string;
  postalCode?: string;
  fullAddress?: string;
  streetName?: string;
  streetNumber?: string;
  buildingName?: string;
  floor?: string;
  serviceAreaId?: string;
  // UX fields
  oneLiner?: string;
  descriptionShort?: string;
  descriptionLong?: string;
  visitHint?: string;
  accessHint?: string;
  trustBadges: string[];
  status: POIStatus;
  priorityScore: number;
  popularityScore: number;
  isIslandHotspot: boolean;
  isTouristArea: boolean;
  isActive: boolean;
  isVerified: boolean;
  visibility: 'public' | 'private' | 'ops_only';
  tags: string[];
  operatingHours?: Record<string, any>;
  contactPhone?: string;
  website?: string;
  socialLinks?: Record<string, string>;
  priceLevel?: string;
  coverImageUrl?: string;
  merchantId?: string;
  googlePlaceId?: string;
  osmId?: string;
  source: string;
  confidence: number;
  editorialLock: Record<string, boolean>;
  lastVerifiedAt?: string;
  verificationSource?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  revision: number;
  anchors?: POIAnchor[];
  media?: {
    cover?: { id: number; url: string; source?: string };
    icon?: { id: number; url: string; source?: string };
    gallery?: { id: number; url: string; position: number; source?: string }[];
  };
  // Domain profiles (only one will be set, matching kind)
  profile?: Record<string, any> | null;
  profileType?: 'attraction' | 'essential' | 'transport' | null;
  accessibility?: Record<string, any> | null;
  safety?: Record<string, any> | null;
  fees?: Record<string, any>[];
  tips?: Record<string, any>[];
}

export interface POIAnchor {
  id: string;
  poiId: string;
  label: string;
  pointLat: number;
  pointLng: number;
  dropoffZoneType: string;
  pickupNotes?: string;
  roadAccessType: string;
  entranceSide?: string;
  allowedVehicleTypes: string[];
  restrictedHours: { start: string; end: string }[];
  requiresContact: boolean;
  weatherBlocked: boolean;
  isDefault: boolean;
  isVerified: boolean;
  source: string;
  confidence: number;
  lastVerifiedAt?: string;
  snapProvider?: string;
  snappedLat?: number;
  snappedLng?: number;
  snappedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LookupType {
  id: string;
  label: string;
  iconUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceArea {
  id: string;
  name: string;
  country: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  boundary_geojson: any;
}

export const poiApi = {
  // POIs
  listPois: (params?: Record<string, any>) => {
    const query = new URLSearchParams(params as any).toString();
    return request<{ data: POI[]; pagination: { total: number; limit: number; offset: number; hasMore: boolean } }>(`/pois${query ? `?${query}` : ''}`);
  },
  getMapMarkers: () => request<MapMarker[]>('/pois/map-markers'),
  getPoi: (id: string) => request<POI>(`/pois/${id}`),
  createPoi: (data: Partial<POI>) => request<POI>('/pois', { method: 'POST', body: JSON.stringify(data) }),
  updatePoi: (id: string, data: Partial<POI>) => request<POI>(`/pois/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  verifyPoi: (id: string) => request<POI>(`/pois/${id}/verify`, { method: 'PATCH' }),
  deactivatePoi: (id: string) => request<POI>(`/pois/${id}/deactivate`, { method: 'PATCH' }),
  reactivatePoi: (id: string) => request<POI>(`/pois/${id}/reactivate`, { method: 'PATCH' }),
  deletePoi: (id: string) => request<{ success: boolean }>(`/pois/${id}`, { method: 'DELETE' }),

  // Lookup Types (read-only for dropdowns)
  getPoiKinds: () => request<POIKind[]>('/pois/kinds'),
  getPoiTypes: (kindId?: string) => {
    const q = kindId ? `?kindId=${kindId}` : '';
    return request<{ id: string; label: string; kindId: string; iconUrl: string | null }[]>(`/pois/types${q}`);
  },
  getDropoffZoneTypes: () => request<{ id: string; label: string; iconUrl: string | null }[]>('/pois/dropoff-zone-types'),
  getRoadAccessTypes: () => request<{ id: string; label: string; iconUrl: string | null }[]>('/pois/road-access-types'),

  // Lookup Types CRUD (admin management)
  listLookupTypes: (table: string) => request<LookupType[]>(`/lookup-types/${table}`),
  getLookupType: (table: string, id: string) => request<LookupType>(`/lookup-types/${table}/${id}`),
  createLookupType: (table: string, data: { id: string; label: string; iconUrl?: string; isActive?: boolean; sortOrder?: number }) =>
    request<LookupType>(`/lookup-types/${table}`, { method: 'POST', body: JSON.stringify(data) }),
  updateLookupType: (table: string, id: string, data: { label?: string; iconUrl?: string; isActive?: boolean; sortOrder?: number }) =>
    request<LookupType>(`/lookup-types/${table}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLookupType: (table: string, id: string) =>
    request<{ success: boolean }>(`/lookup-types/${table}/${id}`, { method: 'DELETE' }),

  // Admin Operations
  resyncTypesense: () => request<any>('/pois/admin/resync-typesense', { method: 'POST' }),
  cleanupOutbox: () => request<any>('/pois/admin/cleanup-outbox', { method: 'POST' }),
  merchantBackfill: () => request<any>('/pois/admin/merchant-backfill', { method: 'POST' }),

  // Bulk Operations
  bulkVerify: (ids: string[]) =>
    request<{ verified: number; notFound: string[] }>('/pois/bulk/verify', { method: 'POST', body: JSON.stringify({ ids }) }),
  bulkDeactivate: (ids: string[]) =>
    request<{ deactivated: number; notFound: string[] }>('/pois/bulk/deactivate', { method: 'POST', body: JSON.stringify({ ids }) }),
  bulkReactivate: (ids: string[]) =>
    request<{ reactivated: number; notFound: string[] }>('/pois/bulk/reactivate', { method: 'POST', body: JSON.stringify({ ids }) }),
  bulkDelete: (ids: string[]) =>
    request<{ deleted: number; notFound: string[] }>('/pois/bulk/delete', { method: 'POST', body: JSON.stringify({ ids }) }),
  bulkUpdate: (ids: string[], fields: Record<string, any>) =>
    request<{ updated: number; notFound: string[] }>('/pois/bulk/update', { method: 'POST', body: JSON.stringify({ ids, fields }) }),

  // Import / Export
  exportPois: async (params?: Record<string, any>): Promise<Blob> => {
    const query = new URLSearchParams(params as any).toString();
    const token = localStorage.getItem('direkto_access_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`/api/v1/pois/admin/export${query ? `?${query}` : ''}`, { headers });
    if (!res.ok) throw new Error('Export failed');
    return res.blob();
  },
  downloadImportTemplate: async (): Promise<Blob> => {
    const token = localStorage.getItem('direkto_access_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch('/api/v1/pois/admin/import-template', { headers });
    if (!res.ok) throw new Error('Template download failed');
    return res.blob();
  },
  importPois: (csv: string) =>
    request<{ total: number; created: number; updated: number; skipped: number; errors: { row: number; id?: string; message: string }[] }>(
      '/pois/admin/import', { method: 'POST', body: JSON.stringify({ csv }) },
    ),

  // Anchors
  getAnchorsForPoi: (poiId: string) => request<POIAnchor[]>(`/poi-anchors/poi/${poiId}`),
  getAnchor: (id: string) => request<POIAnchor>(`/poi-anchors/${id}`),
  createAnchor: (data: any) => request<POIAnchor>('/poi-anchors', { method: 'POST', body: JSON.stringify(data) }),
  updateAnchor: (id: string, data: any) => request<POIAnchor>(`/poi-anchors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  setDefaultAnchor: (id: string) => request<POIAnchor>(`/poi-anchors/${id}/set-default`, { method: 'PATCH' }),
  verifyAnchor: (id: string) => request<POIAnchor>(`/poi-anchors/${id}/verify`, { method: 'PATCH' }),
  deleteAnchor: (id: string) => request<{ success: boolean }>(`/poi-anchors/${id}`, { method: 'DELETE' }),

  // Media
  getMediaForPoi: (poiId: string) => request<any>(`/pois/${poiId}/media`),
  addMedia: (poiId: string, data: { kind: 'cover' | 'gallery' | 'icon'; url: string; position?: number }) =>
    request<any>(`/pois/${poiId}/media`, { method: 'POST', body: JSON.stringify(data) }),
  reorderMedia: (mediaId: number, position: number) =>
    request<any>(`/pois/media/${mediaId}/reorder`, { method: 'PATCH', body: JSON.stringify({ position }) }),
  deleteMedia: (mediaId: number) =>
    request<any>(`/pois/media/${mediaId}`, { method: 'DELETE' }),

  // Service Areas
  listServiceAreas: () => request<ServiceArea[]>('/service-areas'),
  getServiceArea: (id: string) => request<ServiceArea>(`/service-areas/${id}`),
  createServiceArea: (data: any) => request<ServiceArea>('/service-areas', { method: 'POST', body: JSON.stringify(data) }),
  updateServiceArea: (id: string, data: any) => request<ServiceArea>(`/service-areas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteServiceArea: (id: string) => request<{ success: boolean }>(`/service-areas/${id}`, { method: 'DELETE' }),
};
