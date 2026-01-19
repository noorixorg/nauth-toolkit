import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SignupDTO } from './signup.dto';

describe('SignupDTO', () => {
  it('should accept valid signup with recaptchaToken (optional)', async () => {
    const dto = plainToInstance(SignupDTO, {
      email: 'user@example.com',
      password: 'SecurePass123!',
      recaptchaToken: '03AGdBq24P',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.recaptchaToken).toBe('03AGdBq24P');
  });

  it('should accept valid signup without recaptchaToken (backward compatibility)', async () => {
    const dto = plainToInstance(SignupDTO, {
      email: 'user@example.com',
      password: 'SecurePass123!',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.recaptchaToken).toBeUndefined();
  });

  it('should reject non-string recaptchaToken', async () => {
    const dto = plainToInstance(SignupDTO, {
      email: 'user@example.com',
      password: 'SecurePass123!',
      recaptchaToken: 123 as unknown as string,
    });

    const errors = await validate(dto);
    const recaptchaErrors = errors.find((e) => e.property === 'recaptchaToken');
    expect(recaptchaErrors).toBeDefined();
  });
});
