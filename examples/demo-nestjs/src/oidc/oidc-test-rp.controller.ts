import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '@nauth-toolkit/nestjs';

/**
 * A stand-in relying party, for end-to-end tests only.
 *
 * The authorization-code flow ends with the browser being redirected to the client's
 * `redirect_uri`. Rather than run a second application just to catch that, this
 * endpoint acts as the client's callback and echoes back whatever the provider sent,
 * so a test can assert on the `code` and `state` directly.
 *
 * It performs no token exchange: the test does that itself with real client
 * credentials, which is the part actually worth exercising.
 */
@Controller('test/oidc')
export class OIDCTestRelyingPartyController {
  /**
   * Catch the authorization response and echo it back as JSON.
   *
   * @param code - The authorization code, on success
   * @param state - The `state` the client sent, echoed by the provider
   * @param error - The RFC 6749 error code, on failure
   * @param errorDescription - A human-readable description of the failure
   * @returns The parameters the provider redirected with
   */
  @Public()
  @Get('callback')
  callback(
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
  ): { code?: string; state?: string; error?: string; error_description?: string } {
    return { code, state, error, error_description: errorDescription };
  }
}
