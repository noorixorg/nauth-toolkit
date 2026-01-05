import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/types';
import {
  NAuthConfig,
  PasskeyConfig,
  NAuthLogger,
  NAuthException,
  AuthErrorCode,
  MFAMethod,
  IMFADevice,
} from '@nauth-toolkit/core';
import { SetupPasskeyResponseDTO, GetPasskeyChallengeResponseDTO } from './dto/mfa.dto';

/**
 * Passkey Service (WebAuthn/FIDO2)
 *
 * Handles passkey authentication with proper platform authenticator support.
 *
 * @example
 * ```typescript
 * const options = await passkeyService.generateRegistrationOptions(user, existingDevices);
 * const verified = await passkeyService.verifyRegistration(credential, challenge, transports);
 * ```
 */

export class PasskeyService {
  private readonly defaultConfig: Partial<PasskeyConfig> = {
    timeout: 60000,
    userVerification: 'preferred',
  };

  constructor(
    private readonly config: NAuthConfig,
    private readonly logger: NAuthLogger,
  ) {}

  /**
   * Get passkey configuration with defaults
   *
   * @returns Complete passkey configuration
   * @throws {NAuthException} If required config is missing
   * @private
   */
  private getPasskeyConfig(): Required<PasskeyConfig> {
    const passkeyConfig = this.config.mfa?.passkey;

    if (!passkeyConfig?.rpName || !passkeyConfig?.rpId) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Passkey configuration (rpName, rpId) is required');
    }

    // Use configured origin or default based on RP ID
    let origin = passkeyConfig.origin;
    if (!origin) {
      origin = passkeyConfig.rpId === 'localhost' ? 'http://localhost:4200' : `https://${passkeyConfig.rpId}`;
    }

