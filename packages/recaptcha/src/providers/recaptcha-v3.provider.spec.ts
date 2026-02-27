import { RecaptchaV3Provider } from './recaptcha-v3.provider';

// Mock fetch globally
global.fetch = jest.fn();

describe('RecaptchaV3Provider', () => {
  let provider: RecaptchaV3Provider;
  const mockSecretKey = 'test-secret-key';

  beforeEach(() => {
    provider = new RecaptchaV3Provider({ secretKey: mockSecretKey });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('verify', () => {
    it('should successfully verify a valid token', async () => {
      const mockResponse = {
        success: true,
        score: 0.9,
        action: 'login',
        hostname: 'example.com',
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
      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.google.com/recaptcha/api/siteverify',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
      );
    });

    it('should handle failed verification', async () => {
      const mockResponse = {
        success: false,
        'error-codes': ['invalid-input-response'],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await provider.verify('invalid-token');

      expect(result.success).toBe(false);
      expect(result.errorCodes).toEqual(['invalid-input-response']);
    });

    it('should include remoteip parameter when provided', async () => {
      const mockResponse = { success: true, score: 0.8 };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await provider.verify('token', '203.0.113.1');

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = callArgs[1].body as string;
      expect(body).toContain('remoteip=203.0.113.1');
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(provider.verify('token')).rejects.toThrow('reCAPTCHA verification failed: Network error');
    });

    it('should handle HTTP error responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(provider.verify('token')).rejects.toThrow('reCAPTCHA API returned status 500');
    });

    it('should use custom verify URL if provided', async () => {
      const customUrl = 'https://custom.recaptcha.api/verify';
      const customProvider = new RecaptchaV3Provider({
        secretKey: mockSecretKey,
        verifyUrl: customUrl,
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await customProvider.verify('token');

      expect(global.fetch).toHaveBeenCalledWith(
        customUrl,
        expect.any(Object),
      );
    });

    it('should handle missing score in response', async () => {
      const mockResponse = {
        success: true,
        action: 'login',
        hostname: 'example.com',
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
