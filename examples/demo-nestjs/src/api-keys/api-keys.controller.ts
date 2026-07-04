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
  CreateApiKeyResponseDTO,
  ApiKeyResponseDTO,
  ListApiKeysResponseDTO,
  RevokeApiKeyResponseDTO,
  DeleteApiKeyResponseDTO,
} from '@nauth-toolkit/nestjs';

/**
 * Response for the API-key demo routes below.
 */
export class ApiKeyRouteResponseDTO {
  /** Which demo route responded */
  route!: string;
  /** The `sub` of the authenticated principal (session user or API-key owner) */
  authenticatedAs!: string;
  /** The authenticated user's email (when available) */
  email?: string | null;
}

/**
 * Self-service API key management.
 *
 * All routes require an authenticated session (AuthGuard). Keys authenticate as the owning
 * user, resolved from the auth context — no user id is passed. The plaintext key is returned
 * only once at creation.
 */
@UseGuards(AuthGuard)
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeyService) {}

  /** Create a key. Returns the plaintext key ONCE. Identity comes from the auth context. */
  @Post()
  create(@Body() dto: CreateApiKeyDTO): Promise<CreateApiKeyResponseDTO> {
    return this.apiKeys.createKey(dto);
  }

  /** List the current user's keys (sanitized). */
  @Get()
  list(): Promise<ListApiKeysResponseDTO> {
    return this.apiKeys.listKeys();
  }

  /** Update a key's label / IP allowlist. */
  @Patch(':keyId')
  update(@Param('keyId') keyId: string, @Body() dto: UpdateApiKeyDTO): Promise<ApiKeyResponseDTO> {
    return this.apiKeys.updateKey({ keyId, name: dto.name, allowedIps: dto.allowedIps });
  }

  /** Revoke (soft-delete) a key. */
  @Post(':keyId/revoke')
  revoke(@Param('keyId') keyId: string): Promise<RevokeApiKeyResponseDTO> {
    return this.apiKeys.revokeKey({ keyId });
  }

  /** Permanently delete a key. */
  @Delete(':keyId')
  remove(@Param('keyId') keyId: string): Promise<DeleteApiKeyResponseDTO> {
    return this.apiKeys.deleteKey({ keyId });
  }
}

/**
 * Demo routes that show route-level opt-in for API keys.
 *
 * - `/demo/api-key/allowed`  — opts in via @AllowApiKey(): accepts a key OR a session
 * - `/demo/api-key/denied`   — controller opts in, but this route opts out via @DenyApiKey()
 */
@AllowApiKey() // controller-level opt-in
@UseGuards(AuthGuard)
@Controller('demo/api-key')
export class ApiKeyDemoController {
  /** Accepts API-key auth (inherits controller @AllowApiKey). */
  @Get('allowed')
  allowed(@CurrentUser() user: IUser): ApiKeyRouteResponseDTO {
    return { route: 'allowed', authenticatedAs: user.sub, email: user.email };
  }

  /** Opts out — API keys are rejected here even though the controller allows them. */
  @DenyApiKey()
  @Get('denied')
  denied(@CurrentUser() user: IUser): ApiKeyRouteResponseDTO {
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
  profile(@CurrentUser() user: IUser): ApiKeyRouteResponseDTO {
    return { route: 'unmarked', authenticatedAs: user.sub };
  }
}
