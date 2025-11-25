# Authorization Service with Effect.ts

## Overview

The authorization service is implemented as an Effect.ts service in the Application layer. It provides:

- Table-level permission checks
- Field-level permission checks
- Field filtering for responses
- Error types for authorization failures

## Service Structure

```typescript
// src/application/services/authorization/authorization.service.ts
import * as Effect from 'effect/Effect'
import * as Context from 'effect/Context'

// Authorization errors
export class UnauthorizedError extends Error {
  readonly _tag = 'UnauthorizedError'
}

export class ForbiddenError extends Error {
  readonly _tag = 'ForbiddenError'
  constructor(readonly message: string) {
    super(message)
  }
}

// Authorization service interface
export interface AuthorizationService {
  checkTablePermission: (
    user: User,
    tableId: number,
    operation: TableOperation
  ) => Effect.Effect<boolean, UnauthorizedError>

  checkFieldPermission: (
    user: User,
    tableId: number,
    fieldName: string,
    access: 'read' | 'write'
  ) => Effect.Effect<boolean, UnauthorizedError>

  getReadableFields: (
    user: User,
    tableId: number
  ) => Effect.Effect<readonly string[], UnauthorizedError>

  getWritableFields: (
    user: User,
    tableId: number
  ) => Effect.Effect<readonly string[], UnauthorizedError>

  filterResponseFields: <T extends Record<string, unknown>>(
    user: User,
    tableId: number,
    record: T
  ) => Effect.Effect<T, UnauthorizedError>
}

// Service tag for dependency injection
export const AuthorizationService = Context.GenericTag<AuthorizationService>('AuthorizationService')
```

## Service Implementation

```typescript
// src/application/services/authorization/authorization.service.impl.ts
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { AuthorizationService } from './authorization.service'

export const makeAuthorizationService = Layer.succeed(
  AuthorizationService,
  AuthorizationService.of({
    checkTablePermission: (user, tableId, operation) =>
      Effect.gen(function* () {
        // Fetch table permissions from database
        const permissions = yield* getTablePermissions(tableId, user.organizationId)

        // Check if user role has permission for operation
        const hasPermission = permissions[user.role]?.table?.[operation] ?? false

        return hasPermission
      }),

    checkFieldPermission: (user, tableId, fieldName, access) =>
      Effect.gen(function* () {
        // Fetch table permissions from database
        const permissions = yield* getTablePermissions(tableId, user.organizationId)

        // Check field-level permission
        const fieldPermissions = permissions[user.role]?.fields?.[fieldName]
        const hasPermission = fieldPermissions?.[access] ?? true // Default: allowed

        return hasPermission
      }),

    getReadableFields: (user, tableId) =>
      Effect.gen(function* () {
        // Fetch table permissions
        const permissions = yield* getTablePermissions(tableId, user.organizationId)

        // Get all table fields
        const allFields = yield* getTableFields(tableId)

        // Filter fields user can read
        const readableFields = allFields.filter((field) => {
          const fieldPermissions = permissions[user.role]?.fields?.[field]
          return fieldPermissions?.read ?? true // Default: readable
        })

        return readableFields
      }),

    getWritableFields: (user, tableId) =>
      Effect.gen(function* () {
        // Fetch table permissions
        const permissions = yield* getTablePermissions(tableId, user.organizationId)

        // Get all table fields
        const allFields = yield* getTableFields(tableId)

        // Remove readonly fields
        const READONLY_FIELDS = ['id', 'created_at', 'updated_at']
        const mutableFields = allFields.filter((f) => !READONLY_FIELDS.includes(f))

        // Filter fields user can write
        const writableFields = mutableFields.filter((field) => {
          const fieldPermissions = permissions[user.role]?.fields?.[field]
          return fieldPermissions?.write ?? true // Default: writable
        })

        return writableFields
      }),

    filterResponseFields: (user, tableId, record) =>
      Effect.gen(function* () {
        // Get readable fields for user
        const readableFields = yield* getReadableFields(user, tableId)

        // Filter record to only include readable fields
        const filteredRecord = Object.fromEntries(
          Object.entries(record).filter(([key]) => readableFields.includes(key))
        ) as T

        return filteredRecord
      }),
  })
)
```

## Using Authorization Service in Hono Routes

