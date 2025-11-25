# Architecture Documentation Index

## Overview

This index provides a comprehensive guide to Sovrium's architecture documentation, showing relationships between architectural concepts and their implementation in infrastructure, enforcement mechanisms, and cross-references.

---

## Architecture Documents

### Core Architecture Patterns

| Document                        | Purpose                                          | Enforcement                        |
| ------------------------------- | ------------------------------------------------ | ---------------------------------- |
| **functional-programming.md**   | Pure functions, immutability, Effect.ts patterns | ESLint (eslint-plugin-functional)  |
| **layer-based-architecture.md** | 4-layer architecture (aspirational)              | ESLint boundaries (not yet active) |
| **testing-strategy.md**         | F.I.R.S.T principles, test organization          | Bun Test + Playwright              |
| **performance-optimization.md** | React 19 Compiler, Effect.ts, Bun optimization   | ESLint React warnings              |
| **security-best-practices.md**  | Authentication, validation, CSRF/XSS protection  | ESLint Drizzle rules               |

### Architectural Decision Records (ADRs)

| Document                                          | Purpose                                                         | Date       | Status   |
| ------------------------------------------------- | --------------------------------------------------------------- | ---------- | -------- |
| **decisions/001-validation-library-split.md**     | Zod for client validation, Effect Schema for server             | 2025-01-20 | Accepted |
| **decisions/002-domain-feature-isolation.md**     | Strict feature isolation in domain models                       | 2025-01-22 | Accepted |
| **decisions/003-runtime-sql-migrations.md**       | Runtime SQL generation from JSON config (not Drizzle .ts files) | 2025-01-25 | Accepted |
| **decisions/004-presentation-layer-structure.md** | Feature-based component organization                            | 2025-01-18 | Accepted |
| **decisions/005-authorization-strategy.md**       | RBAC + field-level permissions with Better Auth organizations   | 2025-01-25 | Accepted |

### Cross-Cutting Architecture Patterns

| Document                                        | Purpose                                                      | Enforcement                                    |
| ----------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------- |
| **patterns/config-driven-schema-generation.md** | Runtime database schema generation from JSON config          | ESLint boundaries + TypeScript + Effect Schema |
| **patterns/theming-architecture.md**            | Domain-driven CSS compilation with Tailwind @theme directive | ESLint boundaries + functional + TypeScript    |
| **patterns/i18n-centralized-translations.md**   | Centralized translations with config-driven i18n             | Effect Schema validation                       |

---

## Cross-References: Architecture → Infrastructure

### Functional Programming

**Architecture Document**: `functional-programming.md`

**Related Infrastructure**:

- `@docs/infrastructure/framework/effect.md` - Effect.ts for functional programming
- `@docs/infrastructure/language/typescript.md` - TypeScript strict mode, readonly types
- `@docs/infrastructure/quality/eslint.md#functional-programming-enforcement` - Immutability rules
- `@docs/infrastructure/runtime/bun.md` - Native TypeScript execution

**Enforcement**:

- ✅ **eslint-plugin-functional**: Enforces `readonly`, prevents mutations, requires immutable data
- ✅ **TypeScript**: Strict mode, type safety, readonly types
- ⚠️ **Manual review**: Effect.gen patterns, pure functions in domain layer

**Key Concepts**:

- DRY (Don't Repeat Yourself) - single source of truth
- Pure functions (no side effects)
- Immutability (no mutations)
- Effect.ts for controlled side effects
- Composition over inheritance

---

### Layer-Based Architecture

**Architecture Document**: `layer-based-architecture.md`

**Related Infrastructure**:

- `@docs/infrastructure/quality/eslint.md#architectural-enforcement` - Boundary enforcement (aspirational)
- `@docs/infrastructure/framework/effect.md` - Layer/Context for dependency injection
- `@docs/infrastructure/framework/hono.md` - Presentation layer (API routes)
- `@docs/infrastructure/ui/react.md` - Presentation layer (UI components)
- `@docs/infrastructure/database/drizzle.md` - Infrastructure layer (database)

**Enforcement**:

- ⚠️ **eslint-plugin-boundaries**: Configured but not active (directory structure doesn't match)
- ⚠️ **Manual review**: Current structure is flat (src/components/, src/lib/, src/services/)
- ⏳ **Future**: Will be enforced once directory structure matches 4-layer pattern

**Key Concepts**:

- **Domain** - Business logic, pure functions
- **Application** - Use cases, Effect programs
- **Infrastructure** - Database, external APIs
- **Presentation** - UI components, API routes

---

### Testing Strategy

**Architecture Document**: `testing-strategy.md`

**Related Infrastructure**:

- `@docs/infrastructure/testing/bun-test.md` - Unit testing with Bun Test
- `@docs/infrastructure/testing/playwright.md` - E2E testing with Playwright
- `@docs/infrastructure/quality/eslint.md` - Linting for tests
- `@docs/infrastructure/framework/effect.md` - Testing Effect programs

**Enforcement**:

- ✅ **GitHub Actions**: Automated test runs on CI/CD (`.github/workflows/`)
- ✅ **Pre-commit**: Can run tests locally before commit
- ✅ **Bun Test**: Built-in test runner (no jest/vitest needed)

**Key Concepts**:

- F.I.R.S.T principles (Fast, Isolated, Repeatable, Self-validating, Timely)
- Co-located unit tests (`**/*.test.ts`)
- Separate E2E tests (`tests/**/*.spec.ts`)
- Mock dates/random with Bun.spyOn

---

### Performance Optimization

**Architecture Document**: `performance-optimization.md`

**Related Infrastructure**:

- `@docs/infrastructure/ui/react.md#react-19-compiler` - Automatic memoization
- `@docs/infrastructure/framework/effect.md` - Lazy evaluation, parallel execution
- `@docs/infrastructure/runtime/bun.md` - Native TypeScript, fast startup
- `@docs/infrastructure/database/drizzle.md` - Efficient queries, indexes
- `@docs/infrastructure/ui/tanstack-query.md` - Caching, prefetching
- `@docs/infrastructure/ui/tailwind.md` - JIT compilation, purging
- `@docs/infrastructure/quality/eslint.md#react-19-compiler-guidance` - Warns against manual memoization

**Enforcement**:

- ⚠️ **ESLint warnings**: Warns when using `useMemo`, `useCallback`, `React.memo` (React 19 Compiler handles this)
- ✅ **Tailwind JIT**: Automatic unused CSS purging in production
- ⚠️ **Manual profiling**: React DevTools Profiler, Bun performance API

**Key Concepts**:

- Trust React 19 Compiler (avoid manual memoization)
- Effect.ts lazy evaluation (only executes when run)
- Bun native performance (4x faster cold starts)
- TanStack Query stale-while-revalidate
- Code splitting (React.lazy, Hono route splitting)

---

### Security Best Practices

**Architecture Document**: `security-best-practices.md`

**Related Infrastructure**:

- `@docs/infrastructure/framework/better-auth.md` - Authentication, session management
- `@docs/infrastructure/framework/effect.md` - Effect Schema validation
- `@docs/infrastructure/database/drizzle.md` - Parameterized queries
- `@docs/infrastructure/ui/react-hook-form.md` - Client-side form validation (Zod)
- `@docs/infrastructure/quality/eslint.md#database-safety-rules` - WHERE clause enforcement
- `@docs/infrastructure/framework/hono.md` - CSRF middleware, security headers

**Enforcement**:

- ✅ **eslint-plugin-drizzle**: Enforces WHERE clauses on DELETE/UPDATE (prevents mass operations)
- ✅ **Better Auth**: Automatic password hashing (bcrypt), secure session cookies
- ✅ **Effect Schema**: Server-side validation (all API inputs)
- ✅ **Zod**: Client-side validation (React Hook Form)
- ✅ **TypeScript**: Type safety prevents many security bugs

**Key Concepts**:

- Authentication with Better Auth (secure sessions, httpOnly cookies)
- Validation split: Zod (client), Effect Schema (server)
- SQL injection prevention (Drizzle parameterized queries)
- XSS prevention (React auto-escaping)
- CSRF protection (sameSite cookies)

---

### Theming Architecture

**Architecture Document**: `patterns/theming-architecture.md`

**Related Infrastructure**:

- `@docs/infrastructure/ui/tailwind.md` - Tailwind CSS v4, @theme directive, JIT compilation
- `@docs/infrastructure/framework/effect.md` - Effect Schema for theme validation, functional compilation
- `@docs/infrastructure/quality/eslint.md#functional-programming-enforcement` - Immutability rules for theme models
- `@docs/infrastructure/quality/eslint.md#architectural-enforcement` - Layer boundaries for theme/CSS compiler

**Enforcement**:

- ✅ **eslint-plugin-boundaries**: Enforces domain theme models cannot import infrastructure
- ✅ **eslint-plugin-functional**: Enforces theme immutability, no mutations
- ✅ **TypeScript strict mode**: Type safety for theme models and CSS compiler
- ⚠️ **Manual review**: Semantic naming conventions, progressive scales, design system quality

**Key Concepts**:

- Domain-driven theme models (pure Effect Schemas)
- Infrastructure CSS compiler (Tailwind @theme generation)
- Zero variable substitution (direct Tailwind utilities only)
- Functional compilation with in-memory caching (Effect.Ref)
- Layer-based architecture integration (domain → infrastructure flow)

---

### Config-Driven Schema Generation / Runtime SQL Migrations

**Architecture Documents**: `patterns/config-driven-schema-generation.md`, `decisions/003-runtime-sql-migrations.md`

**Related Infrastructure**:

- `@docs/infrastructure/database/drizzle.md` - Drizzle ORM for static schemas (Better Auth)
- `@docs/infrastructure/database/runtime-sql-migrations.md` - Quick reference for runtime migrations
- `@docs/infrastructure/database/runtime-sql-migrations/` - 9-part deep dive (implementation guide)
- `@docs/infrastructure/framework/effect.md` - Effect Schema for config validation
- `@docs/infrastructure/runtime/bun.md` - bun:sql native driver for SQL execution
- `@docs/infrastructure/quality/eslint.md#architectural-enforcement` - Layer boundaries

**Enforcement**:

- ✅ **eslint-plugin-boundaries**: Infrastructure database layer isolated from application use-cases
- ✅ **TypeScript strict mode**: Type safety for SQL generator and migration executor
- ✅ **Effect Schema**: Runtime validation of JSON config (30+ field types)
- ⚠️ **Manual review**: SQL DDL correctness, transaction handling, checksum optimization

**Key Concepts**:

- JSON config as single source of truth for user-defined tables
- Direct SQL generation (not Drizzle .ts file generation)
- Transactional migrations (all-or-nothing with ROLLBACK)
- Checksum optimization (skip generation if config unchanged)
- ID-based rename detection (prevents data loss)
- Virtual fields (formula/rollup) skip column creation

**See Also**:

- [ADR 003: Runtime SQL Migrations](../decisions/003-runtime-sql-migrations.md) - Decision rationale and alternatives
- [Pattern: Config-Driven Schema Generation](../patterns/config-driven-schema-generation.md) - When to use, trade-offs, examples
- [E2E Specs](../../../specs/migrations/) - 27 spec tests covering all migration scenarios

---

## Infrastructure Documentation Map

### Runtime & Language

| Document                 | Purpose                          | Used By                   |
| ------------------------ | -------------------------------- | ------------------------- |
| `runtime/bun.md`         | Bun runtime, package manager     | All architecture patterns |
| `language/typescript.md` | TypeScript compiler, strict mode | All architecture patterns |

### Frameworks

| Document                   | Purpose                                      | Used By                                           |
| -------------------------- | -------------------------------------------- | ------------------------------------------------- |
| `framework/effect.md`      | Functional programming, dependency injection | Functional Programming, Layer-Based Architecture  |
| `framework/hono.md`        | Web framework, API routes                    | Layer-Based Architecture (Presentation), Security |
| `framework/better-auth.md` | Authentication, session management           | Security Best Practices                           |

### Database

| Document              | Purpose                 | Used By                                                          |
| --------------------- | ----------------------- | ---------------------------------------------------------------- |
| `database/drizzle.md` | Drizzle ORM, PostgreSQL | Layer-Based Architecture (Infrastructure), Security, Performance |

### UI

| Document                | Purpose                          | Used By                                              |
| ----------------------- | -------------------------------- | ---------------------------------------------------- |
| `ui/react.md`           | React 19, automatic compiler     | Layer-Based Architecture (Presentation), Performance |
| `ui/tailwind.md`        | Tailwind CSS v4, JIT compilation | Performance Optimization                             |
| `ui/react-hook-form.md` | Form management with Zod         | Security (client-side validation)                    |
| `ui/tanstack-query.md`  | Server state management, caching | Performance Optimization                             |
| `ui/tanstack-table.md`  | Data tables                      | Layer-Based Architecture (Presentation)              |

### Quality

| Document              | Purpose                            | Used By                                 |
| --------------------- | ---------------------------------- | --------------------------------------- |
| `quality/eslint.md`   | Linting, architectural enforcement | All architecture patterns (enforcement) |
| `quality/prettier.md` | Code formatting                    | All architecture patterns               |
| `quality/knip.md`     | Dead code detection                | All architecture patterns               |

### Testing

| Document                | Purpose      | Used By          |
| ----------------------- | ------------ | ---------------- |
| `testing/bun-test.md`   | Unit testing | Testing Strategy |
| `testing/playwright.md` | E2E testing  | Testing Strategy |

### CI/CD & Release

| Document                      | Purpose                           | Used By                   |
| ----------------------------- | --------------------------------- | ------------------------- |
| `cicd/workflows.md`           | GitHub Actions, automated testing | Testing Strategy          |
| `release/semantic-release.md` | Automated releases                | All architecture patterns |

---

## Enforcement Mechanisms

Sovrium uses multiple layers of enforcement to ensure architectural principles are followed:

### 1. ESLint Enforcement (Build-Time)

| Plugin                        | What It Enforces                           | Architecture Document       |
| ----------------------------- | ------------------------------------------ | --------------------------- |
| **eslint-plugin-functional**  | Immutability, no mutations, pure functions | functional-programming.md   |
| **eslint-plugin-boundaries**  | Layer isolation (aspirational)             | layer-based-architecture.md |
| **eslint-plugin-drizzle**     | WHERE clauses on DELETE/UPDATE             | security-best-practices.md  |
| **eslint-plugin-react-hooks** | React 19 best practices                    | performance-optimization.md |

**See**: `@docs/infrastructure/quality/eslint.md` for complete ESLint configuration

### 2. TypeScript Enforcement (Compile-Time)

| Feature                | What It Enforces             | Architecture Document     |
| ---------------------- | ---------------------------- | ------------------------- |
| **Strict mode**        | Type safety, no implicit any | functional-programming.md |
| **readonly types**     | Immutability at type level   | functional-programming.md |
| **Effect error types** | Explicit error handling      | functional-programming.md |

**See**: `@docs/infrastructure/language/typescript.md` for TypeScript configuration

### 3. Effect.ts Enforcement (Runtime)

| Feature           | What It Enforces                | Architecture Document       |
| ----------------- | ------------------------------- | --------------------------- |
| **Effect Schema** | Server-side input validation    | security-best-practices.md  |
| **Layer/Context** | Dependency injection boundaries | layer-based-architecture.md |
| **Effect.gen**    | Controlled side effects         | functional-programming.md   |

**See**: `@docs/infrastructure/framework/effect.md` for Effect.ts patterns

### 4. Better Auth Enforcement (Runtime)

| Feature                        | What It Enforces             | Architecture Document      |
| ------------------------------ | ---------------------------- | -------------------------- |
| **Automatic password hashing** | Secure password storage      | security-best-practices.md |
| **Session cookies**            | HttpOnly, Secure, SameSite   | security-best-practices.md |
| **Session expiration**         | Automatic session management | security-best-practices.md |

**See**: `@docs/infrastructure/framework/better-auth.md` for authentication patterns

### 5. Testing Enforcement (CI/CD)

| Tool               | What It Enforces    | Architecture Document |
| ------------------ | ------------------- | --------------------- |
| **Bun Test**       | Unit tests pass     | testing-strategy.md   |
| **Playwright**     | E2E tests pass      | testing-strategy.md   |
| **GitHub Actions** | Automated test runs | testing-strategy.md   |

**See**: `@docs/infrastructure/testing/` for testing documentation

---

## Validation Split: Client vs Server

Sovrium uses different validation libraries depending on the context:

| Context         | Library           | Use Case                                    | Architecture Document      |
| --------------- | ----------------- | ------------------------------------------- | -------------------------- |
| **Client-side** | **Zod**           | React Hook Form validation, shadcn/ui forms | security-best-practices.md |
| **Server-side** | **Effect Schema** | API input validation, business logic        | security-best-practices.md |

**Why Split?**

- Zod: Optimized for client-side, better React Hook Form integration
- Effect Schema: Integrates with Effect.ts ecosystem, better error handling

**See**:

- `@docs/infrastructure/ui/react-hook-form.md` for client-side validation
- `@docs/infrastructure/framework/effect.md` for server-side validation

---

## Common Patterns

### Pattern: React Component with Form Validation

**Architecture Documents**: security-best-practices.md, layer-based-architecture.md

**Infrastructure Stack**:

1. React 19 (`ui/react.md`) - Component rendering
2. React Hook Form (`ui/react-hook-form.md`) - Form state management
3. Zod (`ui/react-hook-form.md`) - Client-side validation
4. Tailwind CSS (`ui/tailwind.md`) - Styling with utility classes

**Example Location**: Presentation Layer (aspirational: `src/presentation/components/`)

---

### Pattern: API Route with Effect.ts

**Architecture Documents**: functional-programming.md, layer-based-architecture.md, security-best-practices.md

**Infrastructure Stack**:

1. Hono (`framework/hono.md`) - HTTP routing
2. Effect.ts (`framework/effect.md`) - Application logic
3. Effect Schema (`framework/effect.md`) - Input validation
4. Drizzle ORM (`database/drizzle.md`) - Database queries
5. Better Auth (`framework/better-auth.md`) - Authentication

**Example Location**: Presentation Layer (API) + Application Layer (aspirational: `src/presentation/routes/`, `src/application/usecases/`)

---

### Pattern: Database Query with Safety

**Architecture Documents**: security-best-practices.md, layer-based-architecture.md, performance-optimization.md

**Infrastructure Stack**:

1. Drizzle ORM (`database/drizzle.md`) - Parameterized queries
2. Effect.ts (`framework/effect.md`) - Error handling
3. ESLint Drizzle plugin (`quality/eslint.md#database-safety-rules`) - WHERE clause enforcement

**Example Location**: Infrastructure Layer (aspirational: `src/infrastructure/repositories/`)

---

## Aspirational vs Implemented

### ✅ Implemented and Enforced

- **Functional Programming**: ESLint enforces immutability, TypeScript enforces types
- **Effect.ts Patterns**: Effect Schema validates inputs, Effect.gen handles effects
- **Security**: Better Auth handles authentication, Drizzle prevents SQL injection
- **Testing**: Bun Test + Playwright run automatically on CI/CD
- **Performance**: React 19 Compiler auto-optimizes, Tailwind JIT purges CSS

### ⏳ Aspirational (Documented but Not Yet Implemented)

- **Layer-Based Architecture**: 4-layer directory structure (domain/, application/, infrastructure/, presentation/)
- **ESLint Boundaries**: Configured but not active (directory structure doesn't match patterns)

**Note**: See `layer-based-architecture.md#enforcement` for details on aspirational architecture.

---

## How to Use This Index

### When Implementing a Feature

1. **Check Architecture Documents**: Understand principles (functional-programming.md, layer-based-architecture.md)
2. **Review Infrastructure Docs**: Learn technology usage (effect.md, hono.md, drizzle.md)
3. **Check Enforcement**: Understand what's enforced automatically (eslint.md)
4. **Follow Patterns**: Use common patterns from this index
5. **Write Tests**: Follow testing-strategy.md principles

### When Reviewing Code

1. **Check ESLint**: Ensure no violations (`bun run lint`)
2. **Check TypeScript**: Ensure type safety (`bun run typecheck`)
3. **Check Tests**: Ensure tests pass (`bun test`)
4. **Review Architecture**: Ensure principles followed (functional-programming.md)
5. **Review Security**: Ensure best practices followed (security-best-practices.md)

### When Adding New Infrastructure

1. **Document Technology**: Create infrastructure doc (e.g., `docs/infrastructure/utility/new-tool.md`)
2. **Update CLAUDE.md**: Add to Core Stack table if major technology
3. **Update This Index**: Add cross-references to relevant architecture documents
4. **Add Enforcement**: Configure ESLint rules if applicable
5. **Add Tests**: Document testing approach

---

## Quick Links

### Architecture Documents

- [Functional Programming](./functional-programming.md)
- [Layer-Based Architecture](./layer-based-architecture.md)
- [Testing Strategy](./testing-strategy.md)
- [Performance Optimization](./performance-optimization.md)
- [Security Best Practices](./security-best-practices.md)

### Key Infrastructure Documents

- [Effect.ts Framework](../infrastructure/framework/effect.md)
- [ESLint Configuration](../infrastructure/quality/eslint.md)
- [Bun Runtime](../infrastructure/runtime/bun.md)
- [Better Auth](../infrastructure/framework/better-auth.md)
- [Drizzle ORM](../infrastructure/database/drizzle.md)

### Main Project Documentation

- [CLAUDE.md](../../CLAUDE.md) - Quick reference (< 500 lines)

---

**Last Updated**: 2025-11-10
**Maintained By**: architecture-docs-maintainer agent
