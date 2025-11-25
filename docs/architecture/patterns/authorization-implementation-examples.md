# Authorization Implementation Examples

## Overview

This document provides complete, copy-paste-ready implementation examples for all authorization patterns in Sovrium. Each example includes error handling, permission checks, and organization isolation.

## Complete Route Examples

### Example 1: List Records (GET /tables/:tableId/records)

Full implementation with field filtering, pagination, and organization isolation:

```typescript
// src/presentation/api/routes/tables/records.ts
import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '@/presentation/api/middleware/auth'
import { checkTablePermission, getReadableFields } from '@/application/services/authorization'

const app = new Hono()

app.get('/tables/:tableId/records', requireAuth, async (c) => {
  const user = c.get('user')
  const organizationId = c.get('organizationId')
  const tableId = parseInt(c.req.param('tableId'))

  // Parse query params
  const limit = parseInt(c.req.query('limit') || '50')
  const offset = parseInt(c.req.query('offset') || '0')

  // Check table-level read permission
  const canRead = await checkTablePermission(user, tableId, 'read')
  if (!canRead) {
    return c.json(
      { error: 'Forbidden', message: 'You do not have permission to read records from this table' },
      403
    )
  }

  // Fetch records with org isolation
  const records = await db.query.records.findMany({
    where: eq(records.organization_id, organizationId),
    limit,
    offset,
  })

  // Get total count (with org filter)
  const totalCount = await db
    .select({ count: count() })
    .from(records)
    .where(eq(records.organization_id, organizationId))

  // Filter fields based on user's read permissions
  const readableFields = await getReadableFields(user, tableId)
  const filteredRecords = records.map((record) =>
    Object.fromEntries(Object.entries(record).filter(([key]) => readableFields.includes(key)))
  )

  return c.json({
    records: filteredRecords,
    pagination: {
      total: totalCount[0].count,
      limit,
      offset,
      hasMore: offset + limit < totalCount[0].count,
    },
  })
})
```

### Example 2: Create Record (POST /tables/:tableId/records)

Full implementation with field validation and auto-injection:

```typescript
app.post('/tables/:tableId/records', requireAuth, async (c) => {
  const user = c.get('user')
  const organizationId = c.get('organizationId')
  const tableId = parseInt(c.req.param('tableId'))
  const body = await c.req.json()

  // Check table-level create permission
  const canCreate = await checkTablePermission(user, tableId, 'create')
  if (!canCreate) {
    return c.json(
      { error: 'Forbidden', message: 'You do not have permission to create records in this table' },
      403
    )
  }

  // Validate readonly fields
  const READONLY_FIELDS = ['id', 'created_at', 'updated_at']
  for (const field of Object.keys(body)) {
    if (READONLY_FIELDS.includes(field)) {
      return c.json({ error: 'Forbidden', message: `Cannot set readonly field: ${field}` }, 403)
    }
  }

  // Prevent organization_id override
  if (body.organization_id && body.organization_id !== organizationId) {
    return c.json(
      { error: 'Forbidden', message: 'Cannot create records for different organization' },
      403
    )
  }

  // Check field-level write permissions
  const writableFields = await getWritableFields(user, tableId)
  for (const field of Object.keys(body)) {
    if (!writableFields.includes(field)) {
      return c.json(
        { error: 'Forbidden', message: `You do not have permission to write to field: ${field}` },
        403
      )
    }
  }

  // Create record with auto-injected organization_id
  const [newRecord] = await db
    .insert(records)
    .values({
      ...body,
      organization_id: organizationId, // Always inject
    })
    .returning()

  // Filter response fields
  const readableFields = await getReadableFields(user, tableId)
  const filteredRecord = Object.fromEntries(
    Object.entries(newRecord).filter(([key]) => readableFields.includes(key))
  )

  return c.json({ record: filteredRecord }, 201)
})
```

### Example 3: Get Single Record (GET /tables/:tableId/records/:recordId)

Full implementation with organization isolation check:

