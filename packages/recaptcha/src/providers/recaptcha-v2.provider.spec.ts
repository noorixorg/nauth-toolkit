import { RecaptchaV2Provider } from './recaptcha-v2.provider';

// Mock fetch globally
global.fetch = jest.fn();

describe('RecaptchaV2Provider', () => {
  let provider: RecaptchaV2Provider;
  const mockSecretKey = 'test-secret-key';

  beforeEach(() => {
    provider = new RecaptchaV2Provider({ secretKey: mockSecretKey });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('verify', () => {
    it('should successfully verify a valid token', async () => {
      const mockResponse = {
        success: true,
        challenge_ts: '2024-01-15T10:30:00Z',
        hostname: 'example.com',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await provider.verify('valid-token', '192.168.1.1');

      expect(result).toEqual({
        success: true,
        challengeTs: '2024-01-15T10:30:00Z',
        hostname: 'example.com',
        errorCodes: undefined,
      });

      expect(result.score).toBeUndefined(); // v2 does not include score
      expect(result.action).toBeUndefined(); // v2 does not include action
    });

    it('should handle failed verification with error codes', async () => {
      const mockResponse = {
        success: false,
        'error-codes': ['timeout-or-duplicate'],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await provider.verify('expired-token');

      expect(result.success).toBe(false);
      expect(result.errorCodes).toEqual(['timeout-or-duplicate']);
    });

    it('should ignore action parameter for v2', async () => {
      const mockResponse = { success: true };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      // v2 doesn't use action, but method should not error
      await provider.verify('token', '192.168.1.1', 'login');

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Connection refused'));

      await expect(provider.verify('token')).rejects.toThrow('reCAPTCHA verification failed: Connection refused');
    });

    it('should handle HTTP error responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(provider.verify('token')).rejects.toThrow('reCAPTCHA API returned status 500');
    });

    it('should include remoteip parameter when provided', async () => {
      const mockResponse = { success: true };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await provider.verify('token', '203.0.113.1');

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = callArgs[1].body as string;
      expect(body).toContain('remoteip=203.0.113.1');
    });

    it('should use custom verify URL if provided', async () => {
      const customUrl = 'https://custom.recaptcha.api/verify';
      const customProvider = new RecaptchaV2Provider({
        secretKey: mockSecretKey,
        verifyUrl: customUrl,
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await customProvider.verify('token');

      expect(global.fetch).toHaveBeenCalledWith(customUrl, expect.any(Object));
    });

    it('should handle timeout errors', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      (global.fetch as jest.Mock).mockRejectedValueOnce(abortError);

      await expect(provider.verify('token')).rejects.toThrow('reCAPTCHA verification timeout');
    });
  });

  describe('validateConfig', () => {
    it('should return valid when secret key is accepted by Google', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: false,
          'error-codes': ['invalid-input-response'],
        }),
      });

      const result = await provider.validateConfig();

      expect(result.valid).toBe(true);
      expect(result.message).toContain('configuration is valid');
      expect(result.httpStatus).toBe(200);
    });

    it('should return invalid when secret key is wrong', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: false,
          'error-codes': ['invalid-input-secret'],
        }),
      });

      const result = await provider.validateConfig();

      expect(result.valid).toBe(false);
      expect(result.message).toContain('secret key is invalid');
      expect(result.hint).toContain('google.com/recaptcha/admin');
    });

    it('should return invalid for HTTP error responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
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
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await provider.validateConfig();

      expect(result.valid).toBe(false);
      expect(result.message).toContain('Network error');
      expect(result.message).toContain('ECONNREFUSED');
    });

    it('should send probe token to correct endpoint', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
      });

      await provider.validateConfig();

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe('https://www.google.com/recaptcha/api/siteverify');

      const body = callArgs[1].body as string;
      expect(body).toContain('secret=' + mockSecretKey);
      expect(body).toContain('response=NAUTH_STARTUP_VALIDATION_PROBE');
    });
  });
});
