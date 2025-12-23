# Smart E2E Detection Strategy

## Overview

Sovrium's `bun run quality` command includes **smart E2E detection** to prevent timeouts during development and TDD automation. Instead of running all E2E tests on every change, the system intelligently detects which specs are affected by your changes and runs only those tests.

## Problem Statement

### Without Smart Detection

**Traditional Approach**:

```bash
bun run quality
  → ESLint ✓
  → TypeScript ✓
  → Unit Tests ✓
  → E2E Tests (ALL 500+ specs) ❌ Timeout after 90 minutes
```

**Issues**:

- TDD automation workflows timeout (90-minute limit)
- Developer feedback loop is slow (10+ minutes for full E2E suite)
- Wastes CI resources running irrelevant tests
- Documentation-only changes trigger full E2E suite

### With Smart Detection

**Smart Approach**:

```bash
bun run quality
  → ESLint ✓
  → TypeScript ✓
  → Unit Tests ✓
  → Analyzing changed files... (3 files, mode: local)
  → E2E will run: 2 specs (@regression only)
     - specs/app/version.spec.ts
     - specs/api/auth/sign-up/email/post.spec.ts
  → E2E Regression Tests ✓ (2 min instead of 90 min)
```

**Benefits**:

- Fast feedback (minutes instead of hours)
- TDD automation completes within time limits
- Relevant tests only (changed functionality)
- Documentation changes skip E2E entirely

## Architecture

### Detection Modes

The system operates in two modes based on environment:

| Environment   | Mode    | Detection Strategy                                  | Use Case                |
| ------------- | ------- | --------------------------------------------------- | ----------------------- |
| **Local Dev** | `local` | Uncommitted changes (staged + unstaged + untracked) | Developer workflow      |
| **CI/PR**     | `ci`    | Diff from merge-base with `main`                    | Pull request validation |

**Auto-Detection**:

```typescript
// File: scripts/lib/effect/git-service.ts
export const getMode = (): Effect.Effect<'local' | 'ci', never, CommandService> =>
  Effect.gen(function* () {
    const cmd = yield* CommandService

    // Check if running in GitHub Actions
    if (process.env.GITHUB_ACTIONS === 'true') {
      return 'ci'
    }

    // Check if we're in a CI environment
    const ciEnvVars = ['CI', 'CONTINUOUS_INTEGRATION', 'BUILD_NUMBER']
    if (ciEnvVars.some((v) => process.env[v])) {
      return 'ci'
    }

    return 'local'
  })
```

### File Change Detection

#### Local Mode (Uncommitted Changes)

```bash
# Git command used
git diff --name-only HEAD  # Staged + unstaged
git diff --name-only --cached  # Staged only
git ls-files --others --exclude-standard  # Untracked files
```

**Example**:

```
src/domain/models/app/version.ts (modified, unstaged)
src/application/use-cases/GetVersion.ts (modified, staged)
specs/app/version.spec.ts (new file, untracked)
```

#### CI Mode (Branch Diff)

```bash
# Git commands used
git merge-base origin/main HEAD  # Find common ancestor
git diff --name-only <merge-base> HEAD  # All changes since branch diverged
```

**Example** (feature branch with 5 commits):

```
src/infrastructure/auth/better-auth/auth.ts
src/presentation/api/routes/auth/sign-up.ts
specs/api/auth/sign-up/email/post.spec.ts
docs/architecture/patterns/auth-flow.md
```

### Mapping Rules

The system maps changed source files to related E2E specs using predefined rules.

**File**: `scripts/lib/effect/spec-mapping-service.ts`

