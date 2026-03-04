# CLAUDE.md - Sovrium Project Documentation

> **Note**: This is a streamlined version. Detailed documentation is available in `docs/` directory and imported on-demand when needed.

## Project Context

**Vision**: Sovrium aims to be a configuration-driven application platform (see `VISION.md` for full vision)
**Current Status**: Phase 0 - Foundation (minimal schema with metadata only)
**Implementation Progress**: See `SPEC-PROGRESS.md` for detailed feature tracking and development phases

> 💡 When writing code or tests, keep the target architecture in mind (VISION.md) while working within current capabilities (SPEC-PROGRESS.md)

## Quick Reference

**Project**: Sovrium (npm package: "sovrium")
**Legal Entity**: ESSENTIAL SERVICES (copyright holder & trademark owner)
**Version**: 0.1.0 (explicit `release:` commit triggers CI, manual override: `scripts/release.ts`)
**License**: Business Source License 1.1 (BSL 1.1)
- **Core**: BSL 1.1 - Free for internal/non-commercial use, prevents competitive SaaS hosting
- **Enterprise**: Enterprise License (files with `.ee.` in filename/dirname) - Paid features
- **Change Date**: 2029-01-01 (automatically becomes Apache 2.0)
- **Current status**: No `.ee.` files exist yet (Phase 0 - all code is BSL-licensed)
**Runtime**: Bun 1.3.10 (NOT Node.js)
**Entry Points**:
- Library: `src/index.ts` (module import)
- CLI: `src/cli.ts` (binary executable via `bun run start` or `sovrium` command)

## Core Stack

| Technology | Version | Purpose | Docs |
|-----------|---------|---------|------|
| **Bun** | 1.3.10 | Runtime & package manager | @docs/infrastructure/runtime/bun.md |
| **TypeScript** | ^5.9.3 | Type-safe language | @docs/infrastructure/language/typescript.md |
| **Effect** | ^3.19.19 | Functional programming, DI, error handling | @docs/infrastructure/framework/effect.md |
| **Effect Schema** | ^3.19.19 | Server validation (domain/application/infrastructure) | @docs/infrastructure/framework/effect.md |
| **Hono** | ^4.12.3 | Web framework (API routes, RPC client, OpenAPI) | @docs/infrastructure/framework/hono.md |
| **Zod** | ^4.3.6 | OpenAPI integration ONLY (src/domain/models/api/) + client forms | @docs/infrastructure/api/zod-hono-openapi.md |
| **js-yaml** | ^4.1.1 | YAML parser (CLI config files only) | @docs/infrastructure/parsing/js-yaml.md |
| **Better Auth** | ^1.5.2 | Authentication | @docs/infrastructure/framework/better-auth.md |
| **Drizzle ORM** | ^0.45.1 | Database (PostgreSQL via bun:sql) | @docs/infrastructure/database/drizzle.md |
| **React** | ^19.2.4 | UI library | @docs/infrastructure/ui/react.md |
| **Tailwind CSS** | ^4.2.1 | Styling (programmatic CSS compiler) | @docs/infrastructure/ui/tailwind.md |
| **TanStack Query** | ^5.90.21 | Server state management | @docs/infrastructure/ui/tanstack-query.md |
| **TanStack Table** | ^8.21.3 | Data tables | @docs/infrastructure/ui/tanstack-table.md |

## Authorization & Multi-Tenancy

**Strategy**: RBAC (Role-Based Access Control) + Field-Level Permissions

| Concept | Description |
|---------|-------------|
| **Roles** | admin, member, viewer (3 default roles) |
| **Field-Level Permissions** | Granular read/write control per field based on role |
| **Security** | Return 404 for unauthorized access attempts (prevents enumeration) |

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
bun test:e2e                       # Run all E2E tests (⚠️ AGENTS: FORBIDDEN - use targeted commands below)
bun test:e2e:spec                  # Run @spec tests only (⚠️ AGENTS: FORBIDDEN - too slow for agent execution)
bun test:e2e:regression            # Run @regression tests only (optimized) ← agents use this
bun test:e2e:update-snapshots      # Update ALL snapshots (ARIA + visual)
bun test:e2e:update-snapshots:spec # Update @spec test snapshots only
# Agent-allowed E2E commands: bun test:e2e -- <specific-file>, bun test:e2e:regression, bun run quality

