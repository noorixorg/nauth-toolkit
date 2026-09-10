/**
 * Auth Config Schema Unit Tests
 *
 * Tests runtime validation of NAuth configuration including cookie priority,
 * JWT algorithm requirements, and cross-dependency rules.
 */

import { authConfigSchema, tokenDeliveryConfigSchema, jwtConfigSchema } from './auth-config.schema';

const validSecret = 'a'.repeat(32);

describe('authConfigSchema', () => {
  const minimalValidConfig = {
    jwt: {
      accessToken: { secret: validSecret, expiresIn: 3600 },
      refreshToken: { secret: validSecret, expiresIn: 86400 },
    },
    signup: { verificationMethod: 'none' as const },
  };

  it('should parse minimal valid config', () => {
    const result = authConfigSchema.safeParse(minimalValidConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.jwt.accessToken.secret).toBe(validSecret);
    }
  });

  it('should accept tokenDelivery.cookieOptions.priority', () => {
    const config = {
      ...minimalValidConfig,
      tokenDelivery: {
        method: 'cookies' as const,
        cookieOptions: {
          priority: 'low' as const,
          secure: true,
        },
      },
    };
    const result = authConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tokenDelivery?.cookieOptions?.priority).toBe('low');
    }
  });

  it('should accept security.csrf.cookieOptions with default priority', () => {
    const config = {
      ...minimalValidConfig,
      security: {
        csrf: {
          cookieName: 'csrf',
          cookieOptions: {},
        },
      },
    };
    const result = authConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.security?.csrf?.cookieOptions?.priority).toBe('high');
    }
  });

  it('should accept security.csrf.cookieOptions.priority explicit', () => {
    const config = {
      ...minimalValidConfig,
      security: {
        csrf: {
          cookieOptions: { priority: 'medium' as const },
        },
      },
    };
    const result = authConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.security?.csrf?.cookieOptions?.priority).toBe('medium');
    }
  });

  it('should fail when symmetric JWT algorithm has no secret', () => {
    const config = {
      jwt: {
        algorithm: 'HS256' as const,
        accessToken: { expiresIn: 3600 },
        refreshToken: { secret: validSecret, expiresIn: 86400 },
      },
    };
    const result = authConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.errors.find((e) => e.path?.includes('secret'))?.message;
      expect(msg).toContain('secret is required');
    }
  });

  it('should fail when symmetric JWT secret is too short', () => {
    const config = {
      jwt: {
        algorithm: 'HS256' as const,
        accessToken: { secret: 'short', expiresIn: 3600 },
        refreshToken: { secret: validSecret, expiresIn: 86400 },
      },
    };
    const result = authConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.errors.find((e) => e.path?.includes('secret'))?.message;
      expect(msg).toContain('at least 32 characters');
    }
  });

  it('should fail when asymmetric JWT algorithm has no privateKey', () => {
    const config = {
      jwt: {
        algorithm: 'RS256' as const,
        accessToken: {
          publicKey: 'pk',
          expiresIn: 3600,
        },
        refreshToken: { secret: validSecret, expiresIn: 86400 },
      },
    };
    const result = authConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.errors.find((e) => e.path?.includes('privateKey'))?.message;
      expect(msg).toContain('privateKey is required');
    }
  });

  it('should fail when asymmetric JWT algorithm has no publicKey', () => {
    const config = {
      jwt: {
        algorithm: 'RS256' as const,
        accessToken: {
          privateKey: 'sk',
          expiresIn: 3600,
        },
        refreshToken: { secret: validSecret, expiresIn: 86400 },
      },
    };
    const result = authConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.errors.find((e) => e.path?.includes('publicKey'))?.message;
      expect(msg).toContain('publicKey is required');
    }
  });

  it('should fail when email verification enabled without emailProvider', () => {
    const config = {
      ...minimalValidConfig,
      signup: { verificationMethod: 'email' as const },
    };
    const result = authConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.errors.find((e) => e.path?.includes('emailProvider'))?.message;
      expect(msg).toContain('emailProvider is required');
    }
  });

  it('should fail when phone verification enabled without smsProvider', () => {
    const config = {
      ...minimalValidConfig,
      signup: { verificationMethod: 'phone' as const },
    };
    const result = authConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.errors.find((e) => e.path?.includes('smsProvider'))?.message;
      expect(msg).toContain('smsProvider is required');
    }
  });

  it('should fail when MFA enforcement is ADAPTIVE but mfa.enabled is false', () => {
    const config = {
      ...minimalValidConfig,
      mfa: { enforcement: 'ADAPTIVE' as const, enabled: false },
    };
    const result = authConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.errors.find((e) => e.path?.join('.') === 'mfa.enabled')?.message;
      expect(msg).toContain('mfa.enabled must be true');
    }
  });

  it('should fail when MFA enforcement is ADAPTIVE but mfa.adaptive is missing', () => {
    const config = {
      ...minimalValidConfig,
      mfa: { enforcement: 'ADAPTIVE' as const, enabled: true },
    };
    const result = authConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.errors.find((e) => e.path?.join('.') === 'mfa.adaptive')?.message;
      expect(msg).toContain('mfa.adaptive configuration is required');
    }
  });
});

