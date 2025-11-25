# Field-Level Permissions

## Overview

Field-level permissions provide granular control over which fields users can read or write within table records. This allows hiding sensitive data (e.g., salary, SSN) from certain roles while maintaining access to other fields.

## Permission Granularity

Field permissions have two independent access levels:

- **Read**: Can view field in responses (GET operations)
- **Write**: Can modify field in requests (POST, PATCH operations)

These are independent - a field can be:

- Readable but not writable (e.g., `created_by`)
- Writable but not readable (e.g., `password_hash`)
- Both readable and writable (default)
- Neither readable nor writable (fully restricted)

## Permission Configuration Structure

```typescript
// Table permissions configuration
interface TablePermissions {
  [role: string]: {
    table: {
      read: boolean
      create: boolean
      update: boolean
      delete: boolean
    }
    fields: {
      [fieldName: string]: {
        read?: boolean // Default: true (readable)
        write?: boolean // Default: true (writable)
      }
    }
  }
}

// Example configuration
const employeesTablePermissions: TablePermissions = {
  owner: {
    table: { read: true, create: true, update: true, delete: true },
    fields: {}, // Full access to all fields
  },
  admin: {
    table: { read: true, create: true, update: true, delete: true },
    fields: {}, // Full access to all fields
  },
  member: {
    table: { read: true, create: true, update: true, delete: false },
    fields: {
      salary: { read: false, write: false }, // Cannot read or write salary
      ssn: { read: false, write: false }, // Cannot read or write SSN
      performance_review: { read: false }, // Cannot read, but can write
    },
  },
  viewer: {
    table: { read: true, create: false, update: false, delete: false },
    fields: {
      salary: { read: false }, // Cannot read salary
      ssn: { read: false }, // Cannot read SSN
      email: { read: false }, // Cannot read email
      phone: { read: false }, // Cannot read phone
    },
  },
}
```

## Default Permission Behavior

**Important**: If a field is not listed in the `fields` configuration:

- **Default read**: `true` (field is readable)
- **Default write**: `true` (field is writable)

This means:

- Empty `fields: {}` grants full access to all fields
- Only restricted fields need explicit configuration

## Readonly System Fields

Certain fields are **always readonly** regardless of permissions:

```typescript
const READONLY_FIELDS = ['id', 'created_at', 'updated_at']
```

These fields:

- Cannot be set by any user during CREATE or UPDATE
- Are automatically managed by the system
- Always return 403 if client attempts to write them

## Read Permission Implementation

### Filtering Response Fields

When returning records to the client, filter out fields the user cannot read:

```typescript
// Get readable fields for user
const readableFields = await authService.getReadableFields(user, tableId)
// Returns: ['id', 'name', 'email', 'created_at'] (excludes 'salary', 'ssn')

// Filter record to only include readable fields
const filteredRecord = Object.fromEntries(
  Object.entries(record).filter(([key]) => readableFields.includes(key))
)

return c.json({ record: filteredRecord })
```

### Single Record GET Example

```typescript
app.get('/tables/:tableId/records/:recordId', requireAuth, async (c) => {
  const user = c.get('user')
  const tableId = parseInt(c.req.param('tableId'))
  const recordId = parseInt(c.req.param('recordId'))

  // Fetch record with org isolation
  const record = await db.query.records.findFirst({
    where: and(eq(records.id, recordId), eq(records.organization_id, user.organizationId)),
  })

  if (!record) {
    return c.json({ error: 'Record not found' }, 404)
  }

  // Filter fields based on user's read permissions
  const readableFields = await getReadableFields(user, tableId)
  const filteredRecord = Object.fromEntries(
    Object.entries(record).filter(([key]) => readableFields.includes(key))
  )

  return c.json({ record: filteredRecord })
})
```

### List Records GET Example

```typescript
app.get('/tables/:tableId/records', requireAuth, async (c) => {
  const user = c.get('user')
  const tableId = parseInt(c.req.param('tableId'))

  // Fetch records with org isolation
  const records = await db.query.records.findMany({
    where: eq(records.organization_id, user.organizationId),
  })

  // Filter fields for all records
  const readableFields = await getReadableFields(user, tableId)
  const filteredRecords = records.map((record) =>
    Object.fromEntries(Object.entries(record).filter(([key]) => readableFields.includes(key)))
  )

  return c.json({ records: filteredRecords })
})
```

