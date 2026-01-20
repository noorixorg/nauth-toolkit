import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * OpenAPI component schemas exported by `@nauth-toolkit/mfa-email`.
 *
 * This is framework-agnostic: consumer apps can merge these schemas into their
 * OpenAPI document (NestJS, Express, Fastify, etc.).
 *
 * Notes:
 * - Schemas are generated at build time into `dist/src/openapi/components.schemas.json`
 * - Schema names are prefixed with `MfaEmail` to avoid collisions when merging
 *   multiple nauth-toolkit OpenAPI exports.
 */
export interface NAuthOpenApiDocument {
  openapi: string;
  components: {
    schemas: Record<string, unknown>;
  };
}

/**
 * Load the generated OpenAPI document from the packaged JSON file.
 */
export function loadNAuthOpenApiDocument(): NAuthOpenApiDocument {
  const filePath = join(__dirname, 'components.schemas.json');
  const json = readFileSync(filePath, 'utf8');
  return JSON.parse(json) as NAuthOpenApiDocument;
}

/**
 * Load only the OpenAPI component schemas (`components.schemas`).
 */
export function loadNAuthOpenApiSchemas(): Record<string, unknown> {
  return loadNAuthOpenApiDocument().components.schemas;
}
