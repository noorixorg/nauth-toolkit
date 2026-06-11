import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { createGenerator, type Config } from 'ts-json-schema-generator';
import * as ts from 'typescript';

const SCHEMA_PREFIX = 'MfaSms';

/**
 * Build-time OpenAPI schema generator for `@nauth-toolkit/mfa-sms` DTOs.
 *
 * Output:
 * - `dist/src/openapi/components.schemas.json`
 */
export function generateOpenApiSchemas(): void {
  // Compiled output path: `dist/src/openapi` → package root is `../../..`
  const packageRoot = resolve(__dirname, '..', '..', '..');
  const tsconfigPath = join(packageRoot, 'tsconfig.json');

  const outputDir = __dirname;
  const outputJsonPath = join(outputDir, 'components.schemas.json');

  // Temporary TS source file used only for schema generation.
  const tempRegistryPath = join(packageRoot, 'src', 'openapi', '_nauth-openapi-dto-registry.ts');

  mkdirSync(outputDir, { recursive: true });
  mkdirSync(dirname(tempRegistryPath), { recursive: true });

  const dtoFiles = listDtoSourceFiles(join(packageRoot, 'src', 'dto'));
  const exportedSymbolsByModule = dtoFiles.map((filePath, idx) => ({
    namespace: `Dtos${idx}`,
    modulePath: filePath,
    symbols: collectExportedSymbols(filePath),
  }));

  const allSymbolsCount = exportedSymbolsByModule.reduce((acc, m) => acc + m.symbols.length, 0);
  if (allSymbolsCount === 0) {
    throw new Error('OpenAPI generation failed: no exported DTO symbols found under src/dto/.');
  }

  writeFileSync(tempRegistryPath, renderRegistryType(exportedSymbolsByModule), 'utf8');

  try {
    const generatorConfig: Config = {
      path: tempRegistryPath,
      tsconfig: tsconfigPath,
      type: 'NAuthOpenApiDtoRegistry',
      expose: 'all',
      skipTypeCheck: true,
    };

    const generator = createGenerator(generatorConfig);
    const jsonSchema = generator.createSchema('NAuthOpenApiDtoRegistry');

    const openApiDoc = buildOpenApiDocumentFromJsonSchema(jsonSchema, SCHEMA_PREFIX);
    writeFileSync(outputJsonPath, `${JSON.stringify(openApiDoc, null, 2)}\n`, 'utf8');
  } finally {
    rmSync(tempRegistryPath, { force: true });
  }
}

function listDtoSourceFiles(dtoDir: string): string[] {
  const entries = readdirSync(dtoDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts') && e.name !== 'index.ts')
    .map((e) => join(dtoDir, e.name))
    .sort();
}

function collectExportedSymbols(filePath: string): string[] {
  const src = readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, src, ts.ScriptTarget.ES2022, true);

  const symbols = new Set<string>();
  for (const statement of sourceFile.statements) {
    if (!hasExportModifier(statement)) continue;

    if (ts.isClassDeclaration(statement) && statement.name) symbols.add(statement.name.text);
    if (ts.isInterfaceDeclaration(statement) && statement.name) symbols.add(statement.name.text);
    if (ts.isEnumDeclaration(statement) && statement.name) symbols.add(statement.name.text);
    if (ts.isTypeAliasDeclaration(statement) && statement.name) symbols.add(statement.name.text);
  }

  return Array.from(symbols).sort();
}

function hasExportModifier(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return !!modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

function renderRegistryType(modules: Array<{ namespace: string; modulePath: string; symbols: string[] }>): string {
  const lines: string[] = [];

  lines.push('/**');
  lines.push(' * AUTO-GENERATED FILE (build-time only)');
  lines.push(' */');

  const registryDir = resolve(__dirname, '..', '..', '..', 'src', 'openapi');
  for (const m of modules) {
    const relFromRegistry = relative(registryDir, m.modulePath).replace(/\\/g, '/').replace(/\.ts$/, '');
    lines.push(`import type * as ${m.namespace} from '${relFromRegistry}';`);
  }

  lines.push('');
  lines.push('export type NAuthOpenApiDtoRegistry = {');

  for (const m of modules) {
    for (const name of m.symbols) {
      lines.push(`  ${name}: ${m.namespace}.${name};`);
    }
  }

  lines.push('};');
  lines.push('');

  return lines.join('\n');
}

function buildOpenApiDocumentFromJsonSchema(
  jsonSchema: unknown,
  prefix: string,
): { openapi: string; components: { schemas: Record<string, unknown> } } {
  if (typeof jsonSchema !== 'object' || jsonSchema === null || !('definitions' in jsonSchema)) {
    throw new Error('OpenAPI generation failed: JSON Schema missing `definitions`.');
  }

  const definitions = (jsonSchema as { definitions?: Record<string, unknown> }).definitions ?? {};

  const renameMap = new Map<string, string>();
  for (const name of Object.keys(definitions)) {
    if (name === 'NAuthOpenApiDtoRegistry') continue;
    renameMap.set(name, `${prefix}${name}`);
  }

  const schemas: Record<string, unknown> = {};
  for (const [name, schema] of Object.entries(definitions)) {
    if (name === 'NAuthOpenApiDtoRegistry') continue;
    const renamed = renameMap.get(name) ?? name;
    schemas[renamed] = rewriteRefsAndRename(schema, renameMap);
  }

  return { openapi: '3.0.3', components: { schemas } };
}

function rewriteRefsAndRename(value: unknown, renameMap: Map<string, string>): unknown {
  if (Array.isArray(value)) return value.map((v) => rewriteRefsAndRename(v, renameMap));
  if (typeof value !== 'object' || value === null) return value;

  const obj = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(obj)) {
    if (key === '$ref' && typeof val === 'string') {
      const openApiRef = val.replace(/^#\/definitions\//, '#/components/schemas/');
      const refName = openApiRef.replace(/^#\/components\/schemas\//, '');
      const renamed = renameMap.get(refName);
      next[key] = renamed ? `#/components/schemas/${renamed}` : openApiRef;
      continue;
    }
    next[key] = rewriteRefsAndRename(val, renameMap);
  }

  return next;
}

if (require.main === module) {
  generateOpenApiSchemas();
}
