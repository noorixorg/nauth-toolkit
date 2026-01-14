import { Injectable } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NAuthHooksModule } from './hooks.module';
import { UserProfileUpdatedHook } from '../decorators/hook.decorator';
import {
  HookRegistryService as PublicHookRegistryService,
  IUserProfileUpdatedHook,
  type UserProfileUpdatedMetadata,
} from '@nauth-toolkit/core';
import { HookRegistryService as InternalHookRegistryService } from '@nauth-toolkit/core/internal';

@Injectable()
@UserProfileUpdatedHook({ priority: 1 })
class TestUserProfileUpdatedHook implements IUserProfileUpdatedHook {
  execute = jest.fn(async (_metadata: UserProfileUpdatedMetadata): Promise<void> => undefined);
}

describe('NAuthHooksModule', () => {
  it('registers userProfileUpdated hooks into the same HookRegistryService instance used by core services', async () => {
    const internalRegistry = new InternalHookRegistryService();

    // In some build setups, the public and internal HookRegistryService exports can be the same reference.
    // In others, they can diverge (which is the root cause we’re fixing). This test supports both modes.
    const sameToken = (PublicHookRegistryService as unknown) === (InternalHookRegistryService as unknown);

    const module: TestingModule = await Test.createTestingModule({
      imports: [NAuthHooksModule.forFeature([TestUserProfileUpdatedHook])],
      providers: sameToken
        ? [
            // Single-token mode: provide the registry directly
            { provide: PublicHookRegistryService, useValue: internalRegistry },
          ]
        : [
            // Dual-token mode: internal registry used by core services; public token must alias to it
            { provide: InternalHookRegistryService, useValue: internalRegistry },
            { provide: PublicHookRegistryService, useExisting: InternalHookRegistryService },
          ],
    }).compile();

    // Trigger module init manually (Nest does not call OnModuleInit for imported modules in unit tests reliably)
    const hooksModule = module.get(NAuthHooksModule);
    await hooksModule.onModuleInit();

    const hook = module.get(TestUserProfileUpdatedHook);

    await internalRegistry.executeUserProfileUpdated({
      user: { id: 1, sub: 'sub-1' } as unknown as any,
      changedFields: [{ fieldName: 'isPhoneVerified', oldValue: false, newValue: true }],
      updateSource: 'phone_verification',
    });

    expect(hook.execute).toHaveBeenCalledTimes(1);
  });
});