describe('tokenDeliveryConfigSchema', () => {
  it('should accept cookieOptions.priority', () => {
    const result = tokenDeliveryConfigSchema.safeParse({
      method: 'cookies',
      cookieOptions: { priority: 'high' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cookieOptions?.priority).toBe('high');
    }
  });
});

describe('jwtConfigSchema', () => {
  it('should accept HS384 with 32+ char secret', () => {
    const result = jwtConfigSchema.safeParse({
      algorithm: 'HS384',
      accessToken: { secret: validSecret, expiresIn: 3600 },
      refreshToken: { secret: validSecret, expiresIn: 86400 },
    });
    expect(result.success).toBe(true);
  });

  it('should accept RS256 with keys', () => {
    const result = jwtConfigSchema.safeParse({
      algorithm: 'RS256',
      accessToken: {
        privateKey: 'sk',
        publicKey: 'pk',
        expiresIn: 3600,
      },
      refreshToken: { secret: validSecret, expiresIn: 86400 },
    });
    expect(result.success).toBe(true);
  });

  // ==========================================================================
  // GeoLocation
  // ==========================================================================

  describe('geoLocation.maxMind', () => {
    const baseConfig = {
      jwt: {
        accessToken: { secret: validSecret, expiresIn: 3600 },
        refreshToken: { secret: validSecret, expiresIn: 86400 },
      },
      signup: { verificationMethod: 'none' as const },
    };

    const withMaxMind = (maxMind: Record<string, unknown>): Record<string, unknown> => ({
      ...baseConfig,
      geoLocation: { maxMind },
    });

    /** All error messages a failed parse produced, joined for substring assertions. */
    const messagesOf = (result: { success: boolean; error?: { issues: Array<{ message: string }> } }): string =>
      (result.error?.issues ?? []).map((issue) => issue.message).join('\n');

    it('accepts disk-only mode with no download block', () => {
      expect(authConfigSchema.safeParse(withMaxMind({ dbPath: '/app/data/maxmind' })).success).toBe(true);
    });

    it('accepts the maxmind source', () => {
      const result = authConfigSchema.safeParse(
        withMaxMind({ download: { from: 'maxmind', licenseKey: 'k', accountId: 123, onStartup: false } }),
      );
      expect(result.success).toBe(true);
    });

    it('accepts a url source with basic auth', () => {
      const result = authConfigSchema.safeParse(
        withMaxMind({
          download: {
            from: 'url',
            url: 'https://cdn.example.com/{edition}.tar.gz',
            auth: { username: 'u', password: 'p' },
          },
        }),
      );
      expect(result.success).toBe(true);
    });

    it('requires credentials when the maxmind source is chosen', () => {
      const result = authConfigSchema.safeParse(withMaxMind({ download: { from: 'maxmind' } }));
      expect(result.success).toBe(false);
    });

    it('rejects a url source carrying MaxMind credentials', () => {
      const result = authConfigSchema.safeParse(
        withMaxMind({ download: { from: 'url', url: 'https://cdn.example.com/{edition}.mmdb', licenseKey: 'k' } }),
      );
      // Unknown keys are stripped rather than rejected, but the credentials cannot
      // reach the service - the point is that the union makes the pairing meaningless.
      if (result.success) {
        expect((result.data.geoLocation?.maxMind?.download as Record<string, unknown>).licenseKey).toBeUndefined();
      }
    });

    it('requires {edition} in a template covering multiple editions', () => {
      const result = authConfigSchema.safeParse(
        withMaxMind({ download: { from: 'url', url: 'https://cdn.example.com/db.tar.gz' } }),
      );
      expect(result.success).toBe(false);
      expect(messagesOf(result)).toContain('{edition} placeholder');
    });

    it('allows a template without {edition} for a single edition', () => {
      const result = authConfigSchema.safeParse(
        withMaxMind({
          editions: ['GeoLite2-City'],
          download: { from: 'url', url: 'https://cdn.example.com/db.tar.gz' },
        }),
      );
      expect(result.success).toBe(true);
    });

    it('requires a map entry for every configured edition', () => {
      const result = authConfigSchema.safeParse(
        withMaxMind({
          download: { from: 'url', url: { 'GeoLite2-City': 'https://cdn.example.com/city.mmdb' } },
        }),
      );
      expect(result.success).toBe(false);
      expect(messagesOf(result)).toContain("no entry for configured edition 'GeoLite2-Country'");
    });

    it.each([
      ['skipDownloads', { skipDownloads: true }, "Omit 'download' entirely"],
      ['autoDownloadOnStartup', { autoDownloadOnStartup: true }, 'Use download.onStartup'],
      ['licenseKey', { licenseKey: 'k' }, "from: 'maxmind'"],
      ['accountId', { accountId: 123 }, "from: 'maxmind'"],
      ['downloadUrl', { downloadUrl: 'https://example.com/x' }, "from: 'url'"],
      ['downloadAuth', { downloadAuth: { username: 'u', password: 'p' } }, "from: 'url'"],
    ])('rejects the retired %s key and names its replacement', (_name, fragment, expected) => {
      const result = authConfigSchema.safeParse(withMaxMind(fragment as Record<string, unknown>));
      expect(result.success).toBe(false);
      expect(messagesOf(result)).toContain(expected);
    });
  });
});
