import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createGenerator, type Config } from 'ts-json-schema-generator';
import * as ts from 'typescript';

/**
 * Build-time OpenAPI schema generator for nauth-toolkit DTOs.
 *
 * Why this exists:
 * - Consumer apps often import DTO classes from `node_modules`.
 * - Many OpenAPI integrations (including NestJS Swagger plugin transforms)
 *   don't introspect external packages well enough to "expand" DTO shapes.
 * - To keep `@nauth-toolkit/core` framework-agnostic, we generate and ship
 *   OpenAPI component schemas as plain JSON.
 *
 * Output:
 * - `dist/openapi/components.schemas.json`
 *
 * Implementation approach (Option A):
 * - Parse `src/dto/index.ts` to find exported DTO/type files.
 * - Collect exported symbols (classes/interfaces/enums/types) from those files.
 * - Create a temporary "registry" type that references all symbols.
 * - Generate a single JSON Schema document and convert `definitions` into
 *   OpenAPI `components.schemas` (with `$ref` rewrites).
 *
 * @example
 * ```bash
 * # Executed by the core build:
 * node dist/openapi/generate-openapi.js
 * ```
 */
export function generateOpenApiSchemas(): void {
  const packageRoot = resolve(__dirname, '..', '..');
  const tsconfigPath = join(packageRoot, 'tsconfig.json');
  const dtoIndexPath = join(packageRoot, 'src', 'dto', 'index.ts');

  // `dist/openapi` (same folder as this compiled script)
  const outputDir = __dirname;
  const outputJsonPath = join(outputDir, 'components.schemas.json');

  // Temporary TS source file used only for schema generation.
  //
  // Important: this must live under `rootDir` (src/) because the generator
  // type-checks using the project's tsconfig.
  const tempRegistryPath = join(packageRoot, 'src', 'openapi', '_nauth-openapi-dto-registry.ts');

  mkdirSync(outputDir, { recursive: true });
  mkdirSync(dirname(tempRegistryPath), { recursive: true });

  const dtoExportFiles = parseDtoExportFiles(dtoIndexPath);
  const exportedSymbols = collectExportedSymbols(dtoExportFiles);

  // Avoid generating an empty schema file if parsing fails.
  if (exportedSymbols.length === 0) {
    throw new Error(`OpenAPI generation failed: no exported DTO symbols found from ${dtoIndexPath}.`);
  }

  writeFileSync(tempRegistryPath, renderRegistryType(exportedSymbols), 'utf8');

  try {
    const generatorConfig: Config = {
      path: tempRegistryPath,
      tsconfig: tsconfigPath,
      type: 'NAuthOpenApiDtoRegistry',
      expose: 'all',
      // We already run `tsc -b` as part of the build. Skipping type-check here
      // avoids TypeScript project-file-list issues when generating schemas.
      skipTypeCheck: true,
    };

    const generator = createGenerator(generatorConfig);
    const jsonSchema = generator.createSchema('NAuthOpenApiDtoRegistry');

    const openApiDoc = buildOpenApiDocumentFromJsonSchema(jsonSchema);
    writeFileSync(outputJsonPath, `${JSON.stringify(openApiDoc, null, 2)}\n`, 'utf8');
  } finally {
    // Best-effort cleanup. Even if this fails, it doesn't affect consumers.
    rmSync(tempRegistryPath, { force: true });
  }
}

/**
 * Parse `src/dto/index.ts` to get the list of `export * from './x';` files.
 */
function parseDtoExportFiles(dtoIndexPath: string): string[] {
  const content = readFileSync(dtoIndexPath, 'utf8');
  const baseDir = dirname(dtoIndexPath);
  const files = new Set<string>();

  for (const line of content.split('\n')) {
    const match = line.match(/^\s*export\s+\*\s+from\s+['"](\.\/[^'"]+)['"]\s*;\s*$/);
    if (!match) continue;

    const relative = match[1];
    const resolved = join(baseDir, `${relative}.ts`).replace(/\.ts\.ts$/, '.ts');
    files.add(resolved);
  }

  return Array.from(files).sort();
}

