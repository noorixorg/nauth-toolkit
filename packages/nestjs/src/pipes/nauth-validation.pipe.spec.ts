/**
 * NAuth Validation Pipe Unit Tests
 *
 * Tests DTO validation pipe functionality.
 */

import { ArgumentMetadata } from '@nestjs/common';
import { NAuthValidationPipe } from './nauth-validation.pipe';
import { NAuthException } from '@nauth-toolkit/core';
import { AuthErrorCode } from '@nauth-toolkit/core';
import { IsString, MinLength } from 'class-validator';

class TestDTO {
  @IsString()
  @MinLength(3)
  name!: string;
}

describe('NAuthValidationPipe', () => {
  let pipe: NAuthValidationPipe;

  beforeEach(() => {
    pipe = new NAuthValidationPipe();
  });

  describe('transform', () => {
    it('should validate and transform valid DTO', async () => {
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: TestDTO,
        data: undefined,
      };
      const result = await pipe.transform({ name: 'John' }, metadata);
      expect(result).toBeInstanceOf(TestDTO);
      expect((result as TestDTO).name).toBe('John');
    });

    it('should throw NAuthException for invalid DTO', async () => {
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: TestDTO,
        data: undefined,
      };
      await expect(pipe.transform({ name: 'Jo' }, metadata)).rejects.toThrow(NAuthException);
      await expect(pipe.transform({ name: 'Jo' }, metadata)).rejects.toMatchObject({
        code: AuthErrorCode.VALIDATION_FAILED,
      });
    });

    it('should skip validation for primitives', async () => {
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: String,
        data: undefined,
      };
      const result = await pipe.transform('test', metadata);
      expect(result).toBe('test');
    });

    it('should skip validation for undefined value', async () => {
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: TestDTO,
        data: undefined,
      };
      const result = await pipe.transform(undefined, metadata);
      expect(result).toBeUndefined();
    });

    it('should skip validation when metatype is missing', async () => {
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: undefined,
        data: undefined,
      };
      const result = await pipe.transform({ name: 'John' }, metadata);
      expect(result).toEqual({ name: 'John' });
    });
  });
});
