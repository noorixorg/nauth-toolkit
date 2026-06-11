import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AuthChallenge,
  NAuthClientError,
  type AuthResponse,
} from '@nauth-toolkit/client';
import { useAuth } from '../hooks/useAuth';

type Step = 'select' | 'auto-completed' | 'otp';
type Method = 'email' | 'sms';

/**
 * Handles MFA_SETUP_REQUIRED challenges — guides the user through setting up
 * an MFA device (email or SMS) before completing login.
 *
 * Flow:
 *   1. User selects a method (email / SMS)
 *   2. SDK calls getSetupData(session, method)
 *      a. autoCompleted=true  → email/phone already verified, show success → continue
 *      b. autoCompleted=false → send OTP, show code entry
 *   3. respondToChallenge with { deviceId } or { code }
 *   4. If another challenge follows → /auth/challenge; else → /dashboard
 */
export function MfaSetupPage() {
  const { challenge: ctxChallenge, getSetupData, respondToChallenge, resendCode, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const routeChallenge = (location.state as { response?: AuthResponse } | null)?.response;
  const challenge = routeChallenge ?? ctxChallenge;

  const [step, setStep] = useState<Step>('select');
  const [selectedMethod, setSelectedMethod] = useState<Method | null>(null);
  const [maskedDestination, setMaskedDestination] = useState<string | null>(null);
  const [autoCompletedDeviceId, setAutoCompletedDeviceId] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !challenge) navigate('/login', { replace: true });
  }, [isLoading, challenge, navigate]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Read allowed methods from challenge parameters; default to both.
  const allowedMethods: Method[] = (() => {
    const params = challenge?.challengeParameters as Record<string, unknown> | undefined;
    const raw = params?.allowedMethods as string[] | undefined;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.filter((m): m is Method => m === 'email' || m === 'sms');
    }
    return ['email', 'sms'];
  })();

  const handleSelectMethod = async (method: Method) => {
    if (!challenge?.session) return;
    setError(null);
    setLoading(true);
    setSelectedMethod(method);
    try {
      const result = await getSetupData(challenge.session, method);
      const data = result.setupData as Record<string, unknown>;

      if (data.autoCompleted === true) {
        setAutoCompletedDeviceId(data.deviceId as number);
        setStep('auto-completed');
      } else {
        setMaskedDestination(
          (data.maskedEmail ?? data.maskedPhone ?? null) as string | null,
        );
        setStep('otp');
      }
    } catch (err) {
      setError(err instanceof NAuthClientError ? err.message : 'Failed to set up MFA. Please try again.');
      setSelectedMethod(null);
    } finally {
      setLoading(false);
    }
  };

  const handleContinueAutoCompleted = async () => {
    if (!challenge?.session || !selectedMethod || autoCompletedDeviceId == null) return;
    setError(null);
    setLoading(true);
    try {
      const response = await respondToChallenge({
        type: AuthChallenge.MFA_SETUP_REQUIRED,
        session: challenge.session,
        method: selectedMethod,
        setupData: { deviceId: autoCompletedDeviceId },
      });
      navigateAfterChallenge(response);
    } catch (err) {
      setError(err instanceof NAuthClientError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challenge?.session || !selectedMethod) return;
    setError(null);
    setLoading(true);
    try {
      const response = await respondToChallenge({
        type: AuthChallenge.MFA_SETUP_REQUIRED,
        session: challenge.session,
        method: selectedMethod,
        setupData: { code: code.trim() },
      });
      navigateAfterChallenge(response);
    } catch (err) {
      setError(err instanceof NAuthClientError ? err.message : 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!challenge?.session) return;
    setResendLoading(true);
    setError(null);
    try {
      await resendCode(challenge.session);
      setResendCooldown(60);
    } catch (err) {
      setError(err instanceof NAuthClientError ? err.message : 'Failed to resend code.');
    } finally {
      setResendLoading(false);
    }
  };

  const navigateAfterChallenge = (response: AuthResponse) => {
    if (response.challengeName) {
      navigate('/auth/challenge', { replace: true, state: { response } });
    } else {
      navigate('/dashboard', { replace: true });
    }
  };

  if (isLoading || !challenge) return null;

  const methodLabel = selectedMethod === 'sms' ? 'phone' : 'email';

  // ── Step: Method selection ──────────────────────────────────────────────────
  if (step === 'select') {
    return (
      <div className="auth-layout">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Set up two-factor authentication</h1>
            <p>Add an extra layer of security to your account. Choose how you&apos;d like to receive verification codes.</p>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="auth-form">
            {allowedMethods.includes('email') && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleSelectMethod('email')}
                disabled={loading}
              >
                {loading && selectedMethod === 'email' ? 'Setting up…' : 'Set up with Email'}
              </button>
            )}
            {allowedMethods.includes('sms') && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleSelectMethod('sms')}
                disabled={loading}
                style={{ marginTop: '0.75rem' }}
              >
                {loading && selectedMethod === 'sms' ? 'Setting up…' : 'Set up with SMS'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Step: Already verified (auto-completed) ─────────────────────────────────
  if (step === 'auto-completed') {
    return (
      <div className="auth-layout">
        <div className="auth-card">
          <div className="auth-header">
            <h1>MFA device ready</h1>
            <p>
              Your {methodLabel} address is already verified and has been registered as your
              MFA device. You&apos;ll use it for future logins.
            </p>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="auth-form">
            <button
              type="button"
              className="btn-primary"
              onClick={handleContinueAutoCompleted}
              disabled={loading}
            >
              {loading ? 'Continuing…' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step: OTP entry ─────────────────────────────────────────────────────────
  return (
    <div className="auth-layout">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Verify your {methodLabel}</h1>
          <p>
            We sent a 6-digit code to{' '}
            <strong>{maskedDestination ?? `your ${methodLabel}`}</strong>.
            {' '}Enter it below to complete MFA setup.
          </p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmitCode} className="auth-form">
          <div className="form-group">
            <label htmlFor="code">Verification code</label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="input-code"
              autoFocus
              required
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading || code.length < 6}
          >
            {loading ? 'Verifying…' : 'Verify & Enable MFA'}
          </button>
        </form>

        <div className="resend-section">
          <p>Didn&apos;t receive the code?</p>
          <button
            type="button"
            className="btn-ghost"
            onClick={handleResend}
            disabled={resendLoading || resendCooldown > 0}
          >
            {resendCooldown > 0
              ? `Resend in ${resendCooldown}s`
              : resendLoading
                ? 'Sending…'
                : 'Resend code'}
          </button>
        </div>
      </div>
    </div>
  );
}
