# Error Handling Strategy

## Overview

Sovrium uses **Effect.ts typed errors** for predictable, composable error handling across all layers. This document describes the error type hierarchy, cross-layer propagation patterns, and user-facing error mapping.

## Core Principles

### 1. No Throw Statements

- Use `Effect.fail(error)` instead of `throw`
- Enforced via ESLint `no-throw-statements` rule
- Errors are values, not exceptions

### 2. Discriminated Union Errors

- All errors have a `readonly _tag` property
- Enables type-safe error matching with `Effect.catchTag`
- Pattern: `{ readonly _tag: 'ErrorName', readonly cause: unknown }`

### 3. Layer-Specific Errors

- **Domain**: Business rule violations
- **Application**: Use case failures, validation errors
- **Infrastructure**: Technical failures (DB, network, filesystem)
- **Presentation**: API response formatting

## Error Type Hierarchy

### Infrastructure Errors (Technical Failures)

Located in `src/infrastructure/errors/`:

```typescript
// Server creation failure
export class ServerCreationError {
  readonly _tag = 'ServerCreationError'
  constructor(readonly cause: unknown) {}
}

// CSS compilation failure
export class CSSCompilationError {
  readonly _tag = 'CSSCompilationError'
  constructor(readonly cause: unknown) {}
}

// Authentication failure
export class AuthError {
  readonly _tag = 'AuthError'
  constructor(readonly cause: unknown) {}
}
```

### Application Errors (Use Case Failures)

Located in `src/application/errors/`:

```typescript
// App schema validation failure
export class AppValidationError {
  readonly _tag = 'AppValidationError'
  constructor(readonly cause: unknown) {}
}

// Static generation failure
export class StaticGenerationError {
  readonly _tag = 'StaticGenerationError'
  constructor(readonly cause: unknown) {}
}
```

### Domain Errors (Business Rule Violations)

Located in `src/domain/errors/` (create as needed):

```typescript
// Example domain errors
export class InvalidEmailError {
  readonly _tag = 'InvalidEmailError'
  constructor(readonly email: string) {}
}

export class UserNotFoundError {
  readonly _tag = 'UserNotFoundError'
  constructor(readonly userId: number) {}
}

export class InsufficientPermissionsError {
  readonly _tag = 'InsufficientPermissionsError'
  constructor(
    readonly userId: number,
    readonly requiredPermission: string
  ) {}
}
```

### API Error Schemas (Response Formatting)

Located in `src/domain/models/api/error-schemas.ts`:

```typescript
import { z } from 'zod'

// Field-level validation error
export const fieldErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
  code: z.string().optional(),
})

// Validation error response
export const validationErrorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  errors: z.array(fieldErrorSchema),
})

// Generic error response
export const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  code: z.enum([
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'CONFLICT',
    'RATE_LIMITED',
    'INTERNAL_ERROR',
    'SERVICE_UNAVAILABLE',
  ]),
})
```

## Cross-Layer Error Propagation

### Pattern: Infrastructure → Application → Presentation

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Infrastructure │ ──▶ │   Application   │ ──▶ │  Presentation   │
│                 │     │                 │     │                 │
│ DatabaseError   │     │ UserNotFound    │     │ 404 JSON        │
│ NetworkError    │     │ ValidationError │     │ Error Response  │
│ AuthError       │     │ WorkflowFailed  │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Example: Database Error → User Not Found → 404 Response

```typescript
// Infrastructure Layer - Raw database error
class DatabaseError {
  readonly _tag = 'DatabaseError'
  constructor(readonly cause: unknown) {}
}

// Application Layer - Maps to domain error
const getUser = (id: number) =>
  Effect.gen(function* () {
    const repo = yield* UserRepository
    return yield* repo.findById(id).pipe(
      Effect.catchTag('DatabaseError', (e) =>
        // Map infrastructure error to domain error
        Effect.fail(new UserNotFoundError(id))
      )
    )
  })

// Presentation Layer - Maps to API response
const handler = async (c: Context) => {
  const result = await Effect.runPromise(getUser(parseInt(c.req.param('id'))).pipe(Effect.either))

  if (result._tag === 'Left') {
    const error = result.left
    // Map application error to HTTP response
    if (error._tag === 'UserNotFoundError') {
      return c.json({ error: 'User not found' }, 404)
    }
    return c.json({ error: 'Internal server error' }, 500)
  }

  return c.json({ user: result.right }, 200)
}
```

## Error Handling Patterns

### Pattern 1: Catching Specific Errors

```typescript
const program = Effect.gen(function* () {
  const user = yield* getUser(1)
  return user
}).pipe(
  // Catch specific error type
  Effect.catchTag('UserNotFoundError', (error) =>
    Effect.succeed({ user: null, error: 'User not found' })
  ),
  // Catch all remaining errors
  Effect.catchAll((error) => Effect.fail(new ApplicationError('Unexpected error', error)))
)
```

