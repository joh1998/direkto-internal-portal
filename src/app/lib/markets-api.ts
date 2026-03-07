import { api } from './api';

/* ── Types ──────────────────────────────────────────────────── */

export interface Market {
  id: number;
  slug: string;
  displayName: string;
  description: string | null;
  currency: string;
  timezone: string;
  serviceAreaId: string | null;
  serviceArea: { id: string | null; name: string } | null;
  boundaryGeo: { type: 'Polygon'; coordinates: number[][][] } | null;
  centerLat: string;
  centerLng: string;
  radiusKm: string;
  isActive: boolean;
  launchDate: string | null;
  surgeMultiplier: string;
  surgeReason: string | null;
  createdAt: string;
  updatedAt: string;
  farePlans?: FarePlan[];
  vehicleTypes?: VehicleType[];
}

export interface VehicleType {
  id: number;
  marketId: number;
  key: string;
  label: string;
  description: string | null;
  emoji: string | null;
  iconUrl: string | null;
  maxPassengers: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVehicleTypeDto {
  key: string;
  label: string;
  description?: string;
  emoji?: string;
  iconUrl?: string;
  maxPassengers?: number;
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdateVehicleTypeDto extends Partial<Omit<CreateVehicleTypeDto, 'key'>> {}

export interface FarePlan {
  id: number;
  marketId: number;
  vehicleTypeId: number | null;
  vehicleType: string;
  vehicleLabel: string;
  vehicleDescription: string | null;
  maxPassengers: number;
  iconUrl: string | null;
  baseFare: string;
  baseDistanceKm: string;
  perKmRate: string;
  perMinRate: string;
  minFare: string;
  pickupFee: string;
  roundTo: string;
  commissionRate: string;
  cancelFeeAssigned: string;
  cancelFeeInProgress: string;
  surgeCap: string;
  isActive: boolean;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  sortOrder: number;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMarketDto {
  slug: string;
  displayName: string;
  description?: string;
  currency?: string;
  timezone?: string;
  serviceAreaId?: string;
  centerLat: number;
  centerLng: number;
  radiusKm?: number;
  boundaryGeo?: { type: 'Polygon'; coordinates: number[][][] };
  isActive?: boolean;
  launchDate?: string;
}

export interface UpdateMarketDto {
  displayName?: string;
  description?: string;
  currency?: string;
  timezone?: string;
  serviceAreaId?: string | null;
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
  boundaryGeo?: { type: 'Polygon'; coordinates: number[][][] };
  isActive?: boolean;
  launchDate?: string;
  surgeMultiplier?: number;
  surgeReason?: string;
}

export interface CreateFarePlanDto {
  vehicleType: string;
  vehicleLabel: string;
  vehicleDescription?: string;
  maxPassengers?: number;
  iconUrl?: string;
  baseFare: number;
  baseDistanceKm?: number;
  perKmRate: number;
  perMinRate?: number;
  minFare: number;
  pickupFee?: number;
  roundTo?: number;
  commissionRate?: number;
  cancelFeeAssigned?: number;
  cancelFeeInProgress?: number;
  surgeCap?: number;
  isActive?: boolean;
  effectiveFrom?: string;
  effectiveUntil?: string;
  sortOrder?: number;
  vehicleTypeId?: number;
}

export interface UpdateFarePlanDto extends Partial<Omit<CreateFarePlanDto, 'vehicleType'>> {}

/* ── Market endpoints ───────────────────────────────────────── */

export async function fetchMarkets(): Promise<Market[]> {
  return api.get('/markets?includeFarePlans=true') as Promise<Market[]>;
}

export async function fetchMarketById(id: number): Promise<Market> {
  return api.get(`/markets/${id}`) as Promise<Market>;
}

export async function fetchMarketBySlug(slug: string): Promise<Market> {
  return api.get(`/markets/slug/${slug}`) as Promise<Market>;
}

export async function createMarket(data: CreateMarketDto): Promise<Market> {
  return api.post('/markets', data) as Promise<Market>;
}

export async function updateMarket(id: number, data: UpdateMarketDto): Promise<Market> {
  return api.put(`/markets/${id}`, data) as Promise<Market>;
}

export async function deleteMarket(id: number): Promise<void> {
  await api.delete(`/markets/${id}`);
}

export async function setSurge(id: number, multiplier: number, reason?: string): Promise<Market> {
  return api.patch(`/markets/${id}/surge`, { multiplier, reason }) as Promise<Market>;
}

/* ── Fare Plan endpoints ────────────────────────────────────── */

export async function fetchFarePlans(marketId: number, includeInactive = false): Promise<FarePlan[]> {
  return api.get(`/markets/${marketId}/fare-plans${includeInactive ? '?includeInactive=true' : ''}`) as Promise<FarePlan[]>;
}

export async function fetchFarePlanById(planId: number): Promise<FarePlan> {
  return api.get(`/markets/fare-plans/${planId}`) as Promise<FarePlan>;
}

export async function createFarePlan(marketId: number, data: CreateFarePlanDto): Promise<FarePlan> {
  return api.post(`/markets/${marketId}/fare-plans`, data) as Promise<FarePlan>;
}

export async function updateFarePlan(planId: number, data: UpdateFarePlanDto): Promise<FarePlan> {
  return api.put(`/markets/fare-plans/${planId}`, data) as Promise<FarePlan>;
}

export async function deleteFarePlan(planId: number): Promise<void> {
  await api.delete(`/markets/fare-plans/${planId}`);
}

/* ── Vehicle Type endpoints ─────────────────────────────────── */

export async function fetchVehicleTypes(marketId: number): Promise<VehicleType[]> {
  return api.get(`/markets/${marketId}/vehicle-types`) as Promise<VehicleType[]>;
}

export async function fetchVehicleTypeById(vtId: number): Promise<VehicleType> {
  return api.get(`/markets/vehicle-types/${vtId}`) as Promise<VehicleType>;
}

export async function createVehicleType(marketId: number, data: CreateVehicleTypeDto): Promise<VehicleType> {
  return api.post(`/markets/${marketId}/vehicle-types`, data) as Promise<VehicleType>;
}

export async function updateVehicleType(vtId: number, data: UpdateVehicleTypeDto): Promise<VehicleType> {
  return api.put(`/markets/vehicle-types/${vtId}`, data) as Promise<VehicleType>;
}

export async function deleteVehicleType(vtId: number): Promise<void> {
  await api.delete(`/markets/vehicle-types/${vtId}`);
}
