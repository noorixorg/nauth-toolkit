/**
 * DTO Validator Unit Tests
 *
 * Tests DTO validation and transformation functionality.
 */

import { IsString, IsEmail, MinLength, IsOptional } from 'class-validator';
import { ensureValidatedDto, ensureValidatedDtoSync, markDtoAsValidated, isDtoValidated, formatDtoValidationErrors } from './dto-validator';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { ValidationError } from 'class-validator';

class TestDTO {
  @IsString()
  @MinLength(3)
  name!: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}

describe('dto-validator', () => {
  describe('markDtoAsValidated and isDtoValidated', () => {
    it('should mark DTO as validated', () => {
      const dto = new TestDTO();
      expect(isDtoValidated(dto)).toBe(false);
      markDtoAsValidated(dto);
      expect(isDtoValidated(dto)).toBe(true);
    });

    it('should return false for unmarked DTO', () => {
      const dto = new TestDTO();
      expect(isDtoValidated(dto)).toBe(false);
    });
  });

  describe('formatDtoValidationErrors', () => {
    it('should format simple validation errors', () => {
      const errors: ValidationError[] = [
        {
          property: 'name',
          constraints: {
            isString: 'name must be a string',
            minLength: 'name must be longer than or equal to 3 characters',
          },
        },
      ];

      const result = formatDtoValidationErrors(errors);
      expect(result.name).toEqual(['name must be a string', 'name must be longer than or equal to 3 characters']);
    });

    it('should handle nested validation errors', () => {
      const errors: ValidationError[] = [
        {
          property: 'user',
          children: [
            {
              property: 'email',
              constraints: {
                isEmail: 'email must be an email',
              },
            },
          ],
        },
      ];

      const result = formatDtoValidationErrors(errors);
      expect(result['user.email']).toEqual(['email must be an email']);
    });

    it('should handle multiple errors for same field', () => {
      const errors: ValidationError[] = [
        {
          property: 'name',
          constraints: {
            isString: 'name must be a string',
          },
        },
        {
          property: 'name',
          constraints: {
            minLength: 'name must be longer than or equal to 3 characters',
          },
        },
      ];

      const result = formatDtoValidationErrors(errors);
      expect(result.name).toContain('name must be a string');
      expect(result.name).toContain('name must be longer than or equal to 3 characters');
    });

    it('should return empty object for empty errors array', () => {
      const result = formatDtoValidationErrors([]);
      expect(result).toEqual({});
    });
  });

  describe('ensureValidatedDto', () => {
    it('should validate and transform valid input', async () => {
      const input = { name: 'John', email: 'john@example.com' };
      const result = await ensureValidatedDto(TestDTO, input);
      expect(result).toBeInstanceOf(TestDTO);
      expect(result.name).toBe('John');
      expect(result.email).toBe('john@example.com');
    });

    it('should throw NAuthException for invalid input', async () => {
      const input = { name: 'Jo' }; // Too short
      await expect(ensureValidatedDto(TestDTO, input)).rejects.toThrow(NAuthException);
      await expect(ensureValidatedDto(TestDTO, input)).rejects.toMatchObject({
        code: AuthErrorCode.VALIDATION_FAILED,
      });
    });

    it('should handle null input', async () => {
      // Empty DTOs (from null/undefined) may fail validation if required fields are missing
      // This is expected behavior - null/undefined should be normalized to {} which may fail validation
      await expect(ensureValidatedDto(TestDTO, null)).rejects.toThrow(NAuthException);
    });

    it('should handle undefined input', async () => {
      // Empty DTOs (from null/undefined) may fail validation if required fields are missing
      await expect(ensureValidatedDto(TestDTO, undefined)).rejects.toThrow(NAuthException);
    });

    it('should throw error for non-object input', async () => {
      await expect(ensureValidatedDto(TestDTO, 'string')).rejects.toThrow(NAuthException);
      await expect(ensureValidatedDto(TestDTO, 123)).rejects.toThrow(NAuthException);
      await expect(ensureValidatedDto(TestDTO, [])).rejects.toThrow(NAuthException);
    });

    it('should skip validation for already validated DTO', async () => {
      // First validate normally to get a valid DTO
      const input = { name: 'John', email: 'john@example.com' };
      const validatedDto = await ensureValidatedDto(TestDTO, input);
      expect(isDtoValidated(validatedDto)).toBe(true);
      
      // Now pass it again - should skip validation since it's already marked
      // Note: plainToInstance may create a new instance, but validation should be skipped
      const result = await ensureValidatedDto(TestDTO, validatedDto);
      expect(result).toBeInstanceOf(TestDTO);
      expect(isDtoValidated(result)).toBe(true);
    });
  });

  describe('ensureValidatedDtoSync', () => {
    it('should validate and transform valid input synchronously', () => {
      const input = { name: 'John', email: 'john@example.com' };
      const result = ensureValidatedDtoSync(TestDTO, input);
      expect(result).toBeInstanceOf(TestDTO);
      expect(result.name).toBe('John');
      expect(result.email).toBe('john@example.com');
    });

    it('should throw NAuthException for invalid input', () => {
      const input = { name: 'Jo' }; // Too short
      expect(() => ensureValidatedDtoSync(TestDTO, input)).toThrow(NAuthException);
    });

    it('should handle null input', () => {
      // Empty DTOs may fail validation if required fields are missing
      expect(() => ensureValidatedDtoSync(TestDTO, null)).toThrow(NAuthException);
    });

    it('should skip validation for already validated DTO', () => {
      // First validate normally to get a valid DTO
      const input = { name: 'John', email: 'john@example.com' };
      const validatedDto = ensureValidatedDtoSync(TestDTO, input);
      expect(isDtoValidated(validatedDto)).toBe(true);
      
      // Now pass it again - should skip validation since it's already marked
      // Note: plainToInstance may create a new instance, but validation should be skipped
      const result = ensureValidatedDtoSync(TestDTO, validatedDto);
      expect(result).toBeInstanceOf(TestDTO);
      expect(isDtoValidated(result)).toBe(true);
    });

    it('should handle undefined input', () => {
      expect(() => ensureValidatedDtoSync(TestDTO, undefined)).toThrow(NAuthException);
    });

    it('should handle non-object input', () => {
      expect(() => ensureValidatedDtoSync(TestDTO, 'string')).toThrow(NAuthException);
      expect(() => ensureValidatedDtoSync(TestDTO, 123)).toThrow(NAuthException);
      expect(() => ensureValidatedDtoSync(TestDTO, [])).toThrow(NAuthException);
    });
  });

  describe('formatDtoValidationErrors edge cases', () => {
    it('should handle errors without constraints', () => {
      const errors: ValidationError[] = [
        {
          property: 'name',
          children: [
            {
              property: 'nested',
              constraints: {
                isString: 'nested must be a string',
              },
            },
          ],
        },
      ];

      const result = formatDtoValidationErrors(errors);
      expect(result['name.nested']).toEqual(['nested must be a string']);
    });

    it('should handle deeply nested errors', () => {
      const errors: ValidationError[] = [
        {
          property: 'level1',
          children: [
            {
              property: 'level2',
              children: [
                {
                  property: 'level3',
                  constraints: {
                    isString: 'level3 must be a string',
                  },
                },
              ],
            },
          ],
        },
      ];

      const result = formatDtoValidationErrors(errors);
      expect(result['level1.level2.level3']).toEqual(['level3 must be a string']);
    });

    it('should handle errors with empty constraints', () => {
      const errors: ValidationError[] = [
        {
          property: 'name',
          constraints: {},
        },
      ];

      const result = formatDtoValidationErrors(errors);
      expect(result).toEqual({});
    });
  });
});
