# Releasing nauth-toolkit

Step-by-step process for publishing a new version to npm.

## 1. Update the changelog

Add an entry to `CHANGELOG.md` for the new version. Use the next patch version
based on the current version in `packages/core/package.json`.

```bash
# Check the current version
node -e "console.log(require('./packages/core/package.json').version)"
```

Follow [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
## [0.2.2] - 2026-03-01

### Added
- ...

### Fixed
- ...

### Breaking Changes
- ...
```

## 2. Add a Docusaurus changelog entry

Create `nauth-docs/changelog/<date>-v<version>.md`:

```markdown
---
title: v0.2.2
description: Short summary of changes.
slug: v0.2.2
authors:
  - name: nauth-toolkit team
tags: [release]
---

## Added
- ...

<!-- truncate -->

## Fixed
- ...
```

## 3. Commit the changelog

```bash
git add CHANGELOG.md nauth-docs/changelog/
git commit -m "chore: changelog for v0.2.2"
```

## 4. Publish to npm

The publish script bumps all package versions, builds, and publishes.

```bash
node scripts/publish.js latest
```

The script will:
- Increment the patch version across all packages
- Warn if `CHANGELOG.md` is missing an entry for the target version
- Run `pnpm clean && pnpm build:all`
- Publish each package to npm in dependency order

Useful flags:
- `--dry-run` / `-d` — simulate without publishing
- `--skip-version-bump` — publish at the current version (e.g., retry after a partial failure)

## 5. Tag and push

```bash
git add -A
git commit -m "chore: v0.2.2"
git tag v0.2.2
git push origin main --tags
```

## 6. Create a GitHub release

```bash
gh release create v0.2.2 --title "v0.2.2" --notes-file CHANGELOG.md
```

Or write release notes inline:

```bash
gh release create v0.2.2 --title "v0.2.2" --notes "Release notes here..."
```

## Using Changesets (alternative workflow)

For changes developed across multiple PRs, Changesets can track and aggregate
changelog entries automatically.

```bash
# While developing — describe the change
pnpm changeset

# Before releasing — consume changesets, bump versions, update CHANGELOG.md
pnpm changeset version

# Then publish with the existing script (versions already bumped)
node scripts/publish.js latest --skip-version-bump
```
