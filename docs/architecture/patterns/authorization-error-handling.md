# Authorization Error Handling

## Overview

Authorization errors must be handled consistently across all API endpoints. This document defines error types, HTTP status codes, response formats, and Effect.ts error handling patterns.

## HTTP Status Codes

### 401 Unauthorized

**When to use**: User is not authenticated (missing or invalid token)

```typescript
// Missing session
if (!session?.user) {
  return c.json(
    {
      error: 'Unauthorized',
      message: 'Authentication required',
    },
    401
  )
}
```

**Example scenarios**:

- No `Authorization` header in request
- Invalid or malformed JWT token
- Expired session token
- Token signature verification failed

### 403 Forbidden

**When to use**: User is authenticated but lacks required permissions

```typescript
// Table-level permission denied
if (!canCreate) {
  return c.json(
    {
      error: 'Forbidden',
      message: 'You do not have permission to create records in this table',
    },
    403
  )
}

// Field-level permission denied
if (!writableFields.includes(field)) {
  return c.json(
    {
      error: 'Forbidden',
      message: `You do not have permission to write to field: ${field}`,
    },
    403
  )
}

// Readonly field violation
if (READONLY_FIELDS.includes(field)) {
  return c.json(
    {
      error: 'Forbidden',
      message: `Cannot set readonly field: ${field}`,
    },
    403
  )
}
```

**Example scenarios**:

- Viewer role attempting to create records
- Member role attempting to write to protected field (e.g., salary)
- Any user attempting to set readonly fields (id, created_at, updated_at)
- User attempting to create records for different organization

### 404 Not Found

**When to use**: Resource doesn't exist OR belongs to different organization

**CRITICAL**: Always return 404 for cross-org access (never 403)

```typescript
// Organization isolation check
const record = await db.query.records.findFirst({
  where: and(eq(records.id, recordId), eq(records.organization_id, user.organizationId)),
})

if (!record) {
  return c.json({ error: 'Record not found' }, 404) // Could be missing OR cross-org
}
```

**Why 404 instead of 403 for cross-org?**

- 403 reveals that the record exists but belongs to another organization
- 404 hides whether the record exists at all
- Prevents organization enumeration attacks

## Error Response Format

All authorization errors follow a consistent JSON format:

```typescript
interface ErrorResponse {
  error: string // Error type: "Unauthorized", "Forbidden", "Record not found"
  message?: string // Optional human-readable explanation
}
```

### Examples

```json
// 401 Unauthorized
{
  "error": "Unauthorized",
  "message": "Authentication required"
}

// 403 Forbidden (table-level)
{
  "error": "Forbidden",
  "message": "You do not have permission to create records in this table"
}

// 403 Forbidden (field-level)
{
  "error": "Forbidden",
  "message": "You do not have permission to write to field: salary"
}

// 404 Not Found (org isolation)
{
  "error": "Record not found"
}
```

## Effect.ts Error Types

Authorization service uses typed errors in Effect programs:

```typescript
// Effect error types
export class UnauthorizedError extends Error {
  readonly _tag = 'UnauthorizedError'
}

export class ForbiddenError extends Error {
  readonly _tag = 'ForbiddenError'
  constructor(readonly message: string) {
    super(message)
  }
}

export class NotFoundError extends Error {
  readonly _tag = 'NotFoundError'
  constructor(readonly message: string = 'Record not found') {
    super(message)
  }
}
```

## Effect.ts Error Handling Patterns

### Catching Tagged Errors

```typescript
const program = Effect.gen(function* () {
  const authService = yield* AuthorizationService

  // Check permissions
  const canUpdate = yield* authService.checkTablePermission(user, tableId, 'update')
  if (!canUpdate) {
    return yield* Effect.fail(new ForbiddenError('Cannot update records'))
  }

  // ... perform operation
})

// Handle errors
const result = await Effect.runPromise(
  program.pipe(
    Effect.catchTags({
      UnauthorizedError: () =>
        Effect.succeed({
          error: 'Unauthorized',
          message: 'Authentication required',
          status: 401,
        }),
      ForbiddenError: (e) =>
        Effect.succeed({
          error: 'Forbidden',
          message: e.message,
          status: 403,
        }),
      NotFoundError: (e) =>
        Effect.succeed({
          error: e.message,
          status: 404,
        }),
    })
  )
)

// Return appropriate HTTP response
return c.json({ error: result.error, message: result.message }, result.status)
```

### Error Mapping in Routes

```typescript
app.post('/tables/:tableId/records', requireAuth, async (c) => {
  const user = c.get('user')
  const tableId = parseInt(c.req.param('tableId'))
  const body = await c.req.json()

  const program = Effect.gen(function* () {
    const authService = yield* AuthorizationService

    // Check table permission
    const canCreate = yield* authService.checkTablePermission(user, tableId, 'create')
    if (!canCreate) {
      return yield* Effect.fail(
        new ForbiddenError('You do not have permission to create records in this table')
      )
    }

    // Check field permissions
    const writableFields = yield* authService.getWritableFields(user, tableId)
    for (const field of Object.keys(body)) {
      if (!writableFields.includes(field)) {
        return yield* Effect.fail(
          new ForbiddenError(`You do not have permission to write to field: ${field}`)
        )
      }
    }

    // Create record
    const record = yield* createRecord(tableId, body, user.organizationId)

    // Filter response
    const filtered = yield* authService.filterResponseFields(user, tableId, record)

    return filtered
  })

  const result = await Effect.runPromise(
    program.pipe(
      Effect.provide(makeAuthorizationService),
      Effect.catchTags({
        UnauthorizedError: () => Effect.succeed({ error: 'Unauthorized', status: 401 }),
        ForbiddenError: (e) =>
          Effect.succeed({ error: 'Forbidden', message: e.message, status: 403 }),
        NotFoundError: (e) => Effect.succeed({ error: e.message, status: 404 }),
      })
    )
  )

  if ('error' in result) {
    return c.json({ error: result.error, message: result.message }, result.status)
  }

  return c.json({ record: result }, 201)
})
```