## Write Permission Implementation

### Validating Request Fields

Before creating or updating records, validate that user can write to all fields in request body:

```typescript
// Get writable fields for user
const writableFields = await authService.getWritableFields(user, tableId)
// Returns: ['name', 'email', 'department'] (excludes 'salary', readonly fields)

// Check each field in request body
for (const field of Object.keys(requestBody)) {
  if (!writableFields.includes(field)) {
    return c.json(
      { error: 'Forbidden', message: `You do not have permission to write to field: ${field}` },
      403
    )
  }
}
```

### Create Record POST Example

```typescript
app.post('/tables/:tableId/records', requireAuth, async (c) => {
  const user = c.get('user')
  const tableId = parseInt(c.req.param('tableId'))
  const body = await c.req.json()

  // Check table-level create permission
  const canCreate = await checkTablePermission(user, tableId, 'create')
  if (!canCreate) {
    return c.json({ error: 'Forbidden', message: 'Cannot create records' }, 403)
  }

  // Validate readonly fields
  const READONLY_FIELDS = ['id', 'created_at', 'updated_at']
  for (const field of Object.keys(body)) {
    if (READONLY_FIELDS.includes(field)) {
      return c.json({ error: 'Forbidden', message: `Cannot set readonly field: ${field}` }, 403)
    }
  }

  // Validate field-level write permissions
  const writableFields = await getWritableFields(user, tableId)
  for (const field of Object.keys(body)) {
    if (!writableFields.includes(field)) {
      return c.json(
        { error: 'Forbidden', message: `You do not have permission to write to field: ${field}` },
        403
      )
    }
  }

  // Create record with auto-injected org ID
  const record = await db.insert(records).values({
    ...body,
    organization_id: user.organizationId,
  })

  // Filter response fields
  const readableFields = await getReadableFields(user, tableId)
  const filteredRecord = Object.fromEntries(
    Object.entries(record).filter(([key]) => readableFields.includes(key))
  )

  return c.json({ record: filteredRecord }, 201)
})
```

### Update Record PATCH Example

```typescript
app.patch('/tables/:tableId/records/:recordId', requireAuth, async (c) => {
  const user = c.get('user')
  const tableId = parseInt(c.req.param('tableId'))
  const recordId = parseInt(c.req.param('recordId'))
  const body = await c.req.json()

  // Check org ownership
  const existingRecord = await db.query.records.findFirst({
    where: and(eq(records.id, recordId), eq(records.organization_id, user.organizationId)),
  })

  if (!existingRecord) {
    return c.json({ error: 'Record not found' }, 404)
  }

  // Check table-level update permission
  const canUpdate = await checkTablePermission(user, tableId, 'update')
  if (!canUpdate) {
    return c.json({ error: 'Forbidden', message: 'Cannot update records' }, 403)
  }

  // Validate readonly fields
  const READONLY_FIELDS = ['id', 'created_at', 'updated_at', 'organization_id']
  for (const field of Object.keys(body)) {
    if (READONLY_FIELDS.includes(field)) {
      return c.json({ error: 'Forbidden', message: `Cannot modify readonly field: ${field}` }, 403)
    }
  }

  // Validate field-level write permissions (partial update)
  const writableFields = await getWritableFields(user, tableId)
  for (const field of Object.keys(body)) {
    if (!writableFields.includes(field)) {
      return c.json(
        { error: 'Forbidden', message: `You do not have permission to write to field: ${field}` },
        403
      )
    }
  }

  // Update only provided fields
  const updatedRecord = await db
    .update(records)
    .set(body)
    .where(eq(records.id, recordId))
    .returning()

  // Filter response fields
  const readableFields = await getReadableFields(user, tableId)
  const filteredRecord = Object.fromEntries(
    Object.entries(updatedRecord[0]).filter(([key]) => readableFields.includes(key))
  )

  return c.json({ record: filteredRecord })
})
```

## Batch Operations with Field Permissions

For batch operations, validate ALL records before transaction:

```typescript
app.post('/tables/:tableId/records/batch', requireAuth, async (c) => {
  const user = c.get('user')
  const { records: recordsToCreate } = await c.req.json()

  // Get writable fields ONCE (avoid redundant DB queries)
  const writableFields = await getWritableFields(user, tableId)

  // Validate ALL records before transaction
  for (const record of recordsToCreate) {
    // Check readonly fields
    for (const field of Object.keys(record)) {
      if (READONLY_FIELDS.includes(field)) {
        return c.json({ error: 'Forbidden', message: `Cannot set readonly field: ${field}` }, 403)
      }
    }

    // Check field write permissions
    for (const field of Object.keys(record)) {
      if (!writableFields.includes(field)) {
        return c.json(
          { error: 'Forbidden', message: `Cannot write to field: ${field} in batch` },
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

  // Filter response fields for all created records
  const readableFields = await getReadableFields(user, tableId)
  const filteredRecords = result.map((record) =>
    Object.fromEntries(Object.entries(record).filter(([key]) => readableFields.includes(key)))
  )

  return c.json({ records: filteredRecords }, 201)
})
```

## Performance Optimization

### Caching Field Lists

Field permissions don't change frequently - cache the readable/writable field lists:

```typescript
// Cache readable/writable fields per user+table
const fieldPermissionsCache = new Map<string, { readable: string[]; writable: string[] }>()

function getCachedFieldPermissions(userId: string, tableId: number) {
  const cacheKey = `${userId}:${tableId}`
  return fieldPermissionsCache.get(cacheKey)
}

function setCachedFieldPermissions(
  userId: string,
  tableId: number,
  readable: string[],
  writable: string[]
) {
  const cacheKey = `${userId}:${tableId}`
  fieldPermissionsCache.set(cacheKey, { readable, writable })
}
```

### Single Field Check vs Batch

For single-field operations, check field permission directly:

```typescript
// Single field check (efficient for one field)
const canWriteSalary = await checkFieldPermission(user, tableId, 'salary', 'write')

// Batch field check (efficient for multiple fields)
const writableFields = await getWritableFields(user, tableId)
const canWriteSalary = writableFields.includes('salary')
const canWriteSSN = writableFields.includes('ssn')
```

## Testing Field-Level Permissions

### Example Spec: Field Read Filtering

```json
{
  "id": "API-TABLES-RECORDS-LIST-PERMISSIONS-FIELD-FILTER-MEMBER-001",
  "given": "A member user with field-level restrictions (salary field hidden)",
  "when": "Member lists records from employees table",
  "then": "Returns records with salary field excluded from response",
  "validation": {
    "setup": {
      "authUser": {
        "id": 2,
        "organizationId": "org_123",
        "role": "member"
      },
      "tableConfig": {
        "permissions": {
          "member": {
            "table": { "read": true },
            "fields": {
              "salary": { "read": false }
            }
          }
        }
      },
      "fixtures": {
        "records": [{ "id": 1, "name": "Alice", "salary": 120000 }]
      }
    },
    "assertions": [
      { "type": "status", "expected": 200 },
      { "type": "validateResponseData", "path": "records[0].name", "expected": "Alice" },
      { "type": "validateResponseDataExcluded", "path": "records[0].salary" }
    ]
  }
}
```

### Example Spec: Field Write Restriction

```json
{
  "id": "API-TABLES-RECORDS-CREATE-PERMISSIONS-FIELD-WRITE-MEMBER-001",
  "given": "A member user attempts to set protected field (salary)",
  "when": "Member creates record with salary field",
  "then": "Returns 403 Forbidden with field write permission error",
  "validation": {
    "setup": {
      "authUser": {
        "id": 2,
        "organizationId": "org_123",
        "role": "member"
      },
      "tableConfig": {
        "permissions": {
          "member": {
            "table": { "create": true },
            "fields": {
              "salary": { "write": false }
            }
          }
        }
      }
    },
    "request": {
      "body": { "name": "Alice", "salary": 120000 }
    },
    "assertions": [
      { "type": "status", "expected": 403 },
      { "type": "validateError", "expectedError": "Forbidden" },
      {
        "type": "validateResponseData",
        "path": "message",
        "expected": "You do not have permission to write to field: salary"
      }
    ]
  }
}
```

## Related Documentation

- API Routes Authorization: `authorization-api-routes.md`
- Better Auth Integration: `authorization-better-auth-integration.md`
- Effect Service Implementation: `authorization-effect-service.md`
- Organization Isolation: `authorization-organization-isolation.md`
