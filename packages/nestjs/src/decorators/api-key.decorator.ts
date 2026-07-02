import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key marking a route/controller as accepting API-key authentication.
 */
export const ALLOW_API_KEY_KEY = 'NAUTH_ALLOW_API_KEY';

/**
 * Metadata key marking a route/controller as rejecting API-key authentication.
 * Takes precedence over {@link AllowApiKey} and the `apiKeys.globalAllowlist` config.
 */
export const DENY_API_KEY_KEY = 'NAUTH_DENY_API_KEY';

/**
 * Allow API-key authentication for this route or controller (opt-in).
 *
 * With the default opt-in policy, API keys only authenticate on routes/controllers
 * marked with this decorator. Can be applied at the method or class level.
 *
 * @example
 * ```typescript
 * @AllowApiKey()
 * @UseGuards(AuthGuard)
 * @Get('data')
 * async data(@CurrentUser() user: IUser) {
 *   return this.service.getData(user);
 * }
 * ```
 */
export const AllowApiKey = (): MethodDecorator & ClassDecorator => SetMetadata(ALLOW_API_KEY_KEY, true);

/**
 * Deny API-key authentication for this route or controller.
 *
 * Takes precedence over {@link AllowApiKey} and `apiKeys.globalAllowlist`, so a sensitive
 * route can be excluded even when keys are enabled globally or on the whole controller.
 *
 * @example
 * ```typescript
 * @AllowApiKey() // controller-level opt-in
 * @Controller('reports')
 * export class ReportsController {
 *   @DenyApiKey() // ...but this one route rejects API keys
 *   @Delete(':id')
 *   async remove() {}
 * }
 * ```
 */
export const DenyApiKey = (): MethodDecorator & ClassDecorator => SetMetadata(DENY_API_KEY_KEY, true);
