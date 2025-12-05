/**
 * API Documentation Generator
 *
 * Scans TypeScript source files and generates skeleton MDX documentation pages
 * with consistent structure and proper cross-references.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

interface ExportedMember {
  name: string;
  kind: string;
  isPublic: boolean;
  jsDoc?: string;
  members?: ExportedMember[];
  parameters?: { name: string; type: string }[];
  returnType?: string;
}

interface PackageExports {
  services: ExportedMember[];
  dtos: ExportedMember[];
  interfaces: ExportedMember[];
  enums: ExportedMember[];
  types: ExportedMember[];
  utilities: ExportedMember[];
}

/**
 * Parse TypeScript file and extract public exports
 */
function extractExports(filePath: string): ExportedMember[] {
  const program = ts.createProgram([filePath], {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
  });

  const sourceFile = program.getSourceFile(filePath);
  if (!sourceFile) return [];

  const exports: ExportedMember[] = [];
  const checker = program.getTypeChecker();

  function visit(node: ts.Node) {
    // Check for exported classes
    if (ts.isClassDeclaration(node) && node.name) {
      const symbol = checker.getSymbolAtLocation(node.name);
      if (symbol) {
        const jsDoc = ts.displayPartsToString(symbol.getDocumentationComment(checker));

        const methods: ExportedMember[] = [];
        node.members.forEach((member) => {
          if (ts.isMethodDeclaration(member) && member.name) {
            const methodSymbol = checker.getSymbolAtLocation(member.name);
            if (methodSymbol && !isPrivateOrProtected(member)) {
              methods.push({
                name: member.name.getText(),
                kind: 'method',
                isPublic: true,
                jsDoc: ts.displayPartsToString(methodSymbol.getDocumentationComment(checker)),
                parameters: member.parameters.map((p) => ({
                  name: p.name.getText(),
                  type: p.type ? p.type.getText() : 'any',
                })),
                returnType: member.type ? member.type.getText() : 'void',
              });
            }
          }
        });

        exports.push({
          name: node.name.text,
          kind: 'class',
          isPublic: true,
          jsDoc,
          members: methods,
        });
      }
    }

    // Check for exported interfaces
    if (ts.isInterfaceDeclaration(node) && node.name) {
      const symbol = checker.getSymbolAtLocation(node.name);
      if (symbol) {
        const properties: ExportedMember[] = [];
        node.members.forEach((member) => {
          if (ts.isPropertySignature(member) && member.name) {
            properties.push({
              name: member.name.getText(),
              kind: 'property',
              isPublic: true,
              returnType: member.type ? member.type.getText() : 'any',
            });
          }
        });

        exports.push({
          name: node.name.text,
          kind: 'interface',
          isPublic: true,
          jsDoc: ts.displayPartsToString(symbol.getDocumentationComment(checker)),
          members: properties,
        });
      }
    }

    // Check for exported enums
    if (ts.isEnumDeclaration(node) && node.name) {
      exports.push({
        name: node.name.text,
        kind: 'enum',
        isPublic: true,
      });
    }

    ts.forEachChild(node, visit);
  }

  function isPrivateOrProtected(node: ts.ClassElement): boolean {
    return (
      node.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword,
      ) ?? false
    );
  }

  visit(sourceFile);
  return exports;
}

/**
 * Scan package index.ts to get all public exports
 */
function scanPackage(packagePath: string): PackageExports {
  const indexPath = path.join(packagePath, 'src', 'index.ts');

  const result: PackageExports = {
    services: [],
    dtos: [],
    interfaces: [],
    enums: [],
    types: [],
    utilities: [],
  };

  if (!fs.existsSync(indexPath)) {
    console.log(`Index file not found: ${indexPath}`);
    return result;
  }

  // Read index.ts to see what's exported
  const content = fs.readFileSync(indexPath, 'utf-8');

  // Parse export lines
  const exportRegex = /export\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
  const directExportRegex = /export\s+\*\s+from\s+['"]([^'"]+)['"]/g;

  let match;

  // Handle named exports
  while ((match = exportRegex.exec(content)) !== null) {
    const exports = match[1].split(',').map((e) => e.trim());
    const fromPath = match[2];

    const fullPath = path.join(packagePath, 'src', fromPath + '.ts');
    if (fs.existsSync(fullPath)) {
      const members = extractExports(fullPath);

      // Categorize by naming convention
      members.forEach((member) => {
        if (member.name.endsWith('Service')) {
          result.services.push(member);
        } else if (member.name.endsWith('DTO') || member.name.includes('Response')) {
          result.dtos.push(member);
        } else if (member.kind === 'interface') {
          result.interfaces.push(member);
        } else if (member.kind === 'enum') {
          result.enums.push(member);
        }
      });
    }
  }

  return result;
}

