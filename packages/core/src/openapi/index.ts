import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * OpenAPI component schemas exported by `@nauth-toolkit/core`.
 *
 * This is intentionally framework-agnostic: consumer apps can merge these
 * schemas into their OpenAPI document (NestJS, Express, Fastify, etc.).
 *
 * Notes:
 * - Schemas are generated at build time into `dist/openapi/components.schemas.json`
 * - The schema names match the exported DTO/type names (e.g. `SignupDTO`)
 *
 * @example
 * ```typescript
 * import { loadNAuthOpenApiSchemas } from '@nauth-toolkit/core/openapi';
 *
 * // Merge into your OpenAPI document:
 * const schemas = loadNAuthOpenApiSchemas();
 * openapi.components = openapi.components ?? {};
 * openapi.components.schemas = {
 *   ...(openapi.components.schemas ?? {}),
 *   ...schemas,
 * };
 * ```
 */
export interface NAuthOpenApiDocument {
  /**
   * OpenAPI version string.
   *
   * Example: `"3.0.3"`
   */
  openapi: string;

  /**
   * OpenAPI components section containing reusable schemas.
   */
  components: {
    /**
     * Generated schemas keyed by DTO/type name.
     *
     * Values are OpenAPI Schema Objects (kept as `unknown` to avoid introducing
     * a runtime dependency on an OpenAPI typings package).
     */
    schemas: Record<string, unknown>;
  };
}

/**
 * Load the generated OpenAPI document from the packaged JSON file.
 *
 * This is safe to call in production code. The JSON is generated during the
 * library build and shipped in `dist/`.
 *
 * @returns The generated OpenAPI document containing `components.schemas`.
 *
 * @throws {Error} When the generated OpenAPI JSON file is missing or invalid.
 *
 * @example
 * ```typescript
 * import { loadNAuthOpenApiDocument } from '@nauth-toolkit/core/openapi';
 *
 * const doc = loadNAuthOpenApiDocument();
 * console.log(Object.keys(doc.components.schemas));
 * ```
 */
export function loadNAuthOpenApiDocument(): NAuthOpenApiDocument {
  const filePath = join(__dirname, 'components.schemas.json');
  const json = readFileSync(filePath, 'utf8');
  return JSON.parse(json) as NAuthOpenApiDocument;
}

/**
 * Load only the OpenAPI component schemas (`components.schemas`).
 *
 * @returns The generated OpenAPI schemas keyed by DTO/type name.
 *
 * @example
 * ```typescript
 * import { loadNAuthOpenApiSchemas } from '@nauth-toolkit/core/openapi';
 *
 * const schemas = loadNAuthOpenApiSchemas();
 * console.log(Object.keys(schemas));
 * ```
 */
export function loadNAuthOpenApiSchemas(): Record<string, unknown> {
  return loadNAuthOpenApiDocument().components.schemas;
}
