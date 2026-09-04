/**
 * Generated auth routes controller
 *
 * Builds a Nest controller from the core route manifest. A factory rather than an
 * exported class for the same reason as `createOIDCInteractionController`: `@Controller`
 * is a static decorator, so the mount path can only be supplied as an argument. Unlike
 * that one, the *routes themselves* are also built at call time, which is what makes
 * `exclude` and mounting the same bundle twice possible.
 *
 * @packageDocumentation
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Optional,
  Patch,
  Post,
  Put,
  Req,
  Res,
  SetMetadata,
  Type,
  UseGuards,
} from '@nestjs/common';
import {
  AdminAuthService,
  ApiKeyService,
  AuthAuditService,
  AuthService,
  AuthorizationService,
  MFAService,
  NAuthConfig,
  SocialAuthService,
  SocialRedirectHandler,
  runRoute,
  type AnyNAuthRouteDefinition,
  type NAuthRouteServices,
  type ResolvedRouteMount,
} from '@nauth-toolkit/core';
import { AuthGuard } from '../guards/auth.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TOKEN_DELIVERY_KEY } from '../decorators/token-delivery.decorator';
import { REQUIRE_RECAPTCHA_KEY } from '../decorators/recaptcha.decorator';
import { ALLOW_API_KEY_KEY, DENY_API_KEY_KEY } from '../decorators/api-key.decorator';

/** Method decorators keyed by the manifest's HTTP verb. */
const METHOD_DECORATORS = {
  GET: Get,
  POST: Post,
  PUT: Put,
  PATCH: Patch,
  DELETE: Delete,
} as const;

/** Minimal Express-style request the generated handlers read. */
interface GeneratedRequest {
  body?: unknown;
  query?: Record<string, unknown>;
  params?: Record<string, string>;
  cookies?: Record<string, string | undefined>;
}

/** Minimal Express-style response, used only for redirect routes. */
interface GeneratedResponse {
  redirect(url: string): void;
}

/**
 * Base class carrying the constructor.
 *
 * Written statically rather than synthesised so `emitDecoratorMetadata` fires normally
 * and Nest resolves dependencies the conventional way — only the *methods* are
 * generated. `@Optional()` is required on the conditional services: `AuthModule` only
 * exports MFA, audit and API-key services when those features are enabled.
 */
@UseGuards(AuthGuard)
class NAuthGeneratedControllerBase {
  constructor(
    @Inject('NAUTH_CONFIG') readonly nauthConfig: NAuthConfig,
    readonly authService: AuthService,
    readonly adminAuthService: AdminAuthService,
    @Optional() @Inject(MFAService) readonly mfaService?: MFAService,
    @Optional() @Inject(SocialAuthService) readonly socialAuthService?: SocialAuthService,
    @Optional() @Inject(AuthAuditService) readonly auditService?: AuthAuditService,
    @Optional() @Inject(ApiKeyService) readonly apiKeyService?: ApiKeyService,
    @Optional() @Inject(SocialRedirectHandler) readonly socialRedirect?: SocialRedirectHandler,
    @Optional() @Inject(AuthorizationService) readonly authorizationService?: AuthorizationService,
  ) {}

  /**
   * Project the injected services into the shape route handlers expect.
   *
   * @returns The route service container
   */
  protected toRouteServices(): NAuthRouteServices {
    return {
      authService: this.authService,
      adminAuthService: this.adminAuthService,
      mfaService: this.mfaService,
      socialAuthService: this.socialAuthService,
      auditService: this.auditService,
      apiKeyService: this.apiKeyService,
      socialRedirect: this.socialRedirect,
    };
  }
}

/**
 * Apply the metadata one route needs onto a generated method.
 *
 * Metadata is written per handler rather than once on the class: the guards and
 * interceptor read `TOKEN_DELIVERY_KEY` and `REQUIRE_RECAPTCHA_KEY` from the handler
 * only, so class-level values would be silently ignored.
 *
 * @param route - The route being generated
 * @param mount - The resolved mount, for its forced delivery and guard lists
 * @param prototype - The controller prototype
 * @param key - The generated method name
 */
