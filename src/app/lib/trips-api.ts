// ── Trip Monitoring API ────────────────────────────────────────
// Typed functions matching the NestJS TripMonitoringController
import { api } from './api';
import type { PaginatedResponse } from './users-api';

// ── Types (match backend response shapes) ─────────────────────

export interface TripPassenger {
  id: number;
  name: string | null;
  phone: string;
  photoUrl: string | null;
}

export interface TripDriver {
  id: number;
  userId: number;
  rating: string | null;
  currentLatitude?: string | null;
  currentLongitude?: string | null;
  user: {
    name: string | null;
    phone?: string | null;
  } | null;
}

export interface TripVehicle {
  id: number;
  vehicleType: string;
  plateNumber: string;
  make: string | null;
  model: string | null;
}

export type TripStatus =
  | 'REQUESTING'
  | 'DRIVER_ASSIGNED'
  | 'DRIVER_ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'CANCELLED_BY_PASSENGER'
  | 'CANCELLED_BY_DRIVER'
  | 'NO_DRIVERS_AVAILABLE'
  | 'EXPIRED';

export interface ApiTrip {
  id: number;
  publicId: string;
  vehicleType: string;
  status: TripStatus;
  passengerId: number;
  driverId: number | null;
  vehicleId: number | null;

  pickupLatitude: string;
  pickupLongitude: string;
  pickupAddress: string | null;
  dropoffLatitude: string;
  dropoffLongitude: string;
  dropoffAddress: string | null;

  estimatedDistance: number | null;
  estimatedDuration: number | null;
  estimatedFare: string | null;
  finalFare: string | null;
  actualDistance: number | null;
  actualDuration: number | null;

  commission: string | null;
  driverEarnings: string | null;
  surgeMultiplier: string | null;

  requestedAt: string;
  acceptedAt: string | null;
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancellationReason: string | null;

  passengerRating: number | null;
  driverRating: number | null;

  createdAt: string;
  updatedAt: string;

  // joined relations
  passenger: TripPassenger | null;
  driver: TripDriver | null;
  vehicle: TripVehicle | null;
}

export interface TripStatistics {
  totalTrips: number;
  activeTrips: number;
  completedTrips: number;
  cancelledTrips: number;
  totalRevenue: string;
  totalCommission: string;
  averageFare: string;
  averageDistance: number;
  averageDuration: number;
}

export interface TripTimelineEntry {
  status: string;
  timestamp: string;
  description: string;
}

export interface TripSearchParams {
  search?: string;
  status?: string;
  vehicleType?: string;
  dateFrom?: string;
  dateTo?: string;
  minFare?: number;
  maxFare?: number;
  page?: number;
  limit?: number;
}

// ── API functions ─────────────────────────────────────────────

/** Search trips with pagination & filters */
export async function fetchTrips(params: TripSearchParams = {}): Promise<PaginatedResponse<ApiTrip>> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  if (params.vehicleType) query.set('vehicleType', params.vehicleType);
  if (params.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params.dateTo) query.set('dateTo', params.dateTo);
  if (params.minFare != null) query.set('minFare', String(params.minFare));
  if (params.maxFare != null) query.set('maxFare', String(params.maxFare));
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  return api.get<PaginatedResponse<ApiTrip>>(`/admin/trips/search${qs ? `?${qs}` : ''}`);
}

/** Get all currently active trips */
export async function fetchActiveTrips(): Promise<ApiTrip[]> {
  return api.get<ApiTrip[]>('/admin/trips/active');
}

/** Get trip statistics */
export async function fetchTripStatistics(dateFrom?: string, dateTo?: string): Promise<TripStatistics> {
  const query = new URLSearchParams();
  if (dateFrom) query.set('dateFrom', dateFrom);
  if (dateTo) query.set('dateTo', dateTo);
  const qs = query.toString();
  return api.get<TripStatistics>(`/admin/trips/statistics${qs ? `?${qs}` : ''}`);
}

/** Get single trip details */
export async function fetchTripById(tripId: number): Promise<ApiTrip> {
  return api.get<ApiTrip>(`/admin/trips/${tripId}`);
}

/** Get trip timeline */
export async function fetchTripTimeline(tripId: number): Promise<TripTimelineEntry[]> {
  return api.get<TripTimelineEntry[]>(`/admin/trips/${tripId}/timeline`);
}

/** Admin cancel a trip */
export async function adminCancelTrip(tripId: number, reason: string): Promise<{ success: boolean; message: string }> {
  return api.post<{ success: boolean; message: string }>(`/admin/trips/${tripId}/cancel`, { reason });
}
