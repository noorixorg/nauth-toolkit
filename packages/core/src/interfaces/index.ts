export * from './config.interface';
export * from './entities.interface';
export * from './logger.interface';
export * from './mfa-provider.interface';
export * from './oauth.interface';
export * from './provider.interface';
// NOTE: SMS provider configurations moved to their respective packages
// Import from @nauth-toolkit/sms-aws-sns, @nauth-toolkit/sms-twilio, etc.
// export * from './sms-config.interface'; // Deprecated - kept for backward compatibility notes only
export * from './social-auth-provider.interface';
export * from './storage-adapter.interface';
export * from './template.interface';
export * from './sms-template.interface';
export * from './token-verifier.interface';
// Note: ClientInfo interface is exported directly from core/index.ts as IClientInfo
// to avoid naming conflict with ClientInfo decorator
