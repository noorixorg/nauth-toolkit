import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDTO } from './login.dto';

describe('LoginDTO', () => {
  it('should accept deviceType after trimming + lowercasing', async () => {
    const dto = plainToInstance(LoginDTO, {
      identifier: 'USER@EXAMPLE.COM',
      password: 'password',
      deviceType: '  MOBILE  ',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.deviceType).toBe('mobile');
  });

  it('should reject invalid deviceType values', async () => {
    const dto = plainToInstance(LoginDTO, {
      identifier: 'user@example.com',
      password: 'password',
      deviceType: 'car',
    });

    const errors = await validate(dto);
    const deviceTypeErrors = errors.find((e) => e.property === 'deviceType');
    expect(deviceTypeErrors).toBeDefined();
    expect(deviceTypeErrors?.constraints).toBeDefined();
    expect(Object.values(deviceTypeErrors!.constraints!)).toEqual(
      expect.arrayContaining(['DeviceType must be one of: mobile, desktop, tablet']),
    );
  });
});