```typescript
const SPEC_MAPPINGS: readonly SpecMapping[] = [
  // 1. Direct spec file changes (highest priority)
  {
    sourcePattern: /^specs\/.*\.spec\.ts$/,
    getSpecs: (file) => [file], // Run the spec itself
  },

  // 2. Domain model changes → Related specs
  {
    sourcePattern: /^src\/domain\/models\/app\/version\.ts$/,
    getSpecs: () => ['specs/app/version.spec.ts'],
  },

  // 3. Infrastructure auth changes → All auth specs
  {
    sourcePattern: /^src\/infrastructure\/auth\/.*$/,
    getSpecs: async (fs) => {
      return await fs.glob('specs/api/auth/**/*.spec.ts')
    },
  },

  // 4. Database schema changes → Migration and table specs
  {
    sourcePattern: /^src\/infrastructure\/database\/schema\.ts$/,
    getSpecs: async (fs) => {
      const migrationSpecs = await fs.glob('specs/migration/**/*.spec.ts')
      const tableSpecs = await fs.glob('specs/api/tables/**/*.spec.ts')
      return [...migrationSpecs, ...tableSpecs]
    },
  },

  // 5. Route setup changes → Related API specs
  {
    sourcePattern: /^src\/infrastructure\/server\/route-setup\/auth-routes\.ts$/,
    getSpecs: async (fs) => {
      return await fs.glob('specs/api/auth/**/*.spec.ts')
    },
  },
]
```

**Mapping Priority**:

1. **Direct spec changes** - Always run the spec itself
2. **Domain models** - Map to feature specs (e.g., `version.ts` → `version.spec.ts`)
3. **Infrastructure layers** - Map to integration specs (e.g., auth code → all auth specs)
4. **Database schema** - Map to migration and table specs
5. **Route setup** - Map to endpoint specs

### Spec Filtering (@regression Only)

After mapping, the system filters to `@regression` specs only for faster feedback.

**Why @regression and not @spec?**

- `@spec` tests are exhaustive (100+ assertions per feature)
- `@regression` tests are optimized (5-10 critical paths)
- Smart detection runs frequently (every `bun run quality`)
- Full `@spec` suite runs on CI merge to main

**Filter Logic**:

```typescript
const regressionSpecs = specs.filter(
  (s) =>
    s.includes('/app/') || // App specs (version, theme, tables)
    s.includes('/api/') || // API endpoint specs
    s.includes('/static/') // Static generation specs
)
```

**Exclusions**:

- `specs/migration/**/*.spec.ts` - Migration specs (not tagged)
- Development-only specs without tags

