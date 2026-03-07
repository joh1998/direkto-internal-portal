// ── Merchant Management API ───────────────────────────────────
import { api } from './api';
import type { PaginatedResponse } from './users-api';

// ── Types (match backend response shapes) ─────────────────────

export interface ApiMerchant {
  id: number;
  userId: number;
  publicId: string;
  businessName: string;
  businessType: string;
  businessRegistrationNumber: string | null;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  // Location
  businessAddress: string;
  latitude: string | null;
  longitude: string | null;
  municipality: string;
  // Verification
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  verifiedAt: string | null;
  verifiedBy: number | null;
  isActive: boolean;
  isFeatured: boolean;
  documents: Record<string, string> | null;
  // Bank/Payout
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  gcashNumber: string | null;
  // Commission & Contract
  contractedCommissionRate: string;
  commissionRateOverride: string | null;
  contractSignedDate: string | null;
  contractDocumentUrl: string | null;
  launchBonusEndDate: string | null;
  // Photos
  coverPhotoUrl: string | null;
  photos: string[];
  // Notes & Policies
  notes: string | null;
  cancellationPolicy: string | null;
  termsAndConditions: string | null;
  // Stats
  totalItems: number;
  activeItems: number;
  totalBookings: number;
  completedBookings: number;
  totalRevenue: string;
  pendingPayout: string;
  averageRating: string;
  totalReviews: number;
  // Dates
  createdAt: string;
  updatedAt: string;
}

export interface MerchantStats {
  merchantId: number;
  businessName: string;
  totalItems: number;
  activeItems: number;
  totalBookings: number;
  completedBookings: number;
  totalRevenue: number;
  averageRating: number;
  totalReviews: number;
  thisMonth: {
    bookings: number;
    revenue: number;
  };
}

export interface MerchantSearchParams {
  search?: string;
  status?: string;
  municipality?: string;
  verificationStatus?: string;
  page?: number;
  limit?: number;
}

// ── API calls ─────────────────────────────────────────────────

export async function fetchMerchants(params: MerchantSearchParams = {}): Promise<PaginatedResponse<ApiMerchant>> {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.status) qs.set('status', params.status);
  if (params.municipality) qs.set('municipality', params.municipality);
  if (params.verificationStatus) qs.set('verificationStatus', params.verificationStatus);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  return api.get(`/admin/merchants/search?${qs.toString()}`);
}

export async function fetchPendingMerchants(): Promise<ApiMerchant[]> {
  return api.get('/admin/merchants/pending');
}

export async function fetchMerchantById(merchantId: number): Promise<ApiMerchant> {
  return api.get(`/admin/merchants/${merchantId}`);
}

export async function fetchMerchantStats(merchantId: number): Promise<MerchantStats> {
  return api.get(`/admin/merchants/${merchantId}/stats`);
}

export async function reviewMerchant(
  merchantId: number,
  decision: 'APPROVED' | 'REJECTED',
  notes: string,
) {
  return api.post(`/admin/merchants/${merchantId}/review`, { decision, notes });
}

export async function bulkApproveMerchants(merchantIds: number[], commissionRate: number) {
  return api.post('/admin/merchants/bulk-approve', { merchantIds, commissionRate });
}

export async function toggleMerchantStatus(
  merchantId: number,
  status: 'ACTIVE' | 'SUSPENDED',
  reason: string,
) {
  return api.patch(`/admin/merchants/${merchantId}/status`, { status, reason });
}

export interface UpdateMerchantPayload {
  commissionRateOverride?: number | null;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  gcashNumber?: string;
  documents?: Record<string, string>;
  isFeatured?: boolean;
  notes?: string;
  latitude?: string;
  longitude?: string;
  businessAddress?: string;
  coverPhotoUrl?: string | null;
  photos?: string[];
}

export async function updateMerchant(
  merchantId: number,
  payload: UpdateMerchantPayload,
): Promise<ApiMerchant> {
  return api.patch(`/admin/merchants/${merchantId}`, payload);
}

