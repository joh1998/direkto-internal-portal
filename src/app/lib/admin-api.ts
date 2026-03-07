// ── Admin Auth API ─────────────────────────────────────────────
// Typed functions matching the NestJS admin-auth controller

import { api, setTokens, clearTokens, ApiError } from './api';
import type { Role } from './permissions';

// ── Response types ────────────────────────────────────────────

export interface AdminProfile {
  id: number;
  fullName: string;
  email: string;
  role: Role;
  department?: string;
  jobTitle?: string;
  avatarUrl?: string;
  permissions: string[];
}

export interface LoginSuccessResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  admin: AdminProfile;
}

export interface TwoFactorChallengeResponse {
  requiresTwoFactor: true;
  sessionId: string;
  method: 'email' | 'sms';
  expiresIn: number;
  message: string;
}

export type LoginResponse = LoginSuccessResponse | TwoFactorChallengeResponse;

export function isTwoFactorChallenge(
  res: LoginResponse,
): res is TwoFactorChallengeResponse {
  return 'requiresTwoFactor' in res && res.requiresTwoFactor === true;
}

export interface ResendCodeResponse {
  success: boolean;
  method: string;
  expiresIn: number;
  message: string;
}

export interface FullAdminProfile extends AdminProfile {
  phone?: string;
  isActive: boolean;
  lastLoginAt?: string;
  loginCount?: number;
  twoFactorEnabled: boolean;
  twoFactorMethod?: string;
}

// ── API calls ─────────────────────────────────────────────────

/** Step 1: email + password → tokens OR 2FA challenge */
export async function adminLogin(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const res = await api.post<LoginResponse>('/admin/auth/login', {
    email,
    password,
  });

  // If we got tokens directly (no 2FA), store them
  if (!isTwoFactorChallenge(res)) {
    setTokens(res.accessToken, res.refreshToken);
  }

  return res;
}

/** Step 2: verify 2FA code → tokens */
export async function adminVerify2fa(
  sessionId: string,
  code: string,
): Promise<LoginSuccessResponse> {
  const res = await api.post<LoginSuccessResponse>('/admin/auth/verify-2fa', {
    sessionId,
    code,
  });
  setTokens(res.accessToken, res.refreshToken);
  return res;
}

/** Resend 2FA code */
export async function adminResend2fa(
  sessionId: string,
): Promise<ResendCodeResponse> {
  return api.post<ResendCodeResponse>('/admin/auth/resend-2fa', { sessionId });
}

/** Get current admin profile (requires token) */
export async function adminGetProfile(): Promise<FullAdminProfile> {
  return api.get<FullAdminProfile>('/admin/auth/me');
}

/** Logout — revoke current session */
export async function adminLogout(): Promise<void> {
  try {
    await api.post('/admin/auth/logout');
  } catch {
    // Even if API call fails, clear local tokens
  } finally {
    clearTokens();
  }
}

export { ApiError };
