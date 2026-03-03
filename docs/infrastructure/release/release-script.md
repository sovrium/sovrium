# Release Script — Manual Version Management

## Overview

**Script**: `scripts/release.ts`
**Purpose**: Explicit version management replacing semantic-release. Bumps version, updates CHANGELOG, exports schemas, commits, and tags locally. CI handles publishing.

## Usage

```bash
# Bump types
bun run release patch                          # 0.0.2 → 0.0.3
bun run release minor                          # 0.0.2 → 0.1.0
bun run release major                          # 0.0.2 → 1.0.0
bun run release 1.2.3                          # Explicit version

# Options
bun run release patch --dry-run                # Preview without changes
bun run release patch --message "Add OAuth"    # Custom CHANGELOG message

# After running the script:
git push origin main --follow-tags
```

## What the Script Does

| Step | Action                                             | Files Modified         |
| ---- | -------------------------------------------------- | ---------------------- |
| 1    | Run pre-publish checks (`prepublish-check`)        | —                      |
| 2    | Update `package.json` version                      | `package.json`         |
| 3    | Export schemas (`export:schema`, `export:openapi`) | `schemas/{version}/**` |
| 4    | Prepend CHANGELOG.md entry                         | `CHANGELOG.md`         |
| 5    | Git commit (`release: X.Y.Z`)                      | —                      |
| 6    | Git tag (`vX.Y.Z`)                                 | —                      |

## Validations (Before Making Changes)

| Check          | Error If                             |
| -------------- | ------------------------------------ |
| Branch         | Not on `main`                        |
| Working tree   | Uncommitted changes                  |
| Tag uniqueness | `vX.Y.Z` already exists              |
| Version order  | New version not greater than current |

## CI Workflow (release.yml)

After `git push origin main --follow-tags`:

```
Push to main
    ↓
Test workflow runs
    ↓ (if successful + commit starts with "release:")
Publish job:
    1. bun run prepublish-check (validate package metadata + size)
    2. npm publish --provenance --access public
    3. gh release create --generate-notes
    ↓
trigger-website-sync (non-blocking)
```

### Permissions

```yaml
permissions:
  contents: write # Create GitHub Release
  id-token: write # OIDC for npm provenance
```

### Required Secrets

| Secret            | Purpose                          |
| ----------------- | -------------------------------- |
| `NPM_TOKEN`       | npm registry authentication      |
| `GH_PAT_WORKFLOW` | Dispatch website deploy workflow |

**Note**: `bun publish` lacks `--provenance` support (oven-sh/bun#15601), so CI uses `npm publish` with Node.js for OIDC Trusted Publishing.

## CHANGELOG Format

```markdown
## [X.Y.Z](https://github.com/sovrium/sovrium/compare/vOLD...vNEW) (YYYY-MM-DD)

<message or "Release X.Y.Z">
```

## Developer Workflow

```bash
# 1. Work on features (regular commits)
git commit -m "feat(auth): add OAuth support"
git commit -m "fix(api): resolve timeout"
git push origin main

# 2. When ready to release
bun run release patch --message "Add OAuth support, fix API timeout"
# Script: bumps 0.0.2 → 0.0.3, exports schemas, updates changelog, commits, tags

# 3. Push to trigger CI
git push origin main --follow-tags
# CI: Test → npm publish → GitHub Release → website deploy
```

## Key Differences from semantic-release

| Aspect           | Before (semantic-release)         | After (release script)             |
| ---------------- | --------------------------------- | ---------------------------------- |
| Version decision | Automated from commits            | Explicit (`patch`/`minor`/`major`) |
| CHANGELOG        | Auto-generated commit hashes      | Manual summary message             |
| CI commits back  | Yes (`[skip ci]`)                 | No — local commit only             |
| Dependencies     | 4 plugins (~30MB)                 | Zero (Bun built-in APIs)           |
| Dry run          | `bunx semantic-release --dry-run` | `bun run release patch --dry-run`  |
| Publishing       | semantic-release npm plugin       | `npm publish --provenance` in CI   |

## References

- npm Trusted Publishing: https://docs.npmjs.com/generating-provenance-statements
- Conventional Commits: https://www.conventionalcommits.org/
