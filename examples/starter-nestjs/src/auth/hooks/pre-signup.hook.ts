import { Injectable, Logger } from '@nestjs/common';
import {
  PreSignupHook as PreSignupHookDecorator,
  IPreSignupHookProvider,
  PreSignupHookData,
  SignupDTO,
  OAuthUserProfile,
} from '@nauth-toolkit/nestjs';

/**
 * Pre-Signup Hook Example
 *
 * Executes before user creation for both password and social signups.
 * Use this to:
 * - Validate custom business rules (e.g. block certain email domains)
 * - Log signup attempts
 * - Enrich signup data before it's saved
 *
 * Throw an exception here to abort the signup.
 */
@Injectable()
@PreSignupHookDecorator()
export class PreSignupHook implements IPreSignupHookProvider {
  private readonly logger = new Logger(PreSignupHook.name);

  async execute(
    data: PreSignupHookData,
    signupType: 'password' | 'social',
    provider?: string,
  ): Promise<void> {
    if (signupType === 'password') {
      const dto = data as SignupDTO;
      this.logger.log(`New signup: ${dto.email} (password)`);

      // Example: block disposable email domains
      // if (dto.email?.endsWith('@mailinator.com')) {
      //   throw new BadRequestException('Disposable email addresses are not allowed.');
      // }
    } else {
      const profile = data as OAuthUserProfile;
      this.logger.log(`New signup: ${profile.email} (${provider})`);
    }
  }
}
