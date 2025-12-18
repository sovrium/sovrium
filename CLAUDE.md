# CLAUDE.md - Sovrium Project Documentation

> **Note**: This is a streamlined version. Detailed documentation is available in `docs/` directory and imported on-demand when needed.

## Project Context

**Vision**: Sovrium aims to be a configuration-driven application platform (see `@docs/specifications/vision.md` for full vision)
**Current Status**: Phase 0 - Foundation (minimal schema with metadata only)
**Implementation Progress**: See `ROADMAP.md` for detailed feature tracking and development phases

> 💡 When writing code or tests, keep the target architecture in mind (vision.md) while working within current capabilities (ROADMAP.md)

## Quick Reference

**Project**: Sovrium (npm package: "sovrium")
**Legal Entity**: ESSENTIAL SERVICES (copyright holder & trademark owner)
**Version**: 0.0.1 (managed by semantic-release)
**License**: Business Source License 1.1 (BSL 1.1)
- **Core**: BSL 1.1 - Free for internal/non-commercial use, prevents competitive SaaS hosting
- **Enterprise**: Enterprise License (files with `.ee.` in filename/dirname) - Paid features
- **Change Date**: 2029-01-01 (automatically becomes Apache 2.0)
- **Current status**: No `.ee.` files exist yet (Phase 0 - all code is BSL-licensed)
**Runtime**: Bun 1.3.5 (NOT Node.js)
**Entry Points**:
- Library: `src/index.ts` (module import)
- CLI: `src/cli.ts` (binary executable via `bun run start` or `sovrium` command)

## Core Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Bun** | 1.3.5 | Runtime & package manager |
| **TypeScript** | ^5.9.3 | Type-safe language |
| **Effect** | ^3.19.12 | Functional programming, DI, error handling |
| **Effect Schema** | ^3.19.12 | Server validation (domain/application/infrastructure) |
| **Hono** | ^4.11.1 | Web framework (API routes, RPC client, OpenAPI) |
| **Zod** | ^4.2.1 | OpenAPI integration ONLY (src/presentation/api/schemas/) + client forms |
| **Better Auth** | ^1.4.7 | Authentication |
| **Drizzle ORM** | ^0.44.7 | Database (PostgreSQL via bun:sql) |
| **React** | ^19.2.3 | UI library |
| **Tailwind CSS** | ^4.1.18 | Styling (programmatic CSS compiler) |
| **TanStack Query** | ^5.90.12 | Server state management |
| **TanStack Table** | ^8.21.3 | Data tables |

## Authorization & Multi-Tenancy

**Strategy**: RBAC (Role-Based Access Control) + Field-Level Permissions + Organization Isolation

| Concept | Description |
|---------|-------------|
| **Roles** | owner, admin, member, viewer (4 default roles per organization) |
| **Organization Isolation** | Multi-tenant with `organization_id` filtering on all queries |
| **Field-Level Permissions** | Granular read/write control per field based on role |
| **Security** | Return 404 for cross-org access attempts (prevents enumeration) |

**Documentation**: See `@docs/architecture/patterns/authorization-*.md` (7 comprehensive guides)

## Essential Commands

```bash
# Development
bun install                 # Install dependencies
bun run start               # Run application via CLI (src/cli.ts)
bun run src/index.ts        # Run application directly (alternative)

# Scripts (TypeScript utilities)
bun run scripts/export-schema.ts  # Run a specific script
bun run export:schema              # Export Effect Schema to JSON files
bun run export:openapi             # Export OpenAPI schema from runtime API routes
bun test:unit                      # Unit tests (PATTERN FILTER: .test.ts .test.tsx only)

# E2E Testing & Snapshots (Playwright)
bun test:e2e                       # Run all E2E tests
bun test:e2e:spec                  # Run @spec tests only (exhaustive)
bun test:e2e:regression            # Run @regression tests only (optimized)
bun test:e2e:update-snapshots      # Update ALL snapshots (ARIA + visual)
bun test:e2e:update-snapshots:spec # Update @spec test snapshots only

# Utility Scripts (Additional)
bun run quality                    # Check code quality with smart E2E detection
bun run quality --skip-e2e         # Skip E2E tests entirely
bun run quality --skip-coverage    # Skip coverage check (gradual adoption)
bun run quality --skip-effect      # Skip Effect diagnostics (Effect Language Service)
bun run generate:roadmap           # Generate roadmap from specifications
bun run validate:docs              # Validate documentation versions match package.json
bun run release                    # Manually trigger release (semantic-release)

# Database (Drizzle ORM)
bun run db:generate         # Generate migration from schema changes
bun run db:migrate          # Apply migrations to database
bun run db:push             # Push schema changes directly (dev only)
bun run db:studio           # Launch Drizzle Studio (database GUI)
bun run db:check            # Check migration status
bun run db:drop             # Drop migration

# Code Quality (pre-commit)
bun run license             # Add copyright headers to all source files
bun run lint                # ESLint (check)
bun run lint:fix            # ESLint (auto-fix)
bun run format              # Prettier (format all files)
bun run format:check        # Prettier (check formatting without modifying)
bun run typecheck           # TypeScript type checking
bun run clean               # Knip (detect unused code/dependencies)
bun run clean:fix           # Knip (auto-fix unused exports)
bun test:unit               # Unit tests (Bun Test - src/ and scripts/)
bun test:unit:watch         # Unit tests in watch mode
bun test:e2e                # E2E tests (Playwright - all)
bun test:e2e:spec           # E2E spec tests (@spec tag) - for development
bun test:e2e:regression     # E2E regression tests (@regression tag) - for CI/pre-merge
bun test:e2e:ui             # E2E tests with Playwright UI
bun test:all                # All tests (unit + E2E regression)

# Release (manual via GitHub Actions)
git commit -m "release: publish"   # Explicit release commit
git push origin main               # Triggers release ONLY with "release:" type

# Agent Workflows (TDD Pipeline)
# See: @docs/development/tdd-automation-pipeline.md for complete TDD automation guide
```

