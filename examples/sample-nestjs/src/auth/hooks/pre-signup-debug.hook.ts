import { Injectable, Logger } from '@nestjs/common';
import {
  PreSignupHook,
  IPreSignupHookProvider,
  PreSignupHookData,
  SignupDTO,
  AdminSignupDTO,
  OAuthUserProfile,
} from '@nauth-toolkit/nestjs';

/**
 * Pre-Signup Hook - Debug Example
 *
 * Executes before user creation for both password and social signups.
 * Logs signup attempt details for debugging.
 */
@Injectable()
@PreSignupHook()
export class PreSignupDebugHook implements IPreSignupHookProvider {
  private readonly logger = new Logger(PreSignupDebugHook.name);

  async execute(
    data: PreSignupHookData,
    signupType: 'password' | 'social',
    provider?: string,
    adminSignup?: boolean,
  ): Promise<void> {
    this.logger.debug('=== PRE-SIGNUP HOOK TRIGGERED ===');
    this.logger.debug(`Signup Type: ${signupType}`);
    this.logger.debug(`Provider: ${provider || 'N/A'}`);
    this.logger.debug(`Admin Signup: ${adminSignup || false}`);

    if (signupType === 'password') {
      // Handle both SignupDTO and AdminSignupDTO
      const dto = data as SignupDTO | AdminSignupDTO;
      this.logger.debug(`User Email: ${dto.email}`);
      this.logger.debug(`User First Name: ${dto.firstName || 'N/A'}`);
      this.logger.debug(`User Last Name: ${dto.lastName || 'N/A'}`);
      this.logger.debug(`Username: ${dto.username || 'N/A'}`);
      this.logger.debug(`Phone: ${dto.phone || 'N/A'}`);
      this.logger.debug(`Metadata: ${JSON.stringify(dto.metadata || {})}`);
      if ('generatePassword' in dto) {
        this.logger.debug(`Admin Signup - Generate Password: ${dto.generatePassword || false}`);
      }
    } else if (signupType === 'social') {
      const profile = data as OAuthUserProfile;
      this.logger.debug(`User Email: ${profile.email || 'N/A'}`);
      this.logger.debug(`User First Name: ${profile.firstName || 'N/A'}`);
      this.logger.debug(`User Last Name: ${profile.lastName || 'N/A'}`);
      this.logger.debug(`Provider ID: ${profile.id}`);
      this.logger.debug(`Email Verified: ${profile.verified || false}`);
      this.logger.debug(`Picture URL: ${profile.picture || 'N/A'}`);
    }

    this.logger.debug('=== PRE-SIGNUP HOOK COMPLETE ===');
  }
}
