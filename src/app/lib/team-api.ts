// ── Admin Team Management API ─────────────────────────────────
// Endpoints: /admin/team/members, /admin/team/activity
// These manage admin/staff accounts — NOT regular users.
import { api } from './api';

// ── Types (match backend response shapes) ─────────────────────

export interface ApiTeamMember {
  id: number;
  userId: number;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  role: string;
  department: string | null;
  jobTitle: string | null;
  reportsTo: number | null;
  isActive: boolean;
  lastLoginAt: string | null;
  loginCount: number;
  createdAt: string;
}

export interface ApiActivityLog {
  id: number;
  adminUserId: number;
  adminName: string;
  adminRole: string;
  action: string;
  entityType: string | null;
  entityId: number | null;
  description: string;
  changes: unknown;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface CreateTeamMemberPayload {
  userId: number;
  fullName: string;
  email: string;
  phone?: string;
  role: string;
  department?: string;
  jobTitle?: string;
  reportsTo?: number;
}

export interface UpdateTeamMemberPayload {
  fullName?: string;
  email?: string;
  phone?: string;
  role?: string;
  department?: string;
  jobTitle?: string;
  reportsTo?: number;
}

// ── API calls ─────────────────────────────────────────────────

export async function fetchTeamMembers(): Promise<ApiTeamMember[]> {
  return api.get('/admin/team/members');
}

export async function fetchTeamMemberById(id: number): Promise<ApiTeamMember> {
  return api.get(`/admin/team/members/${id}`);
}

export async function createTeamMember(data: CreateTeamMemberPayload): Promise<ApiTeamMember> {
  return api.post('/admin/team/members', data);
}

export async function updateTeamMember(id: number, data: UpdateTeamMemberPayload): Promise<ApiTeamMember> {
  return api.patch(`/admin/team/members/${id}`, data);
}

export async function deactivateTeamMember(id: number): Promise<{ success: boolean; message: string }> {
  return api.delete(`/admin/team/members/${id}`);
}

export async function fetchActivityLogs(opts: { adminUserId?: number; limit?: number } = {}): Promise<ApiActivityLog[]> {
  const qs = new URLSearchParams();
  if (opts.adminUserId) qs.set('adminUserId', String(opts.adminUserId));
  if (opts.limit) qs.set('limit', String(opts.limit));
  const query = qs.toString();
  return api.get(`/admin/team/activity${query ? `?${query}` : ''}`);
}