## Smart Testing Strategy

The `bun run quality` command includes **smart E2E detection** to prevent timeouts during development and TDD automation. It runs @regression tests ONLY for spec files affected by your changes.

### What `bun run quality` Runs

1. **ESLint** - Code linting with caching
2. **TypeScript** - Type checking (incremental)
3. **Effect Diagnostics** - Effect Language Service checks for Effect-specific issues (unnecessaryPipeChain, catchUnfailableEffect, returnEffectInGen, tryCatchInEffectGen)
4. **Unit Tests** - All `.test.ts` files in `src/` and `scripts/`
5. **Coverage Check** - Verifies domain layer has unit tests
6. **Smart E2E Detection** - Identifies affected @regression specs and runs them

### How Smart E2E Detection Works

| Environment | Detection Mode | What's Compared |
|-------------|----------------|-----------------|
| **Local dev** | uncommitted | Staged + unstaged + untracked files |
| **CI/PR branches** | branch diff | Changes since merge-base with main |
| **GitHub Actions** | auto-detect | Uses CI mode when `GITHUB_ACTIONS=true` |

**Mapping Rules** - Changed files are mapped to related specs:
- `specs/**/*.spec.ts` → Runs that spec directly
- `src/domain/models/app/version.ts` → `specs/app/version.spec.ts`
- `src/infrastructure/auth/**` → All `specs/api/auth/**/*.spec.ts`
- `src/infrastructure/server/route-setup/auth-routes.ts` → All auth specs

### When E2E Tests Run

- Direct spec file changes (`specs/**/*.spec.ts`)
- Source files with mapped specs
- Auth infrastructure changes trigger all auth specs
- Database changes trigger migration and table specs

### When E2E Tests Skip

- Documentation-only changes (`.md` files)
- Unit test file changes (`.test.ts`)
- Script file changes (`scripts/`)
- No related specs found for changed source files

**Example Output (no E2E needed)**:
```
→ ESLint... ✓ (2341ms)
→ TypeScript... ✓ (4521ms)
→ Effect Diagnostics... ✓ (1523ms)
→ Unit Tests... ✓ (12034ms)
→ Coverage Check... ✓
→ Analyzing changed files... (3 files, mode: local)
⏭ Skipping E2E: no modified specs or related sources
─────────────────────────────────────────────
✅ All quality checks passed! (20419ms)
```

**Example Output (E2E runs for affected specs)**:
```
→ ESLint... ✓ (2341ms)
→ TypeScript... ✓ (4521ms)
→ Effect Diagnostics... ✓ (1523ms)
→ Unit Tests... ✓ (12034ms)
→ Coverage Check... ✓
→ Analyzing changed files... (5 files, mode: ci)
→ E2E will run: 2 specs (@regression only)
   - specs/app/version.spec.ts
   - specs/api/auth/sign-up/email/post.spec.ts
→ E2E Regression Tests... ✓ (45231ms)
```

### Unit Test Coverage Enforcement

The quality command enforces unit test coverage for the domain layer:

```bash
bun run quality              # Fails if domain files lack .test.ts
bun run quality --skip-coverage  # Skip coverage check (gradual adoption)
```

**Coverage by layer** (current status):
- `domain/`: 93.4% covered (enforced)
- `application/`: 33.3% covered (not enforced yet)
- `infrastructure/`: 43.8% covered (not enforced yet)
- `presentation/`: 26.7% covered (not enforced yet)

### Override Options

