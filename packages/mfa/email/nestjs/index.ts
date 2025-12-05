/**
 * @nauth-toolkit/mfa-email/nestjs
 *
 * NestJS adapter for Email MFA
 */

export { EmailMFAModule } from './email-mfa.module';

// Re-export core Email MFA components
export * from '../src/email-mfa-provider.service';
export * from '../src/dto/mfa.dto';

