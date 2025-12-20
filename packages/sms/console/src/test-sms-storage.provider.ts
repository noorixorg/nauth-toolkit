import { SMSProvider, NAuthLogger } from '@nauth-toolkit/core';

/**
 * Test SMS Storage Interface
 * Stores SMS codes in a test database table for retrieval during E2E tests
 */
export interface TestSMSStorage {
  storeCode(phone: string, code: string): Promise<void>;
  getLatestCode(phone: string): Promise<string | null>;
  clearCodes(phone?: string): Promise<void>;
}

/**
 * Test SMS Provider with Database Storage
 *
 * Stores SMS codes in a test database table for E2E testing.
 * Allows tests to retrieve verification codes via test endpoints.
 *
 * TEST MODE ONLY - Only use when NAUTH_TEST_MODE=true
 */
export class TestSMSStorageProvider implements SMSProvider {
  private logger: NAuthLogger;
  private storage: TestSMSStorage;

  constructor(logger: NAuthLogger, storage: TestSMSStorage) {
    this.logger = logger;
    this.storage = storage;
  }

  setLogger(logger: NAuthLogger): void {
    this.logger = logger;
  }

  async sendOTP(phone: string, code: string): Promise<void> {
    this.logger.log(`[TEST SMS] Sending OTP to: ${phone}, code: ${code}`);

    // Store code in test database
    await this.storage.storeCode(phone, code);

    // Also log to console for visibility
    this.logger.log(`\n${'='.repeat(60)}`);
    this.logger.log('SMS MESSAGE (TEST MODE - Stored in DB)');
    this.logger.log('='.repeat(60));
    this.logger.log(`To: ${phone}`);
    this.logger.log(`Message: Your verification code is: ${code}`);
    this.logger.log(`${'='.repeat(60)}\n`);
  }

  async sendVerificationCode(phone: string, code: string): Promise<void> {
    await this.sendOTP(phone, code);
  }
}
