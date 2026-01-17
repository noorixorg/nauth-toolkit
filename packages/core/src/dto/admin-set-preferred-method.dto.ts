import { IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { SetPreferredMethodDTO, SetPreferredMethodResponseDTO } from './set-preferred-method.dto';

/**
 * Admin DTO for setting preferred MFA method for a specific user
 *
 * Admin APIs must explicitly target a user via `sub`.
 * This DTO mirrors {@link SetPreferredMethodDTO} but adds `sub`.
 *
 * @example
 * ```typescript
 * const result = await mfaService.adminSetPreferredMethod({
 *   sub: 'a21b654c-2746-4168-acee-c175083a65cd',
 *   methodType: 'sms',
 * });
 * ```
 */
export class AdminSetPreferredMethodDTO extends SetPreferredMethodDTO {
  /**
   * Target user's unique identifier (UUID v4)
   *
   * @example "a21b654c-2746-4168-acee-c175083a65cd"
   */
  @IsUUID('4', { message: 'User sub must be a valid UUID v4 format' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  sub!: string;
}

export { SetPreferredMethodResponseDTO };

