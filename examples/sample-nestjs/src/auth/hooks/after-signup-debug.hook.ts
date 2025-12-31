import { Injectable, Logger } from '@nestjs/common';
import { AfterSignupHook, IAfterSignupHookProvider, SignupMetadata } from '@nauth-toolkit/nestjs';
import { IUser } from '@nauth-toolkit/core';

/**
 * After-Signup Hook - Debug Example
 *
 * Executes after successful user creation for both password and social signups.
 * Logs user creation details for debugging.
 */
@Injectable()
@AfterSignupHook()
export class AfterSignupDebugHook implements IAfterSignupHookProvider {
  private readonly logger = new Logger(AfterSignupDebugHook.name);

  async execute(user: IUser, metadata?: SignupMetadata): Promise<void> {
    this.logger.debug('=== AFTER-SIGNUP HOOK TRIGGERED ===');
    this.logger.debug(`User ID: ${user.sub}`);
    this.logger.debug(`User Email: ${user.email}`);
    this.logger.debug(`User First Name: ${user.firstName || 'N/A'}`);
    this.logger.debug(`User Last Name: ${user.lastName || 'N/A'}`);
    this.logger.debug(`Signup Type: ${metadata?.signupType || 'N/A'}`);
    this.logger.debug(`Provider: ${metadata?.provider || 'N/A'}`);
    this.logger.debug(`Requires Verification: ${metadata?.requiresVerification || false}`);
    this.logger.debug(`Admin Signup: ${metadata?.adminSignup || false}`);
    this.logger.debug(`User Created At: ${user.createdAt || 'N/A'}`);
    this.logger.debug('=== AFTER-SIGNUP HOOK COMPLETE ===');
  }
}
