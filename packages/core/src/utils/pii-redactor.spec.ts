import { PiiRedactor } from './pii-redactor';

describe('PiiRedactor', () => {
  let redactor: PiiRedactor;

  beforeEach(() => {
    redactor = new PiiRedactor();
  });

  describe('redactMessage', () => {
    it('should redact email addresses', () => {
      const message = 'User user@example.com logged in';
      const redacted = redactor.redactMessage(message);
      expect(redacted).toBe('User u***@***.com logged in');
    });

    it('should redact IP addresses', () => {
      const message = 'Login from 192.168.1.100';
      const redacted = redactor.redactMessage(message);
      expect(redacted).toBe('Login from 192.168.1.***');
    });

    it('should redact JWT tokens', () => {
      const message = 'Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      const redacted = redactor.redactMessage(message);
      expect(redacted).toBe('Token: [REDACTED_TOKEN]');
    });

    it('should redact passwords', () => {
      const message = 'password: MySecretPass123';
      const redacted = redactor.redactMessage(message);
      expect(redacted).toContain('[REDACTED]');
    });

    it('should redact Argon2 hashes', () => {
      const message =
        'Hash: $argon2id$v=19$m=65536,t=3,p=4$NiHLP1CtwlkNQY105M660Q$o9JAC5CauGAYHIynTirdzAZGQtavL0osvxnYVkmskbo';
      const redacted = redactor.redactMessage(message);
      expect(redacted).toContain('[REDACTED_HASH]');
      expect(redacted).not.toContain('$argon2');
    });

    it('should redact phone numbers', () => {
      const message = 'Phone: +1234567890';
      const redacted = redactor.redactMessage(message);
      expect(redacted).toBe('Phone: +123***7890');
    });

    it('should redact names', () => {
      // Test with full names (two consecutive capitalized words)
      const message = 'Meeting with John Doe at 3pm';
      const redacted = redactor.redactMessage(message);
      // Redacts full names (two consecutive capitalized words)
      expect(redacted).toBe('Meeting with J*** D*** at 3pm');
    });

    it('should redact firstName and lastName fields in JSON', () => {
      const message = 'firstName: John, lastName: Doe';
      const redacted = redactor.redactMessage(message);
      expect(redacted).toBe('firstName=[REDACTED_NAME], lastName=[REDACTED_NAME]');
    });

    it('should handle multiple PII types in one message', () => {
      const message = 'User user@example.com from 192.168.1.100 with token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      const redacted = redactor.redactMessage(message);
      expect(redacted).toContain('u***@***.com');
      expect(redacted).toContain('192.168.1.***');
      expect(redacted).toContain('[REDACTED_TOKEN]');
    });
  });

  describe('redactMetadata', () => {
    it('should redact IP address in metadata', () => {
      const metadata = {
        userId: '123',
        ipAddress: '192.168.1.100',
      };
      const redacted = redactor.redactMetadata(metadata);
      expect(redacted?.ipAddress).toBe('192.168.1.***');
      expect(redacted?.userId).toBe('123');
    });

    it('should redact custom fields', () => {
      redactor = new PiiRedactor({
        customRedactionFields: ['ssn', 'creditCard'],
      });
      const metadata = {
        userId: '123',
        ssn: '123-45-6789',
        creditCard: '4111-1111-1111-1111',
      };
      const redacted = redactor.redactMetadata(metadata);
      expect(redacted?.ssn).toBe('[REDACTED]');
      expect(redacted?.creditCard).toBe('[REDACTED]');
      expect(redacted?.userId).toBe('123');
    });

    it('should handle nested objects', () => {
      const metadata = {
        user: {
          email: 'user@example.com',
          password: 'secret123',
        },
      };
      const redacted = redactor.redactMetadata(metadata);
      expect(redacted?.user).toBeDefined();
      expect((redacted?.user as any).email).toContain('***');
    });

    it('should return undefined for undefined input', () => {
      const redacted = redactor.redactMetadata(undefined);
      expect(redacted).toBeUndefined();
    });
  });

  describe('disable redaction', () => {
    it('should not redact if redaction is disabled', () => {
      redactor = new PiiRedactor({
        redactEmails: false,
        redactIpAddresses: false,
        redactTokens: false,
        redactPasswords: false,
        redactPhoneNumbers: false,
      });
      const message = 'User user@example.com from 192.168.1.100';
      const redacted = redactor.redactMessage(message);
      expect(redacted).toBe(message); // Should be unchanged
    });
  });
});
