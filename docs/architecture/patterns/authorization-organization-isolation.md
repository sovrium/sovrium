# Organization Isolation

## Overview

Organization isolation ensures strict multi-tenancy in Sovrium. Each organization's data is completely isolated from other organizations. Users can only access records that belong to their organization.

## Multi-Tenancy Architecture

Sovrium implements **database-level multi-tenancy** with a single shared database where every table includes an `organization_id` column:

```sql
CREATE TABLE records (
  id SERIAL PRIMARY KEY,
  organization_id TEXT NOT NULL,  -- Organization isolation
  name TEXT NOT NULL,
  -- ... other fields
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_records_organization ON records(organization_id);
```

## Organization ID Source

Organization ID comes from Better Auth session (provided by Organization plugin):

```typescript
// Better Auth middleware extracts organization
export const requireAuth = createMiddleware(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })

  if (!session?.user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // Extract organization ID from session
  c.set('user', session.user)
  c.set('organizationId', session.user.organizationId) // Available on all routes

  await next()
})
```

**Key Points**:

- Organization ID is **always** present in authenticated session
- Users cannot belong to multiple organizations (Better Auth config: `organizationLimit: 1`)
- Organization membership is validated by Better Auth on every request

## Three Isolation Patterns

### 1. Auto-Inject on CREATE

When creating records, **always** inject the authenticated user's organization ID:

```typescript
app.post('/tables/:tableId/records', requireAuth, async (c) => {
  const user = c.get('user')
  const body = await c.req.json()

  // Prevent organization_id override
  if (body.organization_id && body.organization_id !== user.organizationId) {
    return c.json(
      { error: 'Forbidden', message: 'Cannot create records for different organization' },
      403
    )
  }

  // Auto-inject organization_id (override any client value)
  const record = await db.insert(records).values({
    ...body,
    organization_id: user.organizationId, // Always use authenticated user's org
  })

  return c.json({ record }, 201)
})
```

**Why auto-inject?**

- Prevents users from creating records in other organizations
- Prevents organization enumeration attacks
- Ensures data integrity

### 2. Filter on READ

When fetching records, **always** filter by organization ID:

```typescript
app.get('/tables/:tableId/records', requireAuth, async (c) => {
  const user = c.get('user')

  // Always filter by organization
  const records = await db.query.records.findMany({
    where: eq(records.organization_id, user.organizationId),
  })

  return c.json({ records })
})

app.get('/tables/:tableId/records/:recordId', requireAuth, async (c) => {
  const recordId = parseInt(c.req.param('recordId'))
  const user = c.get('user')

  // Check organization ownership
  const record = await db.query.records.findFirst({
    where: and(
      eq(records.id, recordId),
      eq(records.organization_id, user.organizationId) // Organization filter
    ),
  })

  if (!record) {
    return c.json({ error: 'Record not found' }, 404) // Not 403!
  }

  return c.json({ record })
})
```

**Why filter on read?**

- Prevents users from viewing other organizations' data
- Returns 404 for cross-org access (prevents org enumeration)

### 3. Validate on UPDATE/DELETE

Before modifying a record, verify it belongs to the user's organization:

```typescript
app.patch('/tables/:tableId/records/:recordId', requireAuth, async (c) => {
  const recordId = parseInt(c.req.param('recordId'))
  const user = c.get('user')
  const body = await c.req.json()

  // Check organization ownership FIRST
  const existingRecord = await db.query.records.findFirst({
    where: and(eq(records.id, recordId), eq(records.organization_id, user.organizationId)),
  })

  if (!existingRecord) {
    return c.json({ error: 'Record not found' }, 404) // Not 403!
  }

  // Prevent changing organization_id
  if (body.organization_id && body.organization_id !== user.organizationId) {
    return c.json({ error: 'Forbidden', message: 'Cannot change organization_id' }, 403)
  }

  // ... check permissions, update record
})

app.delete('/tables/:tableId/records/:recordId', requireAuth, async (c) => {
  const recordId = parseInt(c.req.param('recordId'))
  const user = c.get('user')

  // Check organization ownership FIRST
  const existingRecord = await db.query.records.findFirst({
    where: and(eq(records.id, recordId), eq(records.organization_id, user.organizationId)),
  })

  if (!existingRecord) {
    return c.json({ error: 'Record not found' }, 404) // Not 403!
  }

  // ... check permissions, delete record
})
```

## Critical: 404 vs 403 for Cross-Org Access

**Always return 404 for cross-org access, NEVER 403**

```typescript
// ✅ CORRECT - Returns 404
const record = await db.query.records.findFirst({
  where: and(eq(records.id, recordId), eq(records.organization_id, user.organizationId)),
})

if (!record) {
  return c.json({ error: 'Record not found' }, 404) // Correct!
}

// ❌ WRONG - Returns 403 (reveals record exists in another org)
const record = await db.query.records.findFirst({
  where: eq(records.id, recordId),
})

if (!record) {
  return c.json({ error: 'Record not found' }, 404)
}

if (record.organization_id !== user.organizationId) {
  return c.json({ error: 'Forbidden' }, 403) // WRONG! Information leakage
}
```

**Why 404 instead of 403?**

- **403 reveals** that the record exists but belongs to another org
- **404 hides** whether the record exists at all
- Prevents **organization enumeration attacks**

## Permission Check Order (CRITICAL)

Always check permissions in this specific order:

1. **Authentication** (401) - User must be authenticated
2. **Organization Isolation** (404) - Record must belong to user's org
3. **Table-Level Permissions** (403) - User must have table operation permission
4. **Field-Level Permissions** (403) - User must have field access permissions

