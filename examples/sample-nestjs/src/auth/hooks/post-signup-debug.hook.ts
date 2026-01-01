import { Injectable, Logger } from '@nestjs/common';
import { PostSignupHook, IPostSignupHookProvider, SignupMetadata } from '@nauth-toolkit/nestjs';
import { IUser } from '@nauth-toolkit/core';

/**
 * Post-Signup Hook - Debug Example
 *
 * Executes after successful user creation for both password and social signups.
 * Logs user creation details for debugging.
 */
@Injectable()
@PostSignupHook()
export class PostSignupDebugHook implements IPostSignupHookProvider {
  private readonly logger = new Logger(PostSignupDebugHook.name);

  async execute(user: IUser, metadata?: SignupMetadata): Promise<void> {
    this.logger.debug('=== POST-SIGNUP HOOK TRIGGERED ===');
    this.logger.debug(`User ID: ${user.sub}`);
    this.logger.debug(`User Email: ${user.email}`);
    this.logger.debug(`User First Name: ${user.firstName || 'N/A'}`);
    this.logger.debug(`User Last Name: ${user.lastName || 'N/A'}`);
    this.logger.debug(`Signup Type: ${metadata?.signupType || 'N/A'}`);
    this.logger.debug(`Provider: ${metadata?.provider || 'N/A'}`);
    this.logger.debug(`Requires Verification: ${metadata?.requiresVerification || false}`);
    this.logger.debug(`Admin Signup: ${metadata?.adminSignup || false}`);
    this.logger.debug(`User Created At: ${user.createdAt || 'N/A'}`);
    this.logger.debug('=== POST-SIGNUP HOOK COMPLETE ===');
  }
}