## Error Handling Order

Follow this order to prevent information leakage:

1. **Authentication** (401) - Check user is authenticated
2. **Organization Isolation** (404) - Check record belongs to user's org
3. **Table-Level Permissions** (403) - Check user can perform operation
4. **Field-Level Permissions** (403) - Check user can access specific fields

```typescript
app.patch('/tables/:tableId/records/:recordId', requireAuth, async (c) => {
  const user = c.get('user')
  const recordId = parseInt(c.req.param('recordId'))

  // 1. Authentication (handled by requireAuth middleware)

  // 2. Organization isolation (404)
  const record = await db.query.records.findFirst({
    where: and(eq(records.id, recordId), eq(records.organization_id, user.organizationId)),
  })

  if (!record) {
    return c.json({ error: 'Record not found' }, 404) // Could be missing OR cross-org
  }

  // 3. Table-level permission (403)
  const canUpdate = await checkTablePermission(user, tableId, 'update')
  if (!canUpdate) {
    return c.json({ error: 'Forbidden', message: 'Cannot update records' }, 403)
  }

  // 4. Field-level permission (403)
  const writableFields = await getWritableFields(user, tableId)
  for (const field of Object.keys(body)) {
    if (!writableFields.includes(field)) {
      return c.json({ error: 'Forbidden', message: `Cannot write to field: ${field}` }, 403)
    }
  }

  // ... proceed with update
})
```

## Batch Operation Error Handling

For batch operations, fail fast on first error:

```typescript
app.post('/tables/:tableId/records/batch', requireAuth, async (c) => {
  const { records: recordsToCreate } = await c.req.json()

  // Check table permission ONCE
  const canCreate = await checkTablePermission(user, tableId, 'create')
  if (!canCreate) {
    return c.json({ error: 'Forbidden', message: 'Cannot create records' }, 403)
  }

  // Validate ALL records before transaction
  const writableFields = await getWritableFields(user, tableId)

  for (const record of recordsToCreate) {
    // Check field permissions
    for (const field of Object.keys(record)) {
      if (!writableFields.includes(field)) {
        return c.json(
          { error: 'Forbidden', message: `Cannot write to field: ${field} in batch operation` },
          403
        )
      }
    }
  }

  // Start transaction (all validations passed)
  const result = await db.transaction(async (tx) => {
    return await tx
      .insert(records)
      .values(recordsToCreate.map((r) => ({ ...r, organization_id: user.organizationId })))
      .returning()
  })

  return c.json({ records: result }, 201)
})
```

**Key points for batch errors**:

- Validate ALL records before starting transaction
- Return single error for entire batch (don't process partial batch)
- Use transaction with automatic rollback on any error
- Include "in batch operation" in error message for clarity

## Testing Error Responses

### Example Spec: 401 Unauthorized

```json
{
  "id": "API-TABLES-RECORDS-LIST-AUTH-UNAUTHORIZED-001",
  "given": "An unauthenticated request (no auth token)",
  "when": "Request GETs /tables/:tableId/records without authentication",
  "then": "Returns 401 Unauthorized",
  "validation": {
    "setup": {
      "authUser": null
    },
    "assertions": [
      { "type": "status", "expected": 401 },
      { "type": "validateError", "expectedError": "Unauthorized" }
    ]
  }
}
```

### Example Spec: 403 Forbidden (Table-Level)

```json
{
  "id": "API-TABLES-RECORDS-CREATE-PERMISSIONS-FORBIDDEN-001",
  "given": "A viewer user (create permission: false)",
  "when": "Viewer attempts to POST record to /tables/:tableId/records",
  "then": "Returns 403 Forbidden with table permission error",
  "validation": {
    "setup": {
      "authUser": {
        "id": 3,
        "organizationId": "org_123",
        "role": "viewer"
      },
      "tableConfig": {
        "permissions": {
          "viewer": {
            "table": { "create": false }
          }
        }
      }
    },
    "assertions": [
      { "type": "status", "expected": 403 },
      { "type": "validateError", "expectedError": "Forbidden" },
      {
        "type": "validateResponseData",
        "path": "message",
        "expected": "You do not have permission to create records in this table"
      }
    ]
  }
}
```

### Example Spec: 404 Not Found (Org Isolation)

```json
{
  "id": "API-TABLES-RECORDS-GET-ORG-ISOLATION-001",
  "given": "A user attempts to access record from different organization",
  "when": "User GETs record with mismatched organization_id",
  "then": "Returns 404 Not Found (not 403)",
  "validation": {
    "setup": {
      "authUser": {
        "id": 2,
        "organizationId": "org_123",
        "role": "admin"
      },
      "fixtures": {
        "records": [{ "id": 1, "organization_id": "org_999", "name": "Record from other org" }]
      }
    },
    "assertions": [
      { "type": "status", "expected": 404 },
      { "type": "validateError", "expectedError": "Record not found" }
    ]
  }
}
```

## Related Documentation

- API Routes Authorization: `authorization-api-routes.md`
- Better Auth Integration: `authorization-better-auth-integration.md`
- Effect Service Implementation: `authorization-effect-service.md`
- Field-Level Permissions: `authorization-field-level-permissions.md`
- Organization Isolation: `authorization-organization-isolation.md`
