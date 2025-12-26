import { Injectable, type PipeTransform, type ArgumentMetadata } from '@nestjs/common';
import { ensureValidatedDto } from '@nauth-toolkit/core';

/**
 * NAuthValidationPipe
 *
 * Framework adapter pipe that validates incoming request payloads using **nauth-toolkit's**
 * DTO validation contract (via `ensureValidatedDto()`), ensuring validation failures always
 * throw `NAuthException` and therefore always serialize in the **NAUTHError** format.
 *
 * @remarks
 * Why this exists:
 * - Nest's `ValidationPipe` throws `BadRequestException` with a different payload shape.
 * - Many frontends assume `message` is a string; changing that breaks UX (e.g., "400 OK").
 * - `ensureValidatedDto()` keeps `message` as a string and places field errors under
 *   `details.validationErrors`, which is platform-agnostic and stable.
 *
 * Usage:
 * - Prefer this pipe globally instead of Nest's ValidationPipe when using nauth-toolkit.
 *
 * @example
 * ```typescript
 * // main.ts
 * import { NestFactory } from '@nestjs/core';
 * import { AppModule } from './app.module';
 * import { NAuthValidationPipe, NAuthHttpExceptionFilter } from '@nauth-toolkit/nestjs';
 *
 * async function bootstrap() {
 *   const app = await NestFactory.create(AppModule);
 *   app.useGlobalPipes(new NAuthValidationPipe());
 *   app.useGlobalFilters(new NAuthHttpExceptionFilter());
 *   await app.listen(3000);
 * }
 * ```
 */
@Injectable()
export class NAuthValidationPipe implements PipeTransform {
  /**
   * Transform and validate the incoming value using nauth-toolkit DTO validation.
   *
   * @param value - Incoming value (usually request body)
   * @param metadata - Nest argument metadata (includes metatype)
   * @returns Validated DTO instance (transformed)
   * @throws {NAuthException} When validation fails (caught by NAuthHttpExceptionFilter)
   */
  async transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    const metatype = metadata.metatype;

    // Skip validation for primitives or missing metatype (same behavior as Nest ValidationPipe)
    if (!metatype || this.isPrimitiveType(metatype)) {
      return value;
    }

    // Validate and transform using nauth-toolkit's stable error contract
    return ensureValidatedDto(metatype as unknown as new () => object, value);
  }

  /**
   * Check whether a metatype is a primitive constructor that should not be validated.
   *
   * @param metatype - Nest metatype
   * @returns True if primitive
   */
  private isPrimitiveType(metatype: unknown): boolean {
    return (
      metatype === String || metatype === Boolean || metatype === Number || metatype === Array || metatype === Object
    );
  }
}
