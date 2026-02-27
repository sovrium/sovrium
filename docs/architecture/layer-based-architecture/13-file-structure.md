# Layer-Based Architecture in Sovrium

> **Note**: This is part 13 of the split documentation. See navigation links below.

## File Structure

This structure reflects the **actual codebase** as of 2026-02-27. All files use **kebab-case** naming. The 4-layer architecture is fully implemented and enforced by `eslint-plugin-boundaries` (636 lines in `eslint/boundaries.config.ts`).

Organization principles:

1. **Layer** (domain, application, infrastructure, presentation)
2. **Feature** (tables, auth, analytics, pages, theme)
3. **Co-located tests** (`.test.ts` files sit alongside source files)

```
sovrium/
├── src/
│   │
│   ├── domain/                                  # DOMAIN LAYER (Pure Business Logic)
│   │   │
│   │   ├── models/                              # Domain Models & Schema Definitions
│   │   │   ├── app/                             # App Configuration Schema (Effect Schema)
│   │   │   │   ├── index.ts                     # Main App schema
│   │   │   │   ├── name.ts                      # App name validation
│   │   │   │   ├── description.ts               # App description validation
│   │   │   │   ├── version.ts                   # App version validation
│   │   │   │   │
│   │   │   │   ├── analytics/                   # Analytics configuration
│   │   │   │   ├── auth/                        # Auth configuration
│   │   │   │   │   ├── methods/                 # Auth method schemas
│   │   │   │   │   ├── oauth/                   # OAuth provider schemas
│   │   │   │   │   └── plugins/                 # Auth plugin schemas
│   │   │   │   ├── automation/                  # Automation triggers/actions
│   │   │   │   ├── common/                      # Shared schema primitives
│   │   │   │   ├── component/                   # UI component schemas
│   │   │   │   │   └── common/                  # Shared component types
│   │   │   │   ├── language/                    # i18n language configuration
│   │   │   │   ├── page/                        # Page configuration
│   │   │   │   │   ├── common/                  # Shared page types
│   │   │   │   │   │   └── interactions/        # Page interaction schemas
│   │   │   │   │   ├── meta/                    # Page metadata (SEO, OG)
│   │   │   │   │   │   └── structured-data/     # JSON-LD structured data
│   │   │   │   │   └── scripts/                 # Page script schemas
│   │   │   │   ├── permissions/                 # RBAC permission schemas
│   │   │   │   ├── table/                       # Table configuration
│   │   │   │   │   ├── field-types/             # Field type schemas
│   │   │   │   │   │   ├── advanced/            # Formula, rollup, etc.
│   │   │   │   │   │   ├── date-time/           # Date, time fields
│   │   │   │   │   │   ├── media/               # File, image fields
│   │   │   │   │   │   ├── numeric/             # Number, currency fields
│   │   │   │   │   │   ├── relational/          # Link, lookup fields
│   │   │   │   │   │   ├── selection/           # Select, checkbox fields
│   │   │   │   │   │   ├── text/                # Text, rich text fields
│   │   │   │   │   │   └── user/                # User, created-by fields
│   │   │   │   │   ├── permissions/             # Table-level permissions
│   │   │   │   │   └── views/                   # Table view schemas
│   │   │   │   └── theme/                       # Theme configuration (colors, fonts, spacing)
│   │   │   │
│   │   │   └── api/                             # API Contract Schemas (Zod for OpenAPI)
│   │   │       ├── analytics.ts                 # Analytics API schemas
│   │   │       ├── auth.ts                      # Auth API schemas
│   │   │       ├── common.ts                    # Shared API types
│   │   │       ├── error.ts                     # Error response schemas
│   │   │       ├── health.ts                    # Health check schemas
│   │   │       ├── request.ts                   # Request validation schemas
│   │   │       ├── tables.ts                    # Tables API schemas
│   │   │       └── index.ts                     # Barrel export
│   │   │
│   │   ├── errors/                              # Domain Errors
│   │   │   ├── create-tagged-error.ts           # Factory for simple _tag+cause errors
│   │   │   └── index.ts                         # ForbiddenError, SessionContextError,
│   │   │                                        #   UniqueConstraintViolationError, ValidationError
│   │   │
│   │   └── utils/                               # Pure Utility Functions
│   │       ├── content-parsing.ts               # Content parsing utilities
│   │       ├── format-detection.ts              # File format detection
│   │       ├── route-matcher.ts                 # Route matching algorithm (pure)
│   │       ├── translation-resolver.ts          # Translation resolution (pure)
│   │       └── index.ts                         # Barrel export
│   │
│   ├── application/                             # APPLICATION LAYER (Use Cases & Orchestration)
│   │   │
│   │   ├── use-cases/                           # Effect Programs (Effect.gen workflows)
│   │   │   ├── server/                          # Server lifecycle
│   │   │   │   ├── start-server.ts              # Start Hono server
│   │   │   │   ├── startup-error-handler.ts     # Handle startup errors
│   │   │   │   ├── generate-static.ts           # Static site generation
│   │   │   │   ├── generate-static-helpers.ts   # SSG helper functions
│   │   │   │   ├── static-content-generators.ts # Content generation
│   │   │   │   ├── static-language-generators.ts # i18n generation
│   │   │   │   ├── static-url-rewriter.ts       # URL rewriting for SSG
│   │   │   │   └── translation-replacer.ts      # Translation replacement
│   │   │   │
│   │   │   ├── tables/                          # Table CRUD & operations
│   │   │   │   ├── programs.ts                  # Core table programs
│   │   │   │   ├── table-operations.ts          # Table-level operations
│   │   │   │   ├── batch-operations.ts          # Batch record operations
│   │   │   │   ├── comment-programs.ts          # Record comments
│   │   │   │   ├── activity-programs.ts         # Activity logging
│   │   │   │   ├── user-role.ts                 # User role management
│   │   │   │   ├── permissions/                 # Table permission use cases
│   │   │   │   └── utils/                       # Shared table utilities
│   │   │   │
│   │   │   ├── auth/                            # Authentication use cases
│   │   │   ├── analytics/                       # Analytics use cases
│   │   │   └── activity/                        # Activity log queries
│   │   │       └── list-activity-logs.ts
│   │   │
│   │   ├── ports/                               # Infrastructure Interfaces (Dependency Inversion)
│   │   │   ├── repositories/                    # Data access ports (Effect Context.Tag)
│   │   │   │   ├── activity-log-repository.ts
│   │   │   │   ├── activity-repository.ts
│   │   │   │   ├── analytics-repository.ts
│   │   │   │   ├── auth-repository.ts
│   │   │   │   ├── batch-repository.ts
│   │   │   │   ├── comment-repository.ts
│   │   │   │   ├── table-repository.ts
│   │   │   │   └── index.ts
│   │   │   ├── services/                        # Capability ports
│   │   │   │   ├── css-compiler.ts
│   │   │   │   ├── page-renderer.ts
│   │   │   │   ├── server-factory.ts
│   │   │   │   ├── static-site-generator.ts
│   │   │   │   └── index.ts
│   │   │   └── models/                          # Shared type definitions
│   │   │       ├── user-metadata.ts
│   │   │       └── user-session.ts
│   │   │
│   │   ├── errors/                              # Application Errors
│   │   │   ├── app-validation-error.ts          # Config validation failure
│   │   │   └── static-generation-error.ts       # SSG failure
│   │   │
│   │   ├── metadata/                            # Application metadata
│   │   └── models/                              # Application-layer models
│   │
│   ├── infrastructure/                          # INFRASTRUCTURE LAYER (External Services)
│   │   │
│   │   ├── database/                            # Database (PostgreSQL + Drizzle ORM)
│   │   │   ├── drizzle/                         # Drizzle configuration
│   │   │   │   ├── schema/                      # Database schema definitions
│   │   │   │   └── ...                          # db.ts, db-bun.ts, layer.ts
│   │   │   ├── repositories/                    # Repository implementations
│   │   │   ├── table-queries/                   # Table query builders
│   │   │   │   ├── batch/                       # Batch operations
│   │   │   │   ├── crud/                        # CRUD operations
│   │   │   │   ├── mutation-helpers/             # Mutation utilities
│   │   │   │   ├── query-helpers/               # Query utilities
│   │   │   │   └── shared/                      # Shared query logic
│   │   │   ├── table-operations/                # Table DDL operations
│   │   │   ├── generators/                      # Schema/SQL generators
│   │   │   ├── schema/                          # Schema utilities
│   │   │   ├── schema-migration/                # Runtime migration system
│   │   │   ├── auth/                            # Auth-related queries
│   │   │   ├── views/                           # View query builders
│   │   │   ├── formula/                         # Formula field evaluation
│   │   │   ├── lookup/                          # Lookup field resolution
│   │   │   ├── sql/                             # Raw SQL utilities
│   │   │   └── index.ts                         # Barrel export
│   │   │
│   │   ├── auth/                                # Authentication (Better Auth)
│   │   │   ├── better-auth/
│   │   │   │   └── plugins/                     # Custom auth plugins
│   │   │   └── index.ts
│   │   │
│   │   ├── css/                                 # CSS Compilation (Tailwind)
│   │   │   ├── compiler.ts                      # Programmatic CSS compiler
│   │   │   ├── css-compiler-live.ts             # Live implementation
│   │   │   ├── cache/                           # CSS cache management
│   │   │   ├── styles/                          # Style generation
│   │   │   ├── theme/                           # Theme → CSS variable mapping
│   │   │   └── index.ts
│   │   │
│   │   ├── server/                              # HTTP Server (Hono)
│   │   │   ├── server.ts                        # Server creation
│   │   │   ├── lifecycle.ts                     # Graceful shutdown
│   │   │   ├── server-factory-live.ts           # ServerFactory implementation
│   │   │   ├── ssg-adapter.ts                   # Static site generator adapter
│   │   │   ├── static-site-generator-live.ts    # SSG implementation
│   │   │   └── route-setup/                     # Route registration
│   │   │
│   │   ├── analytics/                           # Analytics tracking
│   │   │   └── tracking-script.ts
│   │   ├── email/                               # Email (Nodemailer)
│   │   │   ├── email-config.ts
│   │   │   ├── email-service.ts
│   │   │   ├── nodemailer.ts
│   │   │   ├── templates.ts
│   │   │   └── index.ts
│   │   ├── filesystem/                          # File system operations
│   │   │   ├── file-loader.ts
│   │   │   ├── copy-directory.ts
│   │   │   ├── remote-loader.ts
│   │   │   └── index.ts
│   │   ├── logging/                             # Console logging
│   │   │   ├── logger.ts
│   │   │   └── index.ts
│   │   ├── schema/                              # Schema processing
│   │   │   └── server.ts
│   │   ├── devtools/                            # Effect DevTools
│   │   │   ├── devtools-layer.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── errors/                              # Infrastructure Errors
│   │   │   ├── auth-config-required-error.ts
│   │   │   ├── auth-error.ts
│   │   │   ├── css-compilation-error.ts
│   │   │   ├── schema-initialization-error.ts
│   │   │   ├── server-creation-error.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── layers/                              # Effect Layer Composition
│   │   │   ├── app-layer.ts                     # Main application layer
│   │   │   └── page-renderer-layer.ts           # Page renderer layer
│   │   │
│   │   └── utils/                               # Infrastructure utilities
│   │
│   └── presentation/                            # PRESENTATION LAYER (UI & API)
│       │
│       ├── api/                                 # Hono API Routes
│       │   ├── routes/                          # Route definitions
│       │   │   ├── index.ts                     # Route barrel
│       │   │   ├── activity/                    # Activity endpoints
│       │   │   └── tables/                      # Table CRUD endpoints
│       │   ├── middleware/                       # API Middleware
│       │   │   ├── auth.ts                      # Authentication middleware
│       │   │   ├── table.ts                     # Table context middleware
│       │   │   └── validation.ts                # Request validation
│       │   ├── validation/                      # Input validation
│       │   │   └── rules/                       # Validation rule definitions
│       │   └── utils/                           # API utilities
│       │
│       ├── ui/                                  # React UI Components
│       │   ├── pages/                           # Full page components
│       │   │   ├── DefaultHomePage.tsx
│       │   │   ├── DynamicPage.tsx
│       │   │   ├── ErrorPage.tsx
│       │   │   ├── NotFoundPage.tsx
│       │   │   └── ...                          # Page head, body, metadata
│       │   ├── sections/                        # Section rendering system
│       │   │   ├── SectionRenderer.tsx
│       │   │   ├── components/                  # Section components (hero, etc.)
│       │   │   ├── renderers/                   # Render dispatchers
│       │   │   │   └── element-renderers/       # Element-level renderers
│       │   │   ├── rendering/                   # Render utilities
│       │   │   │   └── component-registry/      # Component registration
│       │   │   ├── responsive/                  # Responsive utilities
│       │   │   ├── styling/                     # Section styling
│       │   │   ├── translations/                # Section translations
│       │   │   ├── props/                       # Section prop types
│       │   │   └── utils/                       # Section utilities
│       │   ├── languages/                       # Language UI components
│       │   └── metadata/                        # Metadata components
│       │
│       ├── rendering/                           # Server-Side Rendering
│       │   ├── render-homepage.tsx
│       │   └── render-error-pages.tsx
│       │
│       ├── hooks/                               # React Hooks
│       │   └── use-breakpoint.ts
│       │
│       ├── scripts/                             # Client-side scripts
│       │   ├── client/                          # Browser scripts
│       │   └── script-renderers.ts
│       │
│       ├── styling/                             # Style utilities
│       │   ├── animation-composer.ts
│       │   ├── parse-style.ts
│       │   ├── style-utils.ts
│       │   ├── theme-colors.ts
│       │   └── index.ts
│       │
│       ├── translations/                        # Translation management
│       │   └── translation-resolver.ts
│       │
│       ├── cli/                                 # CLI presentation
│       │
│       └── utils/                               # Presentation utilities
│           └── component-utils.ts
│
├── specs/                                       # E2E Tests (Playwright)
│   ├── api/                                     # API endpoint tests
│   │   ├── activity/                            # Activity log API tests
│   │   ├── analytics/                           # Analytics API tests
│   │   ├── auth/                                # Auth API tests (20+ subdirs)
│   │   ├── health/                              # Health check tests
│   │   └── tables/                              # Table CRUD tests
│   │       ├── permissions/                     # Permission tests
│   │       └── {tableId}/                       # Record, view, comment tests
│   │
│   ├── app/                                     # App schema validation tests
│   │   ├── analytics/
│   │   ├── auth/
│   │   ├── components/
│   │   ├── languages/
│   │   ├── pages/                               # Page config tests
│   │   ├── tables/                              # Table schema tests
│   │   │   ├── field-types/                     # Field type validation
│   │   │   ├── permissions/
│   │   │   ├── relationships/
│   │   │   └── views/
│   │   └── theme/                               # Theme rendering tests (with snapshots)
│   │
│   ├── cli/                                     # CLI tests
│   │   ├── build/                               # Static build tests
│   │   └── start/                               # Server start tests
│   │
│   ├── migrations/                              # Migration system tests
│   │   ├── migration-system/
│   │   └── schema-evolution/
│   │
│   ├── fixtures/                                # Test fixtures
│   └── templates/                               # Test templates
│
├── scripts/                                     # Build & utility scripts (TypeScript)
│   └── **/*.test.ts                             # Script unit tests (co-located)
│
└── docs/                                        # Documentation
    ├── architecture/                            # Architecture patterns & decisions
    │   ├── layer-based-architecture/            # This split documentation
    │   ├── patterns/                            # Authorization, error handling, etc.
    │   ├── decisions/                           # 9 ADRs (001-009)
    │   └── testing-strategy/                    # Testing patterns
    ├── infrastructure/                          # Tech stack documentation
    ├── user-stories/                            # Feature specs with E2E IDs
    └── development/                             # Development workflows (TDD, etc.)
```