## Implementation Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User runs: bun run quality                               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Detect mode: local or ci                                 │
│    - GitHub Actions → ci                                     │
│    - CI env vars → ci                                        │
│    - Otherwise → local                                       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Get changed files                                         │
│    Local: git diff HEAD + untracked                         │
│    CI: git diff <merge-base> HEAD                           │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Map files to specs (using SPEC_MAPPINGS)                 │
│    - Direct spec changes → [spec]                           │
│    - version.ts → [version.spec.ts]                         │
│    - auth/** → [all auth specs]                             │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Filter to @regression specs only                         │
│    - Include: /app/, /api/, /static/                        │
│    - Exclude: /migration/ (not tagged)                      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Decision: run E2E or skip                                │
│    - If specs.length > 0 → Run E2E                          │
│    - If specs.length === 0 → Skip E2E                       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼ (if specs > 0)
┌─────────────────────────────────────────────────────────────┐
│ 7. Run E2E tests with Playwright                            │
│    bunx playwright test --grep @regression [spec1] [spec2]  │
└─────────────────────────────────────────────────────────────┘
```

## Usage Examples

### Example 1: Domain Model Change

**Changed Files**:

```
src/domain/models/app/version.ts (modified)
```

**Detection Output**:

```
→ Analyzing changed files... (1 file, mode: local)
→ E2E will run: 1 spec (@regression only)
   - specs/app/version.spec.ts
→ E2E Regression Tests... ✓ (1 spec, 30s)
```

**Command Executed**:

```bash
bunx playwright test --grep @regression specs/app/version.spec.ts
```

### Example 2: Auth Infrastructure Change

**Changed Files**:

```
src/infrastructure/auth/better-auth/auth.ts (modified)
src/infrastructure/auth/better-auth/schema.ts (modified)
```

**Detection Output**:

```
→ Analyzing changed files... (2 files, mode: local)
→ E2E will run: 15 specs (@regression only)
   - specs/api/auth/sign-up/email/post.spec.ts
   - specs/api/auth/sign-in/email/post.spec.ts
   - specs/api/auth/sign-out/post.spec.ts
   - specs/api/auth/forgot-password/post.spec.ts
   - specs/api/auth/reset-password/post.spec.ts
   ... and 10 more
→ E2E Regression Tests... ✓ (15 specs, 5 min)
```

**Command Executed**:

```bash
bunx playwright test --grep @regression \
  specs/api/auth/sign-up/email/post.spec.ts \
  specs/api/auth/sign-in/email/post.spec.ts \
  # ... (15 specs total)
```

### Example 3: Documentation Change

**Changed Files**:

```
docs/architecture/patterns/auth-flow.md (modified)
README.md (modified)
```

**Detection Output**:

```
→ Analyzing changed files... (2 files, mode: local)
⏭ Skipping E2E: no modified specs or related source files
─────────────────────────────────────────────
✅ All quality checks passed! (18896ms)
```

**No E2E tests run** (documentation-only change).

### Example 4: Direct Spec Change

**Changed Files**:

```
specs/app/version.spec.ts (modified)
```

**Detection Output**:

```
→ Analyzing changed files... (1 file, mode: local)
→ E2E will run: 1 spec (@regression only)
   - specs/app/version.spec.ts
→ E2E Regression Tests... ✓ (1 spec, 25s)
```

**Why It Runs**: Direct spec file changes always trigger the spec itself.

### Example 5: Multiple Unrelated Changes

**Changed Files**:

```
src/domain/models/app/version.ts (modified)
src/domain/models/app/theme.ts (modified)
src/infrastructure/css/compiler.ts (modified)
```

**Detection Output**:

```
→ Analyzing changed files... (3 files, mode: local)
→ E2E will run: 2 specs (@regression only)
   - specs/app/version.spec.ts
   - specs/app/theme.spec.ts
→ E2E Regression Tests... ✓ (2 specs, 1 min)
```

**Note**: CSS compiler changes don't map to specs (infrastructure detail, no E2E coverage).

## CI vs Local Behavior

### Local Development

```bash
# Developer makes changes
git add src/domain/models/app/version.ts
# Don't commit yet

# Run quality check
bun run quality

# Smart detection sees:
# - Mode: local
# - Changed files: src/domain/models/app/version.ts (staged)
# - Mapped specs: specs/app/version.spec.ts
# - E2E runs: 1 spec (@regression)
```

**Fast feedback loop** (seconds to minutes).

### CI Pull Request

```bash
# GitHub Actions workflow
- name: Run quality checks
  run: bun run quality

# Smart detection sees:
# - Mode: ci (GITHUB_ACTIONS=true)
# - Changed files: git diff $(git merge-base origin/main HEAD) HEAD
# - All changes since branch diverged from main
# - Mapped specs: All specs related to changed files
# - E2E runs: N specs (@regression)
```

**Validates only affected functionality** (minutes instead of hours).

### CI Merge to Main

```yaml
# test.yml workflow (triggered on push to main)
- name: Run E2E tests
  run: bun test:e2e:regression # Full @regression suite

# NO smart detection
# Runs ALL @regression specs (not filtered by changes)
# Final validation before deployment
```

**Full regression suite** (ensures nothing broke across entire app).

## When E2E Tests Skip

The system skips E2E tests in these scenarios:

| Scenario                       | Reason                           | Example                         |
| ------------------------------ | -------------------------------- | ------------------------------- |
| **Documentation-only changes** | No source code modified          | `docs/*.md`, `README.md`        |
| **Unit test changes**          | Not related to E2E specs         | `*.test.ts` files               |
| **Script changes**             | Utility scripts, not app code    | `scripts/*.ts`                  |
| **No changed files**           | Clean working directory          | No uncommitted changes          |
| **No mapped specs**            | Changed files don't map to specs | CSS utilities, type definitions |

**Example Output (skip)**:

```
→ Analyzing changed files... (2 files, mode: local)
⏭ Skipping E2E: no modified specs or related source files
```

## Performance Impact

### Before Smart Detection

**Typical quality check** (with all E2E tests):

```
ESLint: 3s
TypeScript: 5s
Unit Tests: 15s
E2E Tests (ALL): 90 min (timeout in TDD automation)
────────────────────────────────
Total: ❌ Timeout
```

### After Smart Detection

**Typical quality check** (with smart E2E):

```
ESLint: 3s
TypeScript: 5s
Unit Tests: 15s
E2E Tests (2 affected specs): 2 min
────────────────────────────────
Total: ✓ 2 min 23s
```

**Improvement**: 97% faster (2 min vs 90 min).

## Override Options

### Skip E2E Entirely

```bash
bun run quality --skip-e2e
```

**Use Case**: Rapid iteration on non-functional changes (documentation, comments).

### Force Run All E2E (@regression)

```bash
bun test:e2e:regression
```

**Use Case**: Manual full regression check before deployment.

### Run Specific Spec

```bash
bunx playwright test specs/app/version.spec.ts
```

**Use Case**: Debug a specific failing spec.

## Configuration

### Adding New Mappings

**File**: `scripts/lib/effect/spec-mapping-service.ts`

```typescript
const SPEC_MAPPINGS: readonly SpecMapping[] = [
  // ... existing mappings

  // Add new mapping for custom feature
  {
    sourcePattern: /^src\/domain\/models\/app\/custom-feature\.ts$/,
    getSpecs: () => ['specs/app/custom-feature.spec.ts'],
  },

  // Map infrastructure change to multiple specs
  {
    sourcePattern: /^src\/infrastructure\/email\/.*$/,
    getSpecs: async (fs) => {
      return await fs.glob('specs/api/auth/**/*.spec.ts')
    },
  },
]
```

**Pattern Types**:

- **Exact file match**: `/^src\/exact\/path\.ts$/`
- **Directory match**: `/^src\/directory\/.*$/`
- **File extension match**: `/.*\.test\.ts$/`

### Debugging Detection

Add `--verbose` flag (not implemented yet) or check logs:

```bash
bun run quality 2>&1 | grep "E2E"