/**
 * Collect exported symbol names from DTO source files.
 *
 * We intentionally keep this limited to common exported declarations:
 * - `export class Foo`
 * - `export interface Foo`
 * - `export enum Foo`
 * - `export type Foo = ...`
 */
function collectExportedSymbols(dtoFiles: string[]): string[] {
  const symbols = new Set<string>();

  for (const filePath of dtoFiles) {
    const src = readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(filePath, src, ts.ScriptTarget.ES2022, true);

    for (const statement of sourceFile.statements) {
      if (!hasExportModifier(statement)) continue;

      if (ts.isClassDeclaration(statement) && statement.name) {
        symbols.add(statement.name.text);
        continue;
      }

      if (ts.isInterfaceDeclaration(statement) && statement.name) {
        symbols.add(statement.name.text);
        continue;
      }

      if (ts.isEnumDeclaration(statement) && statement.name) {
        symbols.add(statement.name.text);
        continue;
      }

      if (ts.isTypeAliasDeclaration(statement) && statement.name) {
        symbols.add(statement.name.text);
        continue;
      }
    }
  }

  return Array.from(symbols).sort();
}

function hasExportModifier(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return !!modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

/**
 * Render a temporary DTO registry type referencing all exported DTO symbols.
 */
function renderRegistryType(symbols: string[]): string {
  const lines: string[] = [];

  lines.push('/**');
  lines.push(' * AUTO-GENERATED FILE (build-time only)');
  lines.push(' *');
  lines.push(' * This file is created temporarily during the core build to');
  lines.push(' * generate OpenAPI component schemas. It is not published.');
  lines.push(' */');
  // Temp file lives in `src/openapi/`, so `../dto` resolves to `src/dto/`.
  lines.push("import type * as Dtos from '../dto';");
  lines.push('');
  lines.push('export type NAuthOpenApiDtoRegistry = {');

  for (const name of symbols) {
    // Keep it purely in the type space.
    lines.push(`  ${name}: Dtos.${name};`);
  }

  lines.push('};');
  lines.push('');

  return lines.join('\n');
}

/**
 * Convert a JSON Schema document into an OpenAPI document containing
 * `components.schemas`.
 *
 * OpenAPI tooling generally expects shared schemas to be addressed via:
 * - `#/components/schemas/<Name>`
 *
 * JSON Schema generators often emit shared types under:
 * - `#/definitions/<Name>`
 */
function buildOpenApiDocumentFromJsonSchema(jsonSchema: unknown): {
  openapi: string;
  components: { schemas: Record<string, unknown> };
} {
  if (typeof jsonSchema !== 'object' || jsonSchema === null || !('definitions' in jsonSchema)) {
    throw new Error('OpenAPI generation failed: JSON Schema missing `definitions`.');
  }

  const definitions = (jsonSchema as { definitions?: Record<string, unknown> }).definitions ?? {};

  const schemas: Record<string, unknown> = {};
  for (const [name, schema] of Object.entries(definitions)) {
    schemas[name] = rewriteRefs(schema);
  }

  // Remove registry type if it got emitted as a definition.
  delete schemas.NAuthOpenApiDtoRegistry;

  // Also rewrite refs in case any schema object references the registry name.
  for (const [name, schema] of Object.entries(schemas)) {
    schemas[name] = rewriteRefs(schema);
  }

  return {
    openapi: '3.0.3',
    components: { schemas },
  };
}

/**
 * Recursively rewrite JSON Schema `$ref` pointers to OpenAPI pointers.
 */
function rewriteRefs(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => rewriteRefs(v));
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  const obj = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(obj)) {
    if (key === '$ref' && typeof val === 'string') {
      next[key] = val.replace(/^#\/definitions\//, '#/components/schemas/');
      continue;
    }
    next[key] = rewriteRefs(val);
  }

  return next;
}

// ============================================================================
// CLI entrypoint (build-time)
// ============================================================================

// When executed directly by `node dist/openapi/generate-openapi.js`
if (require.main === module) {
  generateOpenApiSchemas();
}