## Key Design Principles

### 1. Kebab-Case File Naming

All source files use **kebab-case** (e.g., `start-server.ts`, `create-tagged-error.ts`, `app-validation-error.ts`). This is consistent across all layers.

React component files use **PascalCase** only for the component filename (e.g., `DefaultHomePage.tsx`, `SectionRenderer.tsx`), following React convention.

### 2. Feature-Based Model Organization

Domain models in `domain/models/app/` are organized by feature with deep nesting:

- **12+ feature subdirectories**: analytics, auth, automation, common, component, language, page, permissions, table, theme
- **Table field types** have 8 category subdirectories (advanced, date-time, media, numeric, relational, selection, text, user)
- **Pages** have metadata, scripts, and interaction subdirectories

This granular structure supports:

- **Strict isolation** — Features cannot cross-import schemas
- **Independent evolution** — Add table properties without affecting page code
- **Clear ownership** — Obvious where to add new capabilities
- **Incremental development** — Features can be implemented independently

### 3. Feature-Based Use Case Organization

Use cases in `application/use-cases/` are organized by feature domain:

- `server/` — Server lifecycle, static generation
- `tables/` — Table CRUD, batch operations, permissions
- `auth/` — Authentication workflows
- `analytics/` — Analytics tracking
- `activity/` — Activity log queries

