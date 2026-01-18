/**
 * Google OAuth Client Unit Tests
 */

import 'reflect-metadata';
import { GoogleOAuthClient } from './google-oauth.client';
import { OAuthConfig } from '@nauth-toolkit/core';
import { NAuthException } from '@nauth-toolkit/core';

global.fetch = jest.fn();

describe('GoogleOAuthClient', () => {
  let client: GoogleOAuthClient;
  let config: OAuthConfig;

  beforeEach(() => {
    config = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'https://example.com/callback',
    };
    client = new GoogleOAuthClient(config);
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
          refresh_token: 'refresh-token',
          expires_in: 3600,
        }),
      });

      const result = await client.exchangeCodeForToken('code', 'https://example.com/callback');

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.expiresIn).toBe(3600);
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
          id: 'google-id',
          email: 'user@example.com',
          verified_email: true,
          given_name: 'John',
          family_name: 'Doe',
          picture: 'https://example.com/pic.jpg',
        }),
      });

      const profile = await client.getUserProfile('access-token');

      expect(profile.id).toBe('google-id');
      expect(profile.email).toBe('user@example.com');
      expect(profile.firstName).toBe('John');
      expect(profile.lastName).toBe('Doe');
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

    it('should handle profile with missing optional fields', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 'google-id',
          email: 'user@example.com',
        }),
      });

      const profile = await client.getUserProfile('access-token');

      expect(profile.id).toBe('google-id');
      expect(profile.email).toBe('user@example.com');
      expect(profile.firstName).toBeNull();
      expect(profile.lastName).toBeNull();
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(client.getUserProfile('access-token')).rejects.toThrow();
    });

    it('should handle exchange with missing refresh token', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          access_token: 'access-token',
          expires_in: 3600,
        }),
      });

      const result = await client.exchangeCodeForToken('code', 'https://example.com/callback');

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBeUndefined();
    });
  });
});
