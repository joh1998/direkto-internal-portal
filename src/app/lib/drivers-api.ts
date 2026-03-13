// ── Driver Management API ─────────────────────────────────────
import { api } from './api';
import type { PaginatedResponse } from './users-api';

// ── Types (match backend response shapes) ─────────────────────

export interface ApiDriverUser {
  id: number;
  phone: string;
  name: string;
  email: string | null;
  photoUrl?: string | null;
}

export interface ApiDriverVehicle {
  id: number;
  publicId: string;
  vehicleType: string;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  plateNumber: string;
  photos: {
    frontView?: string;
    backView?: string;
    sideView?: string;
    or?: string;
    cr?: string;
  } | null;
  ownershipType: string;
  ownershipDocs: {
    authorizationLetter?: string;
    ownerIdPhoto?: string;
    ownerName?: string;
    ownerContact?: string;
    deedOfSale?: string;
    sellerIdPhoto?: string;
    salesInvoice?: string;
    financingCert?: string;
    entityIdPhoto?: string;
    companyAuthLetter?: string;
    companyId?: string;
    signatoryIdPhoto?: string;
  } | null;
  applicationStatus: string;
  fixRequirements: Array<{ field: string; reason: string; required: boolean }> | null;
  adminNotes: string | null;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ApiDriver {
  id: number;
  publicId: string;
  userId: number;
  licenseNumber: string;
  licenseExpiry: string;
  licensePhotoUrl: string | null;
  status: 'ONLINE' | 'OFFLINE' | 'ON_TRIP' | 'SUSPENDED';
  rating: string;
  totalTrips: number;
  completedTrips: number;
  cancelledTrips: number;
  acceptanceRate: string;
  cancellationRate: string;
  totalEarnings: string;
  pendingPayout: string;
  applicationStatus: string;
  fixRequirements: Array<{ field: string; reason: string; required: boolean }> | null;
  adminNotes: string | null;
  isVerified: boolean;
  verifiedAt: string | null;
  verifiedBy: number | null;
  documents: Record<string, string> | null;
  backgroundCheckStatus: string | null;
  createdAt: string;
  updatedAt: string;
  user: ApiDriverUser;
  vehicle?: ApiDriverVehicle | null;
}

export interface DriverSearchParams {
  search?: string;
  status?: string;
  isVerified?: boolean;
  page?: number;
  limit?: number;
}

// ── API calls ─────────────────────────────────────────────────

export async function fetchDrivers(params: DriverSearchParams = {}): Promise<PaginatedResponse<ApiDriver>> {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.status) qs.set('status', params.status);
  if (params.isVerified !== undefined) qs.set('isVerified', String(params.isVerified));
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  return api.get(`/admin/drivers/search?${qs.toString()}`);
}

export async function fetchPendingDrivers(): Promise<ApiDriver[]> {
  return api.get('/admin/drivers/pending');
}

export async function fetchDriverById(driverId: number): Promise<ApiDriver> {
  return api.get(`/admin/drivers/${driverId}`) as Promise<ApiDriver>;
}

export async function fetchDriverStats(driverId: number) {
  return api.get(`/admin/drivers/${driverId}/stats`);
}

export async function fetchDriverDocuments(driverId: number) {
  return api.get(`/admin/drivers/${driverId}/documents`);
}

export async function fetchDriverVehicles(driverId: number): Promise<ApiDriverVehicle[]> {
  return api.get(`/admin/drivers/${driverId}/vehicles`) as Promise<ApiDriverVehicle[]>;
}

export async function reviewDriver(
  driverId: number,
  decision: 'APPROVED' | 'REJECTED' | 'NEEDS_FIX',
  notes?: string,
  commissionRate?: number,
  fixRequirements?: Array<{ field: string; reason: string; required: boolean }>,
) {
  return api.post(`/admin/drivers/${driverId}/review`, { decision, notes, commissionRate, fixRequirements });
}

