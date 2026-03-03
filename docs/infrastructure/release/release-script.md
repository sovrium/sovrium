# Release System — Automated + Manual Override

## Overview

**Primary**: Automated via CI (`release.yml` + `scripts/analyze-commits.ts`)
**Manual Override**: `scripts/release.ts` for emergencies and hotfixes
**Publishing**: CI uses `npm publish --provenance` (Bun lacks provenance support)

## Automated Release (Primary)

### How It Works

Push conventional commits to main → CI automatically analyzes, bumps, publishes.

```
git push origin main (with feat:/fix:/perf: commits)
    ↓
Test workflow runs (quality + tests)
    ↓ (if successful)
Release workflow:
    1. Analyze commits since last tag (scripts/analyze-commits.ts)
    2. Determine bump: feat: → minor, fix:/perf: → patch, !  → major
    3. If no releasable commits → exit early (no release)
    4. Pre-publish validation
    5. Bump package.json version
    6. Export schemas (JSON Schema + OpenAPI)
    7. Update CHANGELOG.md (grouped by type with commit links)
    8. Commit: "chore(release): X.Y.Z [skip ci]"
    9. Tag: vX.Y.Z
   10. Push to main (rebase-then-push for race conditions)
   11. npm publish --provenance --access public
   12. Create GitHub Release (with changelog body)
    ↓
trigger-website-sync (non-blocking)
```

### Commit Classification

| Prefix                                                             | Bump  | Changelog Section                                |
| ------------------------------------------------------------------ | ----- | ------------------------------------------------ |
| `feat:`                                                            | minor | Features                                         |
| `fix:`                                                             | patch | Bug Fixes                                        |
| `perf:`                                                            | patch | Performance Improvements                         |
| `!` after type or `BREAKING CHANGE:` in body                       | major | BREAKING CHANGES                                 |
| `chore:`, `docs:`, `style:`, `refactor:`, `test:`, `ci:`, `build:` | none  | Included only when mixed with releasable commits |

### Filtered Out (No Changelog, No Bump)

- Merge commits
- `[skip ci]` commits
- `release:` commits (manual release script)
- `[TDD]` commits
- `chore(release):` commits (automated release)
- Dependabot `Bump X from Y to Z`

### Infinite Loop Prevention

Belt + suspenders approach:

1. `[skip ci]` in release commit → test.yml doesn't trigger → release.yml doesn't trigger
2. `chore(release):` prefix explicitly excluded in `if` condition

### Local Preview

```bash
bun run analyze-commits --dry-run         # Preview commit analysis
bun run analyze-commits --from v0.0.1     # Override start tag
```

## Manual Release (Override)

**Script**: `scripts/release.ts`
**Use case**: Emergency hotfixes, explicit version jumps, or when you need to publish a specific version immediately without waiting for CI commit analysis.

> **Important**: After the automated CI migration, the manual script handles local versioning only. CI will **not** auto-publish after a manual release (because `analyze-commits.ts` finds 0 commits since the new tag). You must publish manually (see below).

### Usage

```bash
# Bump types
bun run release patch                          # 0.0.2 → 0.0.3
bun run release minor                          # 0.0.2 → 0.1.0
bun run release major                          # 0.0.2 → 1.0.0
bun run release 1.2.3                          # Explicit version

# Options
bun run release patch --dry-run                # Preview without changes
bun run release patch --message "Add OAuth"    # Custom CHANGELOG message

# After running the script (push history + tag):
git push origin main --follow-tags

# Manually publish (CI won't do it — tag already exists when CI runs):
npm publish --provenance --access public
gh release create "vX.Y.Z" --title "vX.Y.Z" --notes "Release X.Y.Z"
```

### What the Manual Script Does

| Step | Action                                             | Files Modified         |
| ---- | -------------------------------------------------- | ---------------------- |
| 1    | Run pre-publish checks (`prepublish-check`)        | —                      |
| 2    | Update `package.json` version                      | `package.json`         |
| 3    | Export schemas (`export:schema`, `export:openapi`) | `schemas/{version}/**` |
| 4    | Prepend CHANGELOG.md entry                         | `CHANGELOG.md`         |
| 5    | Git commit (`release: X.Y.Z`)                      | —                      |
| 6    | Git tag (`vX.Y.Z`)                                 | —                      |

### Validations (Before Making Changes)

| Check          | Error If                             |
| -------------- | ------------------------------------ |
| Branch         | Not on `main`                        |
| Working tree   | Uncommitted changes                  |
| Tag uniqueness | `vX.Y.Z` already exists              |
| Version order  | New version not greater than current |

## CI Workflow (release.yml)

### Permissions

```yaml
permissions:
  contents: write # Commit release, create GitHub Release
  id-token: write # OIDC for npm provenance
```

### Required Secrets

| Secret            | Purpose                                     |
| ----------------- | ------------------------------------------- |
| `NPM_TOKEN`       | npm registry authentication                 |
| `GH_PAT_WORKFLOW` | Push release commit + dispatch website sync |

**Note**: `bun publish` lacks `--provenance` support (oven-sh/bun#15601), so CI uses `npm publish` with Node.js for OIDC Trusted Publishing.

## CHANGELOG Format (Automated)

```markdown
## [X.Y.Z](https://github.com/sovrium/sovrium/compare/vOLD...vNEW) (YYYY-MM-DD)

### Features

- **scope**: description ([hash](commit-url))

### Bug Fixes

- description ([hash](commit-url))
```

## Developer Workflow

```bash
# 1. Work normally with conventional commits
git commit -m "feat(auth): add OAuth2 support"
git commit -m "fix(api): handle empty response"
git push origin main

# 2. CI automatically:
#    → Runs tests
#    → Analyzes commits → determines "minor" bump (feat: found)
#    → Bumps 0.0.2 → 0.1.0, exports schemas, updates CHANGELOG
#    → Commits "chore(release): 0.1.0 [skip ci]", tags v0.1.0
#    → Publishes to npm, creates GitHub Release

# 3. Manual override (emergencies only):
bun run release patch --message "Hotfix for critical bug"
git push origin main --follow-tags
# NOTE: CI will NOT publish — tag already exists when CI runs analyze-commits
# You must publish manually:
npm publish --provenance --access public
gh release create "v0.0.3" --title "v0.0.3" --notes "Hotfix for critical bug"
```

## Key Differences from semantic-release

| Aspect           | semantic-release                  | Sovrium (automated)                 | Sovrium (manual)                        |
| ---------------- | --------------------------------- | ----------------------------------- | --------------------------------------- |
| Version decision | Automated from commits            | Automated from commits              | Explicit (`patch`/`minor`/`major`)      |
| CHANGELOG        | Auto-generated commit hashes      | Auto-generated, grouped by type     | Manual summary message                  |
| CI commits back  | Yes (`[skip ci]`)                 | Yes (`chore(release): [skip ci]`)   | No — local commit only                  |
| Dependencies     | 4 plugins (~30MB)                 | Zero (Bun built-in APIs)            | Zero (Bun built-in APIs)                |
| Dry run          | `bunx semantic-release --dry-run` | `bun run analyze-commits --dry-run` | `bun run release patch --dry-run`       |
| Publishing       | semantic-release npm plugin       | `npm publish --provenance` in CI    | Manual: `npm publish --provenance` + gh |

## References

- npm Trusted Publishing: https://docs.npmjs.com/generating-provenance-statements
- Conventional Commits: https://www.conventionalcommits.org/