```bash
bun run quality              # Smart detection (default)
bun run quality --skip-e2e   # Force skip E2E tests entirely
bun run quality --skip-coverage  # Skip coverage enforcement
bun run quality --skip-effect    # Skip Effect diagnostics
```

### CI vs Local Behavior

| Context | Command | E2E Behavior |
|---------|---------|--------------|
| **CI merge to main** | `test.yml` | Runs ALL @regression specs (full suite) |
| **TDD automation** | `bun run quality` | Smart detection - affected @regression only |
| **Local development** | `bun run quality` | Smart detection - affected @regression only |

**Important**: The `test.yml` CI workflow always runs the full E2E regression suite before merging to main. The smart detection in `bun run quality` is for faster feedback during development and TDD automation.

## Coding Standards (Critical Rules)

### Code Formatting (Prettier - `.prettierrc.json`)
- **No semicolons** (`semi: false`)
- **Single quotes** (`singleQuote: true`)
- **100 char line width** (`printWidth: 100`)
- **2-space indent** (`tabWidth: 2`)
- **Trailing commas** (`trailingComma: "es5"`)
- **One attribute per line** (`singleAttributePerLine: true`)

### Copyright Headers (REQUIRED for all .ts/.tsx files)
- **All source files** (src/, scripts/, specs/) MUST include copyright header
- **Header format**:
```typescript
/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */
```
- **When creating new files**: Run `bun run license` after creating files to add headers
- **For agents**: ALWAYS run `bun run license` after creating new .ts/.tsx files

### Module System
- **Always ES Modules** (NOT CommonJS)
- **Omit file extensions** in imports (extensionless)
- **Use path aliases** for components (`@/components/ui/button`)

### UI Components
- **Location**: `src/presentation/components/` (organized by feature)
- **Props**: Extend native HTML element props
- **Styling**: Plain Tailwind CSS classes
- **Exports**: Export both component and props interface

### Test File Naming Convention (CRITICAL - Pattern-Based)
- **Unit Tests**: `*.test.ts` (co-located in `src/` and `scripts/`)
- **E2E Tests**: `*.spec.ts` (in `specs/` directory)
- **Why pattern-based**: Bun test runner uses filename patterns (`bun test .test.ts .test.tsx`) to filter test files
- **Enforcement**: ESLint prevents wrong test runner imports (Playwright in unit tests, Bun Test in E2E tests)
- **See**: `@docs/architecture/testing-strategy/06-test-file-naming-convention.md` for enforcement details

### Snapshot Testing (E2E Tests)
- **ARIA Snapshots** (`toMatchAriaSnapshot`): For structure & accessibility validation
- **Visual Screenshots** (`toHaveScreenshot`): For theme, layout & visual regression
- **Traditional Assertions**: For behavior, logic & specific values
- **Storage**: Snapshots saved in `specs/**/__snapshots__/` (committed to git)
- **Update Command**: `bun test:e2e:update-snapshots` after implementing features
- **Guide**: Run `bun test:snapshots:guide` for decision matrix & best practices

### test.step Pattern (@regression Tests)
- **Mandatory for @regression tests**: Wrap workflow scenarios in descriptive `test.step()` calls
- **Optional for @spec tests**: Recommended for complex tests (50+ lines) to enhance reporting
- **Benefits**: Better CI logs, improved debugging, self-documenting test flows, enhanced HTML reports
- **See**: `@docs/architecture/testing-strategy/14-using-test-steps-for-readability.md` for comprehensive guide with architectural rationale, patterns, and adoption metrics

### Commit Messages (Conventional Commits - REQUIRED)
- `release:` → Publish new version (patch bump 0.0.X) - **ONLY this triggers releases**
- `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:` → No version bump

## Architecture Principles

### Layer-Based Architecture (4 Layers)
1. **Presentation** (UI/API) - React components, Hono routes
2. **Application** (Use Cases) - Effect programs, workflow orchestration
3. **Domain** (Business Logic) - Pure functions, validation, models
4. **Infrastructure** (External) - Database, APIs, file system

**Dependency Direction**: Outer → Inner (Presentation → Application → Domain ← Infrastructure)