```typescript
app.get('/tables/:tableId/records/:recordId', requireAuth, async (c) => {
  const user = c.get('user')
  const organizationId = c.get('organizationId')
  const tableId = parseInt(c.req.param('tableId'))
  const recordId = parseInt(c.req.param('recordId'))

  // Check organization ownership FIRST (before permission check)
  const record = await db.query.records.findFirst({
    where: and(eq(records.id, recordId), eq(records.organization_id, organizationId)),
  })

  if (!record) {
    return c.json({ error: 'Record not found' }, 404) // Not 403!
  }

  // Check table-level read permission
  const canRead = await checkTablePermission(user, tableId, 'read')
  if (!canRead) {
    return c.json(
      { error: 'Forbidden', message: 'You do not have permission to read records from this table' },
      403
    )
  }

  // Filter fields based on user's read permissions
  const readableFields = await getReadableFields(user, tableId)
  const filteredRecord = Object.fromEntries(
    Object.entries(record).filter(([key]) => readableFields.includes(key))
  )

  return c.json({ record: filteredRecord })
})
```

### Example 4: Update Record (PATCH /tables/:tableId/records/:recordId)

Full implementation with partial update support:

```typescript
app.patch('/tables/:tableId/records/:recordId', requireAuth, async (c) => {
  const user = c.get('user')
  const organizationId = c.get('organizationId')
  const tableId = parseInt(c.req.param('tableId'))
  const recordId = parseInt(c.req.param('recordId'))
  const body = await c.req.json()

  // Check organization ownership FIRST
  const existingRecord = await db.query.records.findFirst({
    where: and(eq(records.id, recordId), eq(records.organization_id, organizationId)),
  })

  if (!existingRecord) {
    return c.json({ error: 'Record not found' }, 404)
  }

  // Check table-level update permission
  const canUpdate = await checkTablePermission(user, tableId, 'update')
  if (!canUpdate) {
    return c.json(
      { error: 'Forbidden', message: 'You do not have permission to update records in this table' },
      403
    )
  }

  // Validate readonly fields
  const READONLY_FIELDS = ['id', 'created_at', 'updated_at', 'organization_id']
  for (const field of Object.keys(body)) {
    if (READONLY_FIELDS.includes(field)) {
      return c.json({ error: 'Forbidden', message: `Cannot modify readonly field: ${field}` }, 403)
    }
  }

  // Check field-level write permissions (partial update)
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
  const [updatedRecord] = await db
    .update(records)
    .set({ ...body, updated_at: new Date() })
    .where(and(eq(records.id, recordId), eq(records.organization_id, organizationId)))
    .returning()

  // Filter response fields
  const readableFields = await getReadableFields(user, tableId)
  const filteredRecord = Object.fromEntries(
    Object.entries(updatedRecord).filter(([key]) => readableFields.includes(key))
  )

  return c.json({ record: filteredRecord })
})
```

### Example 5: Delete Record (DELETE /tables/:tableId/records/:recordId)

Full implementation with organization check:

```typescript
app.delete('/tables/:tableId/records/:recordId', requireAuth, async (c) => {
  const user = c.get('user')
  const organizationId = c.get('organizationId')
  const tableId = parseInt(c.req.param('tableId'))
  const recordId = parseInt(c.req.param('recordId'))

  // Check organization ownership FIRST
  const existingRecord = await db.query.records.findFirst({
    where: and(eq(records.id, recordId), eq(records.organization_id, organizationId)),
  })

  if (!existingRecord) {
    return c.json({ error: 'Record not found' }, 404)
  }

  // Check table-level delete permission
  const canDelete = await checkTablePermission(user, tableId, 'delete')
  if (!canDelete) {
    return c.json(
      {
        error: 'Forbidden',
        message: 'You do not have permission to delete records from this table',
      },
      403
    )
  }

  // Delete record
  await db
    .delete(records)
    .where(and(eq(records.id, recordId), eq(records.organization_id, organizationId)))

  return c.json({ success: true }, 200)
})
```

### Example 6: Batch Create (POST /tables/:tableId/records/batch)

Full implementation with transaction and validation:

```typescript
app.post('/tables/:tableId/records/batch', requireAuth, async (c) => {
  const user = c.get('user')
  const organizationId = c.get('organizationId')
  const tableId = parseInt(c.req.param('tableId'))
  const { records: recordsToCreate } = await c.req.json()

  // Check table-level create permission ONCE
  const canCreate = await checkTablePermission(user, tableId, 'create')
  if (!canCreate) {
    return c.json(
      { error: 'Forbidden', message: 'You do not have permission to create records in this table' },
      403
    )
  }

  // Get writable fields ONCE (avoid redundant queries)
  const writableFields = await getWritableFields(user, tableId)
  const READONLY_FIELDS = ['id', 'created_at', 'updated_at']

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
          { error: 'Forbidden', message: `Cannot write to field: ${field} in batch operation` },
          403
        )
      }
    }

    // Check org override
    if (record.organization_id && record.organization_id !== organizationId) {
      return c.json(
        { error: 'Forbidden', message: 'Cannot create records for different organization' },
        403
      )
    }
  }

  // Start transaction (all validations passed)
  const result = await db.transaction(async (tx) => {
    return await tx
      .insert(records)
      .values(recordsToCreate.map((r) => ({ ...r, organization_id: organizationId })))
      .returning()
  })

  // Filter response fields for all created records
  const readableFields = await getReadableFields(user, tableId)
  const filteredRecords = result.map((record) =>
    Object.fromEntries(Object.entries(record).filter(([key]) => readableFields.includes(key)))
  )

  return c.json({ records: filteredRecords, count: filteredRecords.length }, 201)
})
```

### Example 7: Batch Update (PATCH /tables/:tableId/records/batch)

Full implementation with organization validation for all IDs:

```typescript
app.patch('/tables/:tableId/records/batch', requireAuth, async (c) => {
  const user = c.get('user')
  const organizationId = c.get('organizationId')
  const tableId = parseInt(c.req.param('tableId'))
  const { updates } = await c.req.json() // Array of { id, ...fields }

  // Extract all record IDs
  const recordIds = updates.map((u) => u.id)

  // Check organization ownership for ALL records
  const existingRecords = await db.query.records.findMany({
    where: and(inArray(records.id, recordIds), eq(records.organization_id, organizationId)),
  })

  if (existingRecords.length !== recordIds.length) {
    return c.json({ error: 'Record not found' }, 404) // Some records not in user's org
  }

  // Check table-level update permission
  const canUpdate = await checkTablePermission(user, tableId, 'update')
  if (!canUpdate) {
    return c.json(
      { error: 'Forbidden', message: 'You do not have permission to update records in this table' },
      403
    )
  }

  // Get writable fields ONCE
  const writableFields = await getWritableFields(user, tableId)
  const READONLY_FIELDS = ['id', 'created_at', 'updated_at', 'organization_id']

  // Validate ALL updates before transaction
  for (const update of updates) {
    const { id, ...fields } = update

    // Check readonly fields
    for (const field of Object.keys(fields)) {
      if (READONLY_FIELDS.includes(field)) {
        return c.json(
          { error: 'Forbidden', message: `Cannot modify readonly field: ${field}` },
          403
        )
      }
    }

    // Check field write permissions
    for (const field of Object.keys(fields)) {
      if (!writableFields.includes(field)) {
        return c.json(
          { error: 'Forbidden', message: `Cannot write to field: ${field} in batch operation` },
          403
        )
      }
    }
  }

  // Start transaction
  const result = await db.transaction(async (tx) => {
    const updatedRecords = []

    for (const update of updates) {
      const { id, ...fields } = update

      const [updated] = await tx
        .update(records)
        .set({ ...fields, updated_at: new Date() })
        .where(and(eq(records.id, id), eq(records.organization_id, organizationId)))
        .returning()

      updatedRecords.push(updated)
    }

    return updatedRecords
  })

  // Filter response fields
  const readableFields = await getReadableFields(user, tableId)
  const filteredRecords = result.map((record) =>
    Object.fromEntries(Object.entries(record).filter(([key]) => readableFields.includes(key)))
  )

  return c.json({ records: filteredRecords, count: filteredRecords.length })
})
```

### Example 8: Batch Delete (DELETE /tables/:tableId/records/batch)

Full implementation with org validation:

```typescript
app.delete('/tables/:tableId/records/batch', requireAuth, async (c) => {
  const user = c.get('user')
  const organizationId = c.get('organizationId')
  const tableId = parseInt(c.req.param('tableId'))
  const { ids } = await c.req.json()

  // Check organization ownership for ALL records
  const existingRecords = await db.query.records.findMany({
    where: and(inArray(records.id, ids), eq(records.organization_id, organizationId)),
  })

  if (existingRecords.length !== ids.length) {
    return c.json({ error: 'Record not found' }, 404) // Some records not in user's org
  }

  // Check table-level delete permission
  const canDelete = await checkTablePermission(user, tableId, 'delete')
  if (!canDelete) {
    return c.json(
      {
        error: 'Forbidden',
        message: 'You do not have permission to delete records from this table',
      },
      403
    )
  }

  // Delete all records in transaction
  const result = await db.transaction(async (tx) => {
    return await tx
      .delete(records)
      .where(and(inArray(records.id, ids), eq(records.organization_id, organizationId)))
      .returning()
  })

  return c.json({ success: true, count: result.length })
})
```

