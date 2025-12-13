# Layer-Based Architecture in Sovrium

## Overview

Sovrium follows a **Layer-Based Architecture** (also known as **Layered Architecture**), organizing code into four distinct horizontal layers with well-defined responsibilities and clear boundaries. This pattern aligns perfectly with Sovrium's Functional Programming principles and Effect.ts's dependency injection system.

> **Note**: This document provides a high-level summary. For comprehensive coverage with detailed examples, see the split documentation in [`docs/architecture/layer-based-architecture/`](./layer-based-architecture/).

**Reference**: [Bitloops Layered Architecture Documentation](https://bitloops.com/docs/bitloops-language/learning/software-architecture/layered-architecture)

## Why Layer-Based Architecture for Sovrium?

### Benefits

1. **Clear Separation of Concerns** - Each layer handles a specific aspect
2. **Independent Development** - Teams work on different layers simultaneously
3. **Enhanced Testability** - Layers tested in isolation with mocked dependencies
4. **Maintainability** - Changes in one layer minimally impact others
5. **Effect.ts Alignment** - Layer boundaries map naturally to Context and dependency injection
6. **FP Integration** - Pure functions in Domain, explicit effects in outer layers

### Technology Mapping

| Technology     | Primary Layer                | Role                                    |
| -------------- | ---------------------------- | --------------------------------------- |
| **Effect.ts**  | Application + Infrastructure | Orchestration, side effects, DI         |
| **TypeScript** | All Layers                   | Type safety, interface definitions      |
| **Hono**       | Presentation (API)           | HTTP routing, request/response handling |
| **React**      | Presentation (UI)            | Component rendering, user interactions  |
| **Bun**        | Infrastructure               | Runtime, execution environment          |

## The Four Layers

```
┌─────────────────────────────────────────────┐
│       PRESENTATION LAYER (UI/API)           │  ← User interaction, HTTP
│  React Components, Hono Routes, Tailwind   │
├─────────────────────────────────────────────┤
│       APPLICATION LAYER (Use Cases)         │  ← Business workflows
│    Effect Programs, Use Case Logic          │
├─────────────────────────────────────────────┤
│       DOMAIN LAYER (Business Logic)         │  ← Pure business rules
│  Pure Functions, Domain Models, Validation  │
├─────────────────────────────────────────────┤
│    INFRASTRUCTURE LAYER (External)          │  ← I/O, databases, APIs
│  Database, HTTP Client, File System, Bun    │
└─────────────────────────────────────────────┘
```

### Dependency Direction (Critical Rule)

**Dependencies flow INWARD only** - outer layers depend on inner layers, NEVER the reverse:

```
Presentation → Application → Domain ← Infrastructure
```

- **Presentation** depends on **Application** and **Domain**
- **Application** depends on **Domain** and defines **Infrastructure interfaces**
- **Domain** depends on NOTHING (pure, self-contained)
- **Infrastructure** implements interfaces defined in **Application**

## Layer 1: Presentation Layer (UI/API)

### Responsibility

Handle user interactions, render UI, route HTTP requests, present data to users.

### Technologies

- **React 19** - UI components
- **Hono** - HTTP routing
- **Tailwind CSS** - Styling
- **Zod** - OpenAPI schema validation and client forms (`src/presentation/api/schemas/`)

### Example: Hono Route Handler

**Note**: This is an illustrative example showing layer-based patterns. Actual file paths in the codebase may vary (e.g., `src/application/use-cases/server/start-server.ts`), but the layering principles remain consistent.

```typescript
// Example: src/presentation/api/users.ts
import { Hono } from 'hono'
import { Effect } from 'effect'
import { GetUserProfile } from '@/application/use-cases/GetUserProfile'
import { AppLayer } from '@/infrastructure/layers/AppLayer'

const app = new Hono()

app.get('/users/:id', async (c) => {
  const userId = Number(c.req.param('id'))

  if (isNaN(userId) || userId <= 0) {
    return c.json({ error: 'Invalid user ID' }, 400)
  }

  const program = GetUserProfile({ userId }).pipe(Effect.provide(AppLayer))
  const result = await Effect.runPromise(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    return c.json({ error: 'User not found' }, 404)
  }

  return c.json(result.right)
})
```

### API Schemas (Zod)

API route validation uses Zod for OpenAPI integration:

```
src/presentation/api/schemas/
├── health-schemas.ts       # Health check endpoint schemas
└── *.ts                    # Other API contract schemas
```

**Why Zod in Presentation?**

- Industry standard for OpenAPI schema generation
- Excellent integration with Hono (`@hono/zod-validator`)
- Works with React Hook Form for client-side validation
- Effect Schema is used in Domain layer for business validation

### Do's and Don'ts

✅ **DO**: Delegate to Application Layer, validate input format, handle UI state
❌ **DON'T**: Implement business rules, access databases directly, perform calculations

## Layer 2: Application Layer (Use Cases)

### Responsibility

Orchestrate business workflows, coordinate between layers, handle application logic.

### Technologies

- **Effect.ts** - Use case orchestration, dependency injection
- **TypeScript** - Type-safe interfaces, error handling

### Example: Use Case

```typescript
// src/application/use-cases/RegisterUser.ts
import { Effect } from 'effect'
import { createUser } from '@/domain/factories/userFactory'
import { validateEmail } from '@/domain/validators/emailValidator'
import { UserRepository } from '@/application/ports/UserRepository'
import { EmailService } from '@/application/ports/EmailService'
import { Logger } from '@/application/ports/Logger'

export const RegisterUser = (input: {
  name: string
  email: string
  password: string
}): Effect.Effect<
  { userId: number },
  InvalidEmailError | UserAlreadyExistsError,
  UserRepository | EmailService | Logger
> =>
  Effect.gen(function* () {
    const logger = yield* Logger
    const userRepo = yield* UserRepository
    const emailService = yield* EmailService

    // Validate (Domain Layer)
    const emailValidation = validateEmail(input.email)
    if (!emailValidation.isValid) {
      return yield* Effect.fail(new InvalidEmailError({ message: emailValidation.error }))
    }

    // Check existence (Infrastructure)
    const existingUser = yield* userRepo.findByEmail(input.email).pipe(Effect.option)
    if (existingUser._tag === 'Some') {
      return yield* Effect.fail(new UserAlreadyExistsError({ email: input.email }))
    }

    // Create user (Domain Layer)
    const newUser = createUser({
      name: input.name,
      email: input.email,
      passwordHash: hashPassword(input.password),
    })

    // Save (Infrastructure)
    yield* userRepo.save(newUser)

    // Send email (Infrastructure)
    yield* emailService.sendWelcomeEmail({ to: newUser.email, name: newUser.name })

    yield* logger.info(`New user registered: ${newUser.email}`)

    return { userId: newUser.id }
  })
```

### Application Port (Interface)

```typescript
// src/application/ports/UserRepository.ts
import { Effect, Context } from 'effect'

export class UserRepository extends Context.Tag('UserRepository')<
  UserRepository,
  {
    readonly findById: (id: number) => Effect.Effect<User, UserNotFoundError>
    readonly findByEmail: (email: string) => Effect.Effect<User, UserNotFoundError>
    readonly save: (user: User) => Effect.Effect<void, DatabaseError>
  }
>() {}
```

### Do's and Don'ts

✅ **DO**: Orchestrate workflows, define infrastructure interfaces, use Effect Context
❌ **DON'T**: Implement UI logic, write pure business rules, access database directly

## Layer 3: Domain Layer (Business Logic)

### Responsibility

Contain pure business logic, domain models, validation rules, core algorithms.

### Technologies

- **TypeScript** - Pure functions, interfaces
- **Functional Programming** - Immutability, pure functions
- **Effect Schema** - Declarative validation for domain models

### Domain Models Organization

The Domain layer has a specific structure with strict feature isolation:

```
src/domain/models/
└── app/                    # Effect Schema models (server-side domain validation)
    ├── *.ts               # Root aggregation files (tables.ts, pages.ts, etc.)
    ├── table/             # Table feature models (isolated)
    ├── page/              # Page feature models (isolated)
    ├── automation/        # Automation feature models (isolated)
    ├── block/             # Block models
    ├── common/            # Shared models across features
    ├── language/          # Language/i18n models
    └── theme/             # Theme models
```

**Feature Isolation Rules** (enforced by ESLint boundaries):

- `table/` cannot import from `page/` or `automation/`
- `page/` cannot import from `table/` or `automation/`
- `automation/` cannot import from `table/` or `page/`
- Root files (tables.ts, pages.ts) aggregate and re-export from features

**Validation Libraries**:

- **Domain layer**: Effect Schema ONLY for type-safe domain validation
- **Presentation layer**: Zod for OpenAPI schema generation, HTTP contracts, and client forms (see `src/presentation/api/schemas/`)

### Example: Domain Validator

```typescript
// src/domain/validators/emailValidator.ts
export interface EmailValidationResult {
  readonly isValid: boolean
  readonly error?: string
}

export function validateEmail(email: string): EmailValidationResult {
  if (!email || email.trim().length === 0) {
    return { isValid: false, error: 'Email is required' }
  }

  if (email.length > 255) {
    return { isValid: false, error: 'Email is too long' }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Email format is invalid' }
  }

  return { isValid: true }
}
```

### Example: Domain Calculation

```typescript
// src/domain/services/orderCalculator.ts
export interface OrderItem {
  readonly price: number
  readonly quantity: number
}

export function calculateSubtotal(items: readonly OrderItem[]): number {
  return items.reduce((total, item) => total + item.price * item.quantity, 0)
}

export function calculateDiscount(subtotal: number, discountPercent: number): number {
  return subtotal * (discountPercent / 100)
}
```

### Do's and Don'ts

✅ **DO**: Write pure functions, use immutability, validate business rules, define models
✅ **ALLOWED**: `Effect.Schema` for type-safe validation (business logic, no side effects)
❌ **DON'T**: Perform I/O, use Effect runtime (`Effect.gen`, `Effect.runPromise`, `Context`, `Layer`), access external services, depend on other layers

**Note**: Effect.Schema is allowed in Domain layer because it's purely declarative validation (business rules), not runtime effect execution. ESLint enforces this: Schema ✅ | Effect/Context/Layer ❌

## Layer 4: Infrastructure Layer (External Services)

### Responsibility

Implement Application Layer interfaces, handle I/O, interact with external systems.

### Technologies

- **Bun** - Runtime, file system
- **Effect.ts** - Side effect management
- **Database drivers** - PostgreSQL, SQLite, etc.

### Example: Repository Implementation

```typescript
// src/infrastructure/repositories/UserRepositoryImpl.ts
import { Effect, Layer } from 'effect'
import { UserRepository } from '@/application/ports/UserRepository'

export const UserRepositoryLive = Layer.succeed(UserRepository, {
  findById: (id: number) =>
    Effect.gen(function* () {
      const rows = yield* Effect.promise(() =>
        database.query('SELECT * FROM users WHERE id = ?', [id])
      )

      if (rows.length === 0) {
        return yield* Effect.fail(new UserNotFoundError({ userId: id }))
      }

      return rows[0] as User
    }),

  save: (user: User) =>
    Effect.gen(function* () {
      if (user.id === 0) {
        yield* Effect.promise(() =>
          database.execute('INSERT INTO users (name, email, ...) VALUES (?, ?, ...)', [
            user.name,
            user.email,
          ])
        )
      } else {
        yield* Effect.promise(() =>
          database.execute('UPDATE users SET name = ?, email = ? WHERE id = ?', [
            user.name,
            user.email,
            user.id,
          ])
        )
      }
    }),
})
```

### Application Layer (Dependency Wiring)

```typescript
// src/infrastructure/layers/AppLayer.ts
import { Layer } from 'effect'

export const AppLayer = Layer.mergeAll(UserRepositoryLive, LoggerLive, EmailServiceLive)
```

### Do's and Don'ts

✅ **DO**: Implement Application interfaces, handle I/O, wrap external services in Effect
❌ **DON'T**: Implement business logic, orchestrate use cases, expose infrastructure details

## Layer Communication Patterns

### Presentation → Application → Domain

- **Presentation** calls Application use cases
- **Application** orchestrates Domain functions and Infrastructure services
- **Domain** provides pure business logic

### Application → Infrastructure (via Interface)

- **Application** defines infrastructure interfaces (ports)
- **Infrastructure** implements interfaces (adapters)
- **Application** uses interfaces via Effect Context (dependency injection)

### Error Handling Across Layers

- **Domain errors**: Business rule violations (`InvalidEmailError`)
- **Application errors**: Use case failures (`UserNotFoundError`)
- **Infrastructure errors**: Technical failures (`DatabaseError`)
- **Presentation** maps all errors to user-friendly messages

## Enforcement

> **✅ ACTIVE**: Layer-based architecture enforcement is **CURRENTLY ACTIVE** via `eslint-plugin-boundaries`. The 4-layer structure (`domain/`, `application/`, `infrastructure/`, `presentation/`) is implemented with additional feature isolation within the Domain layer.

### ESLint Boundary Enforcement (Active)

The **eslint-plugin-boundaries** plugin automatically enforces both layer dependencies and feature isolation at lint time. Run `bun run lint` to verify boundaries are not violated.

**Active Rules** (currently enforced):

```typescript
// eslint.config.ts
'boundaries/elements': [
  // Layer boundaries
  { type: 'domain', pattern: 'src/domain/**/*' },
  { type: 'application', pattern: 'src/application/**/*' },
  { type: 'infrastructure', pattern: 'src/infrastructure/**/*' },
  { type: 'presentation', pattern: 'src/presentation/**/*' },

  // Domain feature isolation (within domain/models/app/)
  { type: 'domain-model-app', pattern: 'src/domain/models/app/*.{ts,tsx}' }, // Root files
  { type: 'domain-model-table', pattern: 'src/domain/models/app/table/**/*' },
  { type: 'domain-model-page', pattern: 'src/domain/models/app/page/**/*' },
  { type: 'domain-model-automation', pattern: 'src/domain/models/app/automation/**/*' }
]
```

**Enforced Dependency Rules**:

| From Layer         | Allowed Imports        | Blocked Imports           | Error Message                                                                        |
| ------------------ | ---------------------- | ------------------------- | ------------------------------------------------------------------------------------ |
| **Presentation**   | Application, Domain    | Infrastructure            | "Presentation layer violation: Can only import from Application and Domain layers"   |
| **Application**    | Domain, Infrastructure | Presentation              | "Application layer violation: Can only import from Domain and Infrastructure layers" |
| **Domain**         | NOTHING                | All layers                | "Domain layer violation: Domain must remain pure with zero external dependencies"    |
| **Infrastructure** | Domain                 | Application, Presentation | "Infrastructure layer violation: Can only import from Domain layer"                  |

**Domain Feature Isolation Rules** (within `domain/models/app/`):

| From Feature    | Allowed Imports        | Blocked Imports     | Error Message                                                                      |
| --------------- | ---------------------- | ------------------- | ---------------------------------------------------------------------------------- |
| **table/**      | domain-model-app, self | page/, automation/  | "FORBIDDEN: Cannot import from page/automation models (strict feature isolation)"  |
| **page/**       | domain-model-app, self | table/, automation/ | "FORBIDDEN: Cannot import from table/automation models (strict feature isolation)" |
| **automation/** | domain-model-app, self | table/, page/       | "FORBIDDEN: Cannot import from table/page models (strict feature isolation)"       |
| **Root files**  | All features           | None                | Root aggregation files can import from any feature                                 |

### What Is Enforced

```typescript
// ❌ BLOCKED: Presentation → Infrastructure (bypassing Application)
// src/presentation/components/UserList.tsx
import { UserRepository } from '@/infrastructure/repositories/UserRepository'
// ERROR: "Presentation layer violation: Can only import from Application and Domain layers"
// FIX: Use Application layer use case instead

// ✅ CORRECT: Presentation → Application → Infrastructure
// src/presentation/components/UserList.tsx
import { GetUsers } from '@/application/use-cases/GetUsers'

// ❌ BLOCKED: Domain → Any Layer
// src/domain/models/User.ts
import { Effect } from 'effect'
// ERROR: "Domain layer violation: Domain must remain pure with zero external dependencies"
// FIX: Move Effect usage to Application layer

// ✅ CORRECT: Domain layer is pure
// src/domain/models/User.ts
export interface User {
  readonly id: number
  readonly name: string
}

// ❌ BLOCKED: Infrastructure → Application
// src/infrastructure/repositories/UserRepositoryImpl.ts
import { GetUsers } from '@/application/use-cases/GetUsers'
// ERROR: "Infrastructure layer violation: Can only import from Domain layer"
// FIX: Infrastructure implements interfaces, doesn't use use cases

// ✅ CORRECT: Infrastructure → Domain
// src/infrastructure/repositories/UserRepositoryImpl.ts
import type { User } from '@/domain/models/User'
import { Effect } from 'effect' // OK: Effect allowed in Infrastructure
```

### How to Verify Enforcement

To verify that layer boundaries are properly enforced:

1. **Confirm layer directories exist**:

   ```bash
   ls -la src/
   # Should show: domain/, application/, infrastructure/, presentation/
   ```

2. **Run ESLint to catch violations**:

   ```bash
   bun run lint

   # Example output when violations are found:
   # src/presentation/components/UserList.tsx
   #   10:23  error  Presentation layer violation: Can only import from Application and Domain layers  boundaries/element-types
   ```

3. **Fix violations** by moving imports to appropriate layers according to the dependency rules above

### Enforcement Documentation

For complete enforcement details:

- **ESLint boundary rules**: `@docs/infrastructure/quality/eslint.md#architectural-enforcement-critical`
- **ESLint config**: `eslint.config.ts` (lines 369-473)

### Why Enforcement Matters

1. **Prevent Architectural Violations**: Catch dependency rule violations at compile-time
2. **Maintain Domain Purity**: Domain layer stays free from side effects and external dependencies
3. **Enforce Abstraction**: UI cannot bypass Application layer to access Infrastructure directly
4. **Guide Developers**: ESLint error messages teach proper layer usage
5. **Safe Refactoring**: Confidence that changes respect architectural boundaries

### Enforcement Status

Layer-based architecture is fully implemented with active ESLint enforcement:

**Layer Boundaries** (eslint-plugin-boundaries):

- [x] Layer directories created (`domain/`, `application/`, `infrastructure/`, `presentation/`)
- [x] Dependency direction enforced (Outer → Inner)
- [x] Feature isolation within Domain layer (table/page/automation cannot cross-import)
- [x] Presentation cannot bypass Application to access Infrastructure

**Domain Layer Purity** (no-restricted-imports in `eslint/infrastructure.config.ts`):

- [x] Effect runtime forbidden (Effect, Context, Layer, pipe, flow)
- [x] Only Effect.Schema allowed for validation
- [x] Zod forbidden (must use Effect Schema)

**Functional Programming** (eslint-plugin-functional):

- [x] Immutability enforced (`prefer-immutable-types`)
- [x] No variable reassignment (`no-let`)
- [x] No mutations (`immutable-data`)
- [x] No throw statements (`no-throw-statements`)

**Test File Separation**:

- [x] E2E tests (.spec.ts) must use Playwright
- [x] Unit tests (.test.ts) must use Bun Test

**Validation**: Run `bun run lint` to verify all boundaries and restrictions.

## Integration with Functional Programming

| FP Principle             | Layer Application                                        |
| ------------------------ | -------------------------------------------------------- |
| **Pure Functions**       | Domain Layer contains only pure functions                |
| **Immutability**         | All layers use immutable data structures                 |
| **Composition**          | Use cases compose domain functions and infrastructure    |
| **Explicit Effects**     | Infrastructure wraps side effects in Effect programs     |
| **Type Safety**          | TypeScript enforces layer boundaries via interfaces      |
| **Dependency Injection** | Effect Context makes dependencies explicit at boundaries |

## Testing Strategy

### Domain Layer (Pure Functions)

```typescript
import { test, expect } from 'bun:test'

test('calculateDiscount calculates correctly', () => {
  expect(calculateDiscount(100, 10)).toBe(10)
  expect(calculateDiscount(200, 15)).toBe(30)
})
```

### Application Layer (Mock Infrastructure)

```typescript
import { test, expect } from 'bun:test'
import { Effect, Layer } from 'effect'

test('GetUserProfile fetches user successfully', async () => {
  const MockUserRepository = Layer.succeed(UserRepository, {
    findById: (id) => Effect.succeed({ id, name: 'Test User', email: 'test@example.com' }),
  })

  const program = GetUserProfile({ userId: 1 }).pipe(Effect.provide(MockUserRepository))
  const user = await Effect.runPromise(program)

  expect(user.name).toBe('Test User')
})
```

### Infrastructure Layer (Integration Tests)

Test repository implementations with real or test databases. See [Testing Strategy](./testing-strategy.md) for comprehensive testing patterns.

## File Structure

```
sovrium/
├── src/
│   ├── domain/                      # Domain Layer
│   │   ├── models/                  # Domain models
│   │   ├── services/                # Domain services (pure)
│   │   ├── validators/              # Domain validators
│   │   ├── factories/               # Object factories
│   │   └── errors/                  # Domain errors
│   │
│   ├── application/                 # Application Layer
│   │   ├── use-cases/               # Use case implementations
│   │   ├── ports/                   # Infrastructure interfaces
│   │   └── errors/                  # Application errors
│   │
│   ├── infrastructure/              # Infrastructure Layer
│   │   ├── repositories/            # Repository implementations
│   │   ├── logging/                 # Logger implementations
│   │   ├── email/                   # Email service implementations
│   │   └── layers/                  # Effect Layer composition
│   │
│   └── presentation/                # Presentation Layer
│       ├── components/              # React components
│       └── api/                     # Hono API routes
│
└── tests/                           # E2E tests (Playwright)
```

## Best Practices

### 1. Respect Dependency Direction

✅ Outer layers depend on inner layers
❌ Never allow inner layers to depend on outer layers

### 2. Keep Domain Layer Pure

✅ Pure functions with zero dependencies
❌ No side effects, I/O, or external calls

### 3. Use Interfaces for Infrastructure

✅ Application defines interfaces, Infrastructure implements
❌ Never import concrete Infrastructure implementations in Application

### 4. Single Responsibility per Layer

✅ Presentation handles UI, Application orchestrates, Domain contains logic
❌ Don't mix layer responsibilities

## Common Pitfalls

❌ **Business logic in Presentation** - Move to Domain Layer
❌ **Domain depending on Infrastructure** - Keep Domain pure
❌ **Bypassing Application Layer** - Always use use cases
❌ **Mixing layer concerns** - Respect single responsibility

## Comprehensive Documentation

This summary provides an overview of Layer-Based Architecture in Sovrium. For detailed coverage including:

- Extensive code examples for each layer
- Complete communication patterns
- Detailed testing strategies
- Advanced error handling patterns
- Step-by-step implementation guides

**See**: [`docs/architecture/layer-based-architecture/`](./layer-based-architecture/) for the full documentation split into focused sections.

## Resources

- [Bitloops Layered Architecture](https://bitloops.com/docs/bitloops-language/learning/software-architecture/layered-architecture)
- [Functional Programming in Sovrium](./functional-programming.md)
- [Effect.ts Documentation](https://effect.website/docs/introduction)
- [Testing Strategy](./testing-strategy.md)

## Summary

Layer-Based Architecture in Sovrium provides:

1. **Clear structure** - Four layers with specific responsibilities
2. **Pure Domain** - Business logic isolated in pure functions
3. **Effect orchestration** - Application Layer coordinates workflows
4. **Type-safe boundaries** - TypeScript enforces layer contracts
5. **Testability** - Each layer tested independently
6. **Maintainability** - Changes isolated to specific layers

By following Layer-Based Architecture with Functional Programming principles, Sovrium achieves predictable structure, maintainable code, and scalable architecture.
