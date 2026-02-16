# Layer-Based Architecture in Sovrium

> **Note**: This is part 13 of the split documentation. See navigation links below.

## File Structure

This structure supports Sovrium's configuration-driven platform architecture, organizing code by:

1. **Layer** (domain, application, infrastructure, presentation)
2. **Feature** (tables, pages, automations)
3. **Phase** (development roadmap progression)

```
sovrium/
├── src/
│   │
│   ├── domain/                           # DOMAIN LAYER (Pure Business Logic)
│   │   │
│   │   ├── models/                       # Domain Models & Schema Definitions
│   │   │   ├── app/                      # App Configuration Schema (ROOT)
│   │   │   │   ├── index.ts              # ✅ Main App schema (name, description, etc.)
│   │   │   │   ├── name.ts               # ✅ App name validation
│   │   │   │   ├── description.ts        # ✅ App description validation
│   │   │   │   └── version.ts            # ✅ App version validation
│   │   │   │
│   │   │   ├── table/                    # 📋 Table Configuration Schema (Phase 2)
│   │   │   │   ├── index.ts              # TableSchema (Effect Schema)
│   │   │   │   ├── field-types.ts        # FieldType enum & schemas
│   │   │   │   ├── validations.ts        # Field validation rules
│   │   │   │   └── relationships.ts      # Table relationship types
│   │   │   │
│   │   │   ├── page/                     # 📋 Page Configuration Schema (Phase 4)
│   │   │   │   ├── index.ts              # PageSchema (Effect Schema)
│   │   │   │   ├── route.ts              # Route path validation
│   │   │   │   ├── component-types.ts    # Page component types
│   │   │   │   └── layout.ts             # Layout configuration
│   │   │   │
│   │   │   └── automation/               # 📋 Automation Configuration Schema (Phase 5)
│   │   │       ├── index.ts              # AutomationSchema (Effect Schema)
│   │   │       ├── triggers.ts           # Trigger type definitions
│   │   │       ├── actions.ts            # Action type definitions
│   │   │       └── conditions.ts         # Conditional logic types
│   │   │
│   │   ├── validators/                   # Pure Validation Functions
│   │   │   ├── email.ts                  # Email format validation
│   │   │   ├── url.ts                    # URL validation
│   │   │   └── slug.ts                   # Slug validation (for routes)
│   │   │
│   │   ├── services/                     # Domain Services (Pure Functions)
│   │   │   ├── table-generator.ts        # Generate table SQL from config (pure)
│   │   │   ├── route-matcher.ts          # Match routes (pure algorithm)
│   │   │   └── template-parser.ts        # Parse {{variable}} templates (pure)
│   │   │
│   │   ├── factories/                    # Object Factories
│   │   │   └── (future: config object factories)
│   │   │
│   │   └── errors/                       # Domain Errors
│   │       ├── InvalidConfigError.ts     # Configuration validation errors
│   │       ├── InvalidTableError.ts      # Table schema errors
│   │       └── InvalidRouteError.ts      # Route validation errors
│   │
│   ├── application/                      # APPLICATION LAYER (Use Cases & Orchestration)
│   │   │
│   │   ├── use-cases/                    # Use Case Implementations (Effect Programs)
│   │   │   │
│   │   │   ├── server/                   # Phase 1: Server Lifecycle ✅
│   │   │   │   ├── StartServer.ts        # ✅ EXISTING - Start Hono server
│   │   │   │   └── StopServer.ts         # Graceful shutdown
│   │   │   │
│   │   │   ├── config/                   # Phase 1-2: Configuration Loading
│   │   │   │   ├── LoadConfig.ts         # Load & validate config from file
│   │   │   │   └── WatchConfig.ts        # Watch for config changes
│   │   │   │
│   │   │   ├── database/                 # Phase 2: Database Operations 📋
│   │   │   │   ├── CreateTables.ts       # Generate DB schema from config
│   │   │   │   ├── MigrateDatabase.ts    # Run migrations
│   │   │   │   └── SyncSchema.ts         # Sync config → DB
│   │   │   │
│   │   │   ├── auth/                     # Phase 3: Authentication 📋
│   │   │   │   ├── RegisterUser.ts       # User registration
│   │   │   │   └── AuthenticateUser.ts   # User authentication
│   │   │   │
│   │   │   ├── routing/                  # Phase 4: Dynamic Routing 📋
│   │   │   │   ├── RegisterRoutes.ts     # Register pages from config
│   │   │   │   └── GeneratePage.ts       # Generate page component
│   │   │   │
│   │   │   ├── automation/               # Phase 5: Automation Engine 📋
│   │   │   │   ├── RegisterAutomations.ts
│   │   │   │   └── ExecuteAutomation.ts
│   │   │   │
│   │   │   └── StartServer.ts            # ⚠️ Legacy location (migrate to server/)
│   │   │
│   │   ├── ports/                        # Infrastructure Interfaces (Dependency Inversion)
│   │   │   ├── repositories/             # Data access ports (Effect Context.Tag)
│   │   │   │   ├── auth-repository.ts
│   │   │   │   ├── table-repository.ts
│   │   │   │   ├── activity-log-repository.ts
│   │   │   │   └── ...
│   │   │   ├── services/                 # Capability ports
│   │   │   │   ├── css-compiler.ts
│   │   │   │   ├── server-factory.ts
│   │   │   │   └── ...
│   │   │   └── models/                   # Shared type definitions
│   │   │       └── user-session.ts
│   │   │
│   │   ├── services/                     # Application Services (Cross-cutting)
│   │   │   ├── error-handling.ts         # ✅ EXISTING - Error handling utilities
│   │   │   ├── config-validator.ts       # Validate entire config tree
│   │   │   └── runtime-context.ts        # Runtime state management
│   │   │
│   │   └── errors/                       # Application Errors
│   │       ├── ServerStartError.ts       # Server startup errors
│   │       ├── DatabaseConnectionError.ts
│   │       └── ConfigLoadError.ts
│   │
│   ├── infrastructure/                   # INFRASTRUCTURE LAYER (External Services)
│   │   │
│   │   ├── config/                       # Configuration Loading
│   │   │   ├── file-loader.ts            # Load config from .ts/.json files
│   │   │   └── watcher.ts                # File system watching
│   │   │
│   │   ├── database/                     # Database Infrastructure
│   │   │   ├── drizzle/                  # Drizzle ORM (Phase 2) 📋
│   │   │   │   ├── connection.ts         # DB connection pool
│   │   │   │   ├── schema-generator.ts   # Generate Drizzle schemas from config
│   │   │   │   └── migrations.ts         # Migration runner
│   │   │   │
│   │   │   └── repositories/             # Repository Implementations (Phase 2-3) 📋
│   │   │       ├── UserRepository.ts     # IUserRepository implementation
│   │   │       └── TableRepository.ts    # Generic CRUD for config tables
│   │   │
│   │   ├── auth/                         # Authentication Infrastructure (Phase 3) 📋
│   │   │   ├── better-auth/              # Better Auth integration
│   │   │   │   ├── config.ts             # Better Auth setup
│   │   │   │   └── adapters.ts           # Database adapters
│   │   │   │
│   │   │   └── providers/                # OAuth Providers
│   │   │       ├── google.ts
│   │   │       └── github.ts
│   │   │
│   │   ├── email/                        # Email Service Infrastructure (Phase 6) 📋
│   │   │   ├── smtp.ts                   # SMTP implementation
│   │   │   └── resend.ts                 # Resend API implementation
│   │   │
│   │   ├── storage/                      # File Storage Infrastructure (Phase 6) 📋
│   │   │   ├── local.ts                  # Local file system
│   │   │   └── s3.ts                     # S3-compatible storage
│   │   │
│   │   ├── webhooks/                     # Webhook Infrastructure (Phase 5) 📋
│   │   │   └── http-client.ts            # HTTP webhook calls
│   │   │
│   │   ├── logging/                      # Logging Infrastructure (Phase 7) 📋
│   │   │   ├── console-logger.ts         # Console logger
│   │   │   └── file-logger.ts            # File-based logger
│   │   │
│   │   ├── services/                     # Infrastructure Services
│   │   │   ├── server.ts                 # ✅ EXISTING - Hono server
│   │   │   ├── server-lifecycle.ts       # ✅ EXISTING - Shutdown handling
│   │   │   └── css-compiler.ts           # ✅ EXISTING - Tailwind compiler
│   │   │
│   │   └── layers/                       # Effect Layer Composition
│   │       ├── AppLayer.ts               # Main application layer
│   │       ├── DatabaseLayer.ts          # Database layer (Phase 2)
│   │       └── ServicesLayer.ts          # Services layer
│   │
│   └── presentation/                     # PRESENTATION LAYER (UI/API)
│       │
│       ├── api/                          # Hono API Routes
│       │   ├── routes/                   # Route definitions
│       │   │   ├── index.ts              # Homepage route (✅ EXISTING logic in utils/)
│       │   │   ├── health.ts             # Health check endpoint
│       │   │   │
│       │   │   ├── tables/               # Phase 2: CRUD APIs 📋
│       │   │   │   └── [table].ts        # Dynamic table CRUD routes
│       │   │   │
│       │   │   ├── auth/                 # Phase 3: Auth endpoints 📋
│       │   │   │   ├── login.ts
│       │   │   │   └── register.ts
│       │   │   │
│       │   │   └── automations/          # Phase 5: Automation webhooks 📋
│       │   │       └── webhook.ts
│       │   │
│       │   └── middleware/               # API Middleware
│       │       ├── auth.ts               # Authentication middleware (Phase 3)
│       │       ├── cors.ts               # CORS handling
│       │       └── error.ts              # Error handling middleware
│       │
│       ├── components/ui/                # ✅ EXISTING - shadcn/ui components
│       │   ├── button.tsx
│       │   ├── input.tsx
│       │   ├── card.tsx
│       │   └── ... (all shadcn components)
│       │
│       └── utils/                        # Presentation Utilities
│           ├── cn.ts                     # ✅ EXISTING - className merger
│           ├── variant-classes.ts        # ✅ EXISTING - Variant utilities
│           └── render-homepage.tsx       # ✅ EXISTING - SSR homepage
│
├── specs/                                # E2E Tests (Playwright)
│   ├── config/                           # Configuration tests
│   │   └── app-schema.spec.ts            # App schema validation tests
│   │
│   ├── tables/                           # Phase 2: Table CRUD Tests 📋
│   │   └── crud-operations.spec.ts
│   │
│   ├── pages/                            # Phase 4: Dynamic Routing Tests 📋
│   │   └── dynamic-routing.spec.ts
│   │
│   └── automations/                      # Phase 5: Automation Tests 📋
│       └── workflow-execution.spec.ts
│
└── docs/                                 # Documentation
    ├── specifications.md                 # ✅ EXISTING - Product vision
    ├── STATUS.md                         # ✅ EXISTING - Implementation status
    │
    ├── architecture/                     # Architecture Documentation
    │   ├── functional-programming.md     # ✅ EXISTING
    │   ├── layer-based-architecture/     # ✅ EXISTING (split docs)
    │   ├── testing-strategy.md           # ✅ EXISTING
    │   ├── configuration-system.md       # 📋 NEW: How config interpretation works
    │   └── runtime-architecture.md       # 📋 NEW: Runtime execution model
    │
    └── infrastructure/                   # Infrastructure Documentation
        ├── runtime/
        │   └── bun.md                    # ✅ EXISTING
        ├── framework/
        │   ├── effect.md                 # ✅ EXISTING
        │   ├── hono.md                   # ✅ EXISTING
        │   └── better-auth.md            # ✅ EXISTING
        ├── database/
        │   └── drizzle.md                # ✅ EXISTING
        └── ui/
            ├── react.md                  # ✅ EXISTING
            ├── tailwind.md               # ✅ EXISTING
            └── shadcn.md                 # ✅ EXISTING
```

