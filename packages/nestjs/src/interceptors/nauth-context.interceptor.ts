import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ContextStorage } from '@nauth-toolkit/core';
import { getNAuthContextStore } from '../guards/nauth-context.guard';

/**
 * NAuth Context Interceptor
 *
 * Re-enters the AsyncLocalStorage context that was initialized by NAuthContextGuard.
 * This ensures controllers and services run inside the same request-scoped context.
 *
 * **Why This is Needed:**
 * - Guards and interceptors run in separate execution contexts
 * - AsyncLocalStorage context from the guard is not automatically available to controllers
 * - This interceptor restores the context using `ContextStorage.enterStore()`
 *
 * **Pattern:**
 * - Mirrors the core FastifyAdapter pattern for context restoration
 * - Works with both Express and Fastify adapters
 *
 * @example
 * ```typescript
 * // Registered globally in AuthModule as APP_INTERCEPTOR
 * // No manual usage required - runs automatically for all HTTP requests
 * ```
 */
@Injectable()
export class NAuthContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Only operate in HTTP context
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();

    // Get the context store that was created by NAuthContextGuard
    const store = getNAuthContextStore(request);

    if (!store) {
      // No context available - continue without context (shouldn't happen with proper setup)
      return next.handle();
    }

    // Re-enter the context store so controllers/services have access to it
    return new Observable((subscriber) => {
      ContextStorage.enterStore(store, () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
