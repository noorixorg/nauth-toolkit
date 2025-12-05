/**
 * @nauth-toolkit/mfa-passkey/nestjs
 *
 * NestJS adapter for Passkey MFA
 */

export { PasskeyMFAModule } from './passkey-mfa.module';

// Re-export core Passkey components
export * from '../src/passkey.service';
export * from '../src/passkey-mfa-provider.service';
export * from '../src/dto/mfa.dto';