export interface MerchantCommissionInfo {
  merchantId: number;
  merchantName: string;
  currentRate: number;
  currentRateSource: 'LAUNCH_BONUS' | 'OVERRIDE' | 'CONTRACT';
  contractedRate: number;
  contractSignedDate: string | null;
  hasLaunchBonus: boolean;
  launchBonusActive: boolean;
  launchBonusEndDate: string | null;
  daysRemainingInBonus?: number;
  hasOverride: boolean;
  overrideRate?: number;
  last30Days: {
    totalBookings: number;
    totalCommissionEarned: number;
    totalMerchantEarnings: number;
  };
}

export interface MerchantCommissionHistoryEntry {
  id: number;
  merchantId: number;
  eventType: string;
  oldRate: string | null;
  newRate: string | null;
  description: string;
  metadata: Record<string, unknown> | null;
  changedByUserId: number | null;
  changedBySystem: boolean | null;
  createdAt: string;
}

export async function fetchMerchantCommissionInfo(merchantId: number): Promise<MerchantCommissionInfo> {
  return api.get(`/admin/merchants/${merchantId}/commission`);
}

export async function fetchMerchantCommissionHistory(
  merchantId: number,
  limit: number = 20,
): Promise<{ merchantId: number; history: MerchantCommissionHistoryEntry[] }> {
  const qs = new URLSearchParams();
  qs.set('limit', String(limit));
  return api.get(`/admin/merchants/${merchantId}/commission/history?${qs.toString()}`);
}

export async function setMerchantCommissionOverride(
  merchantId: number,
  overrideRate: number,
  reason: string,
): Promise<{ success: boolean; message: string }> {
  return api.post(`/admin/merchants/${merchantId}/commission/override`, {
    overrideRate,
    reason,
  });
}

export async function removeMerchantCommissionOverride(
  merchantId: number,
): Promise<{ success: boolean; message: string }> {
  return api.delete(`/admin/merchants/${merchantId}/commission/override`);
}

// ── Rental Categories ─────────────────────────────────────────

export interface RentalCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  parentCategoryId: number | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export async function fetchRentalCategories(): Promise<RentalCategory[]> {
  return api.get('/rentals/categories');
}

export interface RentalTemplate {
  id: number;
  publicId: string;
  merchantId: number;
  name: string;
  categoryId: number | null;
  categoryName?: string;
  categorySlug?: string;
  subCategory?: string | null;
  description: string | null;
  specifications?: Record<string, any> | null;
  features?: string[] | null;
  baseDailyRate: string;
  baseWeeklyRate?: string | null;
  baseMonthlyRate?: string | null;
  cancellationPolicy?: string | null;
  termsAndConditions?: string | null;
  requiredDocuments?: string[] | null;
  templatePhotos?: string[] | null;
  isActive: boolean;
  createdAt?: string;
}

export async function fetchMerchantTemplates(merchantId: number): Promise<RentalTemplate[]> {
  return api.get(`/admin/merchants/${merchantId}/templates`);
}

// ── Admin Template CRUD ───────────────────────────────────────

export interface CreateTemplatePayload {
  name: string;
  categoryId: number;
  subCategory?: string;
  description: string;
  specifications?: Record<string, any>;
  features?: string[];
  baseDailyRate: number;
  baseWeeklyRate?: number;
  baseMonthlyRate?: number;
  cancellationPolicy?: string;
  termsAndConditions?: string;
  requiredDocuments?: string[];
  templatePhotos?: string[];
}

export async function adminCreateTemplate(
  merchantId: number,
  payload: CreateTemplatePayload,
): Promise<{ success: boolean; template: RentalTemplate }> {
  return api.post(`/admin/merchants/${merchantId}/templates`, payload);
}

export interface UpdateTemplatePayload {
  name?: string;
  categoryId?: number;
  subCategory?: string;
  description?: string;
  specifications?: Record<string, any>;
  features?: string[];
  baseDailyRate?: number;
  baseWeeklyRate?: number;
  baseMonthlyRate?: number;
  cancellationPolicy?: string;
  termsAndConditions?: string;
  requiredDocuments?: string[];
  templatePhotos?: string[];
  isActive?: boolean;
}

export async function adminUpdateTemplate(
  merchantId: number,
  templateId: number,
  payload: UpdateTemplatePayload,
): Promise<{ success: boolean; templateId: number; changedFields: string[] }> {
  return api.patch(`/admin/merchants/${merchantId}/templates/${templateId}`, payload);
}