## Legend

- ✅ **Implemented** - File/directory exists and is working
- 📋 **Planned** - Directory structure prepared, awaiting implementation
- ⚠️ **Legacy Location** - File exists but should be migrated to new structure

---

## Key Design Principles

### 1. Configuration Feature Domains

Each of the 3 core features (tables, pages, automations) gets its own schema subdomain in `domain/models/`. This ensures:

- **Strict isolation** - Features cannot cross-import schemas
- **Independent evolution** - Add table properties without affecting automation code
- **Clear ownership** - Obvious where to add new feature capabilities
- **Feature flagging** - Easy to implement features incrementally

### 2. Phase-Based Use Case Organization

Use cases in `application/use-cases/` are organized by development phase:

- `server/` - Phase 1: Core server functionality
- `config/` - Phase 1-2: Configuration loading
- `database/` - Phase 2: Database operations
- `auth/` - Phase 3: Authentication
- `routing/` - Phase 4: Dynamic routing
- `automation/` - Phase 5: Workflow engine

This structure maps directly to the roadmap in `STATUS.md` and makes it easy to track feature implementation progress.

### 3. Infrastructure Service Organization

Infrastructure services are organized by external dependency type:

- `database/` - PostgreSQL + Drizzle ORM
- `auth/` - Better Auth + OAuth providers
- `email/` - SMTP, Resend, etc.
- `storage/` - Local filesystem, S3
- `webhooks/` - HTTP client for external calls
- `logging/` - Console, file-based logging

