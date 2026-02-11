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

    // Log social metadata for social signups
    if (metadata?.signupType === 'social' && metadata?.socialMetadata) {
      this.logger.debug('--- Social Login Data ---');
      this.logger.debug(`Social Metadata: ${JSON.stringify(metadata.socialMetadata, null, 2)}`);
      if (metadata.profilePicture) {
        this.logger.debug(`Profile Picture: ${metadata.profilePicture}`);
      }
    }

    // Highlight Apple-specific data (name is in user object, not socialMetadata)
    if (metadata?.provider === 'apple') {
      this.logger.debug('--- Apple Sign-In Name Data ---');
      this.logger.debug(
        `Apple firstName from user object: ${user.firstName || 'NOT PROVIDED (may be subsequent login)'}`,
      );
      this.logger.debug(
        `Apple lastName from user object: ${user.lastName || 'NOT PROVIDED (may be subsequent login)'}`,
      );
      this.logger.debug('Note: Apple only sends name on FIRST sign-in. Subsequent logins will not have name data.');
    }

    this.logger.debug('=== POST-SIGNUP HOOK COMPLETE ===');
  }
}