## Authorization Service Helper Functions

These helper functions are used by the route examples above:

```typescript
// src/application/services/authorization/helpers.ts
import { db } from '@/infrastructure/database'
import { eq, and } from 'drizzle-orm'

export async function checkTablePermission(
  user: { id: number; organizationId: string; role: string },
  tableId: number,
  operation: 'read' | 'create' | 'update' | 'delete'
): Promise<boolean> {
  // Fetch table permissions configuration
  const tableConfig = await db.query.tableConfigs.findFirst({
    where: and(eq(tableConfigs.id, tableId), eq(tableConfigs.organization_id, user.organizationId)),
  })

  if (!tableConfig) {
    return false // Table doesn't exist or not in user's org
  }

  // Parse permissions JSON
  const permissions = tableConfig.permissions as TablePermissions

  // Check if user role has permission for operation
  return permissions[user.role]?.table?.[operation] ?? false
}

export async function getWritableFields(
  user: { id: number; organizationId: string; role: string },
  tableId: number
): Promise<string[]> {
  // Fetch table config
  const tableConfig = await db.query.tableConfigs.findFirst({
    where: and(eq(tableConfigs.id, tableId), eq(tableConfigs.organization_id, user.organizationId)),
  })

  if (!tableConfig) {
    return []
  }

  // Get all table fields
  const allFields = Object.keys(tableConfig.schema.properties)

  // Remove readonly fields
  const READONLY_FIELDS = ['id', 'created_at', 'updated_at', 'organization_id']
  const mutableFields = allFields.filter((f) => !READONLY_FIELDS.includes(f))

  // Parse permissions
  const permissions = tableConfig.permissions as TablePermissions
  const rolePermissions = permissions[user.role]

  if (!rolePermissions) {
    return [] // Role has no permissions
  }

  // Filter writable fields
  const writableFields = mutableFields.filter((field) => {
    const fieldPermissions = rolePermissions.fields?.[field]
    return fieldPermissions?.write ?? true // Default: writable
  })

  return writableFields
}

export async function getReadableFields(
  user: { id: number; organizationId: string; role: string },
  tableId: number
): Promise<string[]> {
  // Fetch table config
  const tableConfig = await db.query.tableConfigs.findFirst({
    where: and(eq(tableConfigs.id, tableId), eq(tableConfigs.organization_id, user.organizationId)),
  })

  if (!tableConfig) {
    return []
  }

  // Get all table fields
  const allFields = Object.keys(tableConfig.schema.properties)

  // Parse permissions
  const permissions = tableConfig.permissions as TablePermissions
  const rolePermissions = permissions[user.role]

  if (!rolePermissions) {
    return [] // Role has no permissions
  }

  // Filter readable fields
  const readableFields = allFields.filter((field) => {
    const fieldPermissions = rolePermissions.fields?.[field]
    return fieldPermissions?.read ?? true // Default: readable
  })

  return readableFields
}
```

## Authentication Middleware

```typescript
// src/presentation/api/middleware/auth.ts
import { createMiddleware } from 'hono/factory'
import { auth } from '@/infrastructure/auth/better-auth'

export const requireAuth = createMiddleware(async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  })

  if (!session?.user) {
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Authentication required',
      },
      401
    )
  }

  // Store user context in Hono context
  c.set('user', session.user)
  c.set('organizationId', session.user.organizationId)
  c.set('role', session.user.role)

  await next()
})
```

## Related Documentation

- API Routes: `authorization-api-routes.md`
- Better Auth: `authorization-better-auth-integration.md`
- Effect Service: `authorization-effect-service.md`
- Field Permissions: `authorization-field-level-permissions.md`
- Org Isolation: `authorization-organization-isolation.md`
- Error Handling: `authorization-error-handling.md`
- ADR: `ADR-003-authorization-strategy.md`