Each service implements interfaces defined in `application/ports/`.

### 4. Presentation API vs. Components Separation

Clear boundary between server-side (API) and client-side (Components):

- `api/routes/` - Hono HTTP endpoints
- `api/middleware/` - Request/response middleware
- `components/` - React UI components
- `utils/` - Shared presentation utilities

This separation supports React SSR (Server-Side Rendering) while keeping concerns separated.

### 5. Test Organization by Feature

E2E tests mirror the feature structure:

- `specs/config/` - App schema tests
- `specs/tables/` - Table CRUD tests
- `specs/pages/` - Dynamic routing tests
- `specs/automations/` - Workflow execution tests

This makes it easy to:

- Find tests for specific features
- Support TDD workflow (write test → implement feature)
- Track test coverage by feature

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

### Feature Isolation (Domain Layer)

Configuration feature schemas are **strictly isolated**:

```typescript
// ✅ ALLOWED
import { AppSchema } from '@/domain/models/app'

// ❌ FORBIDDEN - Cross-feature imports
import { TableSchema } from '@/domain/models/app/table' // in pages/index.ts
import { AutomationSchema } from '@/domain/models/app/automation' // in tables/index.ts
```

Each feature can **only import from the root app schema**, ensuring true separation of concerns.

### Ports Pattern (Infrastructure)