```typescript
// src/presentation/api/routes/tables/records.ts
import { Hono } from 'hono'
import * as Effect from 'effect/Effect'
import { AuthorizationService } from '@/application/services/authorization'

const app = new Hono()

app.post('/tables/:tableId/records', requireAuth, async (c) => {
  const user = c.get('user')
  const tableId = parseInt(c.req.param('tableId'))
  const body = await c.req.json()

  // Run Effect program
  const program = Effect.gen(function* () {
    const authService = yield* AuthorizationService

    // Check table-level permission
    const canCreate = yield* authService.checkTablePermission(user, tableId, 'create')
    if (!canCreate) {
      return yield* Effect.fail(
        new ForbiddenError('You do not have permission to create records in this table')
      )
    }

    // Check field-level permissions
    const writableFields = yield* authService.getWritableFields(user, tableId)
    for (const field of Object.keys(body)) {
      if (!writableFields.includes(field)) {
        return yield* Effect.fail(
          new ForbiddenError(`You do not have permission to write to field: ${field}`)
        )
      }
    }

    // Create record...
    const record = yield* createRecord(tableId, body)

    // Filter response fields
    const filteredRecord = yield* authService.filterResponseFields(user, tableId, record)

    return filteredRecord
  })

  // Execute Effect program with runtime
  const result = await Effect.runPromise(
    program.pipe(
      Effect.provide(makeAuthorizationService),
      Effect.catchTags({
        UnauthorizedError: () => Effect.succeed({ error: 'Unauthorized' }),
        ForbiddenError: (e) => Effect.succeed({ error: 'Forbidden', message: e.message }),
      })
    )
  )

  if ('error' in result) {
    const status = result.error === 'Unauthorized' ? 401 : 403
    return c.json(result, status)
  }

  return c.json(result, 201)
})
```

## Effect Program Structure

Typical authorization flow using Effect.gen:

```typescript
const program = Effect.gen(function* () {
  // 1. Get authorization service from context
  const authService = yield* AuthorizationService

  // 2. Check table-level permissions
  const canUpdate = yield* authService.checkTablePermission(user, tableId, 'update')
  if (!canUpdate) {
    return yield* Effect.fail(new ForbiddenError('Cannot update records'))
  }

  // 3. Check field-level permissions
  const writableFields = yield* authService.getWritableFields(user, tableId)
  // ... validate fields

  // 4. Perform operation
  const record = yield* updateRecord(recordId, data)

  // 5. Filter response
  const filtered = yield* authService.filterResponseFields(user, tableId, record)

  return filtered
})
```

## Error Handling

Authorization errors are typed and handled via Effect's error channel:

```typescript
// Catching authorization errors
program.pipe(
  Effect.catchTags({
    UnauthorizedError: () =>
      Effect.succeed({ error: 'Unauthorized', message: 'Authentication required' }),
    ForbiddenError: (e) => Effect.succeed({ error: 'Forbidden', message: e.message }),
  })
)
```

## Dependency Injection

Authorization service is provided via Effect Layer:

```typescript
// Create runtime with authorization service
const runtime = Layer.toRuntime(makeAuthorizationService)

// Run program with runtime
const result = await Effect.runPromise(program.pipe(Effect.provide(runtime)))
```

## Testing Authorization Service

```typescript
// Create test authorization service
const testAuthService = Layer.succeed(
  AuthorizationService,
  AuthorizationService.of({
    checkTablePermission: (user, tableId, operation) => Effect.succeed(user.role === 'admin'),

    checkFieldPermission: (user, tableId, field, access) => Effect.succeed(field !== 'salary'),

    getReadableFields: (user, tableId) => Effect.succeed(['id', 'name', 'email']),

    getWritableFields: (user, tableId) => Effect.succeed(['name', 'email']),

    filterResponseFields: (user, tableId, record) =>
      Effect.succeed(
        Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'salary'))
      ),
  })
)

// Use in tests
const testProgram = program.pipe(Effect.provide(testAuthService))
const result = await Effect.runPromise(testProgram)
```

## Performance Considerations

1. **Cache table permissions**: Permissions don't change frequently, consider caching
2. **Batch field checks**: Check all fields at once instead of one-by-one
3. **Lazy field filtering**: Only filter fields if user has restrictions

```typescript
// Example: Cached permissions
const getTablePermissions = (tableId: number, orgId: string) =>
  Effect.gen(function* () {
    const cache = yield* PermissionsCache
    const cached = cache.get(`${tableId}:${orgId}`)

    if (cached) {
      return cached
    }

    const permissions = yield* fetchPermissionsFromDb(tableId, orgId)
    cache.set(`${tableId}:${orgId}`, permissions, { ttl: 60000 }) // 1 minute

    return permissions
  })
```

## Related Documentation

- API Routes Authorization: `authorization-api-routes.md`
- Better Auth Integration: `authorization-better-auth-integration.md`
- Field-Level Permissions: `authorization-field-level-permissions.md`
- Error Handling: `authorization-error-handling.md`
