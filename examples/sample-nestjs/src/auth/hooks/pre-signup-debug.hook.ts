import { Injectable, Logger } from '@nestjs/common';
import { PreSignupHook, IPreSignupHookProvider } from '@nauth-toolkit/nestjs';

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
    data: unknown,
    signupType: 'password' | 'social',
    provider?: string,
    adminSignup?: boolean,
  ): Promise<void> {
    const userData = data as {
      email?: string;
      firstName?: string;
      lastName?: string;
      metadata?: Record<string, unknown>;
    };

    this.logger.debug('=== PRE-SIGNUP HOOK TRIGGERED ===');
    this.logger.debug(`Signup Type: ${signupType}`);
    this.logger.debug(`Provider: ${provider || 'N/A'}`);
    this.logger.debug(`Admin Signup: ${adminSignup || false}`);
    this.logger.debug(`User Email: ${userData.email || 'N/A'}`);
    this.logger.debug(`User First Name: ${userData.firstName || 'N/A'}`);
    this.logger.debug(`User Last Name: ${userData.lastName || 'N/A'}`);
    this.logger.debug(`Metadata: ${JSON.stringify(userData.metadata || {})}`);
    this.logger.debug('=== PRE-SIGNUP HOOK COMPLETE ===');
  }
}
