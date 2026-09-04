/**
 * OIDC Return Guard Unit Tests
 */
import 'reflect-metadata';
import { Router, UrlTree } from '@angular/router';
import { oidcReturnGuard } from './oidc-return.guard';
import { AuthService } from '../ngmodule/auth.service';

// Mock Angular inject - must be before importing the guard
const mockInject = jest.fn();
jest.mock('@angular/core', () => {
  const actual = jest.requireActual('../../__mocks__/angular-core');
  return {
    ...actual,
    inject: (token: unknown, options?: { optional?: boolean }) => mockInject(token, options),
  };
});

describe('oidcReturnGuard', () => {
  let mockAuthService: jest.Mocked<AuthService>;
  let mockRouter: jest.Mocked<Router>;
  let mockUrlTree: UrlTree;
  let takePendingInteraction: jest.Mock;

  const runGuard = (guard: ReturnType<typeof oidcReturnGuard>) =>
    Promise.resolve(guard({} as any, {} as any) as Promise<boolean | UrlTree>);

  beforeEach(() => {
    mockUrlTree = {} as UrlTree;
    takePendingInteraction = jest.fn();

    mockAuthService = {
      oidc: {
        takePendingInteraction,
        interactionRoute: (uid: string) => `/interaction/${uid}`,
        interactionPath: '/interaction',
      },
    } as any;

    mockRouter = {
      parseUrl: jest.fn().mockReturnValue(mockUrlTree),
    } as any;

    mockInject.mockImplementation((token: unknown) => {
      if (token === AuthService) return mockAuthService;
      if (token === Router) return mockRouter;
      return undefined;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('lets the navigation through when nothing is pending', async () => {
    takePendingInteraction.mockResolvedValue(null);

    await expect(runGuard(oidcReturnGuard())).resolves.toBe(true);
    expect(mockRouter.parseUrl).not.toHaveBeenCalled();
  });

  it('redirects to the pending interaction', async () => {
    takePendingInteraction.mockResolvedValue('abc123');

    await expect(runGuard(oidcReturnGuard())).resolves.toBe(mockUrlTree);
    expect(mockRouter.parseUrl).toHaveBeenCalledWith('/interaction/abc123');
  });

  it('honours an explicit interaction path', async () => {
    takePendingInteraction.mockResolvedValue('abc123');

    await expect(runGuard(oidcReturnGuard('/oauth/consent/'))).resolves.toBe(mockUrlTree);
    expect(mockRouter.parseUrl).toHaveBeenCalledWith('/oauth/consent/abc123');
  });

  it('consumes the stash, so a second landing is not diverted again', async () => {
    takePendingInteraction.mockResolvedValueOnce('abc123').mockResolvedValueOnce(null);
    const guard = oidcReturnGuard();

    await expect(runGuard(guard)).resolves.toBe(mockUrlTree);
    await expect(runGuard(guard)).resolves.toBe(true);
  });
});