The `tables/` subdirectory has further nesting for `permissions/` and `utils/`.

### 4. Infrastructure by External Dependency

Infrastructure is organized by the external service it wraps:

- `database/` — PostgreSQL + Drizzle ORM (largest subdirectory, 15+ subdirs)
- `auth/` — Better Auth + plugins
- `css/` — Tailwind CSS programmatic compiler
- `server/` — Hono HTTP server + SSG
- `email/` — Nodemailer SMTP
- `analytics/` — Tracking scripts
- `filesystem/` — File operations
- `logging/` — Console logging
- `schema/` — Schema processing
- `devtools/` — Effect DevTools

Each service implements interfaces defined in `application/ports/`.

### 5. Co-Located Unit Tests

Unit test files (`.test.ts`, `.test.tsx`) are co-located alongside their source files in every layer. This is enforced by the test file naming convention:

- **Unit tests**: `*.test.ts` in `src/` — Bun Test runner
- **E2E tests**: `*.spec.ts` in `specs/` — Playwright

### 6. Presentation Layer Structure

The presentation layer separates concerns clearly:

- `api/` — Hono routes, middleware, validation (server-side)
- `ui/` — React components (pages, sections, language switcher)
- `rendering/` — SSR utilities (render-homepage, render-error-pages)
- `hooks/` — React hooks (use-breakpoint)
- `scripts/` — Client-side scripts
- `styling/` — Style utilities (animations, theme colors)
- `translations/` — Translation resolution
- `cli/` — CLI presentation

