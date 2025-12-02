# GitHub Actions Workflows

## Overview

This project uses GitHub Actions for automated continuous integration and deployment pipelines. The workflows are configured to run tests and create releases automatically when code is pushed to the main branch.

## Workflow Files

All workflow files are located in `.github/workflows/`:

- `test.yml` - Continuous Integration (runs tests on push/PR)
- `release.yml` - Automated releases (runs after Test passes)

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
          bun-version: 1.3.0

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Lint code
        run: bun run lint

      - name: Check formatting
        run: bun run format:check

      - name: Type check
        run: bun run typecheck

      - name: Run unit tests
        run: bun test

      - name: Install Playwright browsers
        run: bunx playwright install --with-deps chromium

      - name: Run E2E tests
        run: bun test:e2e
```

### What the Test Workflow Does

1. **Checkout** - Fetches the repository code
2. **Setup Bun** - Installs Bun v1.3.3 runtime
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

The release workflow automates the entire release process using semantic-release. It only runs after the Test workflow completes successfully.

### Configuration

```yaml
name: Release

on:
  workflow_run:
    workflows: ['Test']
    types: [completed]
    branches: [main]

permissions:
  contents: write
  issues: write
  pull-requests: write
  id-token: write

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    if: |
      github.event.workflow_run.conclusion == 'success' &&
      !contains(github.event.workflow_run.head_commit.message, '[skip ci]')

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          persist-credentials: false

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 'lts/*'

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: bunx semantic-release
```

### What the Release Workflow Does

1. **Trigger Check** - Only runs if Test workflow succeeded and commit doesn't contain `[skip ci]`
2. **Checkout** - Fetches full git history for version analysis
3. **Setup Bun** - Installs Bun v1.3.3 runtime
4. **Setup Node.js** - Installs Node.js LTS (semantic-release requires Node.js)
5. **Install Dependencies** - Runs `bun install --frozen-lockfile`
6. **Release** - Runs `bunx semantic-release` to create automated release

### Permissions

The release workflow requires these permissions:

- `contents: write` - Commit version bumps and changelog
- `issues: write` - Close issues referenced in commits
- `pull-requests: write` - Comment on PRs
- `id-token: write` - OpenID Connect token

### Required GitHub Secrets

- `GITHUB_TOKEN` - Automatically provided by GitHub Actions
- `NPM_TOKEN` - Must be configured manually for npm publishing

## Workflow Orchestration

The workflows run in sequence:

```
Push to main branch
       ↓
Test Workflow runs (tests, linting, type checking)
       ↓ (if successful)
Release Workflow runs (semantic-release)
       ↓
Automated release created
```

### Why Sequential Execution

- **Quality Gate**: Tests must pass before releasing
- **Resource Efficiency**: Don't run release if tests fail
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
bun test
bun test:e2e
```

### Test Release Process Locally

```bash
# Dry-run semantic-release (doesn't publish)
bunx semantic-release --dry-run
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
3. No `feat:` or `fix:` commits - semantic-release only releases for these
4. Already released - No new commits since last release

### Release Workflow Fails

**Check logs**:

1. Go to Actions tab
2. Click on failed release workflow
3. View semantic-release step output

**Common issues**:

- NPM_TOKEN not configured - Add secret in repository settings
- Commit message format wrong - Use conventional commits
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
