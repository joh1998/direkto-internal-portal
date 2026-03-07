// ── User Management API ───────────────────────────────────────
import { api } from './api';

// ── Types (match backend response shapes) ─────────────────────

export interface ApiUser {
  id: string;
  fullName: string;
  email: string | null;
  phoneNumber: string;
  isBanned: boolean;
  banReason: string | null;
  createdAt: string;
  totalTrips: number;
  totalRentals: number;
  totalSpent: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UserSearchParams {
  search?: string;
  status?: 'ACTIVE' | 'BANNED';
  page?: number;
  limit?: number;
}

// ── API calls ─────────────────────────────────────────────────

export async function fetchUsers(params: UserSearchParams = {}): Promise<PaginatedResponse<ApiUser>> {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.status) qs.set('status', params.status);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  return api.get(`/admin/users/search?${qs.toString()}`);
}

export async function fetchUserDetails(userId: number) {
  return api.get(`/admin/users/${userId}`);
}

export async function toggleUserBan(userId: number, isBanned: boolean, reason?: string) {
  return api.patch(`/admin/users/${userId}/ban`, { isBanned, reason });
}

export async function updateUserDetails(userId: number, data: Record<string, unknown>) {
  return api.patch(`/admin/users/${userId}`, data);
}
