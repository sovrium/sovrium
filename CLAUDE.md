# CLAUDE.md - Sovrium™ Project Documentation

> **Note**: This is a streamlined version. Detailed documentation is available in `docs/` directory and imported on-demand when needed.

## Project Context

**Vision**: Sovrium™ aims to be a configuration-driven application platform (see `@docs/specifications/vision.md` for full vision)
**Current Status**: Phase 0 - Foundation (minimal schema with metadata only)
**Implementation Progress**: See `ROADMAP.md` for detailed feature tracking and development phases

> 💡 When writing code or tests, keep the target architecture in mind (vision.md) while working within current capabilities (ROADMAP.md)

## Quick Reference

**Project**: Sovrium™ (npm package: "sovrium")
**Legal Entity**: ESSENTIAL SERVICES (copyright holder & trademark owner)
**Version**: 0.0.1 (managed by semantic-release)
**License**: Business Source License 1.1 (BSL 1.1)
- **Core**: BSL 1.1 - Free for internal/non-commercial use, prevents competitive SaaS hosting
- **Enterprise**: Enterprise License (files with `.ee.` in filename/dirname) - Paid features
- **Change Date**: 2029-01-01 (automatically becomes Apache 2.0)
- **Current status**: No `.ee.` files exist yet (Phase 0 - all code is BSL-licensed)
**Runtime**: Bun 1.3.0 (NOT Node.js)
**Entry Points**:
- Library: `src/index.ts` (module import)
- CLI: `src/cli.ts` (binary executable via `bun run start` or `sovrium` command)

## Core Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Bun** | 1.3.0 | Runtime & package manager |
| **TypeScript** | ^5.9.3 | Type-safe language |
| **Effect** | ^3.19.6 | Functional programming, DI, error handling |
| **Effect Schema** | ^3.19.6 | Server validation (domain/application/infrastructure) |
| **Hono** | ^4.10.7 | Web framework (API routes, RPC client, OpenAPI) |
| **Zod** | ^4.1.13 | OpenAPI integration ONLY (src/domain/models/api/) + client forms |
| **Better Auth** | 1.3.34 | Authentication |
| **Drizzle ORM** | ^0.44.7 | Database (PostgreSQL via bun:sql) |
| **React** | 19.2.0 | UI library |
| **Tailwind CSS** | 4.1.17 | Styling (programmatic CSS compiler) |
| **TanStack Query** | ^5.90.11 | Server state management |
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
bun test:snapshots:guide           # Show snapshot testing guide & best practices

# Utility Scripts (Additional)
bun run quality                    # Check code quality comprehensively
bun run generate:roadmap           # Generate roadmap from specifications
bun run validate:admin-specs       # Validate admin panel specifications
bun run validate:api-specs         # Validate API specifications
bun run validate:app-specs         # Validate application specifications
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
- Database: `@docs/infrastructure/database/drizzle.md`
- Schemas: `@docs/infrastructure/framework/effect.md`
- **Styling & CSS**: `@docs/infrastructure/ui/tailwind.md`, `@docs/infrastructure/css/css-compiler.md`
- **Theming Architecture**: `@docs/architecture/patterns/theming-architecture.md`
- **Internationalization (i18n)**: `@docs/architecture/patterns/i18n-centralized-translations.md`
- **Testing React Components**: `@docs/infrastructure/testing/react-testing-library.md` (RTL + Happy DOM + Bun)

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

3. **Run @agent-codebase-refactor-auditor** (ALWAYS):
   - Review implementation for code quality
   - Check for duplication
   - Ensure architectural compliance
   - Refactor and optimize as needed

4. **Commit changes**:
   ```bash
   bun run license  # Add copyright headers
   git add -A
   git commit -m "fix: implement APP-VERSION-001"
   git push
   ```