/**
 * Generate service documentation skeleton
 */
function generateServiceDoc(service: ExportedMember, packageName: string): string {
  const methods = service.members?.filter((m) => m.kind === 'method') || [];

  return `---
title: ${service.name}
description: ${service.jsDoc || `${service.name} service`}
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ${service.name}

**Package:** \`@nauth-toolkit/${packageName}\`
**Type:** Service

${service.jsDoc || `Service description goes here.`}

:::tip Import from Your Platform Package
\`\`\`typescript
// NestJS
import { ${service.name} } from '@nauth-toolkit/nestjs';

// Express
import { ${service.name} } from '@nauth-toolkit/express';
\`\`\`
:::

## Overview

${service.jsDoc || 'Overview description goes here.'}

## Methods

${methods
  .map(
    (method) => `
### ${method.name}()

${method.jsDoc || 'Method description goes here.'}

**Signature:**
\`\`\`typescript
${method.name}(${method.parameters?.map((p) => `${p.name}: ${p.type}`).join(', ') || ''}): ${method.returnType || 'Promise<void>'}
\`\`\`

**Parameters:**
${method.parameters?.map((p) => `- \`${p.name}\` - Parameter description`).join('\n') || 'None'}

**Returns:**
- \`${method.returnType || 'Promise<void>'}\` - Return value description

**Example:**

\`\`\`typescript
// Example usage
const result = await service.${method.name}(${method.parameters?.map((p) => p.name).join(', ') || ''});
\`\`\`

---
`,
  )
  .join('\n')}

## Related APIs

- Related API 1
- Related API 2

## See Also

- Related documentation
`;
}

/**
 * Generate DTO documentation skeleton
 */
function generateDTODoc(dto: ExportedMember, packageName: string): string {
  const properties = dto.members?.filter((m) => m.kind === 'property') || [];

  return `---
title: ${dto.name}
description: ${dto.jsDoc || `${dto.name} data transfer object`}
sidebar_position: 1
---

# ${dto.name}

**Package:** \`@nauth-toolkit/${packageName}\`
**Type:** DTO

${dto.jsDoc || 'DTO description goes here.'}

:::tip Import from Your Platform Package
\`\`\`typescript
// NestJS
import { ${dto.name} } from '@nauth-toolkit/nestjs';

// Express
import { ${dto.name} } from '@nauth-toolkit/express';
\`\`\`
:::

## Overview

${dto.jsDoc || 'Overview description goes here.'}

## Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
${properties.map((p) => `| \`${p.name}\` | \`${p.returnType}\` | ❓ | Property description |`).join('\n')}

## Usage Example

\`\`\`typescript
const dto: ${dto.name} = {
${properties.map((p) => `  ${p.name}: undefined, // TODO: Add example value`).join(',\n')}
};
\`\`\`

## Related APIs

- Related API 1
- Related API 2
`;
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 Scanning nauth-toolkit packages...\n');

  const packagesDir = path.join(__dirname, '../../packages');
  const packages = ['core', 'nestjs', 'express'];

  for (const pkg of packages) {
    console.log(`📦 Scanning ${pkg}...`);
    const packagePath = path.join(packagesDir, pkg);
    const exports = scanPackage(packagePath);

    console.log(`  Found ${exports.services.length} services`);
    console.log(`  Found ${exports.dtos.length} DTOs`);
    console.log(`  Found ${exports.interfaces.length} interfaces`);
    console.log(`  Found ${exports.enums.length} enums\n`);

    // Generate skeleton docs
    const docsDir = path.join(__dirname, '../docs/api', pkg);

    // Generate service docs
    for (const service of exports.services) {
      const serviceDir = path.join(docsDir, 'services');
      fs.mkdirSync(serviceDir, { recursive: true });

      const filename =
        service.name
          .replace(/Service$/, '')
          .replace(/([A-Z])/g, '-$1')
          .toLowerCase()
          .slice(1) + '-service.md';

      const content = generateServiceDoc(service, pkg);
      fs.writeFileSync(path.join(serviceDir, filename), content);
      console.log(`  ✓ Generated ${filename}`);
    }

    // Generate DTO docs
    for (const dto of exports.dtos) {
      const dtoDir = path.join(docsDir, 'dto');
      fs.mkdirSync(dtoDir, { recursive: true });

      const filename =
        dto.name
          .replace(/DTO$/, '')
          .replace(/([A-Z])/g, '-$1')
          .toLowerCase()
          .slice(1) + '-dto.md';

      const content = generateDTODoc(dto, pkg);
      fs.writeFileSync(path.join(dtoDir, filename), content);
      console.log(`  ✓ Generated ${filename}`);
    }
  }

  console.log('\n✅ Documentation skeleton generation complete!');
}

main().catch(console.error);