function applyRouteMetadata(
  route: AnyNAuthRouteDefinition,
  mount: ResolvedRouteMount,
  prototype: object,
  key: string,
): void {
  const descriptor = Object.getOwnPropertyDescriptor(prototype, key);
  if (!descriptor) return;

  METHOD_DECORATORS[route.method](route.path)(prototype, key, descriptor);
  HttpCode(route.status)(prototype, key, descriptor);

  if (route.access === 'public') {
    // AuthGuard stays on the class so a signed-in caller is still identified; @Public()
    // makes it non-rejecting, which is what an anonymous caller needs.
    SetMetadata(IS_PUBLIC_KEY, true)(prototype, key, descriptor);
  }

  const delivery = route.delivery ?? mount.delivery;
  if (delivery) SetMetadata(TOKEN_DELIVERY_KEY, delivery)(prototype, key, descriptor);

  if (route.recaptcha === 'require') SetMetadata(REQUIRE_RECAPTCHA_KEY, true)(prototype, key, descriptor);
  if (route.apiKey === 'allow') SetMetadata(ALLOW_API_KEY_KEY, true)(prototype, key, descriptor);
  if (route.apiKey === 'deny') SetMetadata(DENY_API_KEY_KEY, true)(prototype, key, descriptor);

  const { guards = [], adminGuards = [], routeGuards = {} } = mount.options;
  const applicable = [...guards, ...(route.access === 'admin' ? adminGuards : []), ...(routeGuards[route.key] ?? [])];
  if (applicable.length > 0) {
    UseGuards(...(applicable as Parameters<typeof UseGuards>))(prototype, key, descriptor);
  }

  // Body first so a consumer's ValidationPipe still sees a body parameter; the mount
  // validates independently, so both paths produce the same error contract.
  Body()(prototype, key, 0);
  Req()(prototype, key, 1);
  Res({ passthrough: true })(prototype, key, 2);
}

/**
 * Build a Nest controller serving one resolved bundle of shipped routes.
 *
 * @param mount - The bundle, already resolved against config and available services
 * @returns A controller class, ready to list in a module's `controllers`
 *
 * @example
 * ```typescript
 * @Module({ controllers: [createNAuthRoutesController(mount)] })
 * export class MyAuthModule {}
 * ```
 */
export function createNAuthRoutesController(mount: ResolvedRouteMount): Type<unknown> {
  class NAuthRoutesController extends NAuthGeneratedControllerBase {}

  const prototype = NAuthRoutesController.prototype as unknown as Record<string, unknown>;

  // Assignment order is registration order: Nest's MetadataScanner walks
  // Object.getOwnPropertyNames, so declaring literal paths before parametric ones in
  // the manifest is what keeps '/social/link' ahead of '/social/:provider/verify'.
  for (const route of mount.routes) {
    prototype[route.key] = async function (
      this: NAuthGeneratedControllerBase,
      _body: unknown,
      req: GeneratedRequest,
      res: GeneratedResponse,
    ): Promise<unknown> {
      const result = await runRoute(
        route,
        { body: req?.body, query: req?.query, params: req?.params, cookies: req?.cookies },
        (this as unknown as { toRouteServices(): NAuthRouteServices }).toRouteServices(),
        this.nauthConfig,
      );

      if (route.redirect) {
        const { url } = (result ?? {}) as { url?: string };
        if (url) {
          res.redirect(url);
          return undefined;
        }
      }

      return result;
    };

    applyRouteMetadata(route, mount, prototype as object, route.key);
  }

  Controller(mount.prefix)(NAuthRoutesController);

  // A stable, distinct name so two mounts are distinguishable in Nest's boot log and in
  // generated OpenAPI tags.
  Object.defineProperty(NAuthRoutesController, 'name', {
    value: `NAuthRoutesController_${mount.prefix.replace(/[^a-zA-Z0-9]+/g, '_') || 'root'}`,
  });

  return NAuthRoutesController;
}