```typescript
app.patch('/tables/:tableId/records/:recordId', requireAuth, async (c) => {
  const user = c.get('user')
  const tableId = parseInt(c.req.param('tableId'))
  const recordId = parseInt(c.req.param('recordId'))
  const body = await c.req.json()

  // 1. Authentication already checked by requireAuth middleware

  // 2. Organization isolation (404 if not found)
  const existingRecord = await db.query.records.findFirst({
    where: and(eq(records.id, recordId), eq(records.organization_id, user.organizationId)),
  })

  if (!existingRecord) {
    return c.json({ error: 'Record not found' }, 404)
  }

  // 3. Table-level permission (403 if forbidden)
  const canUpdate = await checkTablePermission(user, tableId, 'update')
  if (!canUpdate) {
    return c.json({ error: 'Forbidden', message: 'Cannot update records' }, 403)
  }

  // 4. Field-level permissions (403 if forbidden)
  const writableFields = await getWritableFields(user, tableId)
  for (const field of Object.keys(body)) {
    if (!writableFields.includes(field)) {
      return c.json({ error: 'Forbidden', message: `Cannot write to field: ${field}` }, 403)
    }
  }

  // ... proceed with update
})
```

**Why this order?**

- Checking permissions before org isolation would reveal existence of cross-org records
- Always filter by org BEFORE checking permissions

## Batch Operations with Organization Isolation

For batch operations, validate ALL records belong to user's organization:

```typescript
app.patch('/tables/:tableId/records/batch', requireAuth, async (c) => {
  const user = c.get('user')
  const { updates } = await c.req.json() // Array of { id, ...fields }

  // Extract all record IDs
  const recordIds = updates.map((u) => u.id)

  // Fetch all records with org filter
  const existingRecords = await db.query.records.findMany({
    where: and(
      inArray(records.id, recordIds),
      eq(records.organization_id, user.organizationId) // Organization filter
    ),
  })

  // Check if ALL records were found (org isolation)
  if (existingRecords.length !== recordIds.length) {
    return c.json({ error: 'Record not found' }, 404) // Some records not in user's org
  }

  // ... validate permissions, perform batch update
})

app.delete('/tables/:tableId/records/batch', requireAuth, async (c) => {
  const user = c.get('user')
  const { ids } = await c.req.json()

  // Check all records belong to user's org
  const existingRecords = await db.query.records.findMany({
    where: and(inArray(records.id, ids), eq(records.organization_id, user.organizationId)),
  })

  if (existingRecords.length !== ids.length) {
    return c.json({ error: 'Record not found' }, 404) // Some records not in user's org
  }

  // ... validate permissions, perform batch delete
})
```

**Batch operation rules**:

- If **any** record doesn't belong to user's org, return 404
- Don't reveal **which** records are cross-org
- Use transaction to ensure all-or-nothing updates

## Organization ID in Database Queries

### Using Drizzle ORM

```typescript
import { eq, and, inArray } from 'drizzle-orm'

// Single record query
const record = await db.query.records.findFirst({
  where: and(eq(records.id, recordId), eq(records.organization_id, user.organizationId)),
})

// Multiple records query
const recordList = await db.query.records.findMany({
  where: eq(records.organization_id, user.organizationId),
})

// Batch query
const batchRecords = await db.query.records.findMany({
  where: and(inArray(records.id, recordIds), eq(records.organization_id, user.organizationId)),
})

// Insert with auto-inject
const newRecord = await db.insert(records).values({
  ...body,
  organization_id: user.organizationId, // Always inject
})

// Update with org validation
const updated = await db
  .update(records)
  .set(body)
  .where(and(eq(records.id, recordId), eq(records.organization_id, user.organizationId)))
  .returning()

if (updated.length === 0) {
  return c.json({ error: 'Record not found' }, 404)
}

// Delete with org validation
const deleted = await db
  .delete(records)
  .where(and(eq(records.id, recordId), eq(records.organization_id, user.organizationId)))
  .returning()

if (deleted.length === 0) {
  return c.json({ error: 'Record not found' }, 404)
}
```

## Testing Organization Isolation

### Example Spec: Cross-Org Access Returns 404

```json
{
  "id": "API-TABLES-RECORDS-GET-ORG-ISOLATION-001",
  "given": "A user attempts to access record from different organization",
  "when": "User GETs record with mismatched organization_id",
  "then": "Returns 404 Not Found (not 403 Forbidden)",
  "validation": {
    "setup": {
      "authUser": {
        "id": 2,
        "organizationId": "org_123",
        "role": "admin"
      },
      "fixtures": {
        "records": [
          {
            "id": 1,
            "organization_id": "org_999",
            "name": "Record from other org"
          }
        ]
      }
    },
    "assertions": [
      { "type": "status", "expected": 404 },
      { "type": "validateError", "expectedError": "Record not found" }
    ]
  }
}
```

### Example Spec: Auto-Inject Organization ID

```json
{
  "id": "API-TABLES-RECORDS-CREATE-ORG-AUTO-INJECT-001",
  "given": "A user creates record without specifying organization_id",
  "when": "User POSTs record to /tables/:tableId/records",
  "then": "Returns 201 with record containing auto-injected organization_id",
  "validation": {
    "setup": {
      "authUser": {
        "id": 2,
        "organizationId": "org_123",
        "role": "admin"
      }
    },
    "request": {
      "body": { "name": "New Record" }
    },
    "assertions": [
      { "type": "status", "expected": 201 },
      { "type": "validateResponseData", "path": "record.organization_id", "expected": "org_123" }
    ]
  }
}
```

## Related Documentation

- API Routes Authorization: `authorization-api-routes.md`
- Better Auth Integration: `authorization-better-auth-integration.md`
- Field-Level Permissions: `authorization-field-level-permissions.md`
- Error Handling: `authorization-error-handling.md`
