# GitHub Actions Workflows

## Overview

This project uses GitHub Actions for automated continuous integration and deployment pipelines. The workflows are configured to run tests and create releases automatically when code is pushed to the main branch.

## Workflow Files

All workflow files are located in `.github/workflows/`:

### Core Workflows

- `test.yml` - Continuous Integration (runs tests on push/PR, extended with TDD handling)
- `release.yml` - Automated releases (runs after Test passes)

### TDD Automation Workflows

- `tdd-pr-creator.yml` - Scans for `.fixme()` specs, creates TDD PRs
- `tdd-claude-code.yml` - Runs Claude Code to fix failing specs
- `tdd-monitor.yml` - Detects stale TDD PRs
- `tdd-branch-sync.yml` - Syncs TDD branches with main
- `tdd-cleanup.yml` - Cancels Claude Code runs when TDD PRs reach terminal state

### Workflow Linting

- GitHub Actions workflows are linted with `actionlint` via `bun run lint:workflows`

> **TDD Automation**: For comprehensive documentation on the TDD automation pipeline, see `@docs/development/tdd-automation-pipeline.md`

## Test Workflow (test.yml)

### Purpose

The Test workflow runs quality checks and tests on every push to main and on pull requests targeting main. This ensures code quality before it gets merged or released.

### What the Test Workflow Does

The actual `test.yml` is significantly more complex than a simple sequential pipeline. Key jobs:

1. **detect-change-type** (PR only) - Detects TDD automation PRs and test-only changes for reduced CI scope
2. **quality** (push/PR) - Lint → format check → typecheck → unit tests
3. **e2e** (push/PR) - Sharded Playwright E2E tests (8 shards × 2 workers) with retry logic
4. **tdd-handling** - Auto-merge on success for TDD PRs, dispatch Claude Code on failure

**Key configuration**:

- Bun version from `packageManager` field in `package.json` (via `bun-version-file: package.json`)
- E2E sharding: 8 shards × 2 workers = 16 effective parallel workers
- Concurrency: Cancel in-progress for PRs (fast feedback), keep running for main pushes
- Permissions: `contents: read`, `actions: write`, `issues: write`, `pull-requests: write`

**Quality steps** (sequential, fail-fast):

```
bun run lint          # ESLint
bun run format:check  # Prettier
bun run typecheck     # tsc --noEmit
bun test .test.ts .test.tsx  # Bun unit tests
```

> For the full workflow YAML, see `.github/workflows/test.yml`

## Release Workflow (release.yml)

### Purpose

The release workflow analyzes conventional commits since the last tag, determines the version bump, publishes to npm, and creates a GitHub Release. It runs after the Test workflow completes successfully on main — but **only** when the HEAD commit message starts with `release:`.

### Trigger Condition (Critical)

The Release workflow only runs when **both** conditions are true:

1. The Test workflow completed with `success` on the `main` branch
2. The HEAD commit message starts with `release:` (e.g., `release: publish`)

This is an explicit opt-in gate. Pushing `feat:` or `fix:` commits alone does **not** trigger a release.

### How It Works

1. **Trigger Check** - Test succeeded AND HEAD starts with `release:`
2. **Checkout** - Fetches full git history (for commit analysis)
3. **Setup Bun + Node.js** - Bun for scripts, Node.js for `npm publish --provenance`
4. **Analyze Commits** - `scripts/analyze-commits.ts` parses git log since last tag
5. **Early Exit** - If no releasable commits (`feat:`, `fix:`, `perf:`), skips release
6. **Pre-publish Check** - Validates package metadata
7. **Bump Version** - Updates `package.json` with new version
8. **Export Schemas** - Generates versioned JSON Schema and OpenAPI files
9. **Update CHANGELOG** - Prepends generated changelog entry
10. **Commit & Tag** - `chore(release): X.Y.Z [skip ci]` + `vX.Y.Z` tag
11. **Push** - Rebase-then-push (handles race conditions)
12. **Publish to npm** - `npm publish --provenance --access public`
13. **Create GitHub Release** - With generated changelog as body
14. **Trigger Website Sync** - Dispatches `deploy-website.yml` (non-blocking)

