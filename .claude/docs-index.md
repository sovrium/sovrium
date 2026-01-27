# Documentation Index

> **Import Strategy**: Only import documentation files when you're actively working on related features. This on-demand approach reduces token usage by 60-80%.

> **Note on Syntax**: This document uses `@docs/` syntax optimized for Claude Code AI consumption. This is **NOT a TypeScript path alias** (only `@/*` is configured in tsconfig.json). Human developers should interpret `@docs/` as the `docs/` directory in the project root.
>
> **Example**: `@docs/infrastructure/runtime/bun.md` → `docs/infrastructure/runtime/bun.md`

---

## Product Vision & Roadmap

- `VISION.md` - Target state and product vision (future capabilities)
- `@SPEC-PROGRESS.md` - Test coverage progress, TDD automation stats, and actionable next steps

## Schema Architecture

- `@docs/specifications/schema-architecture.md` - Multi-file JSON Schema structure with $ref, validation tools, and best practices
- `@docs/specifications/specs.schema.json` - Root schema (orchestrator with $ref to feature schemas)
- `@docs/specifications/spec-to-e2e-pattern.md` - Pattern for translating JSON Schema specs to E2E tests (Triple-Documentation: What/Why/Who-When)

## Infrastructure

### Runtime & Language
- `@docs/infrastructure/runtime/bun.md` - Bun runtime & package manager
- `@docs/infrastructure/language/typescript.md` - TypeScript configuration

### Frameworks & Core
- `@docs/infrastructure/framework/effect.md` - Effect.ts patterns (Effect Schema for server validation)
- `@docs/infrastructure/framework/hono.md` - Hono web framework
- `@docs/infrastructure/api/hono-rpc-openapi.md` - Hono RPC client + OpenAPI documentation (dual-track pattern)
- `@docs/infrastructure/api/zod-hono-openapi.md` - Zod + Hono + OpenAPI integration (ESLint enforcement, usage patterns)
- `@docs/infrastructure/api/scalar-api-reference.md` - Scalar API Reference (interactive API documentation UI)
- `@docs/infrastructure/framework/better-auth.md` - Authentication
- `@docs/infrastructure/database/drizzle.md` - Drizzle ORM

### UI & Frontend
- `@docs/infrastructure/ui/react.md` - React 19 patterns
- `@docs/infrastructure/ui/react-hook-form.md` - Form management (client-side, Zod validation)
- `@docs/infrastructure/ui/tailwind.md` - Tailwind CSS
- `@docs/infrastructure/ui/tanstack-query.md` - TanStack Query
- `@docs/infrastructure/ui/tanstack-table.md` - TanStack Table

### CSS & Styling
- `@docs/infrastructure/css/css-compiler.md` - Programmatic Tailwind CSS generation
- `@docs/infrastructure/css/postcss.md` - PostCSS transformation pipeline (required by Tailwind v4)

### Build Tools
- `@docs/infrastructure/build/jiti.md` - Runtime TypeScript loader (transitive dependency via Tailwind)

### Email
- `@docs/infrastructure/email/nodemailer.md` - Nodemailer SMTP email client (transporter, Effect service, Better Auth integration)
- `@docs/infrastructure/email/mailpit.md` - Local email testing with web UI (local SMTP server)

### Parsing
- `@docs/infrastructure/parsing/js-yaml.md` - YAML parser for CLI configuration files

### Utilities
(No utilities currently documented - use Effect.DateTime for date handling)

### Quality & Testing
- `@docs/infrastructure/quality/eslint.md` - ESLint linting
- `@docs/infrastructure/quality/prettier.md` - Prettier formatting
- `@docs/infrastructure/quality/prettier-plugin-tailwindcss.md` - Automatic Tailwind class sorting (Prettier plugin)
- `@docs/infrastructure/quality/knip.md` - Dead code detection
- `@docs/infrastructure/testing/bun-test.md` - Unit testing
- `@docs/infrastructure/testing/react-testing-library.md` - React component testing (RTL + Happy DOM + Bun)
- `@docs/infrastructure/testing/playwright.md` - E2E testing
- `@docs/infrastructure/testing/testcontainers.md` - Docker-based test database isolation
- `@docs/architecture/testing-strategy/15-authentication-testing-strategy.md` - Separate auth method test files (Bearer token, API key)

