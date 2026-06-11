import { PasswordService } from './password.service';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(() => {
    service = new PasswordService();
  });

  describe('hashPassword', () => {
    it('should hash password using Argon2id', async () => {
      const password = 'SecurePassword123!';
      const hash = await service.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash).toMatch(/^\$argon2id\$/);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'SecurePassword123!';
      const hash1 = await service.hashPassword(password);
      const hash2 = await service.hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'SecurePassword123!';
      const hash = await service.hashPassword(password);
      const isValid = await service.verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'SecurePassword123!';
      const hash = await service.hashPassword(password);
      const isValid = await service.verifyPassword('WrongPassword!', hash);

      expect(isValid).toBe(false);
    });

    it('should return false for invalid hash', async () => {
      const isValid = await service.verifyPassword('test', 'invalid-hash');
      expect(isValid).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should validate password meeting all requirements', async () => {
      const result = await service.validatePassword('SecurePass123!');

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should reject password too short', async () => {
      const result = await service.validatePassword('Short1!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject password without uppercase', async () => {
      const result = await service.validatePassword('password123!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without numbers', async () => {
      const result = await service.validatePassword('PasswordTest!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should reject password without special characters', async () => {
      const result = await service.validatePassword('SecurePasswordABC123');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one special character !@#$%^&*()_+=[{}|;:,.<>?-]',
      );
    });

    it('should reject common password', async () => {
      const result = await service.validatePassword('password123');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password is too common and easy to guess');
    });

    it('should reject password containing username', async () => {
      const result = await service.validatePassword('JohnDoe123!', {
        username: 'johndoe',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must not contain your email or username');
    });

    it('should reject password containing email username', async () => {
      const result = await service.validatePassword('TestUser123!', {
        email: 'testuser@example.com',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must not contain your email or username');
    });
  });

  describe('isPasswordInHistory', () => {
    it('should detect password in history', async () => {
      const password = 'OldPassword123!';
      const hash = await service.hashPassword(password);
      const history = [hash];

      const isReused = await service.isPasswordInHistory(password, history);

      expect(isReused).toBe(true);
    });

    it('should allow password not in history', async () => {
      const oldPassword = 'OldPassword123!';
      const newPassword = 'NewPassword123!';
      const hash = await service.hashPassword(oldPassword);
      const history = [hash];

      const isReused = await service.isPasswordInHistory(newPassword, history);

      expect(isReused).toBe(false);
    });

    it('should handle empty history', async () => {
      const isReused = await service.isPasswordInHistory('Password123!', []);
      expect(isReused).toBe(false);
    });
  });

  describe('addToHistory', () => {
    it('should add password to history', () => {
      const history: string[] = [];
      const newHash = 'new-hash';

      const updated = service.addToHistory(history, newHash);

      expect(updated).toContain(newHash);
      expect(updated.length).toBe(1);
    });

    it('should maintain maximum history size', () => {
      const history = ['hash1', 'hash2', 'hash3', 'hash4', 'hash5'];
      const newHash = 'hash6';

      const updated = service.addToHistory(history, newHash);

      expect(updated.length).toBe(5);
      expect(updated).not.toContain('hash1');
      expect(updated).toContain('hash6');
    });
  });
});
