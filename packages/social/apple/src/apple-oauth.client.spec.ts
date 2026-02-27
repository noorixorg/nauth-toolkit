/**
 * Apple OAuth Client Unit Tests
 */

import 'reflect-metadata';
import { AppleOAuthClient } from './apple-oauth.client';
import { OAuthConfig } from '@nauth-toolkit/core';
import { NAuthException } from '@nauth-toolkit/core';

global.fetch = jest.fn();

describe('AppleOAuthClient', () => {
  let client: AppleOAuthClient;
  let config: OAuthConfig;

  beforeEach(() => {
    config = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'https://example.com/callback',
    };
    client = new AppleOAuthClient(config);
    (global.fetch as jest.Mock).mockClear();
  });

  describe('constructor', () => {
    it('should set default scopes', () => {
      expect(client).toBeDefined();
    });
  });

  describe('exchangeCodeForToken', () => {
    it('should exchange code for token', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          access_token: 'access-token',
          id_token: 'id-token',
          refresh_token: 'refresh-token',
          expires_in: 3600,
        }),
      });

      const result = await client.exchangeCodeForToken('code', 'https://example.com/callback');

      expect(result.accessToken).toBe('access-token');
      expect(result.idToken).toBe('id-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.expiresIn).toBe(3600);
    });

    it('should throw error when id_token is missing', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          access_token: 'access-token',
        }),
      });

      await expect(client.exchangeCodeForToken('code', 'https://example.com/callback')).rejects.toThrow(NAuthException);
    });

    it('should throw error on failed exchange', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({
          error: 'invalid_grant',
          error_description: 'Invalid code',
        }),
      });

      await expect(client.exchangeCodeForToken('invalid-code', 'https://example.com/callback')).rejects.toThrow(
        NAuthException,
      );
    });
  });

  describe('getUserProfile', () => {
    it('should fetch user profile', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          sub: 'apple-id',
          email: 'user@example.com',
        }),
      });

      const profile = await client.getUserProfile('access-token');

      expect(profile.id).toBe('apple-id');
      expect(profile.email).toBe('user@example.com');
    });

    it('should throw error on failed profile fetch', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({
          error: 'invalid_token',
        }),
      });

      await expect(client.getUserProfile('invalid-token')).rejects.toThrow(NAuthException);
    });

    it('should use custom client secret when provided', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          access_token: 'access-token',
          id_token: 'id-token',
          expires_in: 3600,
        }),
      });

      await client.exchangeCodeForToken('code', 'https://example.com/callback', 'custom-secret');

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = fetchCall[1].body;
      expect(body).toContain('custom-secret');
    });

    it('should throw error when access_token is missing', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id_token: 'id-token',
        }),
      });

      await expect(client.exchangeCodeForToken('code', 'https://example.com/callback')).rejects.toThrow(NAuthException);
    });

    it('should handle profile with minimal fields', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          sub: 'apple-id',
        }),
      });

      const profile = await client.getUserProfile('access-token');

      expect(profile.id).toBe('apple-id');
      expect(profile.email).toBeNull();
    });

    it('should handle network errors during token exchange', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(client.exchangeCodeForToken('code', 'https://example.com/callback')).rejects.toThrow();
    });

    it('should handle network errors during profile fetch', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(client.getUserProfile('access-token')).rejects.toThrow();
    });
  });
});
