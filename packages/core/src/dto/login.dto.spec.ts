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

  it('should accept valid login with recaptchaToken (optional)', async () => {
    const dto = plainToInstance(LoginDTO, {
      identifier: 'user@example.com',
      password: 'password',
      recaptchaToken: '03AGdBq24P',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.recaptchaToken).toBe('03AGdBq24P');
  });

  it('should accept valid login without recaptchaToken (backward compatibility)', async () => {
    const dto = plainToInstance(LoginDTO, {
      identifier: 'user@example.com',
      password: 'password',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.recaptchaToken).toBeUndefined();
  });

  it('should reject non-string recaptchaToken', async () => {
    const dto = plainToInstance(LoginDTO, {
      identifier: 'user@example.com',
      password: 'password',
      recaptchaToken: 123 as unknown as string,
    });

    const errors = await validate(dto);
    const recaptchaErrors = errors.find((e) => e.property === 'recaptchaToken');
    expect(recaptchaErrors).toBeDefined();
  });
});
