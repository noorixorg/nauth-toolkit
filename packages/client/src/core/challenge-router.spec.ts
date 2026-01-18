import { ChallengeRouter } from './challenge-router';
import { AuthResponse, AuthChallenge } from '../types/auth.types';
import { ResolvedNAuthClientConfig } from './config';

/**
 * Unit tests for ChallengeRouter.
 *
 * Tests:
 * - URL construction for different challenge types
 * - Custom route mapping
 * - Single route with query param mode
 * - MFA special cases
 */
describe('ChallengeRouter', () => {
  let mockConfig: ResolvedNAuthClientConfig;
  let mockNavigate: jest.Mock;

  beforeEach(() => {
    mockNavigate = jest.fn();
    mockConfig = {
      baseUrl: 'https://api.example.com/auth',
      tokenDelivery: 'cookies',
      endpoints: {} as any,
      storage: {} as any,
      httpAdapter: {} as any,
      csrf: { cookieName: 'csrf', headerName: 'x-csrf' },
      deviceTrust: { headerName: 'X-Device', storageKey: 'device' },
      headers: {},
      timeout: 30000,
      redirects: {
        success: '/dashboard',
        sessionExpired: '/login',
        oauthError: '/login',
        challengeBase: '/auth/challenge',
      },
    };
  });

  describe('buildChallengeUrl', () => {
    it('should build default route for VERIFY_EMAIL', () => {
      const router = new ChallengeRouter(mockConfig);
      const response: AuthResponse = {
        challengeName: AuthChallenge.VERIFY_EMAIL,
        session: 'test-session',
      };

      const url = router.buildChallengeUrl(response);
      expect(url).toBe('/auth/challenge/verify-email');
    });

    it('should build default route for FORCE_CHANGE_PASSWORD', () => {
      const router = new ChallengeRouter(mockConfig);
      const response: AuthResponse = {
        challengeName: AuthChallenge.FORCE_CHANGE_PASSWORD,
        session: 'test-session',
      };

      const url = router.buildChallengeUrl(response);
      expect(url).toBe('/auth/challenge/force-change-password');
    });

    it('should use custom route mapping when provided', () => {
      mockConfig.redirects!.challengeRoutes = {
        [AuthChallenge.MFA_REQUIRED]: '/auth/mfa',
        [AuthChallenge.VERIFY_EMAIL]: '/verify',
      };

      const router = new ChallengeRouter(mockConfig);
      const response: AuthResponse = {
        challengeName: AuthChallenge.MFA_REQUIRED,
        session: 'test-session',
      };

      const url = router.buildChallengeUrl(response);
      expect(url).toBe('/auth/mfa');
    });

    it('should use query param mode when enabled', () => {
      mockConfig.redirects!.useSingleChallengeRoute = true;

      const router = new ChallengeRouter(mockConfig);
      const response: AuthResponse = {
        challengeName: AuthChallenge.VERIFY_EMAIL,
        session: 'test-session',
      };

      const url = router.buildChallengeUrl(response);
      expect(url).toBe('/auth/challenge?challenge=VERIFY_EMAIL');
    });

    it('should build passkey route for MFA_REQUIRED with passkey method', () => {
      const router = new ChallengeRouter(mockConfig);
      const response: AuthResponse = {
        challengeName: AuthChallenge.MFA_REQUIRED,
        session: 'test-session',
        challengeParameters: {
          preferredMethod: 'passkey',
        },
      };

      const url = router.buildChallengeUrl(response);
      expect(url).toBe('/auth/challenge/mfa-required/passkey');
    });

    it('should build selector route for MFA_REQUIRED with multiple methods', () => {
      const router = new ChallengeRouter(mockConfig);
      const response: AuthResponse = {
        challengeName: AuthChallenge.MFA_REQUIRED,
        session: 'test-session',
        challengeParameters: {
          availableMethods: ['sms', 'email', 'totp'],
        },
      };

      const url = router.buildChallengeUrl(response);
      expect(url).toBe('/auth/challenge/mfa-selector');
    });

    it('should build default MFA route for single non-passkey method', () => {
      const router = new ChallengeRouter(mockConfig);
      const response: AuthResponse = {
        challengeName: AuthChallenge.MFA_REQUIRED,
        session: 'test-session',
        challengeParameters: {
          preferredMethod: 'sms',
        },
      };

      const url = router.buildChallengeUrl(response);
      expect(url).toBe('/auth/challenge/mfa-required');
    });

    it('should use custom MFA passkey route when configured', () => {
      mockConfig.redirects!.mfaRoutes = {
        passkey: '/auth/passkey-verify',
      };

      const router = new ChallengeRouter(mockConfig);
      const response: AuthResponse = {
        challengeName: AuthChallenge.MFA_REQUIRED,
        session: 'test-session',
        challengeParameters: {
          preferredMethod: 'passkey',
        },
      };

      const url = router.buildChallengeUrl(response);
      expect(url).toBe('/auth/passkey-verify');
    });

    it('should use custom MFA selector route when configured', () => {
      mockConfig.redirects!.mfaRoutes = {
        selector: '/choose-mfa-method',
      };

      const router = new ChallengeRouter(mockConfig);
      const response: AuthResponse = {
        challengeName: AuthChallenge.MFA_REQUIRED,
        session: 'test-session',
        challengeParameters: {
          availableMethods: ['sms', 'email', 'totp'],
        },
      };

      const url = router.buildChallengeUrl(response);
      expect(url).toBe('/choose-mfa-method');
    });

    it('should use custom MFA default route when configured', () => {
      mockConfig.redirects!.mfaRoutes = {
        default: '/verify-code',
      };

      const router = new ChallengeRouter(mockConfig);
      const response: AuthResponse = {
        challengeName: AuthChallenge.MFA_REQUIRED,
        session: 'test-session',
        challengeParameters: {
          preferredMethod: 'sms',
        },
      };

      const url = router.buildChallengeUrl(response);
      expect(url).toBe('/verify-code');
    });

    it('should prioritize challengeRoutes over mfaRoutes', () => {
      mockConfig.redirects!.challengeRoutes = {
        [AuthChallenge.MFA_REQUIRED]: '/custom-mfa',
      };
      mockConfig.redirects!.mfaRoutes = {
        passkey: '/custom-passkey',
        default: '/custom-default',
      };

      const router = new ChallengeRouter(mockConfig);
      const response: AuthResponse = {
        challengeName: AuthChallenge.MFA_REQUIRED,
        session: 'test-session',
        challengeParameters: {
          preferredMethod: 'passkey',
        },
      };

      const url = router.buildChallengeUrl(response);
      // Should use challengeRoutes, not mfaRoutes
      expect(url).toBe('/custom-mfa');
    });
  });

  describe('handleAuthResponse', () => {
    it('should call onAuthResponse callback when provided', async () => {
      const callback = jest.fn();
      mockConfig.onAuthResponse = callback;

      const router = new ChallengeRouter(mockConfig);
      const response: AuthResponse = {
        challengeName: AuthChallenge.VERIFY_EMAIL,
        session: 'test-session',
      };

      await router.handleAuthResponse(response, { source: 'login' });

      expect(callback).toHaveBeenCalledWith(response, { source: 'login' });
    });

    it('should navigate to challenge when no callback provided', async () => {
      mockConfig.navigationHandler = mockNavigate;

      const router = new ChallengeRouter(mockConfig);
      const response: AuthResponse = {
        challengeName: AuthChallenge.VERIFY_EMAIL,
        session: 'test-session',
      };

      await router.handleAuthResponse(response, { source: 'login' });

      expect(mockNavigate).toHaveBeenCalledWith('/auth/challenge/verify-email');
    });

    it('should navigate to success when no challenge present', async () => {
      mockConfig.navigationHandler = mockNavigate;

      const router = new ChallengeRouter(mockConfig);
      const response: AuthResponse = {
        user: { sub: '123', email: 'test@example.com', isEmailVerified: true },
      };

      await router.handleAuthResponse(response, { source: 'login' });

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('navigateToError', () => {
    it('should navigate to oauth error URL', async () => {
      mockConfig.navigationHandler = mockNavigate;

      const router = new ChallengeRouter(mockConfig);
      await router.navigateToError('oauth');

      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });

    it('should navigate to session error URL', async () => {
      mockConfig.navigationHandler = mockNavigate;

      const router = new ChallengeRouter(mockConfig);
      await router.navigateToError('session');

      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });

    it('should use different URLs for oauth vs session errors', async () => {
      mockConfig.redirects!.oauthError = '/oauth-error';
      mockConfig.redirects!.sessionExpired = '/session-expired';
      mockConfig.navigationHandler = mockNavigate;

      const router = new ChallengeRouter(mockConfig);

      await router.navigateToError('oauth');
      expect(mockNavigate).toHaveBeenCalledWith('/oauth-error');

      await router.navigateToError('session');
      expect(mockNavigate).toHaveBeenCalledWith('/session-expired');
    });
  });

  describe('navigateToSuccess', () => {
    it('should include query parameters in URL', async () => {
      mockConfig.navigationHandler = mockNavigate;

      const router = new ChallengeRouter(mockConfig);

      await router.navigateToSuccess({ returnTo: '/dashboard', source: 'signup' });

      const callUrl = decodeURIComponent(mockNavigate.mock.calls[0][0]);
      expect(callUrl).toMatch(/returnTo=\/dashboard/);
      expect(callUrl).toContain('source=signup');
    });

    it('should handle URL with existing query parameters', async () => {
      mockConfig.redirects!.success = '/dashboard?existing=param';
      mockConfig.navigationHandler = mockNavigate;

      const router = new ChallengeRouter(mockConfig);

      await router.navigateToSuccess({ returnTo: '/dashboard' });

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringMatching(/\/dashboard\?existing=param&returnTo=/),
      );
    });

    it('should skip null and undefined query parameters', async () => {
      mockConfig.navigationHandler = mockNavigate;

      const router = new ChallengeRouter(mockConfig);

      await router.navigateToSuccess({
        returnTo: '/dashboard',
        source: null as any,
        extra: undefined as any,
      });

      const callUrl = decodeURIComponent(mockNavigate.mock.calls[0][0]);
      expect(callUrl).toMatch(/returnTo=\/dashboard/);
      expect(callUrl).not.toContain('source');
      expect(callUrl).not.toContain('extra');
    });
  });

  describe('getStoredOauthState', () => {
    it('should handle storage errors gracefully', async () => {
      const failingStorage = {
        getItem: jest.fn().mockRejectedValue(new Error('Storage error')),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      };

      mockConfig.storage = failingStorage as any;
      mockConfig.navigationHandler = mockNavigate;

      const router = new ChallengeRouter(mockConfig);
      const response: AuthResponse = {
        user: { sub: '123', email: 'test@example.com', isEmailVerified: true },
      };

      await router.handleAuthResponse(response, { source: 'login' });

      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  describe('buildMFAUrl', () => {
    it('should return null when no mfaRoutes configured', () => {
      const router = new ChallengeRouter(mockConfig);
      const response: AuthResponse = {
        challengeName: AuthChallenge.MFA_REQUIRED,
        session: 'test-session',
        challengeParameters: {
          preferredMethod: 'sms',
        },
      };

      const url = router.buildChallengeUrl(response);
      expect(url).toBe('/auth/challenge/mfa-required');
    });
  });

  describe('getChallengeUrl', () => {
    it('should return challenge URL', () => {
      const router = new ChallengeRouter(mockConfig);
      const response: AuthResponse = {
        challengeName: AuthChallenge.VERIFY_EMAIL,
        session: 'test-session',
      };

      const url = router.getChallengeUrl(response);
      expect(url).toBe('/auth/challenge/verify-email');
    });
  });
});

