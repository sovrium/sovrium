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

### Configuration

```yaml
name: Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version-file: package.json # Uses version from packageManager field

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Lint code
        run: bun run lint

      - name: Check formatting
        run: bun run format:check

      - name: Type check
        run: bun run typecheck

      - name: Run unit tests
        run: bun test .test.ts .test.tsx

      - name: Install Playwright browsers
        run: bunx playwright install --with-deps chromium

      - name: Run E2E tests
        run: bun test:e2e
```

### What the Test Workflow Does

1. **Checkout** - Fetches the repository code
2. **Setup Bun** - Installs Bun using version from package.json
3. **Install Dependencies** - Runs `bun install --frozen-lockfile`
4. **Lint** - Checks code quality with ESLint
5. **Format Check** - Verifies code formatting with Prettier
6. **Type Check** - Validates TypeScript types with tsc
7. **Unit Tests** - Runs Bun unit tests
8. **E2E Tests** - Installs Playwright browsers and runs E2E tests

### Fail-Fast Strategy

Tests run sequentially and fail fast:

- If linting fails, subsequent steps don't run
- If type checking fails, tests don't run
- If unit tests fail, E2E tests don't run

This saves Test time and resources by stopping at the first failure.

## Release Workflow (release.yml)

### Purpose

The release workflow **automatically** analyzes conventional commits, determines the version bump, publishes to npm, and creates a GitHub Release. It runs after the Test workflow completes successfully on main.

### How It Works

1. **Trigger Check** - Only runs if Test succeeded, not `[skip ci]`, not `chore(release):`
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

The workflows run in sequence:

```
git push origin main (conventional commits)
       ↓
Test Workflow runs (quality checks + tests)
       ↓ (if successful)
Release Workflow runs:
  → Analyze commits (feat: → minor, fix: → patch, etc.)
  → If releasable: bump version, export schemas, update CHANGELOG
  → Commit "chore(release): X.Y.Z [skip ci]" + tag
  → npm publish + GitHub Release
       ↓
Website sync triggered
```

### Manual Override

For emergencies, the manual release script handles local versioning:

```
bun run release patch --message "Hotfix"
       ↓
git push origin main --follow-tags
       ↓
Test → Release workflow runs but exits early:
  analyze-commits.ts finds 0 commits since the new tag → bump = null → skip
       ↓
You must publish manually (CI won't):
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

- **After Test completes** - Only runs if Test workflow succeeds on main
- **Skip conditions**:
  - Test workflow failed
  - Commit message contains `[skip ci]`
  - Commit message starts with `chore(release):`
  - No releasable commits since last tag (`feat:`, `fix:`, `perf:`, or breaking changes)

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

### Test Test Steps Locally

```bash
# Run the same checks that Test runs
bun run lint
bun run format:check
bun run typecheck
bun test .test.ts .test.tsx    # Unit tests (pattern-filtered)
bun test:e2e                   # E2E tests (Playwright)
```

### Test Release Process Locally

```bash
# Preview what CI would release (simulates automated commit analysis)
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