### Pattern 2: Error Recovery with Fallback

```typescript
const getUserWithFallback = (id: number) =>
  getUser(id).pipe(
    // Retry on transient errors
    Effect.retry({ times: 3 }),
    // Fallback to cached data
    Effect.catchTag('DatabaseError', () => getCachedUser(id)),
    // Final fallback
    Effect.orElse(() => Effect.succeed(defaultUser))
  )
```

### Pattern 3: Error Context Enrichment

```typescript
const enrichedProgram = program.pipe(
  Effect.mapError((error) => ({
    ...error,
    timestamp: new Date().toISOString(),
    requestId: generateRequestId(),
    userId: getCurrentUserId(),
  }))
)
```

### Pattern 4: Unified Error Handler

```typescript
// src/presentation/api/utils/error-handler.ts
export async function handleEffect<T, E>(
  c: Context,
  program: Effect.Effect<T, E>,
  options?: { successStatus?: number }
) {
  const result = await Effect.runPromise(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    return mapErrorToResponse(c, result.left)
  }

  return c.json(result.right, options?.successStatus ?? 200)
}

function mapErrorToResponse(c: Context, error: unknown) {
  if (hasTag(error, 'UserNotFoundError')) return c.json({ error: 'User not found' }, 404)
  if (hasTag(error, 'UnauthorizedError')) return c.json({ error: 'Unauthorized' }, 401)
  if (hasTag(error, 'ForbiddenError')) return c.json({ error: 'Forbidden' }, 403)
  if (hasTag(error, 'ValidationError')) return c.json({ error: error.message }, 400)

  // Log unexpected errors
  console.error('Unexpected error:', error)
  return c.json({ error: 'Internal server error' }, 500)
}

function hasTag<T extends string>(error: unknown, tag: T): error is { _tag: T } {
  return typeof error === 'object' && error !== null && '_tag' in error && error._tag === tag
}
```

## User-Facing Error Messages

### Mapping Technical Errors to User Messages

| Technical Error                | HTTP Status | User Message                                       |
| ------------------------------ | ----------- | -------------------------------------------------- |
| `UserNotFoundError`            | 404         | "User not found"                                   |
| `InvalidEmailError`            | 400         | "Please enter a valid email address"               |
| `InsufficientPermissionsError` | 403         | "You don't have permission to perform this action" |
| `AuthError`                    | 401         | "Please sign in to continue"                       |
| `DatabaseError`                | 500         | "Something went wrong. Please try again."          |
| `RateLimitError`               | 429         | "Too many requests. Please wait a moment."         |

### Security Considerations

- **Never expose internal error details** to users
- Use generic messages for 500 errors ("Something went wrong")
- Log detailed errors server-side for debugging
- Return 404 for unauthorized cross-tenant access (prevents enumeration)

## Error Testing Strategy

### Unit Tests for Error Classes

```typescript
// src/infrastructure/errors/server-creation-error.test.ts
import { describe, it, expect } from 'bun:test'
import { ServerCreationError } from './server-creation-error'

describe('ServerCreationError', () => {
  it('should have correct _tag', () => {
    const error = new ServerCreationError('connection failed')
    expect(error._tag).toBe('ServerCreationError')
  })

  it('should preserve cause', () => {
    const cause = new Error('original error')
    const error = new ServerCreationError(cause)
    expect(error.cause).toBe(cause)
  })
})
```

### Integration Tests for Error Flows

```typescript
// E2E test for error handling
test('should return 404 for non-existent user', async ({ page }) => {
  const response = await page.request.get('/api/users/99999')
  expect(response.status()).toBe(404)
  const data = await response.json()
  expect(data.error).toBe('User not found')
})
```

## Enforcement

### ESLint Rules (Active)

| Rule                             | Purpose                                  |
| -------------------------------- | ---------------------------------------- |
| `no-throw-statements`            | Prevents `throw`, enforces `Effect.fail` |
| `functional/no-throw-statements` | FP enforcement                           |

### TypeScript Enforcement

- Errors must have `readonly _tag` property
- `Effect.catchTag` requires matching `_tag` types
- Effect error channel provides type safety

### Manual Review Checklist

- [ ] All errors extend the `{ _tag, cause }` pattern
- [ ] Infrastructure errors don't leak to API responses
- [ ] User-facing messages are generic and safe
- [ ] Unexpected errors are logged server-side
- [ ] Cross-tenant 404s prevent enumeration

## Related Documentation

- `@docs/architecture/patterns/react-effect-integration.md` - Effect in React
- `@docs/architecture/functional-programming.md` - FP principles
- `@docs/architecture/patterns/authorization-error-handling.md` - Auth-specific errors
- `@docs/infrastructure/framework/effect.md` - Effect.ts setup
