/**
 * NestJS DTOs
 *
 * Re-exports DTOs from core with class-validator decorators.
 * This follows the platform-agnostic architecture where core owns DTOs
 * and adapters re-export them.
 *
 * @see packages/core/src/dto/
 */

// Re-export challenge DTOs from core (single source of truth)
export * from '@nauth-toolkit/core';
