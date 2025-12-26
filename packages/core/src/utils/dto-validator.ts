import { validate, validateSync, type ValidationError } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';

/**
 * Internal DTO validation marker used to avoid double-validation when adapters already validated inputs.
 *
 * @remarks
 * We use Symbol.for so multiple copies (or different build outputs) can still share the same marker key.
 * Framework adapters can mark DTOs as validated by setting this symbol on the DTO instance.
 *
 * @example
 * ```typescript
 * // In NestJS adapter after ValidationPipe runs:
 * import { markDtoAsValidated } from '@nauth-toolkit/core/utils';
 * markDtoAsValidated(dto);
 * ```
 */
export const NAUTH_DTO_VALIDATED_MARKER = Symbol.for('nauth.dto.validated');

/**
 * Mark a DTO instance as already validated.
 *
 * This is useful for framework adapters (e.g., NestJS) that run validation via ValidationPipe
 * and want to prevent core services from re-validating the same DTO.
 *
 * @param dto - DTO instance to mark as validated
 *
 * @example
 * ```typescript
 * // In NestJS controller after ValidationPipe:
 * @Post('login')
 * async login(@Body() dto: LoginDTO) {
 *   markDtoAsValidated(dto); // Prevent AuthService from re-validating
 *   return this.authService.login(dto);
 * }
 * ```
 */
export function markDtoAsValidated(dto: object): void {
  Object.defineProperty(dto, NAUTH_DTO_VALIDATED_MARKER, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
}

/**
 * Check if a DTO instance has been marked as validated.
 *
 * @param dto - DTO instance to check
 * @returns True if the DTO has been marked as validated
 */
export function isDtoValidated(dto: object): boolean {
  return (dto as Record<PropertyKey, unknown>)[NAUTH_DTO_VALIDATED_MARKER] === true;
}

/**
 * Convert class-validator errors into ValidationPipe-compatible format.
 *
 * Formats errors to match the structure that NestJS ValidationPipe produces,
 * making it compatible with all framework adapters (NestJS, Express, Fastify, etc.).
 *
 * @param errors - Raw class-validator errors
 * @returns Object mapping field names to arrays of constraint messages
 *          Format: { "fieldName": ["constraint message 1", "constraint message 2"] }
 *
 * @example
 * ```typescript
 * // Input: class-validator ValidationError[]
 * // Output:
 * {
 *   "email": ["email must be an email"],
 *   "password": [
 *     "password must be longer than or equal to 8 characters",
 *     "password must be a string"
 *   ],
 *   "deviceType": ["deviceType must be one of the following values: mobile, desktop, tablet"]
 * }
 * ```
 *
 * @internal
 */
export function formatDtoValidationErrors(errors: ValidationError[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  const walk = (prefix: string, err: ValidationError): void => {
    const field = prefix ? `${prefix}.${err.property}` : err.property;

    if (err.constraints && Object.keys(err.constraints).length > 0) {
      // Extract all constraint messages for this field
      const messages = Object.values(err.constraints);
      if (result[field]) {
        // If field already has errors, append to existing array
        result[field].push(...messages);
      } else {
        result[field] = [...messages];
      }
    }

    if (err.children && err.children.length > 0) {
      for (const child of err.children) {
        walk(field, child);
      }
    }
  };

  for (const error of errors) {
    walk('', error);
  }

  return result;
}

/**
 * Ensure an input value is transformed into a DTO instance and validated.
 *
 * @remarks
 * This utility allows core services to be used safely outside frameworks that run DTO validation
 * (e.g. direct usage in scripts/tests or consumer apps without Nest ValidationPipe).
 *
 * Adapters may mark DTOs as validated by calling `markDtoAsValidated()`, which prevents
 * double-validation (useful when a ValidationPipe already ran).
 *
 * Security:
 * - Unknown properties are stripped via whitelist to avoid persisting/logging untrusted payload keys.
 * - Hard-fails on non-object values to prevent type confusion attacks.
 *
 * @param dtoClass - DTO class constructor
 * @param input - Potentially plain input object (or already a DTO instance)
 * @returns Validated DTO instance
 * @throws {NAuthException} When validation fails
 *
 * @example
 * ```typescript
 * // In a service method:
 * async login(input: unknown): Promise<AuthResponseDTO> {
 *   const dto = await ensureValidatedDto(LoginDTO, input);
 *   // dto is now guaranteed to be validated and transformed
 *   // ...
 * }
 * ```
 */
export async function ensureValidatedDto<T extends object>(dtoClass: new () => T, input: unknown): Promise<T> {
  // ============================================================================
  // Transform plain input into a DTO instance (ensures @Transform decorators run)
  // ============================================================================
  const dto: T = input instanceof dtoClass ? input : plainToInstance(dtoClass, input as Record<string, unknown>);

  // ============================================================================
  // Skip re-validation if an adapter already validated this DTO
  // ============================================================================
  if (isDtoValidated(dto as object)) {
    return dto;
  }

  // ============================================================================
  // Validate DTO (runtime enforcement of decorators)
  // ============================================================================
  const errors = await validate(dto as object, {
    // WHY: Remove unknown keys to prevent untrusted payload fields from leaking into persistence/logs.
    whitelist: true,
    // WHY: Keep backward compatibility by stripping rather than rejecting unknown keys.
    forbidNonWhitelisted: false,
    // WHY: Hard-fail on non-object / unknown values (e.g., passing a number or array).
    forbidUnknownValues: true,
  });

  if (errors.length > 0) {
    // ============================================================================
    // Platform-agnostic validation error contract
    // ============================================================================
    // Keep `message` a string for consistent UX across clients (Angular/React/etc.),
    // and place structured field errors under details.validationErrors.
    //
    // This avoids breaking consumers that assume `message` is a string while still
    // providing ValidationPipe-like field-level detail.
    const validationErrors = formatDtoValidationErrors(errors);

    throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Validation failed', {
      validationErrors,
    });
  }

  // Mark validated so downstream calls (or adapters) can skip redundant validation.
  markDtoAsValidated(dto as object);

  return dto;
}

/**
 * Synchronous variant of {@link ensureValidatedDto}.
 *
 * @remarks
 * Needed for sync methods that accept DTOs (e.g. `MFAService.hasProvider()`), so we can enforce
 * runtime validation without making those APIs async (breaking change).
 *
 * @param dtoClass - DTO class constructor
 * @param input - Potentially plain input object (or already a DTO instance)
 * @returns Validated DTO instance
 * @throws {NAuthException} When validation fails
 */
export function ensureValidatedDtoSync<T extends object>(dtoClass: new () => T, input: unknown): T {
  // ============================================================================
  // Transform plain input into a DTO instance (ensures @Transform decorators run)
  // ============================================================================
  const dto: T = input instanceof dtoClass ? input : plainToInstance(dtoClass, input as Record<string, unknown>);

  // ============================================================================
  // Skip re-validation if an adapter already validated this DTO
  // ============================================================================
  if (isDtoValidated(dto as object)) {
    return dto;
  }

  // ============================================================================
  // Validate DTO (runtime enforcement of decorators)
  // ============================================================================
  const errors = validateSync(dto as object, {
    whitelist: true,
    forbidNonWhitelisted: false,
    forbidUnknownValues: true,
  });

  if (errors.length > 0) {
    const validationErrors = formatDtoValidationErrors(errors);
    throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Validation failed', {
      validationErrors,
    });
  }

  markDtoAsValidated(dto as object);
  return dto;
}