export async function adminDeleteTemplate(
  merchantId: number,
  templateId: number,
): Promise<{ success: boolean; templateId: number; deletedTemplate: string }> {
  return api.delete(`/admin/merchants/${merchantId}/templates/${templateId}`);
}

// ── Merchant Bookings (Admin View) ────────────────────────────

export interface AdminBooking {
  id: number;
  publicId: string;
  bookingNumber: string;
  status: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  dailyRate: string;
  subtotal: string;
  totalAmount: string;
  commissionAmount: string;
  merchantEarnings: string;
  depositAmount: string;
  depositStatus: string;
  paymentStatus: string;
  promoDiscount: string;
  lateFee: string;
  damageCharge: string;
  cancellationReason: string | null;
  renterName: string | null;
  renterPhone: string | null;
  templateName: string | null;
  unitNumber: string | null;
  unitName: string | null;
  createdAt: string;
}

export interface BookingsResponse {
  data: AdminBooking[];
  statusSummary: Record<string, number>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export async function fetchMerchantBookings(
  merchantId: number,
  params: { status?: string; page?: number; limit?: number } = {},
): Promise<BookingsResponse> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  return api.get(`/admin/merchants/${merchantId}/bookings?${qs.toString()}`);
}

// ── Merchant Promo Codes (Admin View) ─────────────────────────

