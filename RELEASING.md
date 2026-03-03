# Releasing nauth-toolkit

## 1. Check current version

```bash
node -e "console.log(require('./packages/core/package.json').version)"
```

## 2. Write changelogs

Add entry to `CHANGELOG.md` ([Keep a Changelog](https://keepachangelog.com/) format):

```markdown
## [0.2.2] - 2026-03-03

### Added
- ...

### Changed
- ...

### Fixed
- ...
```

Create `nauth-docs/changelog/<YYYY-MM-DD>-v<version>.md`:

```markdown
---
title: v0.2.2
description: Short summary.
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

## 3. Dry-run

```bash
node scripts/publish.js latest --dry-run
```

## 4. Publish (bumps versions, builds, publishes all ~20 packages)

```bash
node scripts/publish.js latest
```

## 5. Commit, tag, push

```bash
git add -A
git commit -m "chore: v<version>"
git tag v<version>
git push origin <branch> --tags
```

## 6. GitHub release

```bash
gh release create v<version> --title "v<version>" --notes "See CHANGELOG.md for details."
```

---

## Recovery (partial publish failed)

Re-run without bumping — skips already-published packages:

```bash
node scripts/publish.js latest --skip-version-bump
```