export async function bulkApproveDrivers(driverIds: number[], commissionRate?: number) {
  return api.post('/admin/drivers/bulk-approve', { driverIds, commissionRate });
}

export async function suspendDriver(driverId: number, reason: string) {
  return api.post(`/admin/drivers/${driverId}/suspend`, { reason });
}

export async function reactivateDriver(driverId: number) {
  return api.post(`/admin/drivers/${driverId}/reactivate`);
}

export async function toggleDriverStatus(driverId: number, status: string, reason?: string) {
  return api.patch(`/admin/drivers/${driverId}/status`, { status, reason });
}

export async function reviewVehicleChange(
  vehicleId: number,
  decision: 'APPROVED' | 'REJECTED' | 'NEEDS_FIX',
  notes?: string,
  fixRequirements?: Array<{ field: string; reason: string; required: boolean }>,
) {
  return api.patch(`/drivers/vehicles/${vehicleId}/review`, {
    applicationStatus: decision,
    adminNotes: notes,
    fixRequirements,
  });
}

// ── NEW: Full driver detail APIs ──────────────────────────────

export interface DriverTrip {
  id: number;
  publicId: string;
  vehicleType: string;
  status: string;
  passengerName: string | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  distanceKm: string | null;
  actualDistanceKm: string | null;
  estimatedFare: string | null;
  finalFare: string | null;
  createdAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  rating: number | null;
}

export interface DriverEarnings {
  totalEarnings: number;
  thisMonthEarnings: number;
  totalTrips: number;
  thisMonthTrips: number;
  pendingPayout: number;
  averageFare: number;
  completionRate: number;
}

export interface DriverTripsPaginated {
  trips: DriverTrip[];
  total: number;
  page: number;
  limit: number;
}

export async function fetchDriverTrips(driverId: number, page = 1, limit = 20): Promise<DriverTripsPaginated> {
  return api.get(`/admin/drivers/${driverId}/trips?page=${page}&limit=${limit}`);
}

export async function fetchDriverEarnings(driverId: number): Promise<DriverEarnings> {
  return api.get(`/admin/drivers/${driverId}/earnings`);
}

export async function revokeDriverApproval(driverId: number, reason: string, fixRequirements?: Array<{ field: string; reason: string; required: boolean }>) {
  return api.post(`/admin/drivers/${driverId}/revoke-approval`, { reason, fixRequirements });
}

export async function reopenDriverApplication(driverId: number, reason: string) {
  return api.post(`/admin/drivers/${driverId}/reopen`, { reason });
}

export async function updateFixRequirements(driverId: number, fixRequirements: Array<{ field: string; reason: string; required: boolean }>, adminNotes?: string) {
  return api.patch(`/admin/drivers/${driverId}/fix-requirements`, { fixRequirements, adminNotes });
}

// ── Liveness Session Review ───────────────────────────────────

export interface LivenessSession {
  id: number;
  publicId: string;
  userId: number;
  status: string;
  method: string;
  challengeType: string;
  attemptCount: number;
  reviewReason: string | null;
  failureReason: string | null;
  photoUrl: string | null;
  metrics: Record<string, any> | null;
  createdAt: string;
  verifiedAt: string | null;
  consumedAt: string | null;
  expiresAt?: string;
  user?: {
    id: number;
    name: string;
    phone: string;
    email: string | null;
    photoUrl: string | null;
  };
}

export async function fetchPendingLivenessSessions(): Promise<LivenessSession[]> {
  return api.get('/admin/drivers/liveness/pending');
}

export async function fetchDriverLivenessSessions(driverId: number): Promise<LivenessSession[]> {
  return api.get(`/admin/drivers/${driverId}/liveness`);
}

export async function reviewLivenessSession(
  sessionId: string,
  decision: 'VERIFIED' | 'FAILED',
  notes?: string,
) {
  return api.post(`/admin/drivers/liveness/${sessionId}/review`, { decision, notes });
}
