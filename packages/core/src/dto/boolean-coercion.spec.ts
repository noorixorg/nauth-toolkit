import { MFADeviceResponseDTO } from './mfa-device-response.dto';
import { UserResponseDTO } from './user-response.dto';
import { IMFADevice, IUser } from '../interfaces/entities.interface';
import { MFAMethod } from '../enums/mfa-method.enum';

/**
 * Boolean columns must reach the API as booleans on every database.
 *
 * MySQL stores booleans as `tinyint(1)` and its driver hands them back as 1/0 unless the
 * column is declared `boolean`. That made `isPreferred` permanently false and leaked raw
 * numbers out of fields these DTOs declare as booleans - on MySQL only, so Postgres-based
 * tests never saw it. The entities now declare `boolean`; these assertions pin the
 * mapping so a driver returning numbers can never resurface the bug.
 */
describe('response DTO boolean coercion', () => {
  const deviceWithNumericFlags = {
    id: 8,
    type: MFAMethod.TOTP,
    name: 'Authenticator App',
    // What a MySQL driver returns for tinyint(1) columns
    isPrimary: 1,
    isActive: 1,
    createdAt: new Date('2026-09-06T02:16:00.783Z'),
  } as unknown as IMFADevice;

  describe('MFADeviceResponseDTO', () => {
    it('reports a numeric primary flag as preferred', () => {
      const dto = MFADeviceResponseDTO.fromEntity(deviceWithNumericFlags);

      // Regression: a strict `=== true` here made every device unpreferred on MySQL
      expect(dto.isPreferred).toBe(true);
      expect(dto.isActive).toBe(true);
    });

    it('emits real booleans rather than the driver value', () => {
      const dto = MFADeviceResponseDTO.fromEntity(deviceWithNumericFlags);

      expect(typeof dto.isPreferred).toBe('boolean');
      expect(typeof dto.isActive).toBe('boolean');
    });

    it('reports zero as false', () => {
      const dto = MFADeviceResponseDTO.fromEntity({
        ...deviceWithNumericFlags,
        isPrimary: 0,
        isActive: 0,
      } as unknown as IMFADevice);

      expect(dto.isPreferred).toBe(false);
      expect(dto.isActive).toBe(false);
    });

    it('still maps genuine booleans unchanged', () => {
      const dto = MFADeviceResponseDTO.fromEntity({
        ...deviceWithNumericFlags,
        isPrimary: true,
        isActive: false,
      } as unknown as IMFADevice);

      expect(dto.isPreferred).toBe(true);
      expect(dto.isActive).toBe(false);
    });
  });

  describe('UserResponseDTO', () => {
    const userWithNumericFlags = {
      id: 1,
      sub: 'a21b654c-2746-4168-acee-c175083a65cd',
      email: 'user@example.com',
      isEmailVerified: 1,
      isPhoneVerified: 0,
      isActive: 1,
      isLocked: 0,
      mfaEnabled: 1,
      mfaExempt: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as IUser;

    it('emits real booleans for every flag', () => {
      const dto = UserResponseDTO.fromEntity(userWithNumericFlags);

      for (const field of ['isEmailVerified', 'isPhoneVerified', 'isActive', 'isLocked', 'mfaEnabled', 'mfaExempt']) {
        expect(typeof (dto as unknown as Record<string, unknown>)[field]).toBe('boolean');
      }
    });

    it('preserves the meaning of each flag', () => {
      const dto = UserResponseDTO.fromEntity(userWithNumericFlags);

      expect(dto.isEmailVerified).toBe(true);
      expect(dto.isPhoneVerified).toBe(false);
      expect(dto.isActive).toBe(true);
      expect(dto.isLocked).toBe(false);
      expect(dto.mfaEnabled).toBe(true);
      expect(dto.mfaExempt).toBe(true);
    });
  });
});
