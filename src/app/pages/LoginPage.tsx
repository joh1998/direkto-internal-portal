import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAuth, type TwoFactorState } from '../context/AuthContext';
import {
  Eye,
  EyeOff,
  AlertCircle,
  ArrowLeft,
  Mail,
  Smartphone,
  ShieldCheck,
  Loader2,
  MapPin,
} from 'lucide-react';

type Step = 'credentials' | 'two-factor';

export function LoginPage() {
  const { login, verify2fa, resend2fa, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // ── State ──────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');

  // 2FA state
  const [twoFactor, setTwoFactor] = useState<TwoFactorState | null>(null);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // ── Step 1: Credentials ────────────────────────────────────

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Email is required'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }

    const result = await login(email, password);

    if (result.success) {
      navigate('/', { replace: true });
    } else if (result.twoFactor) {
      setTwoFactor(result.twoFactor);
      setStep('two-factor');
      setOtpDigits(['', '', '', '', '', '']);
      setResendCooldown(60);
      // Focus first OTP input after render
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } else if (result.error) {
      setError(result.error);
    }
  }

  // ── Step 2: 2FA Verification ───────────────────────────────

  function handleOtpChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return; // digits only
    const next = [...otpDigits];
    next[index] = value.slice(-1); // take last char
    setOtpDigits(next);

    // Auto-advance
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 filled
    if (value && index === 5 && next.every(d => d !== '')) {
      submitOtp(next.join(''));
    }
  }

  function handleOtpKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = [...otpDigits];
    for (let i = 0; i < 6; i++) next[i] = pasted[i] || '';
    setOtpDigits(next);
    if (pasted.length === 6) {
      submitOtp(pasted);
    } else {
      otpRefs.current[pasted.length]?.focus();
    }
  }

  async function submitOtp(code?: string) {
    if (!twoFactor) return;
    setError('');
    const c = code || otpDigits.join('');
    if (c.length !== 6) { setError('Enter all 6 digits'); return; }

    const result = await verify2fa(twoFactor.sessionId, c);
    if (result.success) {
      navigate('/', { replace: true });
    } else {
      setError(result.error || 'Invalid verification code');
      setOtpDigits(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    }
  }

  async function handleResend() {
    if (!twoFactor || resendCooldown > 0) return;
    setError('');
    const result = await resend2fa(twoFactor.sessionId);
    if (result.success) {
      setResendCooldown(60);
    } else {
      setError(result.error || 'Failed to resend code');
    }
  }

  function goBack() {
    setStep('credentials');
    setTwoFactor(null);
    setOtpDigits(['', '', '', '', '', '']);
    setError('');
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex bg-[var(--background)]">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] bg-[var(--primary)] relative overflow-hidden flex-col justify-between p-12 text-[var(--primary-foreground)]">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <MapPin size={22} />
            </div>
            <h1 className="text-[26px] tracking-tight" style={{ fontWeight: 700 }}>Direkto</h1>
          </div>
          <p className="text-[15px] opacity-80 mt-1">Internal Admin Portal</p>
        </div>

        <div className="relative z-10 space-y-6">
          <blockquote className="text-[18px] leading-relaxed opacity-90" style={{ fontWeight: 300 }}>
            "Manage your ride-hailing platform with confidence — real-time monitoring, driver management, and analytics all in one place."
          </blockquote>
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-8 h-8 rounded-full bg-white/20 backdrop-blur border-2 border-white/30 flex items-center justify-center text-[11px]" style={{ fontWeight: 600 }}>
                  {['AR', 'JL', 'SC'][i]}
                </div>
              ))}
            </div>
            <p className="text-[13px] opacity-70">Trusted by the Direkto operations team</p>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute inset-0 opacity-[0.06]">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full border-[40px] border-white" />
          <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full border-[50px] border-white" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full border-[30px] border-white" />
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[420px]">

          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[var(--primary)] flex items-center justify-center text-[var(--primary-foreground)]">
                <MapPin size={18} />
              </div>
              <h1 className="text-[24px] tracking-tight text-[var(--foreground)]" style={{ fontWeight: 700 }}>Direkto</h1>
            </div>
            <p className="text-[13px] text-[var(--muted-foreground)] mt-1">Internal Admin Portal</p>
          </div>

          {/* ── Credentials Step ─────────────────────────────── */}
          {step === 'credentials' && (
            <div>
              <div className="mb-8">
                <h2 className="text-[22px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>
                  Welcome back
                </h2>
                <p className="text-[14px] text-[var(--muted-foreground)] mt-1">
                  Sign in to your admin account to continue
                </p>
              </div>

              {error && <ErrorBanner message={error} />}

              <form onSubmit={handleLogin} className="space-y-5" noValidate>
                <div>
                  <label htmlFor="email" className="block text-[13px] text-[var(--foreground)] mb-1.5" style={{ fontWeight: 500 }}>
                    Email address
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-[14px] bg-[var(--input-background,var(--background))] border border-[var(--border)] rounded-xl outline-none focus:ring-2 focus:ring-[var(--ring)]/20 focus:border-[var(--ring)]/40 transition-all text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50"
                      placeholder="you@direkto.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="password" className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>
                      Password
                    </label>
                    <button type="button" className="text-[12px] text-[var(--primary)] hover:underline" style={{ fontWeight: 500 }}>
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full px-4 py-2.5 pr-10 text-[14px] bg-[var(--input-background,var(--background))] border border-[var(--border)] rounded-xl outline-none focus:ring-2 focus:ring-[var(--ring)]/20 focus:border-[var(--ring)]/40 transition-all text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50"
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                      aria-label={showPass ? 'Hide password' : 'Show password'}
                    >
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 bg-[var(--primary)] text-[var(--primary-foreground)] text-[14px] rounded-xl hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  style={{ fontWeight: 500 }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </form>

              {/* Security note */}
              <div className="mt-8 flex items-start gap-2.5 p-3.5 rounded-xl bg-[var(--accent)]/50 border border-[var(--border)]">
                <ShieldCheck size={16} className="text-[var(--muted-foreground)] mt-0.5 shrink-0" />
                <p className="text-[12px] text-[var(--muted-foreground)] leading-relaxed">
                  This is a secure admin area. All login attempts are logged and monitored. 
                  Accounts are locked after 5 failed attempts.
                </p>
              </div>
            </div>
          )}

          {/* ── Two-Factor Step ──────────────────────────────── */}
          {step === 'two-factor' && twoFactor && (
            <div>
              <button
                onClick={goBack}
                className="flex items-center gap-1.5 text-[13px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors mb-6"
              >
                <ArrowLeft size={14} />
                Back to login
              </button>

              <div className="mb-8">
                <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center mb-4">
                  {twoFactor.method === 'sms' ? (
                    <Smartphone size={22} className="text-[var(--primary)]" />
                  ) : (
                    <Mail size={22} className="text-[var(--primary)]" />
                  )}
                </div>
                <h2 className="text-[22px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>
                  Two-factor authentication
                </h2>
                <p className="text-[14px] text-[var(--muted-foreground)] mt-1.5 leading-relaxed">
                  {twoFactor.message || (
                    twoFactor.method === 'sms'
                      ? 'We sent a 6-digit code to your phone.'
                      : `We sent a 6-digit code to ${email}.`
                  )}
                </p>
              </div>

              {error && <ErrorBanner message={error} />}

              <form onSubmit={(e) => { e.preventDefault(); submitOtp(); }} noValidate>
                {/* OTP inputs */}
                <div className="flex gap-2.5 justify-center mb-6" onPaste={handleOtpPaste}>
                  {otpDigits.map((digit, i) => (
                    <input
                      key={i}
                      ref={el => { otpRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      className={`
                        w-12 h-14 text-center text-[20px] rounded-xl border-2 outline-none transition-all
                        bg-[var(--input-background,var(--background))] text-[var(--foreground)]
                        ${digit
                          ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/10'
                          : 'border-[var(--border)] focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/20'}
                      `}
                      style={{ fontWeight: 600 }}
                      autoComplete="one-time-code"
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={isLoading || otpDigits.some(d => !d)}
                  className="w-full py-2.5 bg-[var(--primary)] text-[var(--primary-foreground)] text-[14px] rounded-xl hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  style={{ fontWeight: 500 }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Verifying…
                    </>
                  ) : (
                    'Verify & sign in'
                  )}
                </button>
              </form>

              {/* Resend */}
              <div className="mt-5 text-center">
                <p className="text-[13px] text-[var(--muted-foreground)]">
                  Didn't receive the code?{' '}
                  {resendCooldown > 0 ? (
                    <span className="text-[var(--muted-foreground)]">
                      Resend in {resendCooldown}s
                    </span>
                  ) : (
                    <button
                      onClick={handleResend}
                      className="text-[var(--primary)] hover:underline"
                      style={{ fontWeight: 500 }}
                    >
                      Resend code
                    </button>
                  )}
                </p>
              </div>

              {/* Expiry note */}
              <div className="mt-6 flex items-start gap-2.5 p-3.5 rounded-xl bg-[var(--accent)]/50 border border-[var(--border)]">
                <ShieldCheck size={16} className="text-[var(--muted-foreground)] mt-0.5 shrink-0" />
                <p className="text-[12px] text-[var(--muted-foreground)] leading-relaxed">
                  The verification code expires in 5 minutes. If it expires, 
                  go back and sign in again to receive a new code.
                </p>
              </div>
            </div>
          )}

          {/* Footer */}
          <p className="mt-8 text-center text-[12px] text-[var(--muted-foreground)]">
            © {new Date().getFullYear()} Direkto. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Error Banner ──────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="flex items-start gap-2.5 p-3.5 mb-5 bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400 rounded-xl text-[13px] border border-red-200 dark:border-red-900"
      role="alert"
    >
      <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span className="leading-relaxed">{message}</span>
    </div>
  );
}