# Semantic Release - Automated Version Management

## Overview

**Version**: 24.2.0
**Purpose**: Fully automated version management, changelog generation, and npm package publishing based on conventional commits

Semantic-release eliminates manual version bumping, changelog writing, and release creation by analyzing commit messages to determine the next version number and automating the entire release process.

## What Semantic Release Provides

1. **Automated Versioning** - Determines next version (major.minor.patch) from commit messages
2. **Changelog Generation** - Auto-generates CHANGELOG.md from commit history
3. **npm Publishing** - Publishes package "sovrium" to npm registry automatically
4. **GitHub Releases** - Creates GitHub releases with release notes
5. **Git Commits** - Commits version bumps and changelog back to repository
6. **Version Validation** - Ensures semantic versioning (semver) compliance

## Configuration

- **Configuration File**: `.releaserc.json`
- **Trigger**: Push to `main` branch (via GitHub Actions workflow)
- **Package Name**: "sovrium" (published to npm)

## Semantic Versioning Rules

Semantic-release analyzes commit messages following the Conventional Commits format to determine version bumps:

| Commit Type                                                       | Example                           | Version Change | Example Version |
| ----------------------------------------------------------------- | --------------------------------- | -------------- | --------------- |
| `fix:`                                                            | `fix(api): resolve timeout issue` | Patch (0.0.X)  | 0.1.0 → 0.1.1   |
| `feat:`                                                           | `feat(auth): add OAuth support`   | Minor (0.X.0)  | 0.1.0 → 0.2.0   |
| `feat!:` or `BREAKING CHANGE:`                                    | `feat!: redesign API structure`   | Major (X.0.0)  | 0.1.0 → 1.0.0   |
| `docs:`, `style:`, `refactor:`, `perf:`, `test:`, `chore:`, `ci:` | `docs: update README`             | None           | 0.1.0 → 0.1.0   |

## Conventional Commits Format

All commits to `main` branch MUST follow the Conventional Commits specification:

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Commit Types

- `feat:` - New feature (triggers minor version bump)
- `fix:` - Bug fix (triggers patch version bump)
- `docs:` - Documentation changes (no version bump)
- `style:` - Code style changes (formatting, no logic change, no version bump)
- `refactor:` - Code refactoring (no new features or bug fixes, no version bump)
- `perf:` - Performance improvements (no version bump)
- `test:` - Adding or updating tests (no version bump)
- `chore:` - Maintenance tasks, dependencies (no version bump)
- `ci:` - CI/CD configuration changes (no version bump)

### Breaking Changes

- Add `!` after type: `feat!:` or `fix!:`
- OR include `BREAKING CHANGE:` in footer
- Triggers major version bump (X.0.0)

### Commit Examples

```bash
# Patch release (0.1.0 → 0.1.1)
git commit -m "fix(database): resolve connection pool timeout"

# Minor release (0.1.0 → 0.2.0)
git commit -m "feat(api): add user authentication endpoint"

# Major release (0.1.0 → 1.0.0)
git commit -m "feat!: redesign API structure

BREAKING CHANGE: API endpoints now use /v2/ prefix"

# No release (documentation)
git commit -m "docs: update installation instructions"

# Multi-line with scope
git commit -m "feat(auth): implement OAuth 2.0 flow

- Add OAuth provider configuration
- Implement token refresh mechanism
- Add session management"
```

## Semantic Release Plugin Chain

The release process executes these plugins in sequence (defined in `.releaserc.json`):

### 1. @semantic-release/commit-analyzer

- Analyzes commit messages since last release
- Determines version bump type (major/minor/patch/none)
- Uses Conventional Commits specification

### 2. @semantic-release/release-notes-generator

- Generates release notes from commit messages
- Groups commits by type (Features, Bug Fixes, etc.)
- Formats notes for CHANGELOG.md and GitHub release

### 3. @semantic-release/changelog

- Updates `CHANGELOG.md` with generated release notes
- Prepends new version section to existing changelog
- Maintains chronological order (newest first)

### 4. @semantic-release/npm

- Publishes package "sovrium" to npm registry
- Requires `NPM_TOKEN` secret configured in GitHub
- Updates package.json version (committed later by git plugin)

### 5. @semantic-release/git

