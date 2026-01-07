#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PACKAGES_DIR = path.join(__dirname, '..', 'packages');
const TAG = process.argv[2] || 'latest';
const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('-d');

const PUBLISH_ORDER = [
  'core',
  'client',
  'client-angular',
  'database/typeorm-postgres',
  'database/typeorm-mysql',
  'storage/database',
  'storage/redis',
  'email/console',
  'email/nodemailer',
  'sms/console',
  'sms/aws-sns',
  'mfa/totp',
  'mfa/sms',
  'mfa/email',
  'mfa/passkey',
  'social/google',
  'social/apple',
  'social/facebook',
  'nestjs',
];

function incrementVersion(version) {
  const parts = version.split('.');
  return `${parts[0]}.${parts[1]}.${parseInt(parts[2] || 0, 10) + 1}`;
}

function updatePackageVersion(packagePath, newVersion) {
  const packageJsonPath = path.join(packagePath, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const oldVersion = packageJson.version;
  packageJson.version = newVersion;

  // Update internal dependencies
  ['dependencies', 'peerDependencies'].forEach((depType) => {
    if (packageJson[depType]) {
      Object.keys(packageJson[depType]).forEach((dep) => {
        if (dep.startsWith('@nauth-toolkit/')) {
          const current = packageJson[depType][dep];
          // ============================================================================
          // Workspace protocol + version alignment
          // ============================================================================
          // Keep monorepo development ergonomic by allowing `workspace:*` (etc) locally,
          // but ensure published packages always have valid semver ranges on npm.
          //
          // Examples:
          // - workspace:*  -> ^<newVersion>
          // - workspace:^  -> ^<newVersion>
          // - workspace:~  -> ~<newVersion>
          // - ^0.1.56      -> ^<newVersion>
          // - 0.1.56       -> <newVersion>
          if (typeof current === 'string' && current.startsWith('workspace:')) {
            const workspaceRange = current.slice('workspace:'.length);
            packageJson[depType][dep] = workspaceRange === '~' ? `~${newVersion}` : `^${newVersion}`;
          } else {
            packageJson[depType][dep] =
              current.startsWith('^') || current.startsWith('~') ? current.charAt(0) + newVersion : newVersion;
          }
        }
      });
    }
  });

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  return oldVersion;
}

function getAllPackages() {
  const packages = [];
  function scanDir(dir, relPath = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      const newRelPath = path.join(relPath, entry.name);
      if (entry.isDirectory()) {
        const pkgJson = path.join(fullPath, 'package.json');
        if (fs.existsSync(pkgJson)) {
          const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf8'));
          if (pkg.name?.startsWith('@nauth-toolkit/')) {
            packages.push({ path: fullPath, relativePath: newRelPath, name: pkg.name, version: pkg.version });
          }
        } else {
          scanDir(fullPath, newRelPath);
        }
      }
    }
  }
  scanDir(PACKAGES_DIR);
  return packages;
}

function main() {
  console.log(`Publishing nauth-toolkit packages (tag: ${TAG})${DRY_RUN ? ' [DRY RUN]' : ''}\n`);

  const allPackages = getAllPackages();
  const corePackage = allPackages.find((p) => p.name === '@nauth-toolkit/core');
  if (!corePackage) {
    console.error('ERROR: Core package not found');
    process.exit(1);
  }

  const newVersion = incrementVersion(corePackage.version);
  console.log(`Updating versions: ${corePackage.version} -> ${newVersion}\n`);

  // Update versions
  const updatedPackages = new Map();
  for (const pkg of allPackages) {
    if (DRY_RUN) {
      updatedPackages.set(pkg.relativePath, { ...pkg, newVersion });
      console.log(`  [DRY RUN] ${pkg.name}: ${pkg.version} -> ${newVersion}`);
    } else {
      const oldVersion = updatePackageVersion(pkg.path, newVersion);
      updatedPackages.set(pkg.relativePath, { ...pkg, oldVersion, newVersion });
      console.log(`  OK ${pkg.name}: ${oldVersion} -> ${newVersion}`);
    }
  }

  // Build
  if (DRY_RUN) {
    console.log('\n[DRY RUN] Would build packages...\n');
  } else {
    console.log('\nBuilding packages...\n');
    execSync('yarn clean && yarn build:all', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  }

  // Publish
  console.log(`\nPublishing packages...\n`);
  let success = 0;
  let failed = 0;

  for (const relPath of PUBLISH_ORDER) {
    const pkg = updatedPackages.get(relPath);
    if (!pkg) continue;

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would publish ${pkg.name}`);
      success++;
    } else {
      try {
        // ============================================================================
        // Publishing strategy
        // ============================================================================
        // WARNING: Security/compatibility critical packaging
        //
        // `@nauth-toolkit/client-angular` must be published from its `dist/` output
        // generated by ng-packagr. The root package contains sources and build config,
        // but the distributable entrypoints (exports/typings/fesm/esm) live in `dist/`.
        // If we publish from the root, consumers will fail to resolve the package.
        const publishCwd = pkg.name === '@nauth-toolkit/client-angular' ? path.join(pkg.path, 'dist') : pkg.path;

        // Copy .npmrc to dist directory for client-angular (npm looks for it in cwd)
        // SECURITY: .npmrc is automatically excluded from published packages by npm
        // and is also explicitly listed in .npmignore for extra safety
        if (pkg.name === '@nauth-toolkit/client-angular') {
          const rootNpmrc = path.join(__dirname, '..', '.npmrc');
          const distNpmrc = path.join(publishCwd, '.npmrc');
          if (fs.existsSync(rootNpmrc) && !fs.existsSync(distNpmrc)) {
            fs.copyFileSync(rootNpmrc, distNpmrc);
          }
        }

        execSync(`npm publish --tag ${TAG} --registry https://registry.npmjs.org/`, {
          stdio: 'inherit',
          cwd: publishCwd,
        });
        console.log(`  OK ${pkg.name}`);
        success++;
      } catch (error) {
        const errMsg = error.stderr?.toString() || error.message || '';
        if (errMsg.includes('previously published') || errMsg.includes('EPUBLISHCONFLICT')) {
          console.log(`  SKIP ${pkg.name} (already published)`);
          success++;
        } else {
          console.log(`  FAIL ${pkg.name}`);
          failed++;
        }
      }
    }
  }

  // Publish any remaining packages
  for (const [relPath, pkg] of updatedPackages.entries()) {
    if (!PUBLISH_ORDER.includes(relPath)) {
      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would publish ${pkg.name}`);
        success++;
      } else {
        try {
          execSync(`npm publish --tag ${TAG} --registry https://registry.npmjs.org/`, {
            stdio: 'inherit',
            cwd: pkg.path,
          });
          console.log(`  OK ${pkg.name}`);
          success++;
        } catch (error) {
          console.log(`  FAIL ${pkg.name}`);
          failed++;
        }
      }
    }
  }

  console.log(
    `\nPublished: ${success}${failed > 0 ? ` | Failed: ${failed}` : ''} | Version: ${newVersion} | Tag: ${TAG}\n`,
  );
  if (failed > 0) process.exit(1);
}

main();