# Output:
# → Analyzing changed files... (3 files, mode: local)
# → E2E will run: 2 specs (@regression only)
#    - specs/app/version.spec.ts
#    - specs/app/theme.spec.ts
```

## Integration with TDD Automation

### Queue Processor Workflow

```bash
# TDD automation workflow (every 15 minutes)
1. Pick next spec from queue (e.g., APP-VERSION-001)
2. @agent-e2e-test-fixer removes .fixme()
3. Commits changes: git commit -m "fix: implement APP-VERSION-001"
4. Runs: bun run quality
   → Smart detection sees:
      - Changed: specs/app/version.spec.ts
      - Changed: src/domain/models/app/version.ts
   → E2E runs: specs/app/version.spec.ts (@regression)
   → Passes ✓
5. Creates PR with tdd-automation label
6. GitHub Actions runs: bun run quality (smart detection in CI mode)
7. PR auto-merges
```

**Without smart detection**: Timeout after 90 minutes (all E2E tests).
**With smart detection**: Completes in 5-10 minutes (affected specs only).

### Budget Impact

**TDD automation limits**:

- Max budget: $10.00 per spec
- Max time: 90 minutes per spec

**Smart detection ensures**:

- Quality check completes within 10 minutes
- Budget spent on fixing code, not waiting for irrelevant tests
- No timeouts from running full E2E suite

## Related Documentation

- `@docs/architecture/testing-strategy.md` - Complete testing strategy
- `@docs/development/tdd-automation-pipeline.md` - TDD automation workflow
- `CLAUDE.md` - Smart E2E detection usage in quality command

## Summary

Smart E2E detection provides:

1. **Fast Feedback** - Minutes instead of hours for quality checks
2. **Relevant Tests** - Only runs specs related to changed files
3. **TDD Automation** - Prevents timeouts in automated workflows
4. **CI Efficiency** - Reduces CI resource usage
5. **Developer Experience** - Quick iteration without waiting for full E2E suite

The system automatically detects the environment (local vs CI), identifies changed files, maps them to related specs, and runs only the necessary @regression tests for fast, reliable feedback.
