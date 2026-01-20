import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * OpenAPI component schemas exported by `@nauth-toolkit/mfa-totp`.
 *
 * Notes:
 * - Schemas are generated at build time into `dist/src/openapi/components.schemas.json`
 * - Schema names are prefixed with `MfaTotp` to avoid collisions when merging
 *   multiple nauth-toolkit OpenAPI exports.
 */
export interface NAuthOpenApiDocument {
  openapi: string;
  components: {
    schemas: Record<string, unknown>;
  };
}

export function loadNAuthOpenApiDocument(): NAuthOpenApiDocument {
  const filePath = join(__dirname, 'components.schemas.json');
  const json = readFileSync(filePath, 'utf8');
  return JSON.parse(json) as NAuthOpenApiDocument;
}

export function loadNAuthOpenApiSchemas(): Record<string, unknown> {
  return loadNAuthOpenApiDocument().components.schemas;
}