- Commits updated files back to repository:
  - `CHANGELOG.md` (updated changelog)
  - `package.json` (bumped version)
- Commit message: `chore(release): X.X.X [skip ci]`
- `[skip ci]` prevents infinite release loop

### 6. @semantic-release/github

- Creates GitHub release with generated notes
- Tags repository with version (e.g., `v1.0.0`)
- Attaches release assets if configured

## Release Workflow

The automated release process runs after the CI workflow completes successfully (see `docs/infrastructure/cicd/workflows.md` for details).

### Security Protection

The release workflow includes a security check to prevent accidental releases:

```yaml
if: |
  github.event.workflow_run.conclusion == 'success' &&
  !contains(github.event.workflow_run.head_commit.message, '[skip ci]') &&
  startsWith(github.event.workflow_run.head_commit.message, 'release:')
```

This ensures releases ONLY occur when you explicitly commit with `release:` prefix.

### Required GitHub Secrets

- `GITHUB_TOKEN` - Automatically provided by GitHub Actions
- `NPM_TOKEN` - Must be configured manually for npm publishing

### Workflow Permissions

```yaml
permissions:
  contents: write # Commit version bumps and changelog
  issues: write # Close issues referenced in commits
  pull-requests: write # Comment on PRs
  id-token: write # OpenID Connect token
```

## Release Process Flow

```
Developer commits with "release: publish"
         ↓
Push to main branch
         ↓
Test workflow runs (tests must pass)
         ↓ (if successful)
Release workflow checks commit message
         ↓ (if starts with "release:")
Analyze commits for version bump
         ↓
Generate release notes
         ↓
Update CHANGELOG.md
         ↓
Publish to npm as "sovrium"
         ↓
Commit changes (with [skip ci])
         ↓
Create GitHub release with tag
         ↓
Release complete
```

## Configuration Reference (.releaserc.json)

```json
{
  "branches": ["main"],
  "repositoryUrl": "https://github.com/sovrium/sovrium",
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "@semantic-release/changelog",
      {
        "changelogFile": "CHANGELOG.md"
      }
    ],
    [
      "@semantic-release/npm",
      {
        "npmPublish": true,
        "pkgRoot": "."
      }
    ],
    [
      "@semantic-release/git",
      {
        "assets": ["CHANGELOG.md", "package.json"],
        "message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
      }
    ],
    "@semantic-release/github"
  ]
}
```

## Running Releases

### Automated Release (Recommended)

```bash
# Make your changes with regular commits (feat:, fix:, etc.)
git add .
git commit -m "feat(api): add new endpoint"
git push origin main
# Test workflow runs (no release triggered)

# When ready to publish, create explicit release commit
git commit -m "release: publish" --allow-empty
git push origin main
# Test workflow runs, then release workflow triggers
# Analyzes ALL commits since last release (feat:, fix:, etc.)
# Determines version bump and publishes to npm
```

### Manual Release (Local Testing Only)

```bash
# Test release process locally (dry-run)
bunx semantic-release --dry-run

# Manual release (not recommended - use CI/CD instead)
bunx semantic-release
# Requires NPM_TOKEN environment variable
```

## Development Workflow Integration

**IMPORTANT**: Conventional commits are REQUIRED for proper versioning.

### Before Committing

1. Determine commit type (feat, fix, docs, etc.)
2. Write descriptive subject (what changed, not how)
3. Add scope if applicable (e.g., `feat(auth):`)
4. Include breaking change marker if needed (`feat!:`)

### Commit Message Guidelines

- **Subject**: Imperative mood ("add feature" not "added feature")
- **Length**: Subject ≤ 72 characters for readability
- **Clarity**: Describe what changed and why, not how
- **Scope**: Optional but recommended (component/module name)
- **Body**: Add details for complex changes (optional)
- **Footer**: Reference issues, breaking changes (optional)

### Example Workflow

```bash
# Make code changes
vim src/api/auth.ts

# Stage changes
git add src/api/auth.ts

# Commit with conventional format
git commit -m "feat(auth): implement JWT token refresh

- Add refresh token endpoint
- Implement token rotation
- Add expiration validation"

# Push to main (runs tests, but does NOT trigger release)
git push origin main

# Continue working, making more commits...
# When ready to publish all changes:
git commit -m "release: publish" --allow-empty
git push origin main
# Now release workflow triggers and publishes
```