5. **⚠️ MANDATORY: CREATE PULL REQUEST ⚠️**

   **THIS IS NOT OPTIONAL. THE WORKFLOW IS NOT COMPLETE WITHOUT A PR.**

   You MUST create a PR with `tdd-automation` label and `Closes #<issue_number>` in PR body.

   **WHY THIS IS CRITICAL**:
   - ❌ No PR = Spec marked as `tdd-spec:failed` after 2 minutes
   - ❌ No PR = Pipeline cannot validate your changes
   - ❌ No PR = Issue cannot auto-close
   - ✅ PR required EVEN IF you only removed `.fixme()` and made no other changes

   **Example of what NOT to do** (Issue #1319):
   - Claude removed `.fixme()`, committed, pushed
   - Did NOT create PR → Marked as failed → Required manual intervention

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

6. **PR verification**: Workflow automatically verifies PR was created within 2 minutes
   - If no PR found: Issue marked as `tdd-spec:failed`, pipeline continues with next spec
   - This prevents pipeline from blocking on "no PR created" scenarios

7. **Monitor validation** (test.yml CI checks):
   - If fails: Analyze errors, fix, push (retry up to 3 times)
   - Track retries with labels (retry:1, retry:2, retry:3)
   - After 3 failures: Mark issue `tdd-spec:failed`, exit (allow pipeline to continue)
   - If passes: Enable PR auto-merge with --squash

8. **Issue closes automatically** when PR merges to main (via `Closes #` syntax in PR body)

### Retry Logic

The system implements automatic error recovery:
- **Max 3 retry attempts** per spec
- **Tracks retries** with labels (retry:1, retry:2, retry:3)
- **On 3rd failure**: Marks issue as `tdd-spec:failed`, adds explanatory comment
- **Pipeline continues**: Failed specs don't block queue processing

### Important Rules

- **ALWAYS** run both agents (e2e-test-fixer then refactor-auditor)
- **ALWAYS** create PR - REQUIRED even if only `.fixme()` removal, NO EXCEPTIONS
- **DO NOT** modify multiple specs at once (one spec = one issue)
- **DO NOT** modify test logic - only remove `.fixme()` and implement code
- **DO NOT** close issues manually - they close automatically on PR merge
- **DO NOT** consider the task complete until PR is created
- **DO** commit with format: `fix: implement {SPEC-ID}`
- **DO** create PR with `tdd-automation` label and include `Closes #<issue_number>` in PR body (⚠️ no extra text after number)
- **DO** retry up to 3 times on validation failures

### Completion Checklist

- [ ] `.fixme()` removed, code implemented, both agents run
- [ ] Copyright headers added, changes committed/pushed
- [ ] **⚠️ CRITICAL: PR created** with `tdd-automation` label and `Closes #<issue_number>` in body
- [ ] Auto-merge enabled after validation passes

**Remember**: PR creation is mandatory - Issue #1319 failed because PR was not created.

### Queue System Architecture

```
Push new tests → Scan → Create spec issues → Queue
                                               ↓
         Processor picks oldest spec (every 15 min, configured PAT account)
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
- **PR validation**: test.yml (lint, typecheck, unit tests, E2E regression)
- **Auto-merge**: Enabled after validation passes
- **Issue closure**: Automatic on PR merge to main

### Current Status

View current progress:
```bash
bun run scripts/tdd-automation/track-progress.ts
```

This generates:
- Overall test progress (passing vs fixme)
- Queue status (queued, in-progress, completed, failed)
- Progress by feature area
- Next specs to implement

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
- **Trademark**: Sovrium™ is a trademark of ESSENTIAL SERVICES (registered in France)
- **Free for**: Internal business use, personal projects, educational purposes, non-competing client deployments
- **NOT allowed**: Commercial hosted/managed services to third parties (requires commercial license)
- **Change Date**: 2029-01-01 (automatically becomes Apache License 2.0)
- **Commercial licensing**: Contact license@sovrium.com for competitive SaaS/hosting use cases
- **Philosophy**: Source-available with time-based open source conversion
- See `LICENSE.md` for BSL 1.1 terms and `TRADEMARK.md` for trademark usage guidelines