Infrastructure **must use dependency inversion**:

```typescript
// ✅ CORRECT - Infrastructure implements port interface
import type { IDatabase } from '@/application/ports/IDatabase'
import type { TableSchema } from '@/domain/models/app/table'

// ❌ FORBIDDEN - Infrastructure importing use cases
import { CreateTables } from '@/application/use-cases/database/CreateTables'
```

This enforces the **Dependency Inversion Principle** and keeps layers decoupled.

---

## Migration Strategy

### Gradual Adoption

This structure supports **incremental migration**:

1. **Existing files stay in place** - No breaking changes required
2. **New features use new structure** - ESLint guides placement
3. **Legacy locations marked** - Easy to identify migration targets
4. **Phase-by-phase implementation** - Align structure with roadmap phases

### ESLint Guidance

ESLint configuration enforces these boundaries automatically:

- **Errors** for layer violations (domain importing infrastructure)
- **Errors** for feature cross-imports (table importing automation)
- **Errors** for ports pattern violations (infrastructure importing use-cases)
- **Warnings** for organizational suggestions (flat vs. phase-based use-cases)

See `eslint.config.ts` for complete boundary enforcement rules.

---

## Benefits

### For Development

- ✅ Clear placement rules - Know exactly where code belongs
- ✅ Automated enforcement - ESLint catches violations at save-time
- ✅ IDE navigation - Structure reflects architectural concepts
- ✅ Parallel development - Teams can work on different features independently

### For Maintenance

- ✅ Easy to find code - Consistent structure across codebase
- ✅ Refactoring safety - Type-safe boundaries prevent breaking changes
- ✅ Feature evolution - Add capabilities without cross-contamination
- ✅ Technical debt tracking - Legacy locations clearly marked

### For AI Assistance (Claude Code)

- ✅ Executable architecture - ESLint rules are machine-readable documentation
- ✅ Placement guidance - Error messages explain correct patterns
- ✅ Consistency - AI follows same rules as human developers
- ✅ Discovery - AI can read structure to understand capabilities

---

## Navigation

[← Part 12](./12-testing-layer-based-architecture.md) | [Part 14 →](./14-best-practices.md)

**Parts**: [Part 1](./01-start.md) | [Part 2](./02-overview.md) | [Part 3](./03-what-is-layer-based-architecture.md) | [Part 4](./04-why-layer-based-architecture-for-sovrium.md) | [Part 5](./05-sovriums-four-layers.md) | [Part 6](./06-layer-1-presentation-layer-uiapi.md) | [Part 7](./07-layer-2-application-layer-use-casesorchestration.md) | [Part 8](./08-layer-3-domain-layer-business-logic.md) | [Part 9](./09-layer-4-infrastructure-layer-external-services.md) | [Part 10](./10-layer-communication-patterns.md) | [Part 11](./11-integration-with-functional-programming.md) | [Part 12](./12-testing-layer-based-architecture.md) | **Part 13** | [Part 14](./14-best-practices.md) | [Part 15](./15-common-pitfalls.md) | [Part 16](./16-resources-and-references.md) | [Part 17](./17-summary.md)
