import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import type { Role } from '../lib/permissions';
import {
  adminLogin,
  adminVerify2fa,
  adminResend2fa,
  adminGetProfile,
  adminLogout,
  isTwoFactorChallenge,
  ApiError,
  type AdminProfile,
  type TwoFactorChallengeResponse,
  type LoginSuccessResponse,
} from '../lib/admin-api';

// ── Public types ──────────────────────────────────────────────

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatar?: string;
  department?: string;
  jobTitle?: string;
  permissions?: string[];
}

export interface TwoFactorState {
  sessionId: string;
  method: 'email' | 'sms';
  expiresIn: number;
  message: string;
}

interface AuthState {
  user: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitializing: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; twoFactor?: TwoFactorState; error?: string }>;
  verify2fa: (sessionId: string, code: string) => Promise<{ success: boolean; error?: string }>;
  resend2fa: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Helper: map API AdminProfile → local AdminUser ───────────

function toAdminUser(p: AdminProfile): AdminUser {
  return {
    id: String(p.id),
    email: p.email,
    name: p.fullName,
    role: p.role,
    avatar: p.avatarUrl,
    department: p.department,
    jobTitle: p.jobTitle,
    permissions: p.permissions,
  };
}

function extractError(err: unknown): string {
  if (err instanceof ApiError) {
    // Handle NestJS validation pipe array messages
    const body = err.body as Record<string, unknown> | null;
    if (body && Array.isArray(body.message)) {
      return (body.message as string[]).join('. ');
    }
    return err.message;
  }
  return 'Something went wrong. Please try again.';
}

// ── Provider ──────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    isInitializing: true,
  });

  // On mount, try to restore session from stored token
  useEffect(() => {
    const token = localStorage.getItem('direkto_access_token');
    if (!token) {
      setState(s => ({ ...s, isInitializing: false }));
      return;
    }

    adminGetProfile()
      .then(profile => {
        setState({
          user: toAdminUser(profile),
          isAuthenticated: true,
          isLoading: false,
          isInitializing: false,
        });
      })
      .catch(() => {
        // Token expired or invalid — clear it
        localStorage.removeItem('direkto_access_token');
        localStorage.removeItem('direkto_refresh_token');
        setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          isInitializing: false,
        });
      });
  }, []);

  // ── Login: Step 1 ─────────────────────────────────────────

  const login = useCallback(
    async (
      email: string,
      password: string,
    ): Promise<{ success: boolean; twoFactor?: TwoFactorState; error?: string }> => {
      setState(s => ({ ...s, isLoading: true }));

      try {
        const res = await adminLogin(email, password);

        if (isTwoFactorChallenge(res)) {
          const challenge = res as TwoFactorChallengeResponse;
          setState(s => ({ ...s, isLoading: false }));
          return {
            success: false,
            twoFactor: {
              sessionId: challenge.sessionId,
              method: challenge.method,
              expiresIn: challenge.expiresIn,
              message: challenge.message,
            },
          };
        }

        // Direct login (no 2FA)
        const success = res as LoginSuccessResponse;
        setState({
          user: toAdminUser(success.admin),
          isAuthenticated: true,
          isLoading: false,
          isInitializing: false,
        });
        return { success: true };
      } catch (err) {
        setState(s => ({ ...s, isLoading: false }));
        return { success: false, error: extractError(err) };
      }
    },
    [],
  );

  // ── Login: Step 2 (2FA) ───────────────────────────────────

  const verify2fa = useCallback(
    async (
      sessionId: string,
      code: string,
    ): Promise<{ success: boolean; error?: string }> => {
      setState(s => ({ ...s, isLoading: true }));

      try {
        const res = await adminVerify2fa(sessionId, code);
        setState({
          user: toAdminUser(res.admin),
          isAuthenticated: true,
          isLoading: false,
          isInitializing: false,
        });
        return { success: true };
      } catch (err) {
        setState(s => ({ ...s, isLoading: false }));
        return { success: false, error: extractError(err) };
      }
    },
    [],
  );

  // ── Resend 2FA code ───────────────────────────────────────

  const resend2fa = useCallback(
    async (sessionId: string): Promise<{ success: boolean; error?: string }> => {
      try {
        await adminResend2fa(sessionId);
        return { success: true };
      } catch (err) {
        return { success: false, error: extractError(err) };
      }
    },
    [],
  );

  // ── Logout ────────────────────────────────────────────────

  const logout = useCallback(async () => {
    await adminLogout();
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isInitializing: false,
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...state, login, logout, verify2fa, resend2fa }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}