### Commit Classification

| Prefix                            | Bump  | Changelog Section                        |
| --------------------------------- | ----- | ---------------------------------------- |
| `feat:`                           | minor | Features                                 |
| `fix:`                            | patch | Bug Fixes                                |
| `perf:`                           | patch | Performance Improvements                 |
| `!` or `BREAKING CHANGE:`         | major | BREAKING CHANGES                         |
| `chore:`, `docs:`, `style:`, etc. | none  | (included only if mixed with releasable) |

### Infinite Loop Prevention

- Release commit uses `chore(release): X.Y.Z [skip ci]`
- `[skip ci]` prevents test.yml from triggering
- `chore(release):` prefix explicitly excluded in workflow condition

### Concurrency

- `concurrency: group: release` prevents parallel release attempts
- Rebase-before-push handles race conditions with other commits

### Permissions

- `contents: write` - Commit release, create GitHub Release
- `id-token: write` - OIDC for npm provenance

### Required GitHub Secrets

- `NPM_TOKEN` - npm registry authentication
- `GH_PAT_WORKFLOW` - Push release commit + dispatch website deploy

## Workflow Orchestration

The workflows run in sequence. A release requires an explicit `release:` commit as the trigger.

### Primary Path (Automated Release)

```
1. Push conventional commits (these do NOT trigger release alone)
   git commit -m "feat(auth): add OAuth2"
   git push origin main
         ↓ Test runs (quality + tests)

2. When ready to release, push a "release:" trigger commit
   git commit --allow-empty -m "release: publish"
   git push origin main
         ↓ Test runs (quality + tests)
         ↓ (HEAD starts with "release:" → Release workflow triggers)
   Release Workflow:
     → Analyze commits since last tag (feat: → minor, fix: → patch, etc.)
     → If no releasable commits → exit early (no publish)
     → Bump version, export schemas, update CHANGELOG
     → Commit "chore(release): X.Y.Z [skip ci]" + tag vX.Y.Z
     → npm publish + GitHub Release
         ↓
   Website sync triggered (non-blocking)
```

### Manual Override Path

```
bun run release patch --message "Hotfix"
  (creates local commit "release: X.Y.Z" + tag vX.Y.Z)
       ↓
git push origin main --follow-tags
       ↓
Test → Release workflow triggers (HEAD is "release: X.Y.Z")
  → analyze-commits finds 0 commits since new tag → exits early (no publish)
       ↓
You must publish manually:
  npm publish --provenance --access public
  gh release create "vX.Y.Z" --title "vX.Y.Z" --notes "..."
```

See `@docs/infrastructure/release/release-script.md` for the complete manual release process.

### Why Sequential Execution

- **Quality Gate**: Tests must pass before publishing
- **Resource Efficiency**: Don't publish if tests fail
- **Safety**: Ensures only validated code gets released
- **Automation**: No manual intervention for routine releases

## Workflow Triggers

### Test Workflow Triggers

- **Push to main** - Runs on every push to main branch
- **Pull requests to main** - Runs on PRs targeting main

### Release Workflow Triggers

- **Required condition**: Test workflow succeeded on main AND HEAD commit starts with `release:`
- **Skip conditions** (even if HEAD starts with `release:`):
  - Test workflow failed
  - No releasable commits since last tag (`feat:`, `fix:`, `perf:`, or breaking changes)
- **Anti-loop guards** (prevent infinite CI loops):
  - Release commit uses `chore(release): X.Y.Z [skip ci]` — `[skip ci]` prevents test.yml from re-triggering
  - `chore(release):` prefix does not start with `release:` → Release workflow condition fails even without `[skip ci]`