# Two-Tier Quality Pipeline
# Tier 1: Code quality (format, lint, types, tests, coverage, e2e)
bun run quality                    # Run code quality checks with smart E2E detection
bun run quality --skip-e2e         # Skip E2E tests entirely
bun run quality --skip-coverage    # Skip coverage check (gradual adoption)
bun run quality --skip-workflows   # Skip GitHub Actions workflow linting (actionlint)
bun run quality --skip-format      # Skip Prettier formatting check
bun run quality --skip-knip        # Skip Knip unused code detection
bun run quality --include-effect   # Include Effect diagnostics (slow, skipped by default)
bun run quality --no-cache         # Disable all caching (ESLint, Prettier, TypeScript incremental)
# Tier 2: Content quality + reporting (specs, user stories, SPEC-PROGRESS.md)
bun run progress                   # Analyze specs + user stories, generate SPEC-PROGRESS.md
bun run progress --no-error        # Always exit 0 even with warnings/errors (used in CI)
bun run progress --skip-stories    # Skip user story validation
bun run progress --strict          # Fail on any content quality issues
# Both tiers combined
bun run check:all                  # Run quality && progress --strict
# Other utility scripts
bun run validate:specs             # Validate spec test structure and conventions
bun run validate:docs:versions     # Validate documentation versions match package.json
bun run test:cleanup               # Kill zombie test processes (Playwright, browsers)
bun run release patch              # Bump patch version (0.0.2 → 0.0.3)
bun run release minor              # Bump minor version (0.0.2 → 0.1.0)
bun run release major              # Bump major version (0.0.2 → 1.0.0)
bun run release patch --dry-run    # Preview release without changes
bun run release patch --message "…" # Custom CHANGELOG message

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
bun run lint:workflows      # Lint GitHub Actions workflows (actionlint)
bun run format              # Prettier (format all files)
bun run format:check        # Prettier (check formatting without modifying)
bun run typecheck           # TypeScript type checking
bun run clean               # Knip (detect unused code/dependencies)
bun run clean:fix           # Knip (auto-fix unused exports)
bun test:unit               # Unit tests (Bun Test - src/ and scripts/)
bun test:e2e                # E2E tests (Playwright - all) (⚠️ AGENTS: FORBIDDEN)
bun test:e2e:spec           # E2E spec tests (@spec tag) - for development (⚠️ AGENTS: FORBIDDEN)
bun test:e2e:regression     # E2E regression tests (@regression tag) - for CI/pre-merge
bun test:e2e:ui             # E2E tests with Playwright UI
bun test:all                # All tests (unit + E2E regression)

# Release (explicit trigger — push a "release: publish" commit)
# CI: Test → detect "release:" commit → analyze commits → bump version → npm publish → GitHub Release
bun run analyze-commits --dry-run    # Preview what CI would release
# Manual override (emergencies only — CI won't publish, must publish manually):
bun run release patch --message "Description of changes"
git push origin main --follow-tags   # Pushes commit + tag; CI exits early (no releasable commits)
npm publish --provenance --access public  # Must run manually after push

