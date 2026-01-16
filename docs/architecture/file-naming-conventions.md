# File Naming Conventions

> **Purpose**: Establish consistent, predictable file naming patterns across all layers of the Sovrium architecture.
>
> **Status**: ✅ Active - Enforced via `eslint-plugin-check-file`
>
> **Last Updated**: 2025-10-17

## Table of Contents

- [Philosophy](#philosophy)
- [General Principles](#general-principles)
- [Domain Layer Conventions](#domain-layer-conventions)
- [Application Layer Conventions](#application-layer-conventions)
- [Infrastructure Layer Conventions](#infrastructure-layer-conventions)
- [Presentation Layer Conventions](#presentation-layer-conventions)
- [Test File Conventions](#test-file-conventions)
- [Quick Reference](#quick-reference)
- [Migration Guide](#migration-guide)
- [Enforcement](#enforcement)

---

## Philosophy

Sovrium's file naming conventions follow these guiding principles:

### 1. **Simplicity First**

Use **one default case style** (kebab-case) for 95% of files. Minimize decision fatigue by reducing case style variations.

### 2. **File Name ≠ Export Name**

File names are for **filesystem organization** (kebab-case), while export names follow **language conventions** (camelCase functions, PascalCase classes/components). This decoupling makes naming universal.

```typescript
// ✅ CORRECT - File and export names can differ
// File: start-server.ts
export const startServer = () => Effect.gen(...)

// File: invalid-config-error.ts
export class InvalidConfigError { ... }
```

### 3. **Discoverability**

File names should reveal **intent** and **purpose** at a glance. Developers and AI assistants should be able to locate files through intuitive search patterns.

### 4. **TypeScript-Friendly**

All names support TypeScript's import autocomplete and IDE navigation. Path aliases (`@/`) work seamlessly with file names.

### 5. **Ecosystem Alignment**

Naming patterns match ecosystem conventions:

- **Web URLs** - kebab-case for routes (`/api/health`)
- **CLI tools** - kebab-case for scripts (`update-license.sh`)
- **React hooks** - kebab-case with `use-` prefix (`use-mobile.ts`)
- **UI components** - kebab-case for reusable components (`button.tsx`)

---

## General Principles

### The Two-Style System

**95% of files: kebab-case** (default)

```
src/application/use-cases/server/start-server.ts
src/domain/errors/invalid-config-error.ts
src/presentation/components/ui/button.tsx
```

**5% of files: PascalCase** (page-level components only)

```
src/presentation/components/pages/DefaultHomePage.tsx
src/presentation/components/pages/LoginPage.tsx
```

### File Naming Format

```
{kebab-case}.{extension}
```

**Rules:**

- **Lowercase default** - Use kebab-case unless it's a page component
- **Hyphen separators** - Words separated by hyphens: `user-profile.ts`
- **No underscores** - Except in test files: `name.test.ts`
- **No spaces** - Use hyphens for readability

**Only Exception (PascalCase):**

- **Page components** - `DefaultHomePage.tsx` (full-page React components only)

### Extension Strategy

| Extension   | Usage                                                    |
| ----------- | -------------------------------------------------------- |
| `.ts`       | TypeScript files (schemas, functions, classes, services) |
| `.tsx`      | React components (JSX syntax required)                   |
| `.test.ts`  | Unit tests (Bun Test, co-located with source)            |
| `.test.tsx` | React component unit tests                               |
| `.spec.ts`  | E2E tests (Playwright, in `specs/` directory)            |

### Enterprise Edition Files (`.ee.` Marker)

**Pattern**: `{name}.ee.ts` or `{name}.ee.tsx` (enterprise features)

**Purpose**: Mark files that require an Sovrium Enterprise License

**Location**: Any layer (domain, application, infrastructure, presentation)

```
src/infrastructure/auth/
├── oauth.ts                  # Core: OAuth2 social login (free)
└── saml.ee.ts                # Enterprise: SAML SSO (paid)

src/domain/services/
├── permissions.ts            # Core: Basic RBAC (free)
└── field-permissions.ee.ts   # Enterprise: Field-level permissions (paid)

src/presentation/components/ui/
├── audit-log.tsx             # Core: Basic audit display (free)
└── compliance-report.ee.tsx  # Enterprise: SOC2/HIPAA reports (paid)
```

**Rules:**

- **`.ee.` marker** - Must contain `.ee.` in filename OR be in a directory named `.ee`
- **Two options**:
  1. **File marker**: `saml.ee.ts` (preferred for small features)
  2. **Directory marker**: `auth.ee/saml.ts` (preferred for feature groups)
- **Dual licensing** - These files are NOT licensed under SUL (see LICENSE_EE.md)
- **License check** - May include runtime license validation code
- **Same naming rules** - `.ee.` files follow same kebab-case conventions

**Examples:**

```typescript
// ✅ CORRECT - Enterprise feature file (file marker)
src/infrastructure/auth/saml.ee.ts
export const authenticateViaSAML = (config) => Effect.gen(...)

// ✅ CORRECT - Enterprise feature directory (directory marker)
src/infrastructure/auth.ee/
├── saml.ts
├── ldap.ts
└── active-directory.ts

// ✅ CORRECT - Enterprise component (React component)
src/presentation/components/ui/compliance-report.ee.tsx
export function ComplianceReport({ type }) { /* ... */ }

// ❌ INCORRECT - Missing .ee. marker
src/infrastructure/auth/saml.ts          // Enterprise features must have .ee. marker
src/infrastructure/auth/SAML.ee.ts       // Still use kebab-case

// ❌ INCORRECT - Wrong marker position
src/infrastructure/auth/ee.saml.ts       // .ee. must come BEFORE extension
src/infrastructure/auth/saml-ee.ts       // Use dot, not hyphen
```

**Why this pattern:**

- **Legal clarity** - Immediately visible which files require enterprise license
- **Source transparency** - Enterprise code is public (auditable) but legally protected
- **Fair-code model** - Aligns with LICENSE.md dual licensing structure
- **Build flexibility** - Can exclude `.ee.` files from free distribution builds
- **Simple detection** - Easy to grep for `.ee.` files: `find src -name "*.ee.*"`

**Current status (Phase 0):**

- ❌ No `.ee.` files exist yet
- ✅ Licensing infrastructure ready (LICENSE.md, LICENSE_EE.md)
- ✅ File naming convention documented
- 🔜 First `.ee.` files will be created in Phase 2+ (SSO, advanced RBAC, compliance)

**When to use `.ee.` marker:**

See `@docs/business/enterprise-feature-strategy.md` for guidance on which features should be enterprise.

---

### Index Files

**Purpose**: Aggregate exports for convenient imports

```typescript
// ✅ CORRECT - src/domain/models/app/index.ts
export * from './name.ts'
export * from './version.ts'
export * from './description.ts'
export const AppSchema = Schema.Struct({
  /* ... */
})
```

**Usage:**

- **Domain models** - `index.ts` exports all related schemas
- **Presentation components** - `index.ts` re-exports UI primitives
- **Application ports** - `index.ts` aggregates related interfaces

**Naming:**

- Always `index.ts` (lowercase)
- One `index.ts` per feature subdirectory

---

## Domain Layer Conventions

The domain layer uses **declarative naming** - files describe **what they contain**, not **what they do**.

**All files use kebab-case** (no exceptions).

### Schema Files

**Pattern**: `{entity-name}.ts` or `{property-name}.ts`

**Location**: `src/domain/models/{feature}/`

**Purpose**: Effect Schema definitions for domain entities

```
src/domain/models/app/
├── index.ts              # Main AppSchema + re-exports
├── name.ts               # NameSchema (app name validation)
├── version.ts            # VersionSchema (semver validation)
└── description.ts        # DescriptionSchema (description validation)
```

**Examples:**

```typescript
// ✅ CORRECT
src / domain / models / app / name.ts // exports NameSchema
src / domain / models / table / field - types.ts // exports FieldTypeSchema
src / domain / models / page / route.ts // exports RouteSchema

// ❌ INCORRECT
src / domain / models / app / Name.ts // Don't use PascalCase
src / domain / models / app / AppName.ts // Don't use PascalCase
src / domain / models / app / validate - name.ts // Don't use action verbs
src / domain / models / app / name.schema.ts // Don't add .schema suffix
```

**Why this pattern:**

- **File name simplicity** - `name.ts` is obvious and clean
- **Export flexibility** - Can export `NameSchema`, `Name` type, validation functions
- **Auto-import** - TypeScript autocomplete works seamlessly
- **Scalability** - Easy to add new properties without conflicts

### Validator Files

**Pattern**: `{validation-type}.ts`

**Location**: `src/domain/validators/`

**Purpose**: Pure validation functions (reusable across schemas)

```
src/domain/validators/
├── email.ts    # Email format validation
├── url.ts      # URL validation
└── slug.ts     # Slug validation (for routes)
```

**Examples:**

```typescript
// ✅ CORRECT
src / domain / validators / email.ts // exports validateEmail()
src / domain / validators / url.ts // exports validateUrl()

// ❌ INCORRECT
src / domain / validators / EmailValidator.ts // Don't use PascalCase
src / domain / validators / validate - email.ts // Don't use action verb prefix
```

### Domain Service Files

**Pattern**: `{service-name}.ts`

**Location**: `src/domain/services/`

**Purpose**: Pure domain logic functions (no side effects)

```
src/domain/services/
├── table-generator.ts    # Generate table SQL from config (pure)
├── route-matcher.ts      # Match routes (pure algorithm)
└── template-parser.ts    # Parse {{variable}} templates (pure)
```

**Examples:**

```typescript
// ✅ CORRECT
src / domain / services / table - generator.ts // exports generateTableSQL()
src / domain / services / route - matcher.ts // exports matchRoute()

// ❌ INCORRECT
src / domain / services / TableGenerator.ts // Don't use PascalCase
src / domain / services / generateTable.ts // Use descriptive noun, not verb
```

### Domain Error Classes

**Pattern**: `{error-type}-error.ts` (kebab-case)

**Location**: `src/domain/errors/`

**Purpose**: Domain-specific error classes

```
src/domain/errors/
├── invalid-config-error.ts    # Configuration validation errors
├── invalid-table-error.ts     # Table schema errors
└── invalid-route-error.ts     # Route validation errors
```

**Examples:**

```typescript
// ✅ CORRECT
// File: src/domain/errors/invalid-config-error.ts
export class InvalidConfigError {
  readonly _tag = 'InvalidConfigError'
  constructor(readonly cause: unknown) {}
}

// ❌ INCORRECT
src / domain / errors / InvalidConfigError.ts // Don't use PascalCase
src / domain / errors / config - error.ts // Include error type descriptor
```

**Why kebab-case for errors:**

- **Consistency** - All files use same casing (simple mental model)
- **File ≠ export** - `invalid-config-error.ts` exports `InvalidConfigError` class
- **Discoverability** - Easy to search for `*-error.ts` files

---

## Application Layer Conventions

The application layer uses **action-oriented naming** - files describe **what they do** (orchestration, use cases).

**All files use kebab-case** (no exceptions).

### Use Case Files

**Pattern**: `{action-verb}-{entity}.ts` (kebab-case)

**Location**: `src/application/use-cases/{phase}/`

**Purpose**: Effect programs orchestrating business workflows

```
src/application/use-cases/
├── server/
│   ├── start-server.ts         # Start Hono server
│   └── stop-server.ts          # Graceful shutdown
├── config/
│   ├── load-config.ts          # Load & validate config
│   └── watch-config.ts         # Watch for changes
└── database/
    ├── create-tables.ts        # Generate DB schema
    └── migrate-database.ts     # Run migrations
```

**Examples:**

```typescript
// ✅ CORRECT
// File: src/application/use-cases/server/start-server.ts
export const startServer = (app, options) => Effect.gen(...)

// File: src/application/use-cases/auth/authenticate-user.ts
export const authenticateUser = (credentials) => Effect.gen(...)

// ❌ INCORRECT
src/application/use-cases/server/StartServer.ts       // Don't use PascalCase
src/application/use-cases/server/server.ts            // Missing action verb
src/application/use-cases/server/serverStart.ts       // Use kebab-case
```

**Why kebab-case for use cases:**

- **Simplicity** - One case style for all code files
- **File ≠ export** - `start-server.ts` exports `startServer` function perfectly fine
- **URL-friendly** - Matches web routing conventions (`/api/start-server`)
- **Consistency** - Matches service and utility naming across project

**Edge cases:**

- **Multi-word actions** - Use kebab-case: `register-user-account.ts`, `generate-auth-token.ts`
- **CRUD operations** - Be specific: `create-table.ts`, `update-table-schema.ts`, `delete-table.ts`

### Port Interface Files

**Pattern**: `{service-name}.ts` or `i-{service-name}.ts` (kebab-case)

**Location**: `src/application/ports/`

**Purpose**: Dependency inversion interfaces for infrastructure

```
src/application/ports/
├── config-loader.ts       # or i-config-loader.ts
├── database.ts            # or i-database.ts
├── email-service.ts       # or i-email-service.ts
└── file-storage.ts        # or i-file-storage.ts
```

**Examples:**

```typescript
// ✅ CORRECT (Option 1: without prefix)
// File: src/application/ports/config-loader.ts
export interface ConfigLoader {
  loadConfig(path: string): Effect.Effect<Config, ConfigLoadError>
}

// ✅ CORRECT (Option 2: with i- prefix if you prefer)
// File: src/application/ports/i-config-loader.ts
export interface IConfigLoader {
  loadConfig(path: string): Effect.Effect<Config, ConfigLoadError>
}

// ❌ INCORRECT
src / application / ports / IConfigLoader.ts // Don't use PascalCase
src / application / ports / ConfigLoader.ts // Don't use PascalCase
src / application / ports / config - loader - port.ts // Don't add "port" suffix
```

**Why kebab-case for ports:**

- **Consistency** - Same casing as all other files
- **File ≠ export** - `config-loader.ts` can export `ConfigLoader` or `IConfigLoader` interface
- **Optional prefix** - Use `i-` prefix in filename if you prefer (matches export name)

### Application Service Files

**Pattern**: `{service-name}.ts` (kebab-case)

**Location**: `src/application/services/`

**Purpose**: Cross-cutting application utilities

```
src/application/services/
├── error-handling.ts      # ✅ EXISTING - Error handling utilities
├── config-validator.ts    # Validate entire config tree
└── runtime-context.ts     # Runtime state management
```

**Examples:**

```typescript
// ✅ CORRECT
src/application/services/error-handling.ts
export const handleStartupError = (error) => Effect.gen(...)

// ❌ INCORRECT
src/application/services/ErrorHandling.ts     // Don't use PascalCase
src/application/services/handleError.ts       // Use descriptive noun, not verb
```

### Application Error Classes

**Pattern**: `{error-type}-error.ts` (kebab-case)

**Location**: `src/application/errors/`

**Purpose**: Application-layer error classes

```
src/application/errors/
├── server-start-error.ts              # Server startup errors
├── database-connection-error.ts       # DB connection failures
└── config-load-error.ts               # Config loading errors
```

**Examples:**

```typescript
// ✅ CORRECT
// File: src/application/errors/server-start-error.ts
export class ServerStartError {
  readonly _tag = 'ServerStartError'
  constructor(readonly cause: unknown) {}
}

// ❌ INCORRECT
src / application / errors / ServerStartError.ts // Don't use PascalCase
src / application / errors / server - start.ts // Include "error" suffix
```

---

## Infrastructure Layer Conventions

The infrastructure layer uses **service-oriented naming** - files describe **external dependencies** they interact with.

**All files use kebab-case** (no exceptions).

### Service Implementation Files

**Pattern**: `{service-name}.ts` (kebab-case)

**Location**: `src/infrastructure/{service-type}/`

**Purpose**: Infrastructure service implementations

```
src/infrastructure/server/
├── server.ts              # ✅ EXISTING - Hono server
└── lifecycle.ts           # ✅ EXISTING - Shutdown handling

src/infrastructure/css/
└── compiler.ts            # ✅ EXISTING - Tailwind compiler
```

**Examples:**

```typescript
// ✅ CORRECT
src/infrastructure/server/server.ts
export const createServer = (config) => Effect.gen(...)

src/infrastructure/css/compiler.ts
export const compileCSS = () => Effect.gen(...)

// ❌ INCORRECT
src/infrastructure/server/Server.ts           // Don't use PascalCase
src/infrastructure/server/createServer.ts     // Use noun, not verb
src/infrastructure/server/server-service.ts   // Don't add "service" suffix
```

**Why this pattern:**

- **Kebab-case** - Universal file naming standard
- **Descriptive** - Service name indicates external dependency
- **Consistency** - All infrastructure follows same pattern

### Repository Files

**Pattern**: `{entity}-repository.ts` (kebab-case)

**Location**: `src/infrastructure/database/repositories/`

**Purpose**: Repository pattern implementations

```
src/infrastructure/database/repositories/
├── user-repository.ts      # User data access
└── table-repository.ts     # Generic CRUD for config tables
```

**Examples:**

```typescript
// ✅ CORRECT
// File: src/infrastructure/database/repositories/user-repository.ts
export class UserRepository implements IUserRepository {
  /* ... */
}

// ❌ INCORRECT
src / infrastructure / database / repositories / UserRepository.ts // Don't use PascalCase
src / infrastructure / database / repositories / user.ts // Include "repository" suffix
```

**Why kebab-case for repositories:**

- **Consistency** - Same as all other files
- **File ≠ export** - `user-repository.ts` exports `UserRepository` class just fine

### Adapter Files

**Pattern**: `{technology}.ts` (kebab-case)

**Location**: `src/infrastructure/{service-type}/`

**Purpose**: Third-party service adapters

```
src/infrastructure/email/
├── smtp.ts                # SMTP implementation
└── resend.ts              # Resend API implementation

src/infrastructure/storage/
├── local.ts               # Local file system
└── s3.ts                  # S3-compatible storage

src/infrastructure/auth/providers/
├── google.ts              # Google OAuth
└── github.ts              # GitHub OAuth
```

**Examples:**

```typescript
// ✅ CORRECT
src/infrastructure/email/smtp.ts
export const sendEmailViaSMTP = (config) => Effect.gen(...)

src/infrastructure/storage/s3.ts
export const uploadToS3 = (file) => Effect.gen(...)

// ❌ INCORRECT
src/infrastructure/email/SMTP.ts              // Use lowercase
src/infrastructure/email/smtp-adapter.ts      // Don't add "adapter" suffix
```

### Layer Composition Files

**Pattern**: `{layer-name}-layer.ts` (kebab-case)

**Location**: `src/infrastructure/layers/`

**Purpose**: Effect Layer composition for dependency injection

```
src/infrastructure/layers/
├── app-layer.ts           # Main application layer
├── database-layer.ts      # Database layer (Phase 2)
└── services-layer.ts      # Services layer
```

**Examples:**

```typescript
// ✅ CORRECT
// File: src/infrastructure/layers/app-layer.ts
export const AppLayer = Layer.mergeAll(DatabaseLayer, ServicesLayer)

// ❌ INCORRECT
src / infrastructure / layers / AppLayer.ts // Don't use PascalCase
src / infrastructure / layers / application.ts // Include "layer" suffix
```

**Why kebab-case for layers:**

- **Consistency** - Universal naming standard
- **File ≠ export** - `app-layer.ts` exports `AppLayer` constant

---

## Presentation Layer Conventions

The presentation layer separates **API routes** (Hono) from **React components** (UI).

### React Component Files

**Pattern**:

- **UI primitives**: `{component}.tsx` (kebab-case)
- **Page components**: `{Component}.tsx` (PascalCase)

**Location**: `src/presentation/components/ui/` or `src/presentation/components/pages/`

**Purpose**: React component definitions

```
src/presentation/components/
├── pages/
│   ├── DefaultHomePage.tsx    # Page component (PascalCase)
│   └── LoginPage.tsx          # Page component (PascalCase)
└── common/
    ├── button.tsx             # ✅ Reusable component (kebab-case)
    ├── input.tsx              # ✅ Reusable component (kebab-case)
    ├── card.tsx               # ✅ Reusable component (kebab-case)
    └── alert-dialog.tsx       # ✅ Reusable component (kebab-case)
```

**Examples:**

```typescript
// ✅ CORRECT - Page components (PascalCase)
// File: src/presentation/components/pages/DefaultHomePage.tsx
export function DefaultHomePage({ app }) { /* ... */ }

// ✅ CORRECT - Reusable components (kebab-case)
// File: src/presentation/components/common/button.tsx
export function Button({ children }) { /* ... */ }

// File: src/presentation/components/common/alert-dialog.tsx
export function AlertDialog({ children }) { /* ... */ }

// ❌ INCORRECT
src/presentation/components/pages/default-home-page.tsx  // Page components use PascalCase
src/presentation/components/common/Button.tsx            // Reusable components use kebab-case
```

**Why this dual convention:**

- **Page components (PascalCase)** - Full-page, application-specific components
- **Reusable components (kebab-case)** - Reusable primitives used across the application
- **Clear distinction** - Naming reveals component type immediately

**Edge cases:**

- **Multi-word components** - Use kebab-case: `alert-dialog.tsx`, `input-group.tsx`
- **Component variants** - Separate file: `button-variants.ts` (see Variant Files below)

### Variant Files (CVA)

**Pattern**: `{component}-variants.ts`

**Location**: `src/presentation/components/common/` or `src/presentation/styling/`

**Purpose**: Class Variance Authority (CVA) variant definitions for components with multiple visual variants

```
src/presentation/styling/
├── button-variants.ts      # buttonVariants CVA definition
└── badge-variants.ts       # badgeVariants CVA definition
```

**Examples:**

```typescript
// ✅ CORRECT
src / presentation / styling / button - variants.ts
export const buttonVariants = cva('inline-flex items-center...', {
  variants: {
    /* ... */
  },
})

// ❌ INCORRECT
src / presentation / styling / ButtonVariants.ts // Use kebab-case
src / presentation / styling / button.variants.ts // Use hyphen, not dot
```

### React Hook Files

**Pattern**: `use-{hook-name}.ts`

**Location**: `src/presentation/hooks/`

**Purpose**: React hook definitions

```
src/presentation/hooks/
├── use-mobile.ts          # ✅ EXISTING - useIsMobile hook
└── use-sidebar.ts         # ✅ EXISTING - useSidebar hook
```

**Examples:**

```typescript
// ✅ CORRECT - Standalone hooks (use-* pattern in hooks/ directory)
src / presentation / hooks / use - mobile.ts
export function useIsMobile() {
  /* ... */
}

src / presentation / hooks / use - sidebar.ts
export function useSidebar() {
  /* ... */
}

// ❌ INCORRECT
src / presentation / hooks / mobile.ts // Missing "use-" prefix
src / presentation / hooks / useMobile.ts // Use kebab-case
```

### Utility Files

**Pattern**: `{utility-name}.ts` (kebab-case)

**Location**: `src/presentation/utils/` or `src/presentation/styling/`

**Purpose**: Presentation layer utilities (pure functions)

```
src/presentation/styling/
├── cn.ts                  # ✅ EXISTING - className merger (Tailwind utility)
└── variant-classes.ts     # ✅ EXISTING - Common variant utilities

src/presentation/utils/
└── render-homepage.tsx    # ✅ EXISTING - SSR homepage rendering
```

**Examples:**

```typescript
// ✅ CORRECT
src / presentation / styling / cn.ts
export function cn(...inputs) {
  /* ... */
}

src / presentation / styling / variant - classes.ts
export const COMMON_INTERACTIVE_CLASSES = '...'

// ❌ INCORRECT
src / presentation / styling / CN.ts // Use lowercase
src / presentation / styling / classNameMerger.ts // Use kebab-case
```

### API Route Files

**Pattern**: `{route-name}.ts` or `[{param}].ts` (dynamic routes)

**Location**: `src/presentation/api/routes/`

**Purpose**: Hono API route definitions

```
src/presentation/api/routes/
├── index.ts               # Homepage route
├── health.ts              # Health check endpoint
├── tables/
│   └── [table].ts         # Dynamic table CRUD routes
└── auth/
    ├── login.ts           # Login endpoint
    └── register.ts        # Registration endpoint
```

**Examples:**

```typescript
// ✅ CORRECT - Static routes
src / presentation / api / routes / health.ts
app.get('/health', (c) => c.json({ status: 'ok' }))

// ✅ CORRECT - Dynamic routes (bracket notation)
src / presentation / api / routes / tables / [table].ts
app.get('/tables/:table', (c) => {
  /* ... */
})

// ❌ INCORRECT
src / presentation / api / routes / Health.ts // Use lowercase
src / presentation / api / routes / health - check.ts // Keep names concise
src / presentation / api / routes / tables / table.ts // Use brackets for dynamic params
```

### Middleware Files

**Pattern**: `{middleware-name}.ts`

**Location**: `src/presentation/api/middleware/`

**Purpose**: Hono middleware functions

```
src/presentation/api/middleware/
├── auth.ts                # Authentication middleware
├── cors.ts                # CORS handling
└── error.ts               # Error handling middleware
```

**Examples:**

```typescript
// ✅ CORRECT
src / presentation / api / middleware / auth.ts
export const authMiddleware = (c, next) => {
  /* ... */
}

// ❌ INCORRECT
src / presentation / api / middleware / Auth.ts // Use lowercase
src / presentation / api / middleware / authentication.ts // Keep names concise
src / presentation / api / middleware / auth - middleware.ts // Don't add "middleware" suffix
```

---

## Test File Conventions

Sovrium follows **F.I.R.S.T principles** with separate conventions for unit tests and E2E tests.

### Unit Test Files

**Pattern**: `{source-file}.test.ts` (same name as source + `.test.ts`)

**Location**: Co-located with source file

**Purpose**: Bun Test unit tests for individual functions/components

```
src/domain/models/app/
├── name.ts
├── name.test.ts           # ✅ EXISTING - Unit tests for NameSchema

src/presentation/utils/
├── cn.ts
├── cn.test.ts             # ✅ EXISTING - Unit tests for cn function

src/infrastructure/css/
├── compiler.ts
└── compiler.test.ts       # ✅ EXISTING - Unit tests for compileCSS
```

**Examples:**

```typescript
// ✅ CORRECT
src / domain / models / app / name.test.ts
import { test, expect } from 'bun:test'
import { NameSchema } from './name.ts'

test('validates npm package names', () => {
  /* ... */
})

// ❌ INCORRECT
src / domain / models / app / name.spec.ts // Use .test.ts for unit tests
src / domain / models / app / name - test.ts // Use dot separator
src / domain / models / app / test - name.ts // Keep source name first
```

**Why this pattern:**

- **Co-location** - Tests live next to source code
- **Naming convention** - `.test.ts` suffix identifies unit tests
- **Bun Test** - Uses Bun's built-in test runner
- **Discoverability** - Easy to find tests for any file

### E2E Test Files

**Pattern**: `{feature}.spec.ts` (descriptive feature name + `.spec.ts`)

**Location**: `specs/{feature-domain}/`

**Purpose**: Playwright E2E tests for end-to-end workflows

```
specs/
├── app/
│   ├── name.spec.ts           # ✅ EXISTING - App name display tests
│   ├── version.spec.ts        # ✅ EXISTING - App version display tests
│   └── description.spec.ts    # ✅ EXISTING - App description display tests
├── tables/
│   └── crud-operations.spec.ts
└── pages/
    └── dynamic-routing.spec.ts
```

**Examples:**

```typescript
// ✅ CORRECT
tests / app / name.spec.ts
import { test, expect } from '@playwright/test'

test('should display app name as title', async ({ page }) => {
  // Test implementation
})

// ❌ INCORRECT
tests / app / name.test.ts // Use .spec.ts for E2E tests
tests / app / AppNameTests.spec.ts // Use kebab-case
tests / name.spec.ts // Include feature domain (app/)
```

### Test Fixture Files

**Pattern**: `{fixture-name}.ts` or `index.ts`

**Location**: `specs/fixtures/` or `specs/{feature}/fixtures.ts`

**Purpose**: Shared test fixtures and utilities

```
specs/
├── fixtures/
│   └── index.ts               # ✅ EXISTING - Global fixtures
└── app/
    └── name.spec.ts
```

---

## Quick Reference

### Universal Rule

**Default**: Use **kebab-case** for all files
**Exception**: Use **PascalCase** only for page-level components

### All Layers (kebab-case)

| File Type     | Pattern                   | Example                   | Layer          |
| ------------- | ------------------------- | ------------------------- | -------------- |
| Schema        | `{entity}.ts`             | `name.ts`                 | Domain         |
| Validator     | `{type}.ts`               | `email.ts`                | Domain         |
| Service       | `{service}.ts`            | `table-generator.ts`      | Domain         |
| Error         | `{type}-error.ts`         | `invalid-config-error.ts` | Domain         |
| Use Case      | `{action}-{entity}.ts`    | `start-server.ts`         | Application    |
| Port          | `{service}.ts`            | `config-loader.ts`        | Application    |
| Service       | `{service}.ts`            | `error-handling.ts`       | Application    |
| Error         | `{type}-error.ts`         | `server-start-error.ts`   | Application    |
| Service       | `{service}.ts`            | `server.ts`               | Infrastructure |
| Repository    | `{entity}-repository.ts`  | `user-repository.ts`      | Infrastructure |
| Adapter       | `{technology}.ts`         | `smtp.ts`, `s3.ts`        | Infrastructure |
| Layer         | `{layer}-layer.ts`        | `app-layer.ts`            | Infrastructure |
| UI Component  | `{component}.tsx`         | `button.tsx`              | Presentation   |
| Variants      | `{component}-variants.ts` | `button-variants.ts`      | Presentation   |
| Hook          | `use-{name}.ts`           | `use-mobile.ts`           | Presentation   |
| Utility       | `{utility}.ts`            | `cn.ts`                   | Presentation   |
| API Route     | `{route}.ts`              | `health.ts`               | Presentation   |
| Dynamic Route | `[{param}].ts`            | `[table].ts`              | Presentation   |
| Middleware    | `{middleware}.ts`         | `auth.ts`                 | Presentation   |
| Unit Test     | `{source}.test.ts`        | `name.test.ts`            | Co-located     |
| E2E Test      | `{feature}.spec.ts`       | `name.spec.ts`            | specs/         |

### Only Exception (PascalCase)

| File Type      | Pattern           | Example               | Layer        |
| -------------- | ----------------- | --------------------- | ------------ |
| Page Component | `{Component}.tsx` | `DefaultHomePage.tsx` | Presentation |

---

## Migration Guide

### Identifying Files That Need Renaming

Run this command to find PascalCase files that should be kebab-case:

```bash
# Find PascalCase files that should be kebab-case (exclude page components)
find src -name "*.ts" -o -name "*.tsx" | \
  grep -v "/pages/" | \
  grep -E "^.*[A-Z].*\.(ts|tsx)$" | \
  grep -v ".test.ts" | \
  grep -v ".spec.ts"
```

### Renaming Strategy

**Step 1: Rename file to kebab-case**

```bash
# Example: Renaming a use case file
git mv src/application/use-cases/server/StartServer.ts \
       src/application/use-cases/server/start-server.ts
```

**Step 2: Update imports in consuming files**

```typescript
// Before
import { startServer } from '@/application/use-cases/server/StartServer'

// After
import { startServer } from '@/application/use-cases/server/start-server'
```

**Step 3: Run tests to verify**

```bash
bun run typecheck         # Type checking
bun test:unit            # Unit tests
bun test:e2e             # E2E tests
```

**Step 4: Commit the change**

```bash
git commit -m "refactor: rename StartServer.ts to start-server.ts"
```

### Batch Migration Script

For large-scale renames, use this script template:

```bash
#!/usr/bin/env bash
# rename-to-kebab-case.sh

# Convert PascalCase files to kebab-case (excluding pages/)
find src -type f \( -name "*.ts" -o -name "*.tsx" \) | \
  grep -v "/pages/" | \
  grep -v ".test.ts" | \
  grep -v ".spec.ts" | \
  while read file; do
    dir=$(dirname "$file")
    filename=$(basename "$file")
    base="${filename%.*}"
    ext="${filename##*.}"

    # Convert PascalCase to kebab-case
    new_name=$(echo "$base" | sed 's/\([A-Z]\)/-\1/g' | sed 's/^-//' | tr '[:upper:]' '[:lower:]')

    # Skip if already kebab-case
    if [ "$base" = "$new_name" ]; then
      continue
    fi

    new_file="$dir/$new_name.$ext"
    echo "Renaming: $file -> $new_file"
    git mv "$file" "$new_file"
  done

echo "✅ Migration complete. Run: bun run typecheck && bun test"
```

**Warning**: Always commit changes before running batch renames. Test thoroughly after migration.

---

## Enforcement

### ESLint Enforcement (eslint-plugin-check-file)

Sovrium uses `eslint-plugin-check-file` to automatically enforce file and folder naming conventions with pattern-specific rules.

**Configuration** (`eslint.config.ts` lines 329-387):

```typescript
// ==========================================
// STEP 1: Page Components (PascalCase exception)
// This rule MUST come BEFORE the general kebab-case rule
// ==========================================
{
  files: ['src/presentation/components/pages/**/*.{ts,tsx}'],
  plugins: { 'check-file': checkFilePlugin },
  rules: {
    'check-file/filename-naming-convention': [
      'error',
      { '**/*.{ts,tsx}': 'PASCAL_CASE' },
      { ignoreMiddleExtensions: true }
    ]
  }
}

// ==========================================
// STEP 2: All other files (kebab-case with pattern specificity)
// ==========================================
{
  files: ['src/**/*.{ts,tsx,js,jsx}'],
  ignores: ['src/presentation/components/pages/**/*.{ts,tsx}'], // Already handled above
  plugins: { 'check-file': checkFilePlugin },
  rules: {
    // File naming - Specific patterns checked BEFORE default
    'check-file/filename-naming-convention': [
      'error',
      {
        // SPECIFIC PATTERNS (checked first, in order)
        'src/**/errors/*-error.ts': '*-error',                              // Error classes
        'src/infrastructure/database/repositories/*.ts': '*-repository',    // Repositories
        'src/infrastructure/layers/*.ts': '*-layer',                        // Effect Layers
        'src/presentation/components/ui/*-variants.ts': '*-variants',       // CVA variants
        'src/presentation/hooks/*.{ts,tsx}': 'use-*',                       // React hooks (standalone)
        'src/presentation/components/ui/*-hook.ts': '*-hook',               // React hooks (component-specific)

        // DEFAULT (must be last)
        '**/*.{ts,tsx,js,jsx}': 'KEBAB_CASE'
      },
      { ignoreMiddleExtensions: true }
    ],

    // Folder naming - kebab-case for src/ directories
    'check-file/folder-naming-convention': [
      'error',
      { 'src/**/': 'KEBAB_CASE' }
    ]
  }
}
```

**How it works:**

1. **Two-Stage Processing**:
   - First, page components are checked for PascalCase
   - Then, all other files are checked with pattern-specific rules

2. **Pattern Precedence** (specific → default):
   - Checks specific patterns first (errors, repositories, layers, variants, hooks)
   - Falls back to default kebab-case for files not matching specific patterns
   - Order matters: Specific patterns must come BEFORE the catch-all `KEBAB_CASE`

3. **Middle Extension Handling**:
   - `ignoreMiddleExtensions: true` means `.test`, `.spec`, `.config` are ignored
   - Example: `name.test.ts` validates only "name" (ignores ".test")
   - Example: `compiler.test.ts` validates only "compiler" (ignores ".test")

4. **Automatic Detection**:
   - ESLint errors on any file violating these rules
   - Runs during development (IDE integration) and CI/CD (pre-commit/GitHub Actions)

**Example Violations and Fixes:**

```bash
# ❌ VIOLATIONS (ESLint will error)
src/domain/models/app/AppName.ts
  → Fix: Rename to app-name.ts (default kebab-case)

src/application/use-cases/StartServer.ts
  → Fix: Rename to start-server.ts (default kebab-case)

src/presentation/components/ui/Button.tsx
  → Fix: Rename to button.tsx (default kebab-case)

src/domain/errors/InvalidConfig.ts
  → Fix: Rename to invalid-config-error.ts (requires *-error suffix)

src/infrastructure/database/repositories/User.ts
  → Fix: Rename to user-repository.ts (requires *-repository suffix)

src/infrastructure/layers/App.ts
  → Fix: Rename to app-layer.ts (requires *-layer suffix)

src/presentation/components/ui/button-styles.ts
  → Fix: Rename to button-variants.ts (variants require *-variants suffix)

src/presentation/hooks/mobile.ts
  → Fix: Rename to use-mobile.ts (hooks require use-* prefix)

# ✅ CORRECT (ESLint will pass)
src/domain/models/app/name.ts                           # kebab-case ✓
src/application/use-cases/start-server.ts               # kebab-case ✓
src/presentation/components/ui/button.tsx               # kebab-case ✓
src/domain/errors/invalid-config-error.ts               # *-error pattern ✓
src/infrastructure/database/repositories/user-repository.ts  # *-repository pattern ✓
src/infrastructure/layers/app-layer.ts                  # *-layer pattern ✓
src/presentation/components/ui/button-variants.ts       # *-variants pattern ✓
src/presentation/hooks/use-mobile.ts                    # use-* pattern ✓
src/presentation/components/ui/sidebar-hook.ts          # *-hook pattern ✓
src/presentation/components/pages/DefaultHomePage.tsx   # PascalCase exception ✓
```

**Running Lint Checks:**

```bash
bun run lint              # Check all files for violations
bun run lint --fix        # Auto-fix some violations (cannot rename files automatically)
```

**Note**: ESLint cannot automatically rename files. Developers must use `git mv` to rename files manually.

**Benefits:**

- **Automated Enforcement** - No manual review needed for file naming
- **Immediate Feedback** - ESLint errors appear in IDE during development
- **CI/CD Validation** - Pull requests automatically checked via GitHub Actions
- **Pattern-Specific Rules** - Different rules for errors, repositories, layers, variants, hooks
- **Consistent Codebase** - Zero naming convention violations

**Limitations:**

- **Cannot Auto-Rename** - ESLint cannot automatically rename files (must be done manually with `git mv`)
- **Pattern Coverage** - Some patterns (dynamic route brackets `[param].ts`) are not automatically enforced
- **Folder Scope** - Only `src/` folders enforced, not `specs/`, `scripts/`, `docs/`

### Pattern Matching Reference

**eslint-plugin-check-file Pattern Constants:**

| Pattern Constant | Meaning                 | Example Match               | Example Non-Match      |
| ---------------- | ----------------------- | --------------------------- | ---------------------- |
| `KEBAB_CASE`     | Lowercase with hyphens  | `start-server.ts` ✓         | `StartServer.ts` ❌    |
| `PASCAL_CASE`    | Each word capitalized   | `HomePage.tsx` ✓            | `homePage.tsx` ❌      |
| `*-error`        | Ends with `-error`      | `invalid-config-error.ts` ✓ | `invalid-config.ts` ❌ |
| `*-repository`   | Ends with `-repository` | `user-repository.ts` ✓      | `user-repo.ts` ❌      |
| `*-layer`        | Ends with `-layer`      | `app-layer.ts` ✓            | `app.ts` ❌            |
| `*-variants`     | Ends with `-variants`   | `button-variants.ts` ✓      | `button-styles.ts` ❌  |
| `use-*`          | Starts with `use-`      | `use-mobile.ts` ✓           | `mobile-hook.ts` ❌    |
| `*-hook`         | Ends with `-hook`       | `sidebar-hook.ts` ✓         | `use-sidebar.ts` ❌    |

**Pattern Precedence Order** (specific → default):

The check-file plugin evaluates patterns in the order they appear in the configuration. Specific patterns are checked BEFORE the default:

1. ✓ Check if file is in `src/**/errors/` AND ends with `-error.ts`
2. ✓ Check if file is in `src/infrastructure/database/repositories/` AND ends with `-repository.ts`
3. ✓ Check if file is in `src/infrastructure/layers/` AND ends with `-layer.ts`
4. ✓ Check if file is in `src/presentation/components/ui/` AND ends with `-variants.ts`
5. ✓ Check if file is in `src/presentation/hooks/` AND starts with `use-`
6. ✓ Check if file is in `src/presentation/components/ui/` AND ends with `-hook.ts`
7. ✓ **DEFAULT**: All other files must use `KEBAB_CASE`

**Example**: File `src/domain/errors/invalid-config-error.ts`

- Step 1 matches: File is in `src/**/errors/` and ends with `-error.ts` → ✓ Valid
- Steps 2-7 are not checked (first match wins)

**Example**: File `src/domain/errors/invalid-config.ts`

- Step 1 does NOT match: File is in `src/**/errors/` but does NOT end with `-error.ts` → ❌ Invalid
- ESLint error: "Files in src/\*\*/errors/ must end with -error.ts"

**Example**: File `src/application/use-cases/start-server.ts`

- Steps 1-6 do NOT match (file not in those directories)
- Step 7 (DEFAULT) applies: Must use `KEBAB_CASE` → ✓ Valid

**ignoreMiddleExtensions Behavior:**

When `ignoreMiddleExtensions: true`, the plugin ignores extensions before the final extension:

```
name.test.ts       → Checks: "name" (ignores ".test")
compiler.test.ts   → Checks: "compiler" (ignores ".test")
eslint.config.ts   → Checks: "eslint" (ignores ".config")
app.d.ts           → Checks: "app" (ignores ".d")
```

This allows:

- Unit test files: `name.test.ts` (validates "name" only)
- E2E test files: `name.spec.ts` (validates "name" only)
- Config files: `eslint.config.ts` (validates "eslint" only)
- Type declaration files: `global.d.ts` (validates "global" only)

Without this option, ESLint would try to validate "name.test" as a complete filename, which would fail kebab-case validation.

### TypeScript Path Aliases

TypeScript path aliases support naming conventions:

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@/domain/*": ["./src/domain/*"],
      "@/application/*": ["./src/application/*"],
      "@/infrastructure/*": ["./src/infrastructure/*"],
      "@/presentation/*": ["./src/presentation/*"]
    }
  }
}
```

**Benefits:**

- **Auto-import** - TypeScript suggests correct file names
- **Refactoring safety** - Rename detection across imports
- **Layer-aware imports** - Import paths reflect architecture

### IDE Configuration

Configure IDE to enforce naming patterns:

**VS Code** (`.vscode/settings.json`):

```json
{
  "files.exclude": {
    "**/*.test.ts": false,
    "**/*.spec.ts": false
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/*.test.ts": false,
    "**/*.spec.ts": false
  },
  "explorer.fileNesting.patterns": {
    "*.ts": "${capture}.test.ts, ${capture}.spec.ts",
    "*.tsx": "${capture}.test.tsx"
  }
}
```

### CI/CD Validation

File naming conventions are automatically validated in CI/CD via ESLint:

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Run ESLint (includes file naming validation)
        run: bun run lint
```

**How it works:**

1. **ESLint runs automatically** - `bun run lint` includes check-file plugin
2. **PR checks fail** - Any file naming violations block PR merge
3. **Clear error messages** - ESLint shows which files violate which patterns
4. **No custom scripts** - All validation handled by ESLint configuration

**Benefits:**

- Single source of truth (eslint.config.ts)
- No duplicate validation logic
- Same errors locally and in CI
- Automatic enforcement without custom scripts

---

## Related Documentation

- **Layer-Based Architecture** - `@docs/architecture/layer-based-architecture/13-file-structure.md`
- **Functional Programming** - `@docs/architecture/functional-programming.md`
- **Testing Strategy** - `@docs/architecture/testing-strategy.md`
- **ESLint Configuration** - `@docs/infrastructure/quality/eslint.md`
- **TypeScript Configuration** - `@docs/infrastructure/language/typescript.md`

---

## Summary

Sovrium's file naming conventions prioritize **simplicity** and **consistency**:

### The Two-Style System

**95% kebab-case** (default for everything):

- Domain: schemas, validators, services, errors
- Application: use cases, ports, services, errors
- Infrastructure: services, repositories, adapters, layers
- Presentation: UI components, hooks, utilities, routes, middleware

**5% PascalCase** (page components only):

- Presentation: page-level components (`DefaultHomePage.tsx`, `LoginPage.tsx`)

### Key Principles

✅ **File name ≠ export name** - `start-server.ts` can export `startServer` function
✅ **One case style** - kebab-case for 95% of files (minimal decision fatigue)
✅ **Clear exception** - PascalCase only for full-page components
✅ **Ecosystem aligned** - Matches web URLs, CLI tools, React hooks, shadcn/ui
✅ **TypeScript-friendly** - Auto-import and refactoring support

### Quick Decision Tree

```
Is this a full-page React component?
  ├─ YES → Use PascalCase (HomePage.tsx)
  └─ NO  → Use kebab-case (everything else)
```

When in doubt, **use kebab-case**. It's the default for 95% of files.
