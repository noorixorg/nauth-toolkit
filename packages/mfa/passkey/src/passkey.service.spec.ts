import 'reflect-metadata';
import { PasskeyService } from './passkey.service';
import { NAuthConfig, NAuthLogger, NAuthException, AuthErrorCode, MFAMethod, IMFADevice } from '@nauth-toolkit/core';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/types';

// Mock @simplewebauthn/server
jest.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: jest.fn(),
  verifyRegistrationResponse: jest.fn(),
  generateAuthenticationOptions: jest.fn(),
  verifyAuthenticationResponse: jest.fn(),
}));

/**
 * Passkey Service Unit Tests
 *
 * Tests passkey/WebAuthn service including registration, authentication,
 * and configuration. Uses direct instantiation, no NestJS dependencies.
 */
describe('PasskeyService', () => {
  let service: PasskeyService;
  let mockConfig: NAuthConfig;
  let mockLogger: NAuthLogger;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    // Create mock config with passkey settings
    mockConfig = {
      mfa: {
        passkey: {
          rpName: 'TestApp',
          rpId: 'testapp.com',
          origin: 'https://testapp.com',
          timeout: 60000,
          userVerification: 'preferred',
        },
      },
    } as NAuthConfig;

    // Instantiate service directly
    service = new PasskeyService(mockConfig, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Service Initialization
  // ============================================================================

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================================================
  // isSupported() Method
  // ============================================================================

  describe('isSupported', () => {
    it('should return true when passkey is properly configured', () => {
      const result = service.isSupported();
      expect(result).toBe(true);
    });

    it('should return false when rpName is missing', () => {
      mockConfig.mfa!.passkey!.rpName = undefined as any;
      const result = service.isSupported();
      expect(result).toBe(false);
    });

    it('should return false when rpId is missing', () => {
      mockConfig.mfa!.passkey!.rpId = undefined as any;
      const result = service.isSupported();
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // generateRegistrationOptions() Method
  // ============================================================================

  describe('generateRegistrationOptions', () => {
    it('should generate registration options', async () => {
      const mockOptions = {
        challenge: 'base64-challenge',
        rp: { name: 'TestApp', id: 'testapp.com' },
        user: {
          id: Buffer.from('user-123').toString('base64url'),
          name: 'user@example.com',
          displayName: 'User Name',
        },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        timeout: 60000,
        attestation: 'none',
      };

      (generateRegistrationOptions as jest.Mock).mockResolvedValue(mockOptions);

      const result = await service.generateRegistrationOptions('user-123', 'user@example.com', 'User Name', []);

      expect(result.options).toEqual(mockOptions as any);
      expect(generateRegistrationOptions).toHaveBeenCalled();
      const callArgs = (generateRegistrationOptions as jest.Mock).mock.calls[0][0];
      expect(callArgs.rpName).toBe('TestApp');
      expect(callArgs.rpID).toBe('testapp.com');
      expect(callArgs.userID).toBeInstanceOf(Uint8Array);
      expect(callArgs.userName).toBe('user@example.com');
      expect(callArgs.userDisplayName).toBe('User Name');
    });

    it('should exclude existing credentials', async () => {
      const existingDevices: IMFADevice[] = [
        {
          id: 1,
          userId: 1,
          type: MFAMethod.PASSKEY,
          name: 'Existing Device',
          credentialId: 'existing-cred-id',
          isActive: true,
        } as IMFADevice,
      ];

      const mockOptions = {
        challenge: 'base64-challenge',
        rp: { name: 'TestApp', id: 'testapp.com' },
        user: { id: 'user-id', name: 'user@example.com', displayName: 'User' },
        pubKeyCredParams: [],
        timeout: 60000,
        attestation: 'none',
      };

      (generateRegistrationOptions as jest.Mock).mockResolvedValue(mockOptions);

      await service.generateRegistrationOptions('user-123', 'user@example.com', 'User', existingDevices);

      expect(generateRegistrationOptions).toHaveBeenCalled();
      const callArgs = (generateRegistrationOptions as jest.Mock).mock.calls[0][0];
      expect(callArgs.excludeCredentials).toBeDefined();
      expect(Array.isArray(callArgs.excludeCredentials)).toBe(true);
      expect(callArgs.excludeCredentials[0].id).toBe('existing-cred-id');
      expect(callArgs.excludeCredentials[0].type).toBe('public-key');
    });

    it('should use email as display name when name is empty', async () => {
      const mockOptions = {
        challenge: 'base64-challenge',
        rp: { name: 'TestApp', id: 'testapp.com' },
        user: { id: 'user-id', name: 'user@example.com', displayName: 'user@example.com' },
        pubKeyCredParams: [],
        timeout: 60000,
        attestation: 'none',
      };

      (generateRegistrationOptions as jest.Mock).mockResolvedValue(mockOptions);

      await service.generateRegistrationOptions('user-123', 'user@example.com', '', []);

      expect(generateRegistrationOptions).toHaveBeenCalled();
      const callArgs = (generateRegistrationOptions as jest.Mock).mock.calls[0][0];
      expect(callArgs.userDisplayName).toBe('user@example.com');
    });
  });

  // ============================================================================
  // verifyRegistration() Method
  // ============================================================================

  describe('verifyRegistration', () => {
    const mockCredential: RegistrationResponseJSON = {
      id: 'credential-id',
      rawId: 'base64-raw-id',
      response: {
        clientDataJSON: 'base64-client-data',
        attestationObject: 'base64-attestation',
        clientExtensionResults: {},
      },
      type: 'public-key',
      clientExtensionResults: {},
    } as RegistrationResponseJSON;

    it('should verify registration successfully', async () => {
      const mockVerification = {
        verified: true,
        registrationInfo: {
          credentialID: Buffer.from('credential-id'),
          credentialPublicKey: Buffer.from('public-key'),
          counter: 0,
        },
      };

      (verifyRegistrationResponse as jest.Mock).mockResolvedValue(mockVerification);

      const result = await service.verifyRegistration(mockCredential, 'expected-challenge');

      expect(result.verified).toBe(true);
      expect(result.credentialId).toBeDefined();
      expect(result.publicKey).toBeDefined();
      expect(result.counter).toBe(0);
      expect(verifyRegistrationResponse).toHaveBeenCalled();
      const callArgs = (verifyRegistrationResponse as jest.Mock).mock.calls[0][0];
      expect(callArgs.response).toEqual(mockCredential);
      expect(callArgs.expectedChallenge).toBe('expected-challenge');
      expect(callArgs.expectedOrigin).toEqual(['https://testapp.com']);
      expect(callArgs.expectedRPID).toBe('testapp.com');
    });

    it('should use frontend credential ID when available', async () => {
      const credentialWithId = {
        ...mockCredential,
        id: 'frontend-cred-id',
        rawId: 'base64-raw-id',
      } as any;

      const mockVerification = {
        verified: true,
        registrationInfo: {
          credentialID: Buffer.from('backend-cred-id'),
          credentialPublicKey: Buffer.from('public-key'),
          counter: 0,
        },
      };

      (verifyRegistrationResponse as jest.Mock).mockResolvedValue(mockVerification);

      const result = await service.verifyRegistration(credentialWithId, 'expected-challenge');

      expect(result.credentialId).toBe('frontend-cred-id');
    });

    it('should use client-provided transports', async () => {
      const transports = ['usb', 'nfc'];
      const mockVerification = {
        verified: true,
        registrationInfo: {
          credentialID: Buffer.from('credential-id'),
          credentialPublicKey: Buffer.from('public-key'),
          counter: 0,
        },
      };

      (verifyRegistrationResponse as jest.Mock).mockResolvedValue(mockVerification);

      const result = await service.verifyRegistration(mockCredential, 'expected-challenge', transports);

      expect(result.transports).toEqual(transports);
    });

    it('should throw error when verification fails', async () => {
      (verifyRegistrationResponse as jest.Mock).mockRejectedValue(new Error('Verification failed'));

      try {
        await service.verifyRegistration(mockCredential, 'expected-challenge');
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.VALIDATION_FAILED);
        expect((error as NAuthException).message).toContain('Failed to verify passkey registration');
      }
    });

    it('should throw error when verification result is not verified', async () => {
      const mockVerification = {
        verified: false,
        registrationInfo: null,
      };

      (verifyRegistrationResponse as jest.Mock).mockResolvedValue(mockVerification);

      try {
        await service.verifyRegistration(mockCredential, 'expected-challenge');
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.VALIDATION_FAILED);
        expect((error as NAuthException).message).toContain('Passkey registration failed verification');
      }
    });
  });

  // ============================================================================
  // generateAuthenticationOptions() Method
  // ============================================================================

  describe('generateAuthenticationOptions', () => {
    const mockDevices: IMFADevice[] = [
      {
        id: 1,
        userId: 1,
        type: MFAMethod.PASSKEY,
        name: 'Device 1',
        credentialId: 'cred-id-1',
        isActive: true,
        transports: ['usb'],
      } as IMFADevice,
    ];

    it('should generate authentication options', async () => {
      const mockOptions = {
        challenge: 'base64-challenge',
        timeout: 60000,
        rpId: 'testapp.com',
        allowCredentials: [
          {
            id: 'cred-id-1',
            type: 'public-key',
            transports: ['usb'],
          },
        ],
        userVerification: 'preferred',
      };

      (generateAuthenticationOptions as jest.Mock).mockResolvedValue(mockOptions);

      const result = await service.generateAuthenticationOptions(mockDevices);

      expect(result.options).toEqual(mockOptions as any);
      expect(generateAuthenticationOptions).toHaveBeenCalled();
      const callArgs = (generateAuthenticationOptions as jest.Mock).mock.calls[0][0];
      expect(callArgs.rpID).toBe('testapp.com');
      expect(callArgs.timeout).toBe(60000);
      expect(callArgs.allowCredentials).toBeDefined();
      expect(Array.isArray(callArgs.allowCredentials)).toBe(true);
      expect(callArgs.allowCredentials.length).toBeGreaterThan(0);
      const firstCred = callArgs.allowCredentials[0];
      expect(firstCred.id).toBe('cred-id-1');
      expect(firstCred.type).toBe('public-key');
    });

    it('should throw error when no devices provided', async () => {
      try {
        await service.generateAuthenticationOptions([]);
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.NOT_FOUND);
        expect((error as NAuthException).message).toContain('No passkey devices registered');
      }
    });

    it('should convert base64 credential ID to base64url', async () => {
      const devicesWithBase64: IMFADevice[] = [
        {
          id: 1,
          userId: 1,
          type: MFAMethod.PASSKEY,
          name: 'Device 1',
          credentialId: 'dGVzdC1pZA==', // base64 for "test-id"
          isActive: true,
        } as IMFADevice,
      ];

      const mockOptions = {
        challenge: 'base64-challenge',
        timeout: 60000,
        rpId: 'testapp.com',
        allowCredentials: [],
        userVerification: 'preferred',
      };

      (generateAuthenticationOptions as jest.Mock).mockResolvedValue(mockOptions);

      await service.generateAuthenticationOptions(devicesWithBase64);

      expect(generateAuthenticationOptions).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          allowCredentials: (expect as any).arrayContaining([
            (expect as any).objectContaining({
              id: (expect as any).any(String), // Should be base64url
            }),
          ]),
        }),
      );
    });
  });

  // ============================================================================
  // verifyAuthentication() Method
  // ============================================================================

  describe('verifyAuthentication', () => {
    const mockCredential: AuthenticationResponseJSON = {
      id: 'credential-id',
      rawId: 'base64-raw-id',
      response: {
        clientDataJSON: 'base64-client-data',
        authenticatorData: 'base64-authenticator-data',
        signature: 'base64-signature',
        userHandle: undefined,
      },
      type: 'public-key',
      clientExtensionResults: {},
    } as AuthenticationResponseJSON;

    const mockDevice: IMFADevice = {
      id: 1,
      userId: 1,
      type: MFAMethod.PASSKEY,
      name: 'Device 1',
      credentialId: 'credential-id',
      publicKey: Buffer.from('public-key').toString('base64url'),
      counter: 0,
      isActive: true,
    } as IMFADevice;

    it('should verify authentication successfully', async () => {
      const mockVerification = {
        verified: true,
        authenticationInfo: {
          newCounter: 1,
        },
      };

      (verifyAuthenticationResponse as jest.Mock).mockResolvedValue(mockVerification);

      const result = await service.verifyAuthentication(mockCredential, 'expected-challenge', mockDevice);

      expect(result.verified).toBe(true);
      expect(result.newCounter).toBe(1);
      expect(verifyAuthenticationResponse).toHaveBeenCalled();
    });

    it('should throw error when device data is invalid', async () => {
      const invalidDevice = {
        ...mockDevice,
        credentialId: null,
      } as any;

      try {
        await service.verifyAuthentication(mockCredential, 'expected-challenge', invalidDevice);
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.VALIDATION_FAILED);
        expect((error as NAuthException).message).toContain('Invalid passkey device data');
      }
    });

    it('should throw error when verification fails', async () => {
      (verifyAuthenticationResponse as jest.Mock).mockRejectedValue(new Error('Verification failed'));

      try {
        await service.verifyAuthentication(mockCredential, 'expected-challenge', mockDevice);
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.VALIDATION_FAILED);
        expect((error as NAuthException).message).toContain('Failed to verify passkey authentication');
      }
    });

    it('should throw error when verification result is not verified', async () => {
      const mockVerification = {
        verified: false,
      };

      (verifyAuthenticationResponse as jest.Mock).mockResolvedValue(mockVerification);

      try {
        await service.verifyAuthentication(mockCredential, 'expected-challenge', mockDevice);
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.VALIDATION_FAILED);
        expect((error as NAuthException).message).toContain('Passkey authentication failed verification');
      }
    });

    it('should handle base64 and base64url credential IDs', async () => {
      const deviceWithBase64 = {
        ...mockDevice,
        credentialId: Buffer.from('credential-id').toString('base64'),
      };

      const mockVerification = {
        verified: true,
        authenticationInfo: {
          newCounter: 1,
        },
      };

      (verifyAuthenticationResponse as jest.Mock).mockResolvedValue(mockVerification);

      await service.verifyAuthentication(mockCredential, 'expected-challenge', deviceWithBase64);

      expect(verifyAuthenticationResponse).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // maskCredentialId() Method
  // ============================================================================

  describe('maskCredentialId', () => {
    it('should mask long credential IDs', () => {
      const credentialId = 'abcdefghijklmnopqrstuvwxyz123456';
      const result = service.maskCredentialId(credentialId);
      expect(result).toBe('abcd...3456');
    });

    it('should return short credential IDs as-is', () => {
      const credentialId = 'short';
      const result = service.maskCredentialId(credentialId);
      expect(result).toBe('short');
    });

    it('should handle 8-character credential IDs', () => {
      const credentialId = '12345678';
      const result = service.maskCredentialId(credentialId);
      expect(result).toBe('12345678');
    });
  });
});
