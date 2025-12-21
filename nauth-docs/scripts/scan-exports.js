#!/usr/bin/env node

/**
 * Scan TypeScript exports and generate API documentation inventory
 */

const fs = require('fs');
const path = require('path');

const packagesDir = path.join(__dirname, '../../packages');

function scanIndexFile(packagePath) {
  const indexPath = path.join(packagePath, 'src', 'index.ts');

  if (!fs.existsSync(indexPath)) {
    return { services: [], dtos: [], interfaces: [], enums: [], utilities: [], guards: [], decorators: [], middleware: [] };
  }

  const content = fs.readFileSync(indexPath, 'utf-8');
  const lines = content.split('\n');

  const exports = {
    services: [],
    dtos: [],
    interfaces: [],
    enums: [],
    utilities: [],
    guards: [],
    decorators: [],
    middleware: [],
    interceptors: [],
    filters: [],
    modules: [],
  };

  lines.forEach(line => {
    const exportMatch = line.match(/export\s+\{([^}]+)\}/);
    if (exportMatch) {
      const items = exportMatch[1].split(',').map(item => item.trim());
      items.forEach(item => {
        // Categorize by naming convention
        if (item.endsWith('Service')) exports.services.push(item);
        else if (item.endsWith('DTO') || item.includes('Response')) exports.dtos.push(item);
        else if (item.startsWith('I') && item[1] === item[1].toUpperCase()) exports.interfaces.push(item);
        else if (item.endsWith('Guard')) exports.guards.push(item);
        else if (item.endsWith('Interceptor')) exports.interceptors.push(item);
        else if (item.endsWith('Filter')) exports.filters.push(item);
        else if (item.endsWith('Module')) exports.modules.push(item);
        else if (item.endsWith('Middleware')) exports.middleware.push(item);
        else if (item.match(/^[A-Z][a-z]+[A-Z]/)) exports.enums.push(item);
      });
    }
  });

  return exports;
}

// Scan all packages
console.log('📦 Scanning packages...\n');

const packages = {
  core: scanIndexFile(path.join(packagesDir, 'core')),
  nestjs: scanIndexFile(path.join(packagesDir, 'nestjs')),
  express: scanIndexFile(path.join(packagesDir, 'express')),
};

// Print inventory
Object.entries(packages).forEach(([pkg, exports]) => {
  console.log(`\n📦 ${pkg.toUpperCase()}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Services: ${exports.services.length}`);
  exports.services.slice(0, 5).forEach(s => console.log(`  - ${s}`));
  if (exports.services.length > 5) console.log(`  ... and ${exports.services.length - 5} more`);

  console.log(`\nDTOs: ${exports.dtos.length}`);
  exports.dtos.slice(0, 5).forEach(d => console.log(`  - ${d}`));
  if (exports.dtos.length > 5) console.log(`  ... and ${exports.dtos.length - 5} more`);

  console.log(`\nInterfaces: ${exports.interfaces.length}`);
  exports.interfaces.slice(0, 5).forEach(i => console.log(`  - ${i}`));
  if (exports.interfaces.length > 5) console.log(`  ... and ${exports.interfaces.length - 5} more`);

  if (exports.guards.length > 0) {
    console.log(`\nGuards: ${exports.guards.length}`);
    exports.guards.forEach(g => console.log(`  - ${g}`));
  }

  if (exports.decorators.length > 0) {
    console.log(`\nDecorators: ${exports.decorators.length}`);
    exports.decorators.forEach(d => console.log(`  - ${d}`));
  }

  if (exports.middleware.length > 0) {
    console.log(`\nMiddleware: ${exports.middleware.length}`);
    exports.middleware.forEach(m => console.log(`  - ${m}`));
  }
});

// Save inventory to JSON
const outputPath = path.join(__dirname, 'api-inventory.json');
fs.writeFileSync(outputPath, JSON.stringify(packages, null, 2));
console.log(`\nInventory saved to ${outputPath}`);


