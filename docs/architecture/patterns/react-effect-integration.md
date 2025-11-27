# React-Effect Integration Pattern

## Overview

Sovrium uses **Effect.ts** for type-safe functional programming in the backend and application layer, while **React** handles the presentation layer. This document describes patterns for integrating Effect programs with React components.

## Core Principles

### Effect.ts Role

- **Business Logic**: Effect programs handle validation, API calls, database operations
- **Error Handling**: Typed errors with `Effect.fail` (never `throw`)
- **Dependency Injection**: Services provided via Effect Context/Layer
- **Composability**: Effect.gen for sequential operations, Effect.all for parallel

### React Role

- **UI Rendering**: Components render based on state
- **User Interactions**: Event handlers trigger Effect programs
- **State Management**: TanStack Query for server state, React state for UI state

## Pattern 1: Effect Programs in API Route Handlers

**Use Case**: Hono route handlers executing Effect programs

```typescript
// src/presentation/api/app.ts
import { Effect } from 'effect'

export const createApiRoutes = (app: App, honoApp: Hono) => {
  return honoApp.get('/api/health', async (c) => {
    // Create Effect program
    const program = Effect.gen(function* () {
      const response = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        app: { name: app.name },
      }
      // Validate response against schema
      const validated = yield* Effect.try({
        try: () => healthResponseSchema.parse(response),
        catch: (error) => new Error(`Validation failed: ${error}`),
      })
      return validated
    })

    // Execute Effect program
    try {
      const data = await Effect.runPromise(program)
      return c.json(data, 200)
    } catch (error) {
      return c.json({ error: 'Internal server error' }, 500)
    }
  })
}
```

**Key Points**:

- Use `Effect.runPromise` for async execution
- Wrap in try/catch for error handling at boundary
- Use `Effect.gen` for sequential operations with yield\*

## Pattern 2: Effect Programs with Services

**Use Case**: Programs that need injected dependencies (database, auth, etc.)

```typescript
// src/application/use-cases/user/get-user.ts
import { Effect, Context } from 'effect'

// Define service interface
class UserRepository extends Context.Tag('UserRepository')<
  UserRepository,
  {
    readonly findById: (id: number) => Effect.Effect<User, UserNotFoundError>
  }
>() {}

// Create use case program
const getUser = (id: number) =>
  Effect.gen(function* () {
    const repo = yield* UserRepository
    const user = yield* repo.findById(id)
    return user
  })

// Execute with provided service
const program = getUser(1).pipe(Effect.provide(UserRepositoryLive))

await Effect.runPromise(program)
```

**Key Points**:

- Define services with `Context.Tag`
- Access services with `yield* ServiceTag`
- Provide implementations with `Effect.provide`

## Pattern 3: Error Handling at React Boundary

**Use Case**: Converting Effect errors to user-friendly messages

```typescript
// src/presentation/api/routes/tables.ts
import { Effect } from 'effect'
import { errorResponseSchema } from '@/presentation/api/schemas/error-schemas'

async function runEffect<T>(
  c: Context,
  program: Effect.Effect<T, Error>,
  schema: { parse: (data: T) => T }
) {
  try {
    const result = await Effect.runPromise(program)
    const validated = schema.parse(result)
    return c.json(validated, 200)
  } catch (error) {
    // Map Effect errors to API responses
    return c.json(
      errorResponseSchema.parse({
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
        code: 'INTERNAL_ERROR',
      }),
      500
    )
  }
}
```

**Key Points**:

- Effect errors become exceptions when using `runPromise`
- Catch at the boundary and map to appropriate response
- Use typed error schemas for consistent error format

## Pattern 4: Parallel Effect Operations

**Use Case**: Fetching multiple resources concurrently

```typescript
// Parallel execution with Effect.all
const fetchDashboardData = Effect.gen(function* () {
  const [user, settings, notifications] = yield* Effect.all([
    userService.getCurrentUser(),
    settingsService.getSettings(),
    notificationService.getUnread(),
  ])

  return { user, settings, notifications }
})
```

**Key Points**:

- Use `Effect.all` for parallel operations
- Destructure results in order
- All operations run concurrently

## Pattern 5: Effect.succeed for Simple Returns

**Use Case**: Returning static or computed values without side effects

```typescript
// DON'T use Effect.gen for simple returns
// ❌ Unnecessary complexity
const getBadPattern = () =>
  Effect.gen(function* () {
    return { status: 'ok' }
  })

// ✅ Use Effect.succeed instead
const getGoodPattern = () => Effect.succeed({ status: 'ok' })

// ✅ Use for computed values
const computeResponse = (data: Input) =>
  Effect.succeed({
    id: crypto.randomUUID(),
    data,
    timestamp: new Date().toISOString(),
  })
```

**Key Points**:

- `Effect.succeed` for simple value returns
- `Effect.gen` only when you need `yield*` for sequential operations
- Avoids ESLint "generator function does not have yield" warning

## Anti-Patterns to Avoid

### ❌ Don't Use Effect.runSync in Async Contexts

```typescript
// ❌ BAD: runSync can block and may throw unexpectedly
const handler = (c) => {
  const result = Effect.runSync(myProgram) // WRONG
  return c.json(result)
}

// ✅ GOOD: Use runPromise for async handlers
const handler = async (c) => {
  const result = await Effect.runPromise(myProgram)
  return c.json(result)
}
```

### ❌ Don't Throw in Effect Programs

```typescript
// ❌ BAD: Using throw breaks Effect error handling
const badProgram = Effect.gen(function* () {
  if (!isValid) {
    throw new Error('Invalid') // WRONG
  }
})

// ✅ GOOD: Use Effect.fail for errors
const goodProgram = Effect.gen(function* () {
  if (!isValid) {
    return yield* Effect.fail(new ValidationError('Invalid'))
  }
})
```

### ❌ Don't Mix Promise and Effect Unnecessarily

```typescript
// ❌ BAD: Mixing paradigms
const mixed = async () => {
  const a = await fetch('/api/a')
  const b = await Effect.runPromise(effectProgram)
  return { a, b }
}

// ✅ GOOD: Keep Effect programs pure, convert at boundary
const pure = Effect.gen(function* () {
  const a = yield* fetchEffect('/api/a')
  const b = yield* effectProgram
  return { a, b }
})

// Convert at boundary
await Effect.runPromise(pure)
```

## Enforcement

### ESLint Rules (Active)

| Rule                             | Purpose                                   |
| -------------------------------- | ----------------------------------------- |
| `no-throw-statements`            | Prevents `throw`, enforces `Effect.fail`  |
| `require-yield`                  | Warns when Effect.gen doesn't use yield\* |
| `functional/no-throw-statements` | FP enforcement                            |

### Manual Review Checklist

- [ ] Effect programs use `Effect.runPromise` (not `runSync`)
- [ ] Errors use `Effect.fail` (not `throw`)
- [ ] Services accessed via `yield* ServiceTag`
- [ ] Dependencies provided via `Effect.provide`
- [ ] Simple returns use `Effect.succeed` (not `Effect.gen`)

## Related Documentation

- `@docs/infrastructure/framework/effect.md` - Effect.ts setup and patterns
- `@docs/architecture/functional-programming.md` - FP principles
- `@docs/architecture/patterns/error-handling-strategy.md` - Error handling
- `@docs/architecture/patterns/client-state-management.md` - TanStack Query integration