# Agent Workflows (TDD Pipeline)
# See: @docs/development/tdd-automation-pipeline.md for complete TDD automation guide
```

## Smart Testing Strategy

**Two-Tier Architecture**:
- **Tier 1** `bun run quality`: Prettier → ESLint → Workflow Lint → TypeScript → Effect Diagnostics → Unit Tests → Knip → Coverage Check → Smart E2E
- **Tier 2** `bun run progress`: Quality Gate (typecheck) → Spec Analysis → User Story Validation → SPEC-PROGRESS.md generation
- **Both** `bun run check:all`: quality && progress --strict

**E2E Detection**: Analyzes changed files and runs only related @regression specs (skips if docs/scripts only changed).

**Tier 1 Flags** (`bun run quality`):

| Flag | Effect |
|------|--------|
| `--skip-e2e` | Skip E2E tests entirely |
| `--skip-coverage` | Skip domain coverage check |
| `--skip-workflows` | Skip GitHub Actions workflow linting (actionlint) |
| `--skip-format` | Skip Prettier formatting check |
| `--skip-knip` | Skip unused code detection |
| `--include-effect` | Include Effect diagnostics (slow) |
| `--no-cache` | Disable ESLint, Prettier, and TypeScript caching (clean run) |

**Tier 2 Flags** (`bun run progress`):

| Flag | Effect |
|------|--------|
| `--no-error` | Always exit 0, even with warnings/errors (used in CI) |
| `--skip-stories` | Skip user story validation |
| `--strict` | Fail on any content quality issues |

**Coverage**: Domain layer 93.4% (enforced). Other layers not yet enforced.

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
- **Location**: `src/presentation/ui/` (organized by feature)
- **Props**: Extend native HTML element props
- **Styling**: Plain Tailwind CSS classes
- **Exports**: Export both component and props interface

### Test File Naming Convention (CRITICAL - Pattern-Based)
- **Unit Tests**: `*.test.ts` (co-located in `src/` and `scripts/`)
- **E2E Tests**: `*.spec.ts` (in `specs/` directory)
- **Why pattern-based**: Bun test runner uses filename patterns (`bun test .test.ts .test.tsx`) to filter test files
- **Enforcement**: ESLint prevents wrong test runner imports (Playwright in unit tests, Bun Test in E2E tests)
- **See**: `@docs/architecture/testing-strategy/06-test-file-naming-convention.md` for enforcement details

### Unit Test Mocking (CRITICAL - Avoid mock.module())
- **❌ NEVER use `mock.module()` for application modules** - Causes process-global cache contamination
- **✅ USE dependency injection pattern** - Pass mocks as function parameters
- **ONE exception**: Mocking `@/infrastructure/database` barrel is safe (opaque connection object)
- **Why**: `mock.module()` contaminates Bun's module cache for ALL test files (even after `mock.restore()`)
- **Impact**: 24 CI failures on Linux (tests passed locally on macOS due to file iteration differences)
- **See**: `@docs/infrastructure/testing/bun-test.md#-critical-mockmodule-process-global-contamination` for full details

### Snapshot Testing (E2E Tests)
- **ARIA Snapshots** (`toMatchAriaSnapshot`): For structure & accessibility validation
- **Visual Screenshots** (`toHaveScreenshot`): For theme, layout & visual regression
- **Traditional Assertions**: For behavior, logic & specific values
- **Storage**: Snapshots saved in `specs/**/__snapshots__/` (committed to git)
- **Update Command**: `bun test:e2e:update-snapshots` after implementing features
- **Guide**: See `@docs/architecture/testing-strategy/` for decision matrix & best practices

### test.step Pattern (@regression Tests)
- **Mandatory for @regression tests**: Wrap workflow scenarios in descriptive `test.step()` calls
- **Optional for @spec tests**: Recommended for complex tests (50+ lines) to enhance reporting
- **Benefits**: Better CI logs, improved debugging, self-documenting test flows, enhanced HTML reports
- **See**: `@docs/architecture/testing-strategy/14-using-test-steps-for-readability.md` for comprehensive guide with architectural rationale, patterns, and adoption metrics

