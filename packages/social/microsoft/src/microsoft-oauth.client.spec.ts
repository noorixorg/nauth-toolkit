/**
 * Microsoft OAuth Client Unit Tests
 */

import 'reflect-metadata';
import { MicrosoftOAuthClient, MicrosoftOAuthConfig } from './microsoft-oauth.client';
import { NAuthException } from '@nauth-toolkit/core';

global.fetch = jest.fn();

const TENANT_GUID = '9f4c2a10-1b3c-4d5e-8f70-2a1b3c4d5e6f';

describe('MicrosoftOAuthClient', () => {
  let client: MicrosoftOAuthClient;
  let config: MicrosoftOAuthConfig;

  beforeEach(() => {
    config = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'https://example.com/callback',
      tenant: 'common',
    };
    client = new MicrosoftOAuthClient(config);
    (global.fetch as jest.Mock).mockClear();
  });

  describe('constructor', () => {
    it('accepts a tenant alias', () => {
      expect(client).toBeDefined();
    });

    it('accepts a directory GUID', () => {
      expect(new MicrosoftOAuthClient({ ...config, tenant: TENANT_GUID })).toBeDefined();
    });

    it('rejects an unusable tenant rather than building a broken authority URL', () => {
      expect(() => new MicrosoftOAuthClient({ ...config, tenant: 'not a tenant' })).toThrow(NAuthException);
    });
  });

  describe('getAuthorizationUrl', () => {
    it('targets the configured tenant', () => {
      const pinned = new MicrosoftOAuthClient({ ...config, tenant: TENANT_GUID });

      expect(pinned.getAuthorizationUrl('state-123')).toContain(
        `https://login.microsoftonline.com/${TENANT_GUID}/oauth2/v2.0/authorize`,
      );
    });

    it('includes the state parameter', () => {
      expect(client.getAuthorizationUrl('state-123')).toContain('state=state-123');
    });

    it('appends additional OAuth params', () => {
      const url = client.getAuthorizationUrl('state-123', { prompt: 'select_account' });

      expect(url).toContain('prompt=select_account');
    });

    it('requests the configured scopes', () => {
      const scoped = new MicrosoftOAuthClient({ ...config, scopes: ['openid', 'email'] });

      // URLSearchParams encodes the separating space as '+'
      expect(scoped.getAuthorizationUrl()).toContain('scope=openid+email');
    });
  });

  describe('exchangeCodeForToken', () => {
    it('returns the ID token alongside the access token', async () => {
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

    it('posts to the tenant-scoped token endpoint', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ access_token: 'access-token' }),
      });
      const pinned = new MicrosoftOAuthClient({ ...config, tenant: TENANT_GUID });

      await pinned.exchangeCodeForToken('code', 'https://example.com/callback');

      expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
        `https://login.microsoftonline.com/${TENANT_GUID}/oauth2/v2.0/token`,
      );
    });

    it('throws on a failed exchange', async () => {
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

    it('handles a response with no refresh token', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ access_token: 'access-token', expires_in: 3600 }),
      });

      const result = await client.exchangeCodeForToken('code', 'https://example.com/callback');

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBeUndefined();
    });

    it('handles network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(client.exchangeCodeForToken('code', 'https://example.com/callback')).rejects.toThrow(NAuthException);
    });
  });

  describe('getUserProfile', () => {
    it('reads the OIDC userinfo endpoint', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          sub: 'subject-id',
          email: 'user@contoso.com',
          given_name: 'Ada',
          family_name: 'Lovelace',
        }),
      });

      const profile = await client.getUserProfile('access-token');

      expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('https://graph.microsoft.com/oidc/userinfo');
      expect(profile.id).toBe('subject-id');
      expect(profile.email).toBe('user@contoso.com');
      expect(profile.firstName).toBe('Ada');
      expect(profile.lastName).toBe('Lovelace');
    });

    it('never reports email as verified — userinfo carries no tenant context', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ sub: 'subject-id', email: 'user@contoso.com' }),
      });

      const profile = await client.getUserProfile('access-token');

      expect(profile.verified).toBe(false);
    });

    it('throws on an expired access token', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: jest.fn().mockResolvedValue({ error: 'invalid_token' }),
      });

      await expect(client.getUserProfile('invalid-token')).rejects.toThrow(NAuthException);
    });
  });
});
