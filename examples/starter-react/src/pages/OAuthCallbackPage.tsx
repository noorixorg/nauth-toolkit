import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * Landing page for the OAuth redirect flow.
 *
 * After the user authenticates with Google (or another provider), the backend
 * redirects the browser to this route. This page then completes the handshake:
 *
 * - Cookie mode: backend has already set auth cookies; we just load the profile.
 * - JSON mode:   backend passes an `exchangeToken` query param; we exchange it
 *                for tokens via POST /auth/social/exchange.
 */
export function OAuthCallbackPage() {
  const { handleOAuthCallback } = useAuth();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    // Guard against StrictMode double-invocation.
    if (ranRef.current) return;
    ranRef.current = true;

    // Check for an error forwarded by the backend (e.g. user denied OAuth consent).
    const params = new URLSearchParams(window.location.search);
    if (params.get('error')) {
      navigate('/login', { replace: true });
      return;
    }

    handleOAuthCallback()
      .then(({ user, needsChallenge }) => {
        if (user) {
          navigate('/dashboard', { replace: true });
        } else if (needsChallenge) {
          navigate('/auth/challenge', { replace: true });
        } else {
          navigate('/login', { replace: true });
        }
      })
      .catch(() => {
        setErrorMsg('Authentication failed. Please try again.');
        setTimeout(() => navigate('/login', { replace: true }), 3000);
      });
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  if (errorMsg) {
    return (
      <div className="auth-layout">
        <div className="auth-card">
          <div className="error-message">{errorMsg}</div>
          <p className="auth-footer">Redirecting to login…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-layout">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="spinner" />
        <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>Completing sign in…</p>
      </div>
    </div>
  );
}