### Commit Messages (Conventional Commits - REQUIRED)
- `feat:` → Determines **minor** bump when CI analyzes commits at release time
- `fix:`, `perf:` → Determines **patch** bump when CI analyzes commits at release time
- `!` (e.g., `feat!:`) or `BREAKING CHANGE:` in body → Determines **major** bump
- `chore(release):` → Created by CI automated release — **never create manually**
- `release:` → **Triggers CI release gate** (e.g., `release: publish`). `feat:/fix:` commits alone do NOT trigger a release — only a `release:` HEAD commit does.
- `docs:`, `style:`, `refactor:`, `test:`, `chore:`, `ci:`, `build:` → No version bump (appear in changelog only if mixed with releasable commits)

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
│   ├── architecture/            # Architecture patterns
│   └── user-stories/            # Feature specifications with E2E spec IDs
├── scripts/                     # Build & utility scripts (TypeScript, run by Bun)
│   ├── **/*.ts                  # TypeScript scripts (executable with Bun)
│   └── **/*.test.ts             # Script unit tests (co-located, Bun Test)
├── src/                         # Layer-based architecture (see @docs/architecture/layer-based-architecture.md)
│   ├── domain/                  # Domain Layer - Pure business logic
│   ├── application/             # Application Layer - Use cases, orchestration
│   │   ├── ports/               # Infrastructure interfaces (dependency inversion)
│   │   │   ├── repositories/    # Data access ports (Effect Context.Tag)
│   │   │   ├── services/        # Capability ports (CSS, rendering, server)
│   │   │   └── models/          # Shared type definitions
│   │   └── use-cases/           # Effect programs, workflow orchestration
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
- **TDD Automation**: `@docs/development/tdd-automation-pipeline.md`
- **User Stories & Specifications**: `@docs/user-stories/` (Feature requirements with E2E spec IDs)

**Slash Command**: Use `/docs` to list all available documentation files

## LLM Documentation URLs (Infrastructure Reference)

When implementing features that use infrastructure technologies, fetch the official LLM-optimized documentation for the latest API reference. Use these **when you need to understand a framework's API, resolve usage questions, or implement features involving these technologies** — not for every task.

| Technology | llms.txt URL | When to Fetch |
|-----------|-------------|---------------|
| **Bun** | https://bun.sh/llms.txt | Bun APIs, runtime features, package manager |
| **Effect** | https://effect.website/llms.txt | Effect.gen, Schema, Layer, Context patterns |
| **Hono** | https://hono.dev/llms.txt | Route handlers, middleware, SSR patterns |
| **Better Auth** | https://better-auth.com/llms.txt | Auth flows, plugins, session management |
| **Drizzle** | https://orm.drizzle.team/llms.txt | Schema definitions, queries, migrations |
| **React** | https://react.dev/llms.txt | Components, hooks, React 19 features |
| **TanStack** | https://tanstack.com/llms.txt | TanStack Query, TanStack Table |
| **Zod** | https://zod.dev/llms.txt | Schema validation, OpenAPI integration |
| **Prettier** | https://prettier.io/llms.txt | Formatting options, configuration |

**Usage**: `WebFetch(url: "https://hono.dev/llms.txt", prompt: "How to use zValidator middleware")`

## Development Workflow

