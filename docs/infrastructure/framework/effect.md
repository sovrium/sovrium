# Effect.ts - Typed Functional Programming Library

## Overview

**Version**: ^3.19.19
**Purpose**: Comprehensive typed functional programming library for TypeScript with explicit error handling, dependency injection, and structured concurrency
**Full Reference**: https://effect.website/llms.txt

## Why Effect for Sovrium

- **Type-Safe Error Handling**: Errors tracked at the type level, impossible to ignore
- **Dependency Injection**: Built-in, type-safe DI via Context and Layer
- **Composability**: Build complex workflows from simple building blocks
- **Testability**: Pure functional core makes testing trivial without mocks
- **Excellent TypeScript Integration**: Full type inference

## Sovrium-Specific Patterns

### Effect.gen vs async/await: Layer Separation

| Aspect           | Effect.gen                  | async/await                     |
| ---------------- | --------------------------- | ------------------------------- |
| **Use Case**     | Business logic, use cases   | HTTP routes, component effects  |
| **Layer**        | Application, Infrastructure | Presentation                    |
| **Error Types**  | Tracked in type system      | Thrown exceptions (untracked)   |
| **Dependencies** | Injected via Effect Context | Manual DI or globals            |
| **Testability**  | Pure, easy to mock          | Requires mocking infrastructure |

**Rule**: Write business logic with `Effect.gen`, consume it with `async/await` in Hono routes and React components.

### Application Layer: Effect.gen

```typescript
// src/application/use-cases/RegisterUser.ts
export const RegisterUser = (
  input: RegisterUserInput
): Effect.Effect<
  User,
  InvalidEmailError | UserAlreadyExistsError,
  UserRepository | EmailService | Logger
> =>
  Effect.gen(function* () {
    const logger = yield* Logger
    const userRepo = yield* UserRepository

    const existingUser = yield* userRepo.findByEmail(input.email).pipe(Effect.option)
    if (existingUser._tag === 'Some') {
      return yield* Effect.fail(new UserAlreadyExistsError({ email: input.email }))
    }

    const newUser = createUser(input)
    yield* userRepo.save(newUser)
    yield* logger.info(`New user registered: ${newUser.email}`)
    return newUser
  })
```

### Presentation Layer: async/await

```typescript
// src/presentation/api/routes/users.ts
app.post('/register', async (c) => {
  const body = await c.req.json()
  const program = RegisterUser(body).pipe(Effect.provide(AppLayer))
  const result = await Effect.runPromise(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    const error = result.left
    if (error._tag === 'InvalidEmailError') return c.json({ error: error.message }, 400)
    if (error._tag === 'UserAlreadyExistsError')
      return c.json({ error: 'User already exists' }, 409)
    return c.json({ error: 'Internal server error' }, 500)
  }

  return c.json(result.right, 201)
})
```

### Service Definition Pattern

```typescript
import { Effect, Context, Layer } from 'effect'

// Define service interface
class UserRepository extends Context.Tag('UserRepository')<
  UserRepository,
  {
    readonly findById: (id: number) => Effect.Effect<User, UserNotFoundError>
    readonly save: (user: User) => Effect.Effect<void, DatabaseError>
  }
>() {}

// Implement with Layer
const UserRepositoryLive = Layer.effect(
  UserRepository,
  Effect.gen(function* () {
    const db = yield* Database
    return UserRepository.of({
      findById: (id) =>
        Effect.tryPromise({
          /* ... */
        }),
      save: (user) =>
        Effect.tryPromise({
          /* ... */
        }),
    })
  })
)
```

### Error Types with Data.TaggedError

```typescript
import { Data } from 'effect'

class UserNotFoundError extends Data.TaggedError('UserNotFoundError')<{
  readonly userId: number
}> {}

class DatabaseError extends Data.TaggedError('DatabaseError')<{
  readonly cause: unknown
}> {}

// Pattern match on errors
const program = fetchUser(1).pipe(
  Effect.catchTag('UserNotFoundError', () => Effect.succeed(defaultUser)),
  Effect.catchTag('DatabaseError', (error) => Effect.fail(new ServiceUnavailableError()))
)
```

### Running Effects

```typescript
// Run as Promise (most common in Presentation layer)
Effect.runPromise(program)

// Run synchronously (must not have async operations)
const result = Effect.runSync(Effect.succeed(42))

// Run with Either for error handling
const result = await Effect.runPromise(program.pipe(Effect.either))
if (result._tag === 'Left') {
  /* handle error */
}
```

## Experimental Packages

### @effect/experimental (^0.58.0)

Used for DevTools integration in development:

```typescript
// src/infrastructure/devtools/devtools-layer.ts
import { DevTools } from '@effect/experimental'

export const DevToolsLayer = DevTools.layer()
export const isDevToolsEnabled = (): boolean => process.env['EFFECT_DEVTOOLS'] === '1'
```

### @effect/language-service (0.74.0)

TypeScript language service plugin for enhanced IDE support. Configured in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [{ "name": "@effect/language-service" }]
  }
}
```

## Key Differences from Typical Usage

- **Domain Layer**: Pure functions only (no Effect, no side effects)
- **Application Layer**: Effect.gen for workflows, use cases
- **Infrastructure Layer**: Effect services implementing ports (Context.Tag + Layer)
- **Presentation Layer**: async/await consuming Effect programs via `Effect.runPromise`
- **Validation**: Effect Schema for server validation, Zod only for OpenAPI + forms

## Full Documentation

- Official: https://effect.website/docs/introduction
- LLM-optimized: https://effect.website/llms.txt
- GitHub: https://github.com/Effect-TS/effect