---

## Dependency Rules (Enforced by ESLint)

### Layer Dependencies

```
Presentation → Application → Domain ← Infrastructure
```

- **Presentation** depends on **Application** and **Domain** (NOT Infrastructure directly)
- **Application** depends on **Domain** (defines **Infrastructure interfaces** in ports/)
- **Domain** depends on **NOTHING** (pure, self-contained)
- **Infrastructure** depends on **Domain** and **Application/ports** (implements interfaces)

### Enforcement

Layer boundaries are **actively enforced** via `eslint-plugin-boundaries` with 636 lines of configuration in `eslint/boundaries.config.ts`, covering 21+ element types. Violations are ESLint **errors** (not warnings).

### Ports Pattern (Dependency Inversion)

Infrastructure **must use dependency inversion**:

```typescript
// ✅ CORRECT — Infrastructure implements port interface
import type { TableRepository } from '@/application/ports/repositories/table-repository'
import type { TableSchema } from '@/domain/models/app/table'

// ❌ FORBIDDEN — Infrastructure importing use cases
import { programs } from '@/application/use-cases/tables/programs'
```

---

## Navigation

[← Part 12](./12-testing-layer-based-architecture.md) | [Part 14 →](./14-best-practices.md)

**Parts**: [Part 1](./01-start.md) | [Part 2](./02-overview.md) | [Part 3](./03-what-is-layer-based-architecture.md) | [Part 4](./04-why-layer-based-architecture-for-sovrium.md) | [Part 5](./05-sovriums-four-layers.md) | [Part 6](./06-layer-1-presentation-layer-uiapi.md) | [Part 7](./07-layer-2-application-layer-use-casesorchestration.md) | [Part 8](./08-layer-3-domain-layer-business-logic.md) | [Part 9](./09-layer-4-infrastructure-layer-external-services.md) | [Part 10](./10-layer-communication-patterns.md) | [Part 11](./11-integration-with-functional-programming.md) | [Part 12](./12-testing-layer-based-architecture.md) | **Part 13** | [Part 14](./14-best-practices.md) | [Part 15](./15-common-pitfalls.md) | [Part 16](./16-resources-and-references.md) | [Part 17](./17-summary.md)
