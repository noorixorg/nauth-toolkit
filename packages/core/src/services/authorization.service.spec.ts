/**
 * Authorization Service Unit Tests
 *
 * Covers the decision order that governs every privileged operation:
 * no provider -> allow, system context -> allow, no actor -> deny, else ask the provider.
 */

import { AuthorizationService } from './authorization.service';
import { IAuthorizationProvider, AuthorizationContext } from '../interfaces/authorization-provider.interface';
import { ContextStorage } from '../utils/context-storage';
import { runAsSystem } from '../utils/run-as-system';
import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { IUser } from '../interfaces/entities.interface';

describe('AuthorizationService', () => {
  const actor = { sub: 'admin-1', email: 'admin@example.com' } as unknown as IUser;

  let logger: { debug: jest.Mock; warn: jest.Mock; error: jest.Mock; log: jest.Mock };
  let audit: { recordEvent: jest.Mock };

  beforeEach(() => {
    logger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), log: jest.fn() };
    audit = { recordEvent: jest.fn().mockResolvedValue(null) };
  });

  /** Run inside a request context with an authenticated actor. */
  const asUser = <T>(user: IUser | undefined, fn: () => Promise<T>): Promise<T> =>
    ContextStorage.run(async () => {
      if (user) ContextStorage.set('CURRENT_USER', user);
      return fn();
    });

  const providerOf = (decision: { allow: boolean; reason?: string }): IAuthorizationProvider => ({
    authorize: jest.fn().mockReturnValue(decision),
  });

  describe('when no provider is configured', () => {
    it('permits privileged operations, preserving pre-authorization behaviour', async () => {
      const service = new AuthorizationService(undefined, logger as never, () => audit as never);

      await expect(asUser(undefined, () => service.authorize('admin.user.delete'))).resolves.toBeUndefined();
      expect(audit.recordEvent).not.toHaveBeenCalled();
    });

    it('reports itself as not configured, so admin routes can refuse to mount', () => {
      expect(new AuthorizationService().isConfigured()).toBe(false);
      expect(new AuthorizationService(providerOf({ allow: true })).isConfigured()).toBe(true);
    });
  });

  describe('when a provider is configured', () => {
    it('permits an allowed action and passes actor, action and target through', async () => {
      const provider = providerOf({ allow: true });
      const service = new AuthorizationService(provider, logger as never, () => audit as never);

      await asUser(actor, () => service.authorize('admin.user.delete', { targetSub: 'victim-9' }));

      const ctx = (provider.authorize as jest.Mock).mock.calls[0][0] as AuthorizationContext;
      expect(ctx.action).toBe('admin.user.delete');
      expect(ctx.actor).toBe(actor);
      expect(ctx.targetSub).toBe('victim-9');
    });

    it('denies with the provider reason as the error message', async () => {
      const service = new AuthorizationService(
        providerOf({ allow: false, reason: 'Requires the admin role' }),
        logger as never,
        () => audit as never,
      );

      await expect(asUser(actor, () => service.authorize('admin.user.delete'))).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'Requires the admin role',
      });
    });

    it('denies when there is no authenticated actor', async () => {
      const provider = providerOf({ allow: true });
      const service = new AuthorizationService(provider, logger as never, () => audit as never);

      // Off the request path with no explicit bypass: nobody to authorize.
      await expect(asUser(undefined, () => service.authorize('admin.user.delete'))).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      expect(provider.authorize).not.toHaveBeenCalled();
    });

    it('treats a throwing provider as a denial, never as an allow', async () => {
      const service = new AuthorizationService(
        { authorize: jest.fn().mockRejectedValue(new Error('policy service unreachable')) },
        logger as never,
        () => audit as never,
      );

      await expect(asUser(actor, () => service.authorize('admin.user.delete'))).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('policy service unreachable'));
    });

    it('awaits an async provider', async () => {
      const service = new AuthorizationService(
        { authorize: jest.fn().mockResolvedValue({ allow: false, reason: 'nope' }) },
        logger as never,
        () => audit as never,
      );

      await expect(asUser(actor, () => service.authorize('admin.user.list'))).rejects.toMatchObject({
        message: 'nope',
      });
    });
  });

  describe('denial auditing', () => {
    it('records the action, actor and target', async () => {
      const service = new AuthorizationService(
        providerOf({ allow: false, reason: 'Requires the admin role' }),
        logger as never,
        () => audit as never,
      );

      await asUser(actor, () => service.authorize('admin.user.setPassword', { targetSub: 'victim-9' })).catch(
        () => undefined,
      );

      expect(audit.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AuthAuditEventType.AUTHORIZATION_DENIED,
          eventStatus: 'FAILURE',
          reason: 'Requires the admin role',
          sub: 'victim-9',
          metadata: expect.objectContaining({ action: 'admin.user.setPassword', actorSub: 'admin-1' }),
        }),
      );
    });

    it('still denies when auditing fails', async () => {
      audit.recordEvent.mockRejectedValue(new Error('db down'));
      const service = new AuthorizationService(providerOf({ allow: false }), logger as never, () => audit as never);

      // A broken audit trail must not turn a denial into a different failure - or a pass.
      await expect(asUser(actor, () => service.authorize('admin.user.delete'))).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });
  });

  describe('runAsSystem', () => {
    it('bypasses the provider entirely rather than calling it with no actor', async () => {
      const provider = providerOf({ allow: false, reason: 'denied' });
      const service = new AuthorizationService(provider, logger as never, () => audit as never);

      await runAsSystem(() => service.authorize('admin.user.delete', { targetSub: 'victim-9' }));

      expect(provider.authorize).not.toHaveBeenCalled();
      expect(audit.recordEvent).not.toHaveBeenCalled();
    });

    it('stops applying once the bypass has finished', async () => {
      const provider = providerOf({ allow: false, reason: 'denied' });
      const service = new AuthorizationService(provider, logger as never, () => audit as never);

      await runAsSystem(async () => service.authorize('admin.user.list'));

      await expect(asUser(actor, () => service.authorize('admin.user.list'))).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('restores the surrounding context even when the callback throws', async () => {
      const provider = providerOf({ allow: false, reason: 'denied' });
      const service = new AuthorizationService(provider, logger as never, () => audit as never);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', actor);

        await expect(
          runAsSystem(async () => {
            throw new Error('seed failed');
          }),
        ).rejects.toThrow('seed failed');

        // The bypass must not leak past the failure.
        await expect(service.authorize('admin.user.delete')).rejects.toMatchObject({ code: 'FORBIDDEN' });
      });
    });

    it('nests without the inner scope ending the outer one', async () => {
      const provider = providerOf({ allow: false });
      const service = new AuthorizationService(provider, logger as never, () => audit as never);

      await runAsSystem(async () => {
        await runAsSystem(async () => service.authorize('admin.user.list'));
        // Still inside the outer bypass.
        await service.authorize('admin.user.delete');
      });

      expect(provider.authorize).not.toHaveBeenCalled();
    });
  });
});
