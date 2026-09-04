/**
 * The shipped interaction controller.
 *
 * Asserted through Nest's own metadata rather than by making HTTP requests: what
 * matters here is the wiring — the route path, and the guard arrangement that took an
 * hour to get right and would fail silently if it regressed.
 */
import 'reflect-metadata';
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AuthGuard, IS_PUBLIC_KEY } from '@nauth-toolkit/nestjs';
import { createOIDCInteractionController, DEFAULT_INTERACTION_PATH } from './oidc-interaction.controller';
import { OIDCProviderModule } from './oidc-provider.module';
import type { OIDCProviderModuleOptions } from './oidc-provider.module';

const options = {
  issuer: 'https://auth.example.com',
  interactionUrl: (uid: string) => `https://example.com/interaction/${uid}`,
  cookieKeys: ['test-key'],
} as OIDCProviderModuleOptions;

const routes = ['state', 'login', 'confirm', 'abort'] as const;

describe('createOIDCInteractionController', () => {
  it('mounts at oidc/interaction by default', () => {
    const controller = createOIDCInteractionController();

    expect(Reflect.getMetadata(PATH_METADATA, controller)).toBe(DEFAULT_INTERACTION_PATH);
    expect(DEFAULT_INTERACTION_PATH).toBe('oidc/interaction');
  });

  it('mounts wherever it is told to', () => {
    const controller = createOIDCInteractionController('identity/interaction');

    expect(Reflect.getMetadata(PATH_METADATA, controller)).toBe('identity/interaction');
  });

  it('applies AuthGuard at the controller level', () => {
    // Without this the request context never carries CURRENT_USER — AuthGuard is not
    // global in this toolkit — and the session gate reports no_session for everyone.
    const controller = createOIDCInteractionController();

    expect(Reflect.getMetadata(GUARDS_METADATA, controller)).toContain(AuthGuard);
  });

  it('marks every route public, so an anonymous caller is answered rather than rejected', () => {
    // Sending a signed-out user to the login page is the case that has to work, so the
    // guard must be optional on every one of these routes.
    const controller = createOIDCInteractionController();

    for (const route of routes) {
      const handler = (controller.prototype as Record<string, unknown>)[route];
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler as object)).toBe(true);
    }
  });
});

describe('OIDCProviderModule interaction routing', () => {
  it('registers the interaction controller by default', () => {
    const module = OIDCProviderModule.forRoot(options);

    expect(module.controllers).toHaveLength(1);
    expect(Reflect.getMetadata(PATH_METADATA, module.controllers?.[0] as object)).toBe('oidc/interaction');
  });

  it('registers it at a configured path', () => {
    const module = OIDCProviderModule.forRoot({ ...options, interaction: { path: 'identity/interaction' } });

    expect(Reflect.getMetadata(PATH_METADATA, module.controllers?.[0] as object)).toBe('identity/interaction');
  });

  it('registers nothing when the consumer opts out', () => {
    const module = OIDCProviderModule.forRoot({ ...options, interaction: { enabled: false } });

    expect(module.controllers).toEqual([]);
    // The bridge stays exported either way, so a hand-written controller still works.
    expect(module.exports).toContain('NAUTH_OIDC_BRIDGE');
  });
});