## Version Bump Decision Tree

```
Does commit include breaking change?
├─ Yes → Major version bump (X.0.0)
└─ No
   ├─ Is commit type "feat:"? → Minor version bump (0.X.0)
   ├─ Is commit type "fix:"? → Patch version bump (0.0.X)
   └─ Other types → No version bump
```

## When Releases Occur

Releases happen ONLY when:

1. Commit message starts with `release:` (e.g., `release: publish`)
2. Commits are pushed to `main` branch
3. CI workflow completes successfully
4. Commit message does not contain `[skip ci]`
5. semantic-release analyzes all commits since last release to determine version bump

## When Releases DO NOT Occur

No release when:

- Commit message does NOT start with `release:` (security protection)
- CI workflow fails (lint, typecheck, Effect diagnostics, or unit tests)
- Commit contains `[skip ci]`
- Push is to branch other than `main`

## Files Created/Modified by Semantic Release

### Created

- `CHANGELOG.md` - Auto-generated changelog (updated on each release)

### Modified on Each Release

- `package.json` - Version number updated
- `CHANGELOG.md` - New release section prepended

### Committed by semantic-release

- Commit message: `chore(release): X.X.X [skip ci]`
- Includes updated files listed above

## Integration with Other Tools

| Tool               | Integration Point       | Notes                                      |
| ------------------ | ----------------------- | ------------------------------------------ |
| **ESLint**         | Pre-release validation  | Linting must pass before release           |
| **TypeScript**     | Pre-release validation  | Type checking must pass before release     |
| **Bun Test**       | Pre-release validation  | Unit tests must pass before release        |
| **Playwright**     | Not in release workflow | E2E tests run separately in CI             |
| **Prettier**       | No integration          | Formatting checked in separate CI workflow |
| **GitHub Actions** | Release orchestration   | Workflow triggers semantic-release         |
| **npm Registry**   | Package publishing      | "sovrium" package published on release     |

## Semantic Release vs Manual Releases

| Aspect                    | Semantic Release            | Manual Releases      |
| ------------------------- | --------------------------- | -------------------- |
| **Version Determination** | Automated from commits      | Manual decision      |
| **Changelog**             | Auto-generated from commits | Manually written     |
| **Publishing**            | Automated to npm            | Manual `npm publish` |
| **GitHub Release**        | Auto-created with notes     | Manually created     |
| **License Updates**       | Automated via script        | Manual edits         |
| **Git Tags**              | Automatically created       | Manual `git tag`     |
| **Consistency**           | Always follows semver       | Prone to human error |
| **Speed**                 | Fast (seconds after push)   | Slow (manual steps)  |

## Troubleshooting

### No Release Created Despite feat/fix Commits

- Check commit message format (must match conventional commits)
- Verify CI workflow passed
- Check workflow logs in GitHub Actions
- Ensure `[skip ci]` not in commit message

### npm Publish Failed

- Verify `NPM_TOKEN` secret is configured in repository settings
- Check npm token has publish permissions
- Ensure package name "sovrium" is available or owned by you
- Review npm publish logs in workflow

### Workflow Skipped

- Check if commit message contains `[skip ci]`
- Verify workflow file exists at `.github/workflows/release.yml`
- Ensure push was to `main` branch

### Version Conflict

- semantic-release manages versions automatically
- DO NOT manually edit version in package.json
- Let semantic-release determine and set version

## Best Practices

1. **Always use conventional commits** - Required for proper versioning
2. **Never skip CI on manual commits** - Only semantic-release should use `[skip ci]`
3. **Test before pushing to main** - Workflow runs all tests, but catch issues early
4. **Use descriptive scopes** - Helps organize changelog (e.g., `feat(api):`, `fix(db):`)
5. **Document breaking changes** - Always explain breaking changes in commit body
6. **Let automation handle versions** - Never manually bump version in package.json
7. **Review generated changelogs** - Verify release notes accurately reflect changes
8. **Squash feature branches** - Cleaner commit history for changelog generation

## References

- semantic-release documentation: https://semantic-release.gitbook.io/
- Conventional Commits specification: https://www.conventionalcommits.org/
- Plugin documentation: https://semantic-release.gitbook.io/semantic-release/extending/plugins-list
