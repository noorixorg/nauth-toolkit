import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SignupDTO } from './signup.dto';
import { UserUpdateDTO } from './user-update.dto';

/**
 * Timezone/locale DTO validation
 *
 * These fields are populated automatically by the frontend SDK, so a browser reporting
 * something unexpected must produce a clean 400 rather than a row the email formatter
 * cannot use.
 */
describe('timezone and locale validation', () => {
  const errorsFor = async (dto: object): Promise<string[]> => {
    const errors = await validate(dto);
    return errors.flatMap((e) => Object.keys(e.constraints ?? {}).map(() => e.property));
  };

  describe('SignupDTO', () => {
    const base = { email: 'user@example.com', password: 'SecurePass123!' };

    it('accepts a valid timezone and locale', async () => {
      const dto = plainToInstance(SignupDTO, { ...base, timezone: 'Europe/Dublin', locale: 'en-GB' });
      expect(await errorsFor(dto)).toEqual([]);
    });

    it('accepts a signup with neither field — both are optional', async () => {
      const dto = plainToInstance(SignupDTO, base);
      expect(await errorsFor(dto)).toEqual([]);
    });

    it('rejects an unknown timezone', async () => {
      const dto = plainToInstance(SignupDTO, { ...base, timezone: 'Mars/Olympus' });
      expect(await errorsFor(dto)).toContain('timezone');
    });

    it('rejects a malformed locale', async () => {
      const dto = plainToInstance(SignupDTO, { ...base, locale: 'not a locale' });
      expect(await errorsFor(dto)).toContain('locale');
    });

    it('trims surrounding whitespace', async () => {
      const dto = plainToInstance(SignupDTO, { ...base, timezone: '  Europe/Dublin  ' });
      expect(dto.timezone).toBe('Europe/Dublin');
      expect(await errorsFor(dto)).toEqual([]);
    });
  });

  describe('UserUpdateDTO', () => {
    it('accepts both fields', async () => {
      const dto = plainToInstance(UserUpdateDTO, { timezone: 'Asia/Karachi', locale: 'ur-PK' });
      expect(await errorsFor(dto)).toEqual([]);
    });

    it('rejects an unknown timezone on update too', async () => {
      const dto = plainToInstance(UserUpdateDTO, { timezone: 'Nowhere/Nothing' });
      expect(await errorsFor(dto)).toContain('timezone');
    });

    it('allows an update that touches neither field', async () => {
      const dto = plainToInstance(UserUpdateDTO, { firstName: 'Ada' });
      expect(await errorsFor(dto)).toEqual([]);
    });
  });
});
