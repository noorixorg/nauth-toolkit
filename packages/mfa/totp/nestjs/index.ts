/**
 * @nauth-toolkit/mfa-totp/nestjs
 *
 * NestJS adapter for TOTP MFA
 */

export { TOTPMFAModule } from './totp-mfa.module';

// Re-export core TOTP components
export * from '../src/totp.service';
export * from '../src/totp-mfa-provider.service';
export * from '../src/dto/mfa.dto';