1. **Write code** following standards above
2. **Test locally**: `bun run lint && bun run format && bun run typecheck && bun test:unit`
3. **Commit**: Use conventional commits (`feat:`, `fix:`, etc.)
4. **Push**: GitHub Actions runs tests
5. **Release**: Push a `release: publish` commit to trigger CI release (analyzes conventional commits since last tag for version bump)
6. **Manual release** (emergency): `bun run release patch --message "..."` then `git push origin main --follow-tags` then `npm publish --provenance --access public` (CI won't publish — see `@docs/infrastructure/release/release-script.md`)

## TDD Automation Pipeline (V3)

> **Primary Documentation**: See `@docs/development/tdd-automation-pipeline.md` for comprehensive pipeline documentation.

**Architecture**: GitHub PR-based state management with serial processing (1 spec at a time).

**Workflow Files**:
- `tdd-pr-creator.yml` - Scans for `.fixme()` specs, creates TDD PRs (triggers: schedule every 4 hours, manual)
- `test.yml` - Extended with TDD handling (auto-merge on success, dispatch Claude Code on failure)
- `tdd-claude-code.yml` - Runs Claude Code to fix failing specs with cost protection
- `tdd-monitor.yml` - Detects stale TDD PRs (failed >30 min without Claude Code activity)
- `tdd-branch-sync.yml` - Syncs TDD branches with main to prevent staleness
- `tdd-cleanup.yml` - Cancels Claude Code runs when TDD PRs reach terminal state (merged/manual-intervention)

**State Management**:
- PR-based state via labels and title format
- PR Title: `[TDD] Implement <spec-id>`
- Serial processing: Only one active TDD PR at a time
- Error handling: ALL errors add `manual-intervention` label, keep PR open, trigger PR Creator

**Quick Commands**:
```bash
# View active TDD PRs (prefer GitHub MCP: mcp__github__search_pull_requests with label filter)
gh pr list --label "tdd-automation"

# View PRs needing manual intervention (prefer GitHub MCP: mcp__github__search_pull_requests)
gh pr list --label "tdd-automation:manual-intervention"

# Manually trigger PR creator (no MCP equivalent — must use gh CLI)
gh workflow run tdd-pr-creator.yml
```

**Labels Used**:
- `tdd-automation` - PR identification (all TDD PRs)
- `tdd-automation:manual-intervention` - Needs human review (on any error)

**Cost Protection**: $20 per run (Opus 4.6, all attempts), $200/day, $1000/week limits with 80% warnings

**Full Documentation**: `@docs/development/tdd-automation-pipeline.md`

## GitHub Operations (MCP vs gh CLI)

**Prefer GitHub MCP tools** over `gh` CLI for all PR and issue operations. MCP tools provide structured, type-safe access without shell escaping or output parsing.

| Operation | MCP Tool (Preferred) | `gh` CLI (Fallback) |
|-----------|---------------------|---------------------|
| List/search PRs | `mcp__github__list_pull_requests`, `search_pull_requests` | `gh pr list` |
| View PR details | `mcp__github__pull_request_read` (method: `get`) | `gh pr view` |
| View PR diff | `mcp__github__pull_request_read` (method: `get_diff`) | `gh pr diff` |
| View PR status | `mcp__github__pull_request_read` (method: `get_status`) | `gh pr checks` |
| View PR comments | `mcp__github__pull_request_read` (method: `get_comments`) | `gh pr view --json comments` |
| Create PR | `mcp__github__create_pull_request` | `gh pr create` |
| Update PR | `mcp__github__update_pull_request` | `gh pr edit` |
| Merge PR | `mcp__github__merge_pull_request` | `gh pr merge` |
| Comment on PR/issue | `mcp__github__add_issue_comment` | `gh pr comment` / `gh issue comment` |
| List issues | `mcp__github__list_issues`, `search_issues` | `gh issue list` |
| View issue | `mcp__github__issue_read` | `gh issue view` |
| Create/update issue | `mcp__github__issue_write` | `gh issue create` / `gh issue edit` |
| Create branch | `mcp__github__create_branch` | `gh api` / `git` |

**Must use `gh` CLI** (no MCP equivalent):
- `gh run view/list/cancel` — GitHub Actions run management
- `gh workflow run` — Trigger workflows
- `gh api repos/.../actions/...` — Custom Actions API calls
- `gh run download` — Download workflow artifacts

## Key Differences from Typical Stacks

- ❌ **NOT Node.js** - Use Bun exclusively
- ❌ **NOT npm/yarn/pnpm** - Use Bun package manager
- ❌ **NOT CommonJS** - ES Modules only
- ❌ **NOT manual memoization** - React 19 Compiler handles it
- ✅ **DO use TypeScript directly** - Bun executes .ts files natively
- ✅ **DO use Effect.gen** - Application layer workflows
- ✅ **DO use path aliases** - `@/presentation/ui/pages/HomePage`
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
