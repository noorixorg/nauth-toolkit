import { Injectable } from '@nestjs/common';
// Internal API import (for test utilities only)
import { PasswordService } from '@nauth-toolkit/core/internal';

/**
 * Test service to demonstrate local nauth-toolkit integration
 */
@Injectable()
export class TestService {
  private readonly passwordService: PasswordService;

  constructor() {
    // Initialize password service with default config
    this.passwordService = new PasswordService();
  }

  /**
   * Test password hashing
   */
  async testPasswordHashing() {
    const password = 'TestPassword123!';

    // Hash the password
    const hash = await this.passwordService.hashPassword(password);

    // Verify the password
    const isValid = await this.passwordService.verifyPassword(password, hash);

    // Test password validation
    const validation = await this.passwordService.validatePassword(password);

    return {
      success: true,
      hash: `${hash.substring(0, 50)}...`,
      isValid,
      validation,
    };
  }
}
