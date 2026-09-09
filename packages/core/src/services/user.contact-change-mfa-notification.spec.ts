/**
 * UserService - MFA device removal notifications on contact change
 *
 * Focused test suite to avoid coupling to the large UserService test file.
 *
 * Changing a phone number deletes the account's SMS MFA devices, and changing an email
 * deletes its email MFA devices. Both used to record only an audit row, so a session
 * holder could strip an account's second factor without the owner being notified. These
 * tests pin the `mfaDeviceRemoved` lifecycle hook to both paths.
 */

import { Repository } from 'typeorm';
import { UserService } from './user.service';
import { SessionService } from './session.service';
import { ClientInfoService } from './client-info.service';
import { InternalAuthAuditService as AuthAuditService } from './auth-audit.service';
import { HookRegistryService } from './hook-registry.service';
import { AuthServiceInternalHelpers } from './auth-service-internal-helpers';
import { BaseLoginAttempt, BaseMFADevice, BaseUser } from '../entities';
import { AdminUpdateUserAttributesDTO } from '../dto/admin-update-user-attributes.dto';
import { LoggerService, NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { IUser } from '../interfaces/entities.interface';
import { MFAMethod } from '../enums/mfa-method.enum';

interface Harness {
  service: UserService;
  executeMFADeviceRemoved: jest.Mock;
  executePhoneChanged: jest.Mock;
  executeEmailChanged: jest.Mock;
  recordEvent: jest.Mock;
}

/**
 * Build a UserService whose repositories report one existing MFA device of the given
 * type and, after deletion, no remaining active devices.
 */
function buildService(user: IUser, removedType: MFAMethod): Harness {
  const mockUserRepository = {
    findOne: jest.fn().mockResolvedValue(user),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  } as unknown as Repository<BaseUser>;

  // First find() returns the devices tied to the old contact detail; the second is the
  // post-deletion sweep for anything still active.
  const find = jest
    .fn()
    .mockResolvedValueOnce([{ id: 99, type: removedType, isActive: true }])
    .mockResolvedValueOnce([]);

  const mockMfaDeviceRepository = {
    find,
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  } as unknown as Repository<BaseMFADevice>;

  const recordEvent = jest.fn().mockResolvedValue(null);
  const executeMFADeviceRemoved = jest.fn().mockResolvedValue(undefined);
  const executePhoneChanged = jest.fn().mockResolvedValue(undefined);
  const executeEmailChanged = jest.fn().mockResolvedValue(undefined);

  const baseLogger: LoggerService = {
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    verbose: jest.fn(),
  } as unknown as LoggerService;

  const service = new UserService(
    mockUserRepository,
    {} as unknown as Repository<BaseLoginAttempt>,
    { revokeAllUserSessions: jest.fn().mockResolvedValue(0) } as unknown as SessionService,
    { signup: {}, password: {} } as unknown as NAuthConfig,
    new NAuthLogger({ instance: baseLogger, enablePiiRedaction: false, logLevel: 'debug' }),
    mockMfaDeviceRepository,
    { recordEvent } as unknown as AuthAuditService,
    {
      executePreUserUpdate: jest.fn().mockResolvedValue(undefined),
      executePostUserUpdate: jest.fn().mockResolvedValue(undefined),
      executeEmailChanged,
      executeMFADeviceRemoved,
      executePhoneChanged,
    } as unknown as HookRegistryService,
    {
      get: jest.fn().mockReturnValue({ ipAddress: '203.0.113.9', userAgent: 'test-agent' }),
    } as unknown as ClientInfoService,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    { validateUniquenessConstraints: jest.fn().mockResolvedValue(undefined) } as unknown as AuthServiceInternalHelpers,
  );

  return { service, executeMFADeviceRemoved, executePhoneChanged, executeEmailChanged, recordEvent };
}

/** A user with MFA enabled and both contact details verified. */
function mfaUser(): IUser {
  return {
    id: 7,
    sub: '3f2b8c1e-9a4d-4b7e-8c2f-1d5a6e7b9c04',
    email: 'old@example.com',
    phone: '+15550000001',
    isEmailVerified: true,
    isPhoneVerified: true,
    isActive: true,
    isLocked: false,
    mfaEnabled: true,
  } as unknown as IUser;
}

describe('UserService contact change - mfaDeviceRemoved notification', () => {
  it('fires the hook when a phone change removes SMS MFA devices', async () => {
    const { service, executeMFADeviceRemoved } = buildService(mfaUser(), MFAMethod.SMS);

    const dto = Object.assign(new AdminUpdateUserAttributesDTO(), {
      sub: '3f2b8c1e-9a4d-4b7e-8c2f-1d5a6e7b9c04',
      phone: '+15550000002',
    });
    await service.updateUserAttributes(dto);

    expect(executeMFADeviceRemoved).toHaveBeenCalledTimes(1);
    expect(executeMFADeviceRemoved).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceType: MFAMethod.SMS,
        removedBy: 'system',
        reason: 'phone_changed',
        remainingDeviceCount: 0,
      }),
    );
  });

  it('fires the hook when an email change removes email MFA devices', async () => {
    const { service, executeMFADeviceRemoved } = buildService(mfaUser(), MFAMethod.EMAIL);

    const dto = Object.assign(new AdminUpdateUserAttributesDTO(), {
      sub: '3f2b8c1e-9a4d-4b7e-8c2f-1d5a6e7b9c04',
      email: 'new@example.com',
    });
    await service.updateUserAttributes(dto);

    expect(executeMFADeviceRemoved).toHaveBeenCalledTimes(1);
    expect(executeMFADeviceRemoved).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceType: MFAMethod.EMAIL,
        removedBy: 'system',
        reason: 'email_changed',
        remainingDeviceCount: 0,
      }),
    );
  });

  it('passes client info through so the alert can name the origin of the change', async () => {
    const { service, executeMFADeviceRemoved } = buildService(mfaUser(), MFAMethod.SMS);

    const dto = Object.assign(new AdminUpdateUserAttributesDTO(), {
      sub: '3f2b8c1e-9a4d-4b7e-8c2f-1d5a6e7b9c04',
      phone: '+15550000002',
    });
    await service.updateUserAttributes(dto);

    expect(executeMFADeviceRemoved).toHaveBeenCalledWith(
      expect.objectContaining({
        clientInfo: expect.objectContaining({ ipAddress: '203.0.113.9' }),
      }),
    );
  });

  it('still records the audit row alongside the hook', async () => {
    const { service, recordEvent } = buildService(mfaUser(), MFAMethod.SMS);

    const dto = Object.assign(new AdminUpdateUserAttributesDTO(), {
      sub: '3f2b8c1e-9a4d-4b7e-8c2f-1d5a6e7b9c04',
      phone: '+15550000002',
    });
    await service.updateUserAttributes(dto);

    expect(recordEvent).toHaveBeenCalledWith(expect.objectContaining({ reason: 'phone_changed' }));
  });

  it('does not fire the hook when the phone is unchanged', async () => {
    const { service, executeMFADeviceRemoved } = buildService(mfaUser(), MFAMethod.SMS);

    const dto = Object.assign(new AdminUpdateUserAttributesDTO(), {
      sub: '3f2b8c1e-9a4d-4b7e-8c2f-1d5a6e7b9c04',
      phone: '+15550000001',
    });
    await service.updateUserAttributes(dto);

    expect(executeMFADeviceRemoved).not.toHaveBeenCalled();
  });
});

