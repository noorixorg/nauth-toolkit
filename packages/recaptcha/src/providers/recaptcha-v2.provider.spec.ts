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
  });
});
