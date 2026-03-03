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

The release workflow publishes the package to npm and creates a GitHub Release. It runs after the Test workflow completes successfully on commits created by `bun run release` (which start with `release:`).

### What the Release Workflow Does

1. **Trigger Check** - Only runs if Test workflow succeeded and commit starts with `release:`
2. **Checkout** - Fetches the repository code
3. **Setup Bun + Node.js** - Bun for dependencies, Node.js for `npm publish --provenance` (Bun lacks provenance support)
4. **Install Dependencies** - Runs `bun install --frozen-lockfile`
5. **Publish to npm** - `npm publish --provenance --access public` with OIDC Trusted Publishing
6. **Create GitHub Release** - `gh release create --generate-notes --verify-tag`
7. **Trigger Website Sync** - Dispatches `deploy-website.yml` (non-blocking)

### Permissions

- `contents: write` - Create GitHub Release
- `id-token: write` - OIDC for npm provenance

### Required GitHub Secrets

- `NPM_TOKEN` - npm registry authentication
- `GH_PAT_WORKFLOW` - Dispatch website deploy workflow

## Workflow Orchestration

The workflows run in sequence:

```
bun run release patch (local)
       ↓
git push origin main --follow-tags
       ↓
Test Workflow runs (tests, linting, type checking)
       ↓ (if successful + commit starts with "release:")
Release Workflow runs (npm publish + GitHub Release)
       ↓
Website sync triggered
```

### Why Sequential Execution

- **Quality Gate**: Tests must pass before publishing
- **Resource Efficiency**: Don't publish if tests fail
- **Safety**: Ensures only validated code gets released

## Workflow Triggers

### Test Workflow Triggers

- **Push to main** - Runs on every push to main branch
- **Pull requests to main** - Runs on PRs targeting main

### Release Workflow Triggers

- **After Test completes** - Only runs if Test workflow succeeds
- **Skip conditions**:
  - Test workflow failed
  - Commit message contains `[skip ci]`
  - Push is to branch other than main

## Using [skip ci] in Commits

Add `[skip ci]` to commit messages to skip both Test and release workflows:

```bash
git commit -m "docs: update README [skip ci]"
```

**Use cases**:

- Documentation-only changes
- README updates
- CHANGELOG edits (when manually edited)

**Important**: Only semantic-release should automatically use `[skip ci]` (in release commits). Don't use it for regular commits unless absolutely necessary.

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
# Dry-run release script (doesn't make changes)
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
3. Commit doesn't start with `release:` - Must be created by `bun run release`
4. Tag doesn't exist - Ensure `--follow-tags` was used when pushing

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
2. **Use conventional commits** - Required for semantic-release to work
3. **Don't force push to main** - Breaks workflow history
4. **Monitor workflow status** - Check Actions tab after pushing
5. **Fix Test failures immediately** - Don't merge PRs with failing Test
6. **Use `[skip ci]` sparingly** - Only for documentation changes
7. **Keep workflows updated** - Update Bun version, actions versions regularly

## Workflow Maintenance

### Updating Bun Version

When updating Bun version in project:

1. Update `bun-version` in both Test and Release workflows
2. Test locally with new Bun version first
3. Update in one PR to keep workflows in sync

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