describe('UserService phone change - phoneChanged notification', () => {
  const SUB = '3f2b8c1e-9a4d-4b7e-8c2f-1d5a6e7b9c04';

  it('fires phoneChanged with the old and new numbers', async () => {
    const { service, executePhoneChanged } = buildService(mfaUser(), MFAMethod.SMS);

    const dto = Object.assign(new AdminUpdateUserAttributesDTO(), { sub: SUB, phone: '+15550000002' });
    await service.updateUserAttributes(dto);

    expect(executePhoneChanged).toHaveBeenCalledTimes(1);
    expect(executePhoneChanged).toHaveBeenCalledWith(
      expect.objectContaining({ oldPhone: '+15550000001', newPhone: '+15550000002' }),
    );
  });

  it('reports the SMS devices removed and that MFA was switched off', async () => {
    const { service, executePhoneChanged } = buildService(mfaUser(), MFAMethod.SMS);

    const dto = Object.assign(new AdminUpdateUserAttributesDTO(), { sub: SUB, phone: '+15550000002' });
    await service.updateUserAttributes(dto);

    // The fixture leaves no devices behind, so the account loses MFA entirely.
    expect(executePhoneChanged).toHaveBeenCalledWith(
      expect.objectContaining({ deactivatedMFADevices: 1, mfaDisabled: true }),
    );
  });

  it('does not claim MFA was disabled when another factor survives', async () => {
    const user = mfaUser();
    const { service, executePhoneChanged } = buildService(user, MFAMethod.SMS);

    // Re-point the second find() at a surviving TOTP device.
    const repo = (service as unknown as { mfaDeviceRepository: { find: jest.Mock } }).mfaDeviceRepository;
    repo.find
      .mockReset()
      .mockResolvedValueOnce([{ id: 99, type: MFAMethod.SMS, isActive: true }])
      .mockResolvedValueOnce([{ id: 100, type: MFAMethod.TOTP, isActive: true }]);

    const dto = Object.assign(new AdminUpdateUserAttributesDTO(), { sub: SUB, phone: '+15550000002' });
    await service.updateUserAttributes(dto);

    expect(executePhoneChanged).toHaveBeenCalledWith(
      expect.objectContaining({ deactivatedMFADevices: 1, mfaDisabled: false }),
    );
  });

  it('does not fire when the phone is unchanged', async () => {
    const { service, executePhoneChanged } = buildService(mfaUser(), MFAMethod.SMS);

    const dto = Object.assign(new AdminUpdateUserAttributesDTO(), { sub: SUB, phone: '+15550000001' });
    await service.updateUserAttributes(dto);

    expect(executePhoneChanged).not.toHaveBeenCalled();
  });

  it('does not fire phoneChanged for an email-only change', async () => {
    const { service, executePhoneChanged } = buildService(mfaUser(), MFAMethod.EMAIL);

    const dto = Object.assign(new AdminUpdateUserAttributesDTO(), { sub: SUB, email: 'new@example.com' });
    await service.updateUserAttributes(dto);

    expect(executePhoneChanged).not.toHaveBeenCalled();
  });
});

describe('UserService email change - emailChanged notification', () => {
  const SUB = '3f2b8c1e-9a4d-4b7e-8c2f-1d5a6e7b9c04';

  it('reports how many email MFA devices the change removed', async () => {
    const { service, executeEmailChanged } = buildService(mfaUser(), MFAMethod.EMAIL);

    const dto = Object.assign(new AdminUpdateUserAttributesDTO(), { sub: SUB, email: 'new@example.com' });
    await service.updateUserAttributes(dto);

    // The field has always been declared on EmailChangedMetadata; it was never populated,
    // so it silently arrived as undefined in every consumer hook.
    expect(executeEmailChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        oldEmail: 'old@example.com',
        newEmail: 'new@example.com',
        deactivatedMFADevices: 1,
      }),
    );
  });
});
