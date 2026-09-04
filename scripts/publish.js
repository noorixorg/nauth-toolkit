#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const PACKAGES_DIR = path.join(__dirname, '..', 'packages');
const TAG = process.argv[2] || 'latest';
const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('-d');
const SKIP_VERSION_BUMP = process.argv.includes('--skip-version-bump');
const MINOR_BUMP = process.argv.includes('--minor');

const PUBLISH_ORDER = [
  'core',
  'recaptcha',
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
  'oidc-provider',
  'nestjs',
];

function incrementVersion(version) {
  const parts = version.split('.');
  // `--minor` for a release that adds public API — a new package, a new exported
  // namespace, new enum members. The default stays a patch bump.
  if (MINOR_BUMP) {
    return `${parts[0]}.${parseInt(parts[1] || 0, 10) + 1}.0`;
  }
  return `${parts[0]}.${parts[1]}.${parseInt(parts[2] || 0, 10) + 1}`;
}

/**
 * Resolve workspace: protocol references in a package.json file.
 * Converts `workspace:*`, `workspace:^`, `workspace:~` to real semver ranges.
 * Returns true if the file was modified.
 */
function resolveWorkspaceProtocol(packageJsonPath, version) {
  const pkgJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  let modified = false;

  ['dependencies', 'peerDependencies'].forEach((depType) => {
    if (pkgJson[depType]) {
      Object.keys(pkgJson[depType]).forEach((dep) => {
        if (!dep.startsWith('@nauth-toolkit/')) return;
        const val = pkgJson[depType][dep];
        if (typeof val === 'string' && val.startsWith('workspace:')) {
          const range = val.slice('workspace:'.length);
          pkgJson[depType][dep] = range === '~' ? `~${version}` : `^${version}`;
          modified = true;
        }
      });
    }
  });

  if (modified) {
    fs.writeFileSync(packageJsonPath, JSON.stringify(pkgJson, null, 2) + '\n');
  }
  return modified;
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

/**
 * Get the directory from which a package should be published.
 * client-angular publishes from dist/ (ng-packagr output).
 */
function getPublishCwd(pkg) {
  return pkg.name === '@nauth-toolkit/client-angular' ? path.join(pkg.path, 'dist') : pkg.path;
}

function publishPackage(pkg, newVersion) {
  const publishCwd = getPublishCwd(pkg);

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

  // Resolve workspace: protocol in the publish directory's package.json.
  // For most packages this is the root package.json (already handled by
  // updatePackageVersion in normal flow, but needed for --skip-version-bump).
  // For client-angular this is dist/package.json where ng-packagr copies
  // peerDependencies verbatim from root.
  resolveWorkspaceProtocol(path.join(publishCwd, 'package.json'), newVersion);

  // ng-packagr copies publishConfig verbatim, so the dist manifest inherits the
  // `directory: 'dist'` that makes pnpm link workspace consumers to the built output.
  // Inside dist that would mean dist/dist, so strip it from what is published.
  if (pkg.name === '@nauth-toolkit/client-angular') {
    const distManifestPath = path.join(publishCwd, 'package.json');
    const distManifest = JSON.parse(fs.readFileSync(distManifestPath, 'utf8'));
    if (distManifest.publishConfig) {
      delete distManifest.publishConfig.directory;
      delete distManifest.publishConfig.linkDirectory;
      fs.writeFileSync(distManifestPath, `${JSON.stringify(distManifest, null, 2)}\n`);
    }
  }

  execSync(`npm publish --tag ${TAG} --registry https://registry.npmjs.org/`, {
    stdio: 'inherit',
    cwd: publishCwd,
  });
}

/**
 * Prompt the user for confirmation via stdin.
 * Returns a promise that resolves to true (yes) or false (no).
 */
function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes');
    });
  });
}

/**
 * Check whether CHANGELOG.md contains an entry for the given version.
 */
function changelogHasVersion(version) {
  const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
  if (!fs.existsSync(changelogPath)) return false;
  const content = fs.readFileSync(changelogPath, 'utf8');
  return content.includes(`## [${version}]`);
}

async function main() {
  const flags = [DRY_RUN && 'DRY RUN', SKIP_VERSION_BUMP && 'SKIP VERSION BUMP', MINOR_BUMP && 'MINOR'].filter(
    Boolean,
  );
  const flagStr = flags.length ? ` [${flags.join(', ')}]` : '';
  console.log(`Publishing nauth-toolkit packages (tag: ${TAG})${flagStr}\n`);

  const allPackages = getAllPackages();
  const corePackage = allPackages.find((p) => p.name === '@nauth-toolkit/core');
  if (!corePackage) {
    console.error('ERROR: Core package not found');
    process.exit(1);
  }

  const currentVersion = corePackage.version;
  const newVersion = SKIP_VERSION_BUMP ? currentVersion : incrementVersion(currentVersion);

  if (SKIP_VERSION_BUMP) {
    console.log(`Publishing at current version: ${currentVersion}\n`);
  } else {
    console.log(`Updating versions: ${currentVersion} -> ${newVersion}\n`);
  }

  // Check CHANGELOG.md for an entry matching the target version
  if (!DRY_RUN && !changelogHasVersion(newVersion)) {
    console.warn(`\n  WARNING: CHANGELOG.md has no entry for version ${newVersion}\n`);
    const proceed = await confirm('  Continue without a changelog entry? (y/N) ');
    if (!proceed) {
      console.log('\n  Aborted. Update CHANGELOG.md and try again.\n');
      process.exit(0);
    }
    console.log('');
  }

  // Update versions (or just collect packages if skipping bump)
  const updatedPackages = new Map();
  for (const pkg of allPackages) {
    if (SKIP_VERSION_BUMP || DRY_RUN) {
      updatedPackages.set(pkg.relativePath, { ...pkg, newVersion });
      if (!SKIP_VERSION_BUMP) {
        console.log(`  [DRY RUN] ${pkg.name}: ${pkg.version} -> ${newVersion}`);
      }
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
    execSync('pnpm run clean && pnpm run build:all', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
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
        publishPackage(pkg, newVersion);
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

  // Publish any remaining packages not in PUBLISH_ORDER
  for (const [relPath, pkg] of updatedPackages.entries()) {
    if (!PUBLISH_ORDER.includes(relPath)) {
      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would publish ${pkg.name}`);
        success++;
      } else {
        try {
          publishPackage(pkg, newVersion);
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
