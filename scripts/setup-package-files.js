#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const PACKAGES_DIR = path.join(__dirname, '..', 'packages');
const LICENSE_FILE = path.join(__dirname, '..', 'LICENSE');

function getAllPackages() {
  const packages = [];

  function scanDir(dir, relativePath = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        const packageJsonPath = path.join(fullPath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          if (packageJson.name && packageJson.name.startsWith('@nauth-toolkit/')) {
            packages.push({
              path: fullPath,
              relativePath: relPath,
              name: packageJson.name,
              description: packageJson.description || '',
            });
          }
        } else {
          scanDir(fullPath, relPath);
        }
      }
    }
  }

  scanDir(PACKAGES_DIR);
  return packages;
}

function updatePackageJson(packagePath, packageName, description) {
  const packageJsonPath = path.join(packagePath, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  // Ensure package is public (remove private field if present)
  if (packageJson.private === true) {
    delete packageJson.private;
  }

  // Update license
  packageJson.license = 'UNLICENSED';

  // Ensure publishConfig is set correctly
  if (!packageJson.publishConfig) {
    packageJson.publishConfig = {};
  }
  packageJson.publishConfig.access = 'public';
  packageJson.publishConfig.tag = 'preview';

  // Ensure engines field
  if (!packageJson.engines) {
    packageJson.engines = {};
  }
  packageJson.engines.node = '>=22.0.0';

  // Ensure files field includes dist, LICENSE and README
  if (!packageJson.files) {
    packageJson.files = [];
  }
  if (!packageJson.files.includes('dist')) {
    packageJson.files.unshift('dist'); // Add dist first
  }
  if (!packageJson.files.includes('LICENSE')) {
    packageJson.files.push('LICENSE');
  }
  if (!packageJson.files.includes('README.md')) {
    packageJson.files.push('README.md');
  }

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`Updated ${packageName}`);
}

function createREADME(packagePath, packageName, description) {
  const readmePath = path.join(packagePath, 'README.md');

  // Skip if README already exists
  if (fs.existsSync(readmePath)) {
    console.log(`  → README already exists for ${packageName}`);
    return;
  }

  const readmeContent = `# ${packageName}

${description}

This package is part of [nauth-toolkit](https://github.com/noorixorg/nauth-toolkit), an open-source authentication framework for Node.js backends.

## Installation

\`\`\`bash
npm install ${packageName}
# or
pnpm add ${packageName}
\`\`\`

## Documentation

Full documentation: https://nauth.dev

## Support

- Issues and discussions: https://github.com/noorixorg/nauth-toolkit
- Documentation: https://nauth.dev

## License

MIT — see the LICENSE file in the package root for full license terms.
`;

  fs.writeFileSync(readmePath, readmeContent);
  console.log(`  → Created README.md for ${packageName}`);
}

function copyLICENSE(packagePath, packageName) {
  const licenseDest = path.join(packagePath, 'LICENSE');

  if (!fs.existsSync(LICENSE_FILE)) {
    console.log(`  WARNING: LICENSE file not found at root, skipping copy for ${packageName}`);
    return;
  }

  if (fs.existsSync(licenseDest)) {
    console.log(`  → LICENSE already exists for ${packageName}`);
    return;
  }

  fs.copyFileSync(LICENSE_FILE, licenseDest);
  console.log(`  → Copied LICENSE to ${packageName}`);
}

function main() {
  console.log('Setting up package files...\n');

  const packages = getAllPackages();

  for (const pkg of packages) {
    console.log(`\nProcessing ${pkg.name}...`);
    updatePackageJson(pkg.path, pkg.name, pkg.description);
    createREADME(pkg.path, pkg.name, pkg.description);
    copyLICENSE(pkg.path, pkg.name);
  }

  console.log('\nAll packages updated!\n');
}

main();