export interface AdminPromoCode {
  id: number;
  code: string;
  description: string | null;
  discountType: string; // 'PERCENTAGE' | 'FIXED'
  discountValue: string;
  maxDiscountAmount: string | null;
  minBookingAmount: string | null;
  merchantId: number | null;
  categoryId: number | null;
  marketId: number | null;
  maxUses: number | null;
  maxUsesPerUser: number | null;
  currentUses: number;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface PromoCodesResponse {
  data: AdminPromoCode[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export async function fetchMerchantPromoCodes(
  merchantId: number,
  params: { active?: boolean; page?: number; limit?: number } = {},
): Promise<PromoCodesResponse> {
  const qs = new URLSearchParams();
  if (params.active !== undefined) qs.set('active', String(params.active));
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  return api.get(`/admin/merchants/${merchantId}/promo-codes?${qs.toString()}`);
}

export async function adminDeactivatePromo(
  merchantId: number,
  promoId: number,
): Promise<{ success: boolean; promoId: number; code: string }> {
  return api.post(`/admin/merchants/${merchantId}/promo-codes/${promoId}/deactivate`);
}

// ── Merchant Extensions (Admin View) ──────────────────────────

export interface AdminExtension {
  id: number;
  bookingId: number;
  status: string; // 'PENDING' | 'APPROVED' | 'REJECTED'
  originalEndDate: string;
  requestedEndDate: string;
  extraDays: number;
  additionalCost: string;
  additionalCommission: string;
  renterNotes: string | null;
  merchantNotes: string | null;
  rejectionReason: string | null;
  respondedAt: string | null;
  createdAt: string;
  bookingNumber: string;
  renterName: string | null;
  templateName: string | null;
}

export interface ExtensionsResponse {
  data: AdminExtension[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export async function fetchMerchantExtensions(
  merchantId: number,
  params: { status?: string; page?: number; limit?: number } = {},
): Promise<ExtensionsResponse> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  return api.get(`/admin/merchants/${merchantId}/extensions?${qs.toString()}`);
}

// ── Merchant Damage Reports (Admin View) ──────────────────────

export interface AdminDamageReport {
  id: number;
  bookingId: number;
  unitId: number;
  description: string;
  severity: string; // 'MINOR' | 'MODERATE' | 'SEVERE'
  photos: string[] | null;
  estimatedRepairCost: string;
  actualRepairCost: string | null;
  status: string; // 'PENDING' | 'ACKNOWLEDGED' | 'DISPUTED' | 'RESOLVED'
  disputeReason: string | null;
  resolution: string | null;
  resolvedAmount: string | null;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  reportedAt: string;
  bookingNumber: string;
  renterName: string | null;
  unitNumber: string | null;
  unitName: string | null;
  templateName: string | null;
}

export interface DamageReportsResponse {
  data: AdminDamageReport[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export async function fetchMerchantDamageReports(
  merchantId: number,
  params: { status?: string; page?: number; limit?: number } = {},
): Promise<DamageReportsResponse> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  return api.get(`/admin/merchants/${merchantId}/damage-reports?${qs.toString()}`);
}

export async function adminResolveDamageReport(
  reportId: number,
  resolution: string,
  resolvedAmount: number,
  notes: string,
): Promise<{ success: boolean; reportId: number; resolution: string; resolvedAmount: number }> {
  return api.post(`/admin/merchants/damage-reports/${reportId}/resolve`, {
    resolution,
    resolvedAmount,
    notes,
  });
}

// ── Rental Unit Management (Admin) ────────────────────────────

export interface AdminUnit {
  id: number;
  publicId: string;
  templateId: number;
  merchantId: number;
  unitNumber: string;
  unitName: string | null;
  plateNumber: string | null;
  serialNumber: string | null;
  color: string | null;
  year: number | null;
  currentMileage: number | null;
  condition: string;
  conditionNotes: string | null;
  conditionScore: number | null;
  photos: string[] | null;
  mainPhotoUrl: string | null;
  dailyRate: string;
  weeklyRate?: string | null;
  monthlyRate?: string | null;
  depositAmount: string;
  damageWaiverFee?: string | null;
  replacementValue: string;
  pickupAddress: string | null;
  deliveryAvailable: boolean;
  deliveryFee?: string | null;
  deliveryRadiusKm?: number | null;
  isAvailable: boolean;
  availabilityStatus: string;
  unavailableReason: string | null;
  totalBookings: number;
  totalRevenue: string;
  totalRentalDays: number;
  averageRating: string;
  verificationStatus: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface TemplateUnitsResponse {
  data: AdminUnit[];
  templateName: string;
  totalUnits: number;
  availableUnits: number;
}

export async function fetchTemplateUnits(
  merchantId: number,
  templateId: number,
): Promise<TemplateUnitsResponse> {
  return api.get(`/admin/merchants/${merchantId}/templates/${templateId}/units`);
}

export interface CreateUnitPayload {
  unitNumber: string;
  unitName?: string;
  plateNumber?: string;
  serialNumber?: string;
  color?: string;
  year?: number;
  currentMileage?: number;
  condition: 'EXCELLENT' | 'GOOD' | 'FAIR';
  conditionNotes?: string;
  conditionScore?: number;
  photos?: string[];
  dailyRate: number;
  weeklyRate?: number;
  monthlyRate?: number;
  depositAmount: number;
  damageWaiverFee?: number;
  replacementValue: number;
  pickupAddress?: string;
  deliveryAvailable?: boolean;
  deliveryFee?: number;
  deliveryRadiusKm?: number;
}

export async function adminCreateUnit(
  merchantId: number,
  templateId: number,
  payload: CreateUnitPayload,
): Promise<{ success: boolean; unit: AdminUnit }> {
  return api.post(`/admin/merchants/${merchantId}/templates/${templateId}/units`, payload);
}

export interface UpdateUnitPayload {
  unitNumber?: string;
  unitName?: string;
  plateNumber?: string;
  serialNumber?: string;
  color?: string;
  year?: number;
  currentMileage?: number;
  condition?: 'EXCELLENT' | 'GOOD' | 'FAIR';
  conditionNotes?: string;
  conditionScore?: number;
  photos?: string[];
  dailyRate?: number;
  weeklyRate?: number;
  monthlyRate?: number;
  depositAmount?: number;
  damageWaiverFee?: number;
  replacementValue?: number;
  pickupAddress?: string;
  deliveryAvailable?: boolean;
  deliveryFee?: number;
  deliveryRadiusKm?: number;
  isAvailable?: boolean;
  isActive?: boolean;
}

export async function adminUpdateUnit(
  merchantId: number,
  unitId: number,
  payload: UpdateUnitPayload,
): Promise<{ success: boolean; unitId: number; changedFields: string[] }> {
  return api.patch(`/admin/merchants/${merchantId}/units/${unitId}`, payload);
}

export async function adminDeleteUnit(
  merchantId: number,
  unitId: number,
): Promise<{ success: boolean; unitId: number; deletedUnit: string }> {
  return api.delete(`/admin/merchants/${merchantId}/units/${unitId}`);
}