### Functional Programming (Core Principles)
1. **DRY (Don't Repeat Yourself)** - Single source of truth for all logic
2. **Pure Functions** - No side effects in Domain layer
3. **Immutability** - Use `readonly`, never mutate
4. **Explicit Effects** - Use Effect.ts for side effects
5. **Composition** - Build complex from simple functions
6. **Type Safety** - Strict TypeScript, Effect error types

**Enforcement**: FP patterns automatically enforced via ESLint (`eslint-plugin-functional`). See `@docs/infrastructure/quality/eslint.md#functional-programming-enforcement`

**Layer Enforcement**: Layer-based architecture (domain/, application/, infrastructure/, presentation/) is actively enforced via `eslint-plugin-boundaries`. See `@docs/architecture/layer-based-architecture.md#enforcement` for details.

**Test Naming Convention (Cross-Layer Pattern)**: Test separation by file extension, not directory structure:
- **Unit tests**: `*.test.ts` (Bun Test) - Co-located with source in src/ and scripts/
- **E2E tests**: `*.spec.ts` (Playwright) - Located in specs/ directory
- **Pattern-based filtering**: `bun test .test.ts .test.tsx` excludes `.spec.ts` files automatically
- **ESLint enforcement**: Prevents wrong test runner usage (see `@docs/architecture/testing-strategy/06-test-file-naming-convention.md`)

## File Structure

```
sovrium/
├── docs/                        # Detailed documentation (import on-demand)
│   ├── infrastructure/          # Tech stack docs
│   └── architecture/            # Architecture patterns
├── scripts/                     # Build & utility scripts (TypeScript, run by Bun)
│   ├── **/*.ts                  # TypeScript scripts (executable with Bun)
│   └── **/*.test.ts             # Script unit tests (co-located, Bun Test)
├── src/                         # Layer-based architecture (see @docs/architecture/layer-based-architecture.md)
│   ├── domain/                  # Domain Layer - Pure business logic
│   ├── application/             # Application Layer - Use cases, orchestration
│   ├── infrastructure/          # Infrastructure Layer - External services, I/O
│   ├── presentation/            # Presentation Layer - UI components, API routes
│   ├── index.ts                 # Entry point
│   └── **/*.test.ts             # Unit tests (co-located, Bun Test)
├── specs/**/*.spec.ts           # E2E tests (Playwright)
├── package.json
├── tsconfig.json
├── playwright.config.ts
├── eslint.config.ts
└── CLAUDE.md                    # This file
```

## Detailed Documentation (On-Demand Import)

> **⚠️ IMPORTANT - Token Optimization**: To reduce token usage, documentation files are **NOT automatically loaded**. Import docs ONLY when actively working on related features using the `@docs/` syntax.

**Complete documentation index**: See `@.claude/docs-index.md` for the full list of available documentation files, organized by category.

**Quick Access Examples**:
- Authentication: `@docs/infrastructure/framework/better-auth.md`
- Forms: `@docs/infrastructure/ui/react-hook-form.md`
- API Routes: `@docs/infrastructure/api/hono-rpc-openapi.md`
- Database: `@docs/infrastructure/database/drizzle.md`, `@docs/architecture/patterns/database-access-strategy.md`, `@docs/architecture/patterns/internal-table-naming-convention.md`, `@docs/architecture/patterns/soft-delete-by-default.md`
- Schemas: `@docs/infrastructure/framework/effect.md`
- **Email**: `@docs/infrastructure/email/nodemailer.md` (Nodemailer SMTP client)
- **Email Testing**: `@docs/infrastructure/email/mailpit.md` (Local SMTP with Web UI)
- **Styling & CSS**: `@docs/infrastructure/ui/tailwind.md`, `@docs/infrastructure/css/css-compiler.md`
- **Theming Architecture**: `@docs/architecture/patterns/theming-architecture.md`
- **Internationalization (i18n)**: `@docs/architecture/patterns/i18n-centralized-translations.md`
- **Testing React Components**: `@docs/infrastructure/testing/react-testing-library.md` (RTL + Happy DOM + Bun)
- **TDD Automation**: `@docs/development/tdd-automation-pipeline.md`, `@docs/development/tdd-error-handling.md`, `@docs/development/tdd-conflict-resolution.md`

**Slash Command**: Use `/docs` to list all available documentation files

## Development Workflow

1. **Write code** following standards above
2. **Test locally**: `bun run lint && bun run format && bun run typecheck && bun test:unit`
3. **Commit**: Use conventional commits (`feat:`, `fix:`, etc.) for regular work
4. **Push**: GitHub Actions runs tests
5. **Release**: When ready to publish, use `git commit -m "release: publish"` and push

## TDD Automation Queue System (For Claude Code)

### Overview

The project uses a **queue-based TDD automation system** that creates GitHub issues for individual test specs. When you see an issue titled "🤖 [SPEC-ID]: [description]", follow these instructions.

**Full Documentation**: See `@docs/development/tdd-automation-pipeline.md` for complete details.

### Recognizing Queue Spec Issues

Look for these indicators:
- Title starts with "🤖" and contains a spec ID (e.g., `APP-VERSION-001`)
- Labels include `tdd-spec:queued` or `tdd-spec:in-progress`
- Instructions in @claude mention comment
- Instructions are minimal and clear

### Your Workflow for Spec Issues

When triggered by @claude mention (posted by queue processor every 15 min):

1. **Branch creation** - Claude Code automatically creates branches with pattern: `claude/issue-{ISSUE_NUMBER}-{timestamp}`
   ```bash
   # Example: claude/issue-1319-20251102-2026
   # Timestamp ensures uniqueness (no conflicts)
   # Branch created automatically - no manual git checkout needed
   ```
   **Note**: Claude Code creates the branch automatically with pattern `claude/issue-{ISSUE_NUMBER}-{timestamp}`.

2. **Run @agent-e2e-test-fixer**:
   - Locate test using spec ID (file path in issue)
   - Remove `.fixme()` from ONE specific test
   - Implement minimal code to pass test
   - Follow Sovrium architecture patterns

3. **⚡ Check for Test-Only Change (Early Exit)**:

   After removing `.fixme()`, check if the test passes WITHOUT any `src/` changes:
   ```bash
   # Check if any src/ files were modified
   SRC_CHANGES=$(git diff --name-only HEAD | grep '^src/' | wc -l)
   if [ "$SRC_CHANGES" -eq 0 ]; then
     echo "⚡ Test-only change detected - skipping full audit"
     # Run minimal validation only
     bun run quality
     # Skip step 4 (codebase-refactor-auditor)
     # Proceed directly to step 5 (Commit)
   fi
   ```

   **When to use Early Exit**:
   - Test passes immediately after removing `.fixme()` (feature already implemented)
   - No files in `src/` were modified (only spec files changed)
   - Example: Issue #5999 - test passed immediately, no code changes needed

   **Benefits of Early Exit**:
   - Saves 5-10 minutes per spec
   - Reduces duplicate PR risk (faster completion = less race condition window)
   - `bun run quality` still validates spec file changes

4. **Run @agent-codebase-refactor-auditor** (ONLY if `src/` files changed):
   - **SKIP this step** if Early Exit applies (test-only change)
   - Review implementation for code quality
   - Check for duplication
   - Ensure architectural compliance
   - Refactor and optimize as needed

5. **Commit changes**:
   ```bash
   bun run license  # Add copyright headers
   git add -A
   git commit -m "fix: implement APP-VERSION-001"
   git push
   ```

6. **⚠️ PRE-PR CHECKS (MANDATORY - Prevent Duplicate PRs) ⚠️**

   **BEFORE creating a PR**, you MUST run ALL THREE checks. Skip PR creation if ANY check fails.

   ```bash
   ISSUE_NUMBER=<ISSUE_NUMBER>  # Replace with actual issue number
   CURRENT_BRANCH=$(git branch --show-current)

   # Check 1: Verify issue is still open
   ISSUE_STATE=$(gh issue view $ISSUE_NUMBER --json state --jq '.state')
   if [ "$ISSUE_STATE" = "CLOSED" ]; then
     echo "✅ Issue already closed - skipping PR creation (work already done)"
     exit 0
   fi

   # Check 2: Check for existing PRs for this issue (open OR merged)
   EXISTING_PRS=$(gh pr list --label tdd-automation --state all --json number,body,state \
     --jq '.[] | select(.body | contains("Closes #'$ISSUE_NUMBER'")) | "#\(.number) (\(.state))"')
   if [ -n "$EXISTING_PRS" ]; then
     echo "✅ Found existing PR(s): $EXISTING_PRS - skipping PR creation"
     exit 0
   fi

   # Check 3: Check for PR from current branch (catches same-run duplicates)
   BRANCH_PR=$(gh pr list --head "$CURRENT_BRANCH" --state all --json number,state \
     --jq '.[] | "#\(.number) (\(.state))"')
   if [ -n "$BRANCH_PR" ]; then
     echo "✅ PR already exists from this branch: $BRANCH_PR - skipping PR creation"
     exit 0
   fi

   echo "✅ All checks passed - safe to create PR"
   ```

   **WHY THIS IS CRITICAL** (PR #6067 and PR #6097 incidents):
   - Claude Code can run for up to 60 minutes
   - During that time, another workflow may create and merge a PR for the same issue
   - **Check 3 is NEW**: In issue #5999, two PRs (#6096, #6097) were created from the SAME branch
   - This happens when Claude creates a PR, continues running, and tries to create another
   - Without all 3 checks, duplicate PRs waste CI resources and cause confusion

7. **⚠️ MANDATORY: CREATE PULL REQUEST ⚠️**

   **THIS IS NOT OPTIONAL. THE WORKFLOW IS NOT COMPLETE WITHOUT A PR.**

   You MUST create a PR with `tdd-automation` label and `Closes #<issue_number>` in PR body.

   **WHY THIS IS CRITICAL**:
   - ❌ No PR = Spec marked as `tdd-spec:failed` after 2 minutes
   - ❌ No PR = Pipeline cannot validate your changes
   - ❌ No PR = Issue cannot auto-close
   - ✅ PR required EVEN IF you only removed `.fixme()` and made no other changes

   **Example of what NOT to do** (Issue #1319):
   - Claude removed `.fixme()`, committed, pushed
   - Did NOT create PR -> Marked as failed -> Required manual intervention

   **How to create PR**:
   ```bash
   gh pr create \
     --title "fix: implement APP-VERSION-001" \
     --body "Closes #1234" \
     --label "tdd-automation"
   ```

   **⚠️ CRITICAL - PR Body Format**: GitHub's auto-close keywords are format-sensitive
   - ✅ **Correct**: `Closes #1234` (issue number only, no extra text after number)
   - ❌ **Wrong**: `Closes #1234 - description` (extra text breaks auto-close)
   - Multiple issues: Use separate lines (`Closes #1234\nCloses #5678`)

8. **PR verification**: Workflow automatically verifies PR was created within 2 minutes
   - If no PR found: Issue marked as `tdd-spec:failed`, pipeline continues with next spec
   - This prevents pipeline from blocking on "no PR created" scenarios

9. **Monitor validation** (test.yml CI checks):
   - If fails: Analyze errors, fix, push (retry up to 3 times)
   - Track retries with labels (`retry:spec:1/2/3` or `retry:infra:1/2/3`)
   - After 3 failures: Mark issue `tdd-spec:failed`, exit (allow pipeline to continue)
   - If passes: Enable PR auto-merge with --squash

10. **Issue closes automatically** when PR merges to main (via `Closes #` syntax in PR body)

### TDD Labels Reference

All TDD labels follow consistent naming conventions:

| Category | Labels | Description |
|----------|--------|-------------|
| **State** | `tdd-spec:queued` | Waiting in queue for processing |
| | `tdd-spec:in-progress` | Currently being worked on |
| | `tdd-spec:completed` | Successfully merged to main |
| | `tdd-spec:failed` | Failed after max retries |
| **Failure Type** | `failure:spec` | Target spec itself failing |
| | `failure:regression` | Changes broke OTHER tests |
| | `failure:infra` | Infrastructure/flaky issue |
| **Retry Tracking** | `retry:spec:1/2/3` | Retry attempts for code errors |
| | `retry:infra:1/2/3` | Retry attempts for infra errors |
| **Alerting** | `high-failure-rate` | Many specs failing (incident) |
| **General** | `tdd-automation` | Marks TDD pipeline issues/PRs |
| | `skip-automated` | Human marked as too complex for automation |

### Retry Logic

The system implements automatic error recovery:
- **Max 3 retry attempts** per spec
- **Tracks retries** with labels (`retry:spec:N` for code errors, `retry:infra:N` for infra errors)
- **On 3rd failure**: Marks issue as `tdd-spec:failed`, adds explanatory comment
- **Pipeline continues**: Failed specs don't block queue processing

### Regression Detection and Handling

**CRITICAL**: The TDD workflow automatically detects regressions (tests failing in OTHER files due to your changes).

**How Failure Classification Works**:
| Failure Type | Target Spec | Other Specs | Label Applied |
|--------------|-------------|-------------|---------------|
| `target_only` | ❌ Fails | ✅ Pass | `failure:spec` |
| `regression_only` | ✅ Pass | ❌ Fail | `failure:regression` |
| `mixed` | ❌ Fails | ❌ Fail | `failure:regression` |

**What Happens When Regressions Are Detected**:
1. CI classifies test failures as `target_only`, `regression_only`, or `mixed`
2. `failure:regression` label added to PR and issue
3. Regression Handler posts `@claude` comment with specific fix instructions
4. Claude Code receives detailed analysis of failing specs and common patterns
5. Claude fixes the regression WITHOUT modifying the failing tests
6. Up to 3 retry attempts before marking as `tdd-spec:failed`

**Common Regression Causes**:
- **Greedy catch-all schemas**: `UnknownFieldSchema` with `type: Schema.String` catches valid types
- **Validation bypass**: Removing/weakening validation that other tests rely on
- **Type signature changes**: Breaking dependent code with new return types

**Regression Fix Protocol**:
```bash
# 1. Run failing regression specs
bun test:e2e -- <regression_specs>

# 2. Analyze what you changed
git diff HEAD~1 --name-only

# 3. Fix without modifying tests
# - Preserve existing validation
# - Exclude known types from catch-alls
# - Maintain backward compatibility

# 4. Verify both specs pass
bun test:e2e -- <target_spec>
bun test:e2e -- <regression_specs>
bun test:e2e:regression

# 5. Push the fix
git commit -m "fix: resolve regression in {SPEC-ID}"
git push
```

### Important Rules

- **ALWAYS** run both agents (e2e-test-fixer then refactor-auditor)
- **ALWAYS** check for existing PRs before creating a new one (prevents duplicates)
- **ALWAYS** create PR - REQUIRED even if only `.fixme()` removal, NO EXCEPTIONS
- **DO NOT** modify multiple specs at once (one spec = one issue)
- **DO NOT** modify test logic - only remove `.fixme()` and implement code
- **DO NOT** close issues manually - they close automatically on PR merge
- **DO NOT** consider the task complete until PR is created
- **DO NOT** create a PR if issue is already closed or PR already exists
- **DO** commit with format: `fix: implement {SPEC-ID}`
- **DO** create PR with `tdd-automation` label and include `Closes #<issue_number>` in PR body (⚠️ no extra text after number)
- **DO** retry up to 3 times on validation failures

### Completion Checklist

- [ ] `.fixme()` removed, code implemented, both agents run
- [ ] Copyright headers added, changes committed/pushed
- [ ] **⚠️ PRE-PR CHECKS**: Issue still open AND no existing PRs (prevents duplicates)
- [ ] **⚠️ CRITICAL: PR created** with `tdd-automation` label and `Closes #<issue_number>` in body
- [ ] Auto-merge enabled after validation passes

**Remember**:
- PR creation is mandatory - Issue #1319 failed because PR was not created.
- Pre-PR checks are mandatory - PR #6067 was created as duplicate after PR #6066 already merged.

### Queue System Architecture

```
Push new tests → Scan → Create spec issues → Queue
                                               ↓
         Processor picks HIGHEST PRIORITY spec (every 15 min)
         Priority order: APP → MIG → STATIC → API → ADMIN
         Within domain: Alphabetical by feature, then test number
                                               ↓
                              Mark in-progress + Post @claude mention
                                               ↓
                    Claude Code triggered (dual-agent workflow)
                                               ↓
                              Create branch + e2e-test-fixer → refactor-auditor
                                               ↓
                                      Commit → Create PR
                                               ↓
                                test.yml validation (retry up to 3x)
                                               ↓
                        Pass → Auto-merge → Issue closes → Next spec
                        Fail (3x) → Mark failed → Next spec
```

### Queue Priority System

Specs are processed by **priority**, not creation order. Priority is calculated from the spec ID:

```
Priority = Domain Base + Feature Priority + Test Offset

Domain bases (lower = higher priority):
- APP: 0           (runs first)
- MIG: 1,000,000   (runs after APP)
- STATIC: 2,000,000
- API: 3,000,000
- ADMIN: 4,000,000 (runs last)

Within each domain:
- Features sorted alphabetically (THEME before VERSION)
- Tests run in order: 001 → 002 → ... → REGRESSION (last)
```

**Example execution order**:
1. `APP-THEME-001` (priority: ~570,001)
2. `APP-THEME-REGRESSION` (priority: ~570,900)
3. `APP-VERSION-001` (priority: ~660,001)
4. `MIGRATION-ERROR-001` (priority: ~1,120,001)

### Queue Status & Monitoring

Check queue status anytime:
```bash
# View queue status
bun run scripts/tdd-automation/queue-manager.ts status

# View queued specs
gh issue list --label "tdd-spec:queued"

# View specs in-progress
gh issue list --label "tdd-spec:in-progress"

# View progress dashboard
cat TDD-PROGRESS.md

# Check for stale issues (tests fixed but issues not closed)
bun run tdd:close-stale-issues              # Dry run (shows what would be closed)
bun run tdd:close-stale-issues --close      # Actually close stale issues
```

**Stale Issue Cleanup**: The system automatically closes stale issues (tests that have been fixed but issues weren't properly closed) during the daily populate workflow. You can also run it manually using the commands above.

### If Something Goes Wrong

**PR validation fails**:
1. Claude Code automatically retries (up to 3 attempts)
2. Check PR for test.yml CI status
3. After 3 failures, issue marked as `tdd-spec:failed`
4. Manual intervention required for failed specs

**Spec stuck in-progress**:
1. Check if PR was created: `gh pr list --label "tdd-automation"`
2. Check if test.yml workflow ran on PR
3. If stuck > 90 minutes, recovery workflow re-queues automatically

**Queue not processing**:
1. Check if another spec is in-progress: `gh issue list --label "tdd-spec:in-progress"`
2. The system processes one spec at a time (strict serial)
3. Wait up to 15 minutes for the processor to pick the next spec
4. Check processor workflow: `gh run list --workflow="TDD Queue - Processor"`

### Configuration

Key workflow settings:
- **Queue Processor**: Every 15 minutes (configured PAT account)
- **Max concurrent**: 1 spec at a time (strict serial)
- **Dual agents**: e2e-test-fixer + codebase-refactor-auditor (ALWAYS both)
- **Retry attempts**: Max 3 per spec
- **PR validation**: test.yml (lint, typecheck, Effect diagnostics, unit tests, E2E regression)
- **Auto-merge**: Enabled after validation passes
- **Issue closure**: Automatic on PR merge to main

### Claude Code GitHub Actions Best Practices

The TDD workflows follow [official Claude Code best practices](https://code.claude.com/docs/github-actions):

| Setting | tdd-execute.yml | tdd-refactor.yml | Purpose |
|---------|-----------------|------------------|---------|
| **Model** | `claude-sonnet-4-5-20250929` | `claude-sonnet-4-5-20250929` | Cost predictability |
| **Max Turns** | 30 | 40 | Prevent runaway conversations |
| **Allowed Tools** | Edit, Read, Write, Bash, Glob, Grep, Task, TodoWrite | Edit, Read, Write, Bash, Glob, Grep, Task, TodoWrite | Principle of least privilege |
| **Disallowed Tools** | WebFetch, WebSearch, AskUserQuestion, NotebookEdit, SlashCommand | WebFetch, WebSearch, AskUserQuestion, NotebookEdit, SlashCommand | Block unnecessary capabilities |

**Why these settings?**

1. **Explicit model selection**: Prevents unexpected cost increases if default model changes
2. **Max turns limit**:
   - `tdd-execute.yml` (30): Covers read→implement→test→PR cycle for single spec
   - `tdd-refactor.yml` (40): Allows more exploration for comprehensive audits
3. **Tool restrictions**:
   - **Allowed**: Only tools necessary for code implementation and testing
   - **Blocked AskUserQuestion**: No human present in automation - would hang or skip steps
   - **Blocked WebFetch/WebSearch**: External content not needed for code implementation
   - **Blocked NotebookEdit**: No Jupyter notebooks in project
   - **Blocked SlashCommand**: Prevents unintended command execution

**Previous approach**: `--dangerously-skip-permissions` (grants ALL tools)
**Current approach**: Explicit `--allowedTools` and `--disallowedTools` for security hardening

### Current Status

View current queue status:
```bash
bun run scripts/tdd-automation/queue-manager.ts status
```

## Key Differences from Typical Stacks

- ❌ **NOT Node.js** - Use Bun exclusively
- ❌ **NOT npm/yarn/pnpm** - Use Bun package manager
- ❌ **NOT CommonJS** - ES Modules only
- ❌ **NOT manual memoization** - React 19 Compiler handles it
- ✅ **DO use TypeScript directly** - Bun executes .ts files natively
- ✅ **DO use Effect.gen** - Application layer workflows
- ✅ **DO use path aliases** - `@/presentation/components/pages/HomePage`
- ✅ **DO validate inputs** - Client: Zod (React Hook Form), Server: Effect Schema
- ✅ **DO use Effect.DateTime** - For all date handling (client and server)

## Claude Code Usage Optimization

**Token Cost Management**: This project is optimized to reduce Claude Code token usage by 85-90%.

### What's Excluded (`.claudeignore`)
- `node_modules/` (56k files, 624MB) - Dependencies
- `docs/infrastructure/` (1,058 files, 117k lines) - Use on-demand imports instead
- Build artifacts, logs, test reports, caches

### Best Practices
1. **Import docs on-demand**: Use `@docs/` syntax ONLY when working on related features
2. **Start fresh conversations**: Don't reuse threads for unrelated tasks (history accumulates tokens)
3. **Use `/docs` command**: Lists available documentation without loading it
4. **Batch edits**: One large diff is cheaper than multiple "please refine" follow-ups
5. **Choose right model**: Use Haiku for simple tasks, Sonnet 4 for complex reasoning

### Monitoring Usage
To track your token usage and cost:
1. Install [Claude Code Usage Monitor](https://github.com/Maciek-roboblog/claude-code-usage-monitor)
2. Monitor token usage per conversation
3. Set alerts if approaching weekly limits (Pro: ~40-80 hours/week)

### Expected Token Usage (After Optimization)
- **Conversation start**: ~20k-30k tokens (vs. 200k+ before)
- **With doc import**: +5k-15k tokens per doc file
- **Typical task**: 20k-50k tokens total
- **Result**: 6-10x more conversations per week

---

**License & Trademarks**

**License**: Business Source License 1.1 (BSL 1.1)
- **Copyright**: ESSENTIAL SERVICES (legal entity, owns the code)
- **Trademark**: Sovrium is a trademark of ESSENTIAL SERVICES (registered in France)
- **Free for**: Internal business use, personal projects, educational purposes, non-competing client deployments
- **NOT allowed**: Commercial hosted/managed services to third parties (requires commercial license)
- **Change Date**: 2029-01-01 (automatically becomes Apache License 2.0)
- **Commercial licensing**: Contact license@sovrium.com for competitive SaaS/hosting use cases
- **Philosophy**: Source-available with time-based open source conversion
- See `LICENSE.md` for BSL 1.1 terms and `TRADEMARK.md` for trademark usage guidelines