## Using [skip ci] in Commits

Add `[skip ci]` to commit messages to skip both Test and release workflows:

```bash
git commit -m "docs: update README [skip ci]"
```

**Use cases**:

- Documentation-only changes
- README updates
- CHANGELOG edits (when manually edited)

**Important**: Only the automated CI release workflow (`chore(release): X.Y.Z [skip ci]`) should automatically use `[skip ci]`. Don't use it for regular commits unless absolutely necessary.

## Local Workflow Testing

### Replicate Test Steps Locally

```bash
# Run the quality checks that CI runs (equivalent to the quality job)
bun run quality           # Full quality pipeline (recommended)

# Or run individual steps:
bun run lint
bun run format:check
bun run typecheck
bun test .test.ts .test.tsx    # Unit tests (pattern-filtered)
bun test:e2e                   # E2E tests (all — use test:e2e:regression for agents)
```

### Preview Release Locally

```bash
# Preview what CI would release (simulates commit analysis from last tag)
bun run analyze-commits --dry-run

# Preview specific tag range
bun run analyze-commits --dry-run --from v0.0.1

# Dry-run manual override script (doesn't make changes)
bun run release patch --dry-run
```

## Monitoring Workflows

### View Workflow Status

1. Go to repository on GitHub
2. Click "Actions" tab
3. View workflow runs and their status

### Workflow Badges

Add workflow status badges to README:

```markdown
![Test](https://github.com/sovrium/sovrium/workflows/Test/badge.svg)
![Release](https://github.com/sovrium/sovrium/workflows/Release/badge.svg)
```

## Troubleshooting

### Test Workflow Fails

**Check which step failed**:

1. Go to Actions tab in GitHub
2. Click on failed workflow run
3. Expand failed step to see error

**Common failures**:

- Lint errors - Run `bun run lint` locally and fix issues
- Format errors - Run `bun run format` locally
- Type errors - Run `bun run typecheck` locally and fix types
- Test failures - Run `bun test` or `bun test:e2e` locally and fix

### Release Workflow Doesn't Run

**Possible causes**:

1. Test workflow failed - Check Test workflow status
2. Commit contains `[skip ci]` - Remove from commit message
3. Commit starts with `chore(release):` - This is a release commit; expected to be skipped
4. No releasable commits - Only `feat:`, `fix:`, `perf:`, or breaking changes trigger a release

### Release Workflow Fails

**Check logs**:

1. Go to Actions tab
2. Click on failed release workflow
3. View npm publish or GitHub Release step output

**Common issues**:

- NPM_TOKEN not configured - Add secret in repository settings
- Tag not pushed - Re-push with `git push origin main --follow-tags`
- Package name already taken - Change package name in package.json

## Best Practices

1. **Always run tests locally first** - Don't rely on Test to catch basic errors
2. **Use conventional commits** - Required for automated release detection to work
3. **Don't force push to main** - Breaks workflow history
4. **Monitor workflow status** - Check Actions tab after pushing
5. **Fix Test failures immediately** - Don't merge PRs with failing Test
6. **Use `[skip ci]` sparingly** - Only for documentation changes
7. **Keep workflows updated** - Update Bun version, actions versions regularly

## Workflow Maintenance

### Updating Bun Version

When updating Bun version in project:

1. Update `packageManager` field in `package.json` (both workflows use `bun-version-file: package.json`)
2. Test locally with new Bun version first
3. No workflow file changes needed — both workflows auto-resolve version from `package.json`

### Updating GitHub Actions

Check for action updates regularly:

```yaml
# Update actions/checkout from v3 to v4
uses: actions/checkout@v4

# Update oven-sh/setup-bun to latest
uses: oven-sh/setup-bun@v2
```

## References

- GitHub Actions documentation: https://docs.github.com/en/actions
- workflow_run trigger: https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#workflow_run
- Bun GitHub Action: https://github.com/oven-sh/setup-bun
