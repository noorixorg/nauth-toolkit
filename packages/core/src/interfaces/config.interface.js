"use strict";
/**
 * Configuration interface for nauth-toolkit
 *
 * NOTE: This interface is validated at runtime using Zod.
 * See packages/core/src/schemas/auth-config.schema.ts for validation rules.
 *
 * The Zod schema validates:
 * - Required fields and types
 * - Cross-dependencies (e.g., email config requires emailProvider)
 * - Algorithm-specific requirements (JWT symmetric vs asymmetric)
 * - MFA enforcement modes and their requirements
 * - Social provider requirements
 * - GeoLocation MaxMind credentials
 *
 * Validation errors are caught at module initialization with clear, actionable messages.
 */
Object.defineProperty(exports, "__esModule", { value: true });
