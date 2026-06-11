import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AuthChallenge,
  NAuthClientError,
  getMaskedDestination,
  getMFAMethod,
  type AuthResponse,
  type ChallengeResponse,
} from '@nauth-toolkit/client';
import { useAuth } from '../hooks/useAuth';

/**
 * Handles verification challenges (VERIFY_EMAIL, VERIFY_PHONE, MFA_REQUIRED, etc.)
 * that follow signup or login.
 *
 * The active challenge comes from two sources (whichever is available first):
 *  1. React Router location state — passed by LoginPage/SignupPage immediately after
 *     the API response, before React context state has been committed. This avoids
 *     the timing race where the context update is batched after navigation.
 *  2. AuthContext challenge — set by the auth:challenge SDK event, used if the user
 *     navigates directly to this URL or refreshes the page.
 */
export function ChallengePage() {
  const { challenge: ctxChallenge, respondToChallenge, resendCode, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Prefer the response passed via route state to avoid the React 18 batching
  // race condition (context state may not be committed when this component mounts).
  const routeChallenge = (location.state as { response?: AuthResponse } | null)?.response;
  const challenge = routeChallenge ?? ctxChallenge;

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Redirect away if there is no pending challenge (e.g. direct URL access).
  // Wait for isLoading to be false so the AuthContext has time to hydrate
  // ctxChallenge from storage before deciding there is no challenge.
  useEffect(() => {
    if (!isLoading && !challenge) navigate('/login', { replace: true });
    // MFA_SETUP_REQUIRED is handled by a dedicated page.
    if (!isLoading && challenge?.challengeName === AuthChallenge.MFA_SETUP_REQUIRED) {
      navigate('/auth/mfa-setup', { replace: true, state: { response: challenge } });
    }
  }, [isLoading, challenge, navigate]);

  // Countdown timer for the resend cooldown.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challenge?.session || !challenge.challengeName) return;
    setError(null);
    setLoading(true);
    try {
      const challengeResponse = {
        type: challenge.challengeName,
        session: challenge.session,
        ...(challenge.challengeName === AuthChallenge.MFA_REQUIRED && {
          method: getMFAMethod(challenge),
        }),
        code: code.trim(),
      } as ChallengeResponse;
      const response = await respondToChallenge(challengeResponse);
      if (!response.challengeName) {
        // No further challenge — authentication complete.
        navigate('/dashboard', { replace: true });
      } else {
        // Another challenge follows — update route state so the component stays valid.
        navigate('/auth/challenge', { replace: true, state: { response } });
      }
    } catch (err) {
      setError(
        err instanceof NAuthClientError ? err.message : 'Verification failed. Please try again.',
      );
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
      setError(
        err instanceof NAuthClientError ? err.message : 'Failed to resend code.',
      );
    } finally {
      setResendLoading(false);
    }
  };

  if (isLoading || !challenge) return null;

  const destination = getMaskedDestination(challenge);
  const mfaMethod = challenge.challengeName === AuthChallenge.MFA_REQUIRED
    ? getMFAMethod(challenge)
    : undefined;
  const isTotp = mfaMethod === 'totp';
  const sendsCode = !isTotp;

  let heading = 'Verify your identity';
  if (challenge.challengeName === AuthChallenge.VERIFY_EMAIL) heading = 'Check your email';
  else if (challenge.challengeName === AuthChallenge.VERIFY_PHONE) heading = 'Check your phone';

  return (
    <div className="auth-layout">
      <div className="auth-card">
        <div className="auth-header">
          <h1>{heading}</h1>
          <p>
            {isTotp
              ? 'Enter the 6-digit code from your authenticator app.'
              : <>
                  We sent a 6-digit code to{' '}
                  <strong>{destination ?? 'your device'}</strong>.
                  {' '}Enter it below to continue.
                </>
            }
          </p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
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
            {loading ? 'Verifying…' : 'Verify'}
          </button>
        </form>

        {sendsCode && (
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
        )}
      </div>
    </div>
  );
}