### CI/CD & Release
- `@docs/infrastructure/cicd/workflows.md` - GitHub Actions
- `@docs/infrastructure/release/semantic-release.md` - Automated releases

## Architecture

### Core Architecture Patterns

- `@docs/architecture/functional-programming.md` - FP principles
- `@docs/architecture/layer-based-architecture.md` - Layered architecture
- `@docs/architecture/naming-conventions.md` - Comprehensive naming conventions (files, variables, functions, classes, types)
- `@docs/architecture/file-naming-conventions.md` - Detailed file naming guide
- `@docs/architecture/api-conventions.md` - Convention-based API routing
- `@docs/architecture/testing-strategy.md` - F.I.R.S.T principles
- `@docs/architecture/performance-optimization.md` - Performance patterns
- `@docs/architecture/security-best-practices.md` - Security guidelines

### Architectural Decision Records (ADRs)

- `@docs/architecture/decisions/001-validation-library-split.md` - ADR 001: Validation library split (Zod for client, Effect Schema for server)
- `@docs/architecture/decisions/002-domain-feature-isolation.md` - ADR 002: Domain feature isolation patterns
- `@docs/architecture/decisions/003-runtime-sql-migrations.md` - ADR 003: Runtime SQL migration generation from JSON config
- `@docs/architecture/decisions/004-presentation-layer-feature-based-structure.md` - ADR 004: Presentation layer feature-based structure
- `@docs/architecture/decisions/005-authorization-strategy.md` - ADR 005: Authorization strategy for table APIs (RBAC + field-level permissions)
- `@docs/architecture/decisions/006-table-permission-configuration.md` - ADR 006: Table permission configuration storage and management (Proposed)
- `@docs/architecture/decisions/007-soft-delete-by-default.md` - ADR 007: Soft delete by default for all tables

### Cross-Cutting Architecture Patterns

- `@docs/architecture/patterns/config-driven-schema-generation.md` - Config-driven database schema generation pattern
- `@docs/architecture/patterns/database-access-strategy.md` - Hybrid database access (Drizzle ORM for internal tables, manual SQL for user tables)
- `@docs/architecture/patterns/internal-table-naming-convention.md` - Internal table naming with `_sovrium_` prefix for namespace isolation
- `@docs/architecture/patterns/soft-delete-by-default.md` - Soft delete by default (Airtable-style trash/restore UX)
- `@docs/architecture/patterns/theming-architecture.md` - Domain-driven CSS compilation with Tailwind @theme directive
- `@docs/architecture/patterns/i18n-centralized-translations.md` - Centralized translations with config-driven i18n

## Development Workflows

- `@docs/development/tdd-automation-pipeline.md` - **TDD Automation Pipeline (V3)** - PR-based state management with serial processing, cost protection, and auto-merge (automated test fixing via GitHub Actions + Claude Code)
- `@docs/development/copyright-headers.md` - Copyright header automation and management
- `@.claude/SKILLS.md` - Skills reference (autonomous utilities for validation, translation, and code quality)

---

## Usage Examples

### Working with Authentication
```
Import: @docs/infrastructure/framework/better-auth.md
```

### Working with Forms
```
Import: @docs/infrastructure/ui/react-hook-form.md
Import: @docs/infrastructure/ui/tailwind.md
```

### Working with API Routes
```
Import: @docs/infrastructure/framework/hono.md
Import: @docs/infrastructure/api/hono-rpc-openapi.md
```

### Working with Database
```
Import: @docs/infrastructure/database/drizzle.md
Import: @docs/architecture/patterns/database-access-strategy.md
Import: @docs/architecture/patterns/internal-table-naming-convention.md
Import: @docs/architecture/layer-based-architecture.md
Import: @docs/architecture/decisions/003-runtime-sql-migrations.md
Import: @docs/architecture/patterns/config-driven-schema-generation.md
```

### Working with Schemas & Validation
```
Import: @docs/infrastructure/framework/effect.md
Import: @docs/specifications/schema-architecture.md
```

### Working with CLI Configuration
```
Import: @docs/infrastructure/parsing/js-yaml.md
```
