import { RecaptchaEnterpriseProvider } from './recaptcha-enterprise.provider';

// Mock fetch globally
global.fetch = jest.fn();

describe('RecaptchaEnterpriseProvider', () => {
  let provider: RecaptchaEnterpriseProvider;
  const mockConfig = {
    projectId: 'test-project',
    apiKey: 'test-api-key',
    siteKey: 'test-site-key',
  };

  beforeEach(() => {
    provider = new RecaptchaEnterpriseProvider(mockConfig);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('verify', () => {
    it('should successfully verify a valid token', async () => {
      const mockResponse = {
        tokenProperties: {
          valid: true,
          action: 'login',
          hostname: 'example.com',
        },
        riskAnalysis: {
          score: 0.9,
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await provider.verify('valid-token', '192.168.1.1', 'login');

      expect(result).toEqual({
        success: true,
        score: 0.9,
        action: 'login',
        hostname: 'example.com',
        errorCodes: undefined,
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toContain('recaptchaenterprise.googleapis.com');
      expect(callArgs[0]).toContain(`projects/${mockConfig.projectId}/assessments`);
      expect(callArgs[0]).toContain(`key=${mockConfig.apiKey}`);
    });

    it('should handle invalid token with reason', async () => {
      const mockResponse = {
        tokenProperties: {
          valid: false,
          invalidReason: 'EXPIRED',
        },
        riskAnalysis: {},
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await provider.verify('expired-token');

      expect(result.success).toBe(false);
      expect(result.errorCodes).toEqual(['EXPIRED']);
    });

    it('should include IP address and action in request', async () => {
      const mockResponse = {
        tokenProperties: { valid: true },
        riskAnalysis: { score: 0.8 },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await provider.verify('token', '203.0.113.1', 'signup');

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.event.userIpAddress).toBe('203.0.113.1');
      expect(requestBody.event.expectedAction).toBe('signup');
      expect(requestBody.event.siteKey).toBe(mockConfig.siteKey);
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API unavailable'));

      await expect(provider.verify('token')).rejects.toThrow(
        'reCAPTCHA Enterprise verification failed: API unavailable',
      );
    });

    it('should handle HTTP error responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Forbidden',
      });

      await expect(provider.verify('token')).rejects.toThrow('reCAPTCHA Enterprise API returned status 403');
    });

    it('should use custom API endpoint if provided', async () => {
      const customEndpoint = 'https://custom-region.googleapis.com/v1';
      const customProvider = new RecaptchaEnterpriseProvider({
        ...mockConfig,
        apiEndpoint: customEndpoint,
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tokenProperties: { valid: true },
          riskAnalysis: {},
        }),
      });

      await customProvider.verify('token');

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toContain(customEndpoint);
    });

    it('should handle missing riskAnalysis gracefully', async () => {
      const mockResponse = {
        tokenProperties: {
          valid: true,
          action: 'login',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await provider.verify('token');

      expect(result.success).toBe(true);
      expect(result.score).toBeUndefined();
    });
  });

  describe('validateConfig', () => {
    it('should return valid when API responds with HTTP 200', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          tokenProperties: { valid: false, invalidReason: 'INVALID' },
          riskAnalysis: {},
        }),
      });

      const result = await provider.validateConfig();

      expect(result.valid).toBe(true);
      expect(result.message).toContain('configuration is valid');
      expect(result.httpStatus).toBe(200);
    });

    it('should return invalid with hint for HTTP 400 (bad site key)', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'INVALID_ARGUMENT',
      });

      const result = await provider.validateConfig();

      expect(result.valid).toBe(false);
      expect(result.message).toContain('HTTP 400');
      expect(result.message).toContain(mockConfig.siteKey);
      expect(result.hint).toContain('console.cloud.google.com/security/recaptcha');
      expect(result.httpStatus).toBe(400);
    });

    it('should return invalid with hint for HTTP 403 (API key or API not enabled)', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Forbidden',
      });

      const result = await provider.validateConfig();

      expect(result.valid).toBe(false);
      expect(result.message).toContain('HTTP 403');
      expect(result.hint).toContain('recaptchaenterprise.googleapis.com');
      expect(result.httpStatus).toBe(403);
    });

    it('should return invalid with hint for HTTP 404 (wrong project ID)', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not Found',
      });

      const result = await provider.validateConfig();

      expect(result.valid).toBe(false);
      expect(result.message).toContain('HTTP 404');
      expect(result.message).toContain(mockConfig.projectId);
      expect(result.httpStatus).toBe(404);
    });

    it('should handle unexpected HTTP status codes', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const result = await provider.validateConfig();

      expect(result.valid).toBe(false);
      expect(result.message).toContain('HTTP 500');
      expect(result.httpStatus).toBe(500);
    });

    it('should handle network timeout', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      (global.fetch as jest.Mock).mockRejectedValueOnce(abortError);

      const result = await provider.validateConfig();

      expect(result.valid).toBe(false);
      expect(result.message).toContain('timeout');
      expect(result.hint).toContain('network connectivity');
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await provider.validateConfig();

      expect(result.valid).toBe(false);
      expect(result.message).toContain('Network error');
      expect(result.message).toContain('ECONNREFUSED');
      expect(result.hint).toContain('network connectivity');
    });

    it('should send probe token to correct endpoint', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ tokenProperties: { valid: false }, riskAnalysis: {} }),
      });

      await provider.validateConfig();

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toContain(`projects/${mockConfig.projectId}/assessments`);
      expect(callArgs[0]).toContain(`key=${mockConfig.apiKey}`);

      const requestBody = JSON.parse(callArgs[1].body);
      expect(requestBody.event.token).toBe('NAUTH_STARTUP_VALIDATION_PROBE');
      expect(requestBody.event.siteKey).toBe(mockConfig.siteKey);
    });
  });
});
