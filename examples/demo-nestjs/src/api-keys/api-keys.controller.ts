import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  AuthGuard,
  AllowApiKey,
  DenyApiKey,
  CurrentUser,
  IUser,
  ApiKeyService,
  CreateApiKeyDTO,
  UpdateApiKeyDTO,
} from '@nauth-toolkit/nestjs';

/**
 * Self-service API key management.
 *
 * All routes require an authenticated session (AuthGuard). Keys authenticate
 * as the owning user; the plaintext key is returned only once at creation.
 */
@UseGuards(AuthGuard)
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeyService) {}

  /** Create a key. Returns the plaintext key ONCE. */
  @Post()
  create(@CurrentUser() user: IUser, @Body() dto: CreateApiKeyDTO) {
    return this.apiKeys.createKey({
      userId: user.id,
      name: dto.name,
      expiresInDays: dto.expiresInDays,
      allowedIps: dto.allowedIps,
    });
  }

  /** List the current user's keys (sanitized). */
  @Get()
  list(@CurrentUser() user: IUser) {
    return this.apiKeys.listKeys(user.id);
  }

  /** Update a key's label / IP allowlist. */
  @Patch(':keyId')
  update(@CurrentUser() user: IUser, @Param('keyId') keyId: string, @Body() dto: UpdateApiKeyDTO) {
    return this.apiKeys.updateKey({ userId: user.id, keyId, name: dto.name, allowedIps: dto.allowedIps });
  }

  /** Revoke (soft-delete) a key. */
  @Post(':keyId/revoke')
  revoke(@CurrentUser() user: IUser, @Param('keyId') keyId: string) {
    return this.apiKeys.revokeKey({ userId: user.id, keyId });
  }

  /** Permanently delete a key. */
  @Delete(':keyId')
  remove(@CurrentUser() user: IUser, @Param('keyId') keyId: string) {
    return this.apiKeys.deleteKey({ userId: user.id, keyId });
  }
}

/**
 * Demo routes that show route-level opt-in for API keys.
 *
 * - `/demo/api-key/allowed`  — opts in via @AllowApiKey(): accepts a key OR a session
 * - `/demo/api-key/unmarked` — no opt-in: rejects API keys (session only)
 * - `/demo/api-key/denied`   — controller opts in, but this route opts out via @DenyApiKey()
 */
@AllowApiKey() // controller-level opt-in
@UseGuards(AuthGuard)
@Controller('demo/api-key')
export class ApiKeyDemoController {
  /** Accepts API-key auth (inherits controller @AllowApiKey). */
  @Get('allowed')
  allowed(@CurrentUser() user: IUser) {
    return { route: 'allowed', authenticatedAs: user.sub, email: user.email };
  }

  /** Opts out — API keys are rejected here even though the controller allows them. */
  @DenyApiKey()
  @Get('denied')
  denied(@CurrentUser() user: IUser) {
    return { route: 'denied', authenticatedAs: user.sub };
  }
}

/**
 * A protected route with NO API-key opt-in. API keys are rejected here (session only),
 * demonstrating the least-privilege default.
 */
@UseGuards(AuthGuard)
@Controller('demo/no-api-key')
export class ApiKeyUnmarkedDemoController {
  @Get('profile')
  profile(@CurrentUser() user: IUser) {
    return { route: 'unmarked', authenticatedAs: user.sub };
  }
}