    return {
      ...this.defaultConfig,
      ...passkeyConfig,
      origin,
    } as Required<PasskeyConfig>;
  }

  /**
   * Generate WebAuthn registration options for passkey setup
   *
   * @param userId - User ID (will be encoded as user.id)
   * @param userEmail - User's email
   * @param userName - User's display name
   * @param existingDevices - User's existing passkey devices (to exclude from registration)
   * @returns Registration options for WebAuthn API
   */
  async generateRegistrationOptions(
    userId: string,
    userEmail: string,
    userName: string,
    existingDevices: IMFADevice[] = [],
  ): Promise<SetupPasskeyResponseDTO> {
    this.logger?.log?.(`Generating passkey registration options for user: ${userEmail}`);

    const passkeyConfig = this.getPasskeyConfig();

    // Extract existing credential IDs to exclude from new registration
    const excludeCredentials = existingDevices
      .filter((device) => device.type === MFAMethod.PASSKEY && device.isActive && device.credentialId)
      .map((device) => ({
        id: device.credentialId!,
        type: 'public-key' as const,
        transports: (device.transports as AuthenticatorTransportFuture[]) || undefined,
      }));

    const options = await generateRegistrationOptions({
      rpName: passkeyConfig.rpName,
      rpID: passkeyConfig.rpId,
      userID: new TextEncoder().encode(userId),
      userName: userEmail,
      userDisplayName: userName || userEmail,
      timeout: passkeyConfig.timeout,
      attestationType: 'none',
      excludeCredentials: excludeCredentials.length > 0 ? excludeCredentials : undefined,
      authenticatorSelection: {
        authenticatorAttachment: passkeyConfig.authenticatorAttachment,
        requireResidentKey: false,
        userVerification: passkeyConfig.userVerification,
      },
      supportedAlgorithmIDs: [-7, -257], // ES256, RS256
    });

    this.logger?.log?.(`Passkey registration options generated for: ${userEmail}`);

    return {
      options: options as unknown as SetupPasskeyResponseDTO['options'],
    };
  }

  /**
   * Verify passkey registration response
   *
   * @param credential - WebAuthn registration response from client
   * @param expectedChallenge - Expected challenge from registration options
   * @param transports - Optional transports from client-side credential.getTransports()
   * @returns Verified credential data for storage
   * @throws {NAuthException} If verification fails
   */
  async verifyRegistration(
    credential: RegistrationResponseJSON,
    expectedChallenge: string,
    transports?: string[],
  ): Promise<{
    verified: boolean;
    credentialId: string;
    publicKey: string;
    counter: number;
    transports: string[];
  }> {
    this.logger?.log?.('Verifying passkey registration');

    const passkeyConfig = this.getPasskeyConfig();

    let verification: VerifiedRegistrationResponse;
    try {
      verification = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge,
        expectedOrigin: Array.isArray(passkeyConfig.origin) ? passkeyConfig.origin : [passkeyConfig.origin],
        expectedRPID: passkeyConfig.rpId,
        requireUserVerification: passkeyConfig.userVerification === 'required',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.error?.('Passkey registration verification failed', {
        error: errorMessage,
        expectedRPID: passkeyConfig.rpId,
        expectedOrigins: Array.isArray(passkeyConfig.origin) ? passkeyConfig.origin : [passkeyConfig.origin],
      });
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        `Failed to verify passkey registration: ${errorMessage}`,
      );
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Passkey registration failed verification');
    }

    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

    // Use client-provided transports or try to extract from verification
    let finalTransports: string[] = transports || [];
    if (finalTransports.length === 0) {
      const verifUnknown = verification as unknown as Record<string, unknown>;
      const regInfo = verifUnknown.registrationInfo as Record<string, unknown>;
      if (regInfo.transports && Array.isArray(regInfo.transports)) {
        finalTransports = regInfo.transports as string[];
      }
    }

    // Extract credential ID - Use the ID from frontend directly for consistency
    // This ensures it matches exactly what the browser will send during authentication
    const credentialWithId = credential as RegistrationResponseJSON & { id?: string; rawId?: string };
    const frontendCredentialId = credentialWithId.id || credentialWithId.rawId;

    // Fallback to SimpleWebAuthn's extracted ID if frontend ID not available
    let storedCredentialId: string;
    if (frontendCredentialId) {
      storedCredentialId = frontendCredentialId;
    } else {
      const credentialIdBuffer = Buffer.isBuffer(credentialID)
        ? credentialID
        : Buffer.from(credentialID as unknown as ArrayLike<number>);
      storedCredentialId = credentialIdBuffer.toString('base64url');
    }

    this.logger?.log?.('Passkey registration verified successfully', {
      hasTransports: finalTransports.length > 0,
      transports: finalTransports,
    });

    return {
      verified: true,
      credentialId: storedCredentialId, // Use frontend ID to ensure match during authentication
      publicKey: Buffer.from(credentialPublicKey).toString('base64url') as string,
      counter,
      transports: finalTransports,
    };
  }

  /**
   * Generate WebAuthn authentication options for MFA challenge
   *
   * @param userDevices - User's registered passkey devices
   * @returns Authentication options for WebAuthn API
   */
  async generateAuthenticationOptions(userDevices: IMFADevice[]): Promise<GetPasskeyChallengeResponseDTO> {
    this.logger?.log?.('Generating passkey authentication options');

    const passkeyConfig = this.getPasskeyConfig();

    // Extract active passkey credentials
    // Important: credentialId from database may be base64 or base64url
    // SimpleWebAuthn expects base64url, so we use it as-is if it's already base64url
    // If it's standard base64, we need to convert it
    const allowCredentials = userDevices
      .filter((device) => device.type === MFAMethod.PASSKEY && device.isActive && device.credentialId)
      .map((device) => {
        let credentialId = device.credentialId!;

        // Check if it's standard base64 (contains + or /) and convert to base64url
        if (credentialId.includes('+') || credentialId.includes('/')) {
          // It's standard base64, decode and re-encode as base64url
          const decoded = Buffer.from(credentialId, 'base64');
          credentialId = decoded.toString('base64url');
        }
        // Otherwise assume it's already base64url

        return {
          id: credentialId,
          type: 'public-key' as const,
          transports: (device.transports as AuthenticatorTransportFuture[]) || undefined,
        };
      });

    if (allowCredentials.length === 0) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'No passkey devices registered');
    }

    const options = await generateAuthenticationOptions({
      rpID: passkeyConfig.rpId,
      timeout: passkeyConfig.timeout,
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
      userVerification: passkeyConfig.userVerification,
    });

    this.logger?.log?.('Passkey authentication options generated');

    return {
      options: options as unknown as GetPasskeyChallengeResponseDTO['options'],
    };
  }

  /**
   * Verify passkey authentication response
   *
   * @param credential - WebAuthn authentication response from client
   * @param expectedChallenge - Expected challenge from authentication options
   * @param device - MFA device with stored public key and counter
   * @returns Verification result with new counter
   * @throws {NAuthException} If verification fails
   */
  async verifyAuthentication(
    credential: AuthenticationResponseJSON,
    expectedChallenge: string,
    device: IMFADevice,
  ): Promise<{
    verified: boolean;
    newCounter: number;
  }> {
    this.logger?.log?.(`Verifying passkey authentication for device: ${device.name}`);

    if (!device.credentialId || !device.publicKey || device.counter === null || device.counter === undefined) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Invalid passkey device data');
    }

    const passkeyConfig = this.getPasskeyConfig();

    let verification: VerifiedAuthenticationResponse;
    try {
      // Convert base64url credential ID to Buffer
      // Note: Database may store as base64 or base64url, try both formats
      let credentialIDBuffer: Buffer;
      try {
        // Try base64url first (current format)
        credentialIDBuffer = Buffer.from(device.credentialId, 'base64url');
      } catch {
        // Fallback to standard base64 (legacy format)
        credentialIDBuffer = Buffer.from(device.credentialId, 'base64');
      }

      let publicKeyBuffer: Buffer;
      try {
        // Try base64url first (current format)
        publicKeyBuffer = Buffer.from(device.publicKey, 'base64url');
      } catch {
        // Fallback to standard base64 (legacy format)
        publicKeyBuffer = Buffer.from(device.publicKey, 'base64');
      }

      verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge,
        expectedOrigin: Array.isArray(passkeyConfig.origin) ? passkeyConfig.origin : [passkeyConfig.origin],
        expectedRPID: passkeyConfig.rpId,
        authenticator: {
          credentialID: new Uint8Array(credentialIDBuffer),
          credentialPublicKey: new Uint8Array(publicKeyBuffer),
          counter: device.counter,
          transports: (device.transports as AuthenticatorTransportFuture[]) || undefined,
        } as unknown as Parameters<typeof verifyAuthenticationResponse>[0]['authenticator'],
        requireUserVerification: passkeyConfig.userVerification === 'required',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.error?.('Passkey authentication verification failed', {
        error: errorMessage,
        expectedRPID: passkeyConfig.rpId,
        credentialId: `${credential.id.substring(0, 8)}...`,
      });

      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        `Failed to verify passkey authentication: ${errorMessage}`,
      );
    }

    if (!verification.verified) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Passkey authentication failed verification');
    }

    this.logger?.log?.('Passkey authentication verified successfully');

    return {
      verified: true,
      newCounter: verification.authenticationInfo.newCounter,
    };
  }

  /**
   * Check if passkey is supported by configuration
   *
   * @returns True if passkey is properly configured
   */
  isSupported(): boolean {
    try {
      this.getPasskeyConfig();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Mask credential ID for display
   *
   * @param credentialId - Base64url encoded credential ID
   * @returns Masked credential ID
   */
  maskCredentialId(credentialId: string): string {
    if (credentialId.length <= 8) {
      return credentialId;
    }
    return `${credentialId.slice(0, 4)}...${credentialId.slice(-4)}`;
  }
}
