/**
 * @nauth-toolkit/mfa-sms/nestjs
 *
 * NestJS adapter for SMS MFA
 */

export { SMSMFAModule } from './sms-mfa.module';

// Re-export core SMS MFA components
export * from '../src/sms-mfa-provider.service';
export * from '../src/dto/mfa.dto';

