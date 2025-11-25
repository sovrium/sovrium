# Better Auth Integration for Authorization

## Overview

Better Auth (v1.3.34) provides authentication and user session management. This document describes how to extract user context and organization information from Better Auth for authorization purposes.

## Better Auth Setup

```typescript
// src/infrastructure/auth/better-auth.ts
import { betterAuth } from 'better-auth'
import { organization } from 'better-auth/plugins'

export const auth = betterAuth({
  database: {
    // Drizzle adapter configuration
  },
  plugins: [
    organization({
      // Organization plugin configuration
      allowUserToCreateOrganization: true,
      organizationLimit: 1, // Users can belong to one org
    }),
  ],
})
```

## User Context Structure

Better Auth session contains:

```typescript
interface Session {
  user: {
    id: string
    email: string
    name: string
    organizationId: string // From organization plugin
    role: 'owner' | 'admin' | 'member' | 'viewer'
  }
  session: {
    id: string
    expiresAt: Date
  }
}
```

## Extracting Session in Hono Middleware

```typescript
// src/presentation/api/middleware/auth.ts
import { createMiddleware } from 'hono/factory'
import { auth } from '@/infrastructure/auth/better-auth'

export const requireAuth = createMiddleware(async (c, next) => {
  // Extract session from request headers
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  })

  // Check if session exists and has user
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

## Roles and Their Default Permissions

Better Auth Organization plugin provides these roles:

```typescript
type Role = 'owner' | 'admin' | 'member' | 'viewer'

// Default permission patterns by role:
const DEFAULT_PERMISSIONS = {
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
    fields: {}, // Default full access, can be restricted per table
  },
  viewer: {
    table: { read: true, create: false, update: false, delete: false },
    fields: {}, // Read-only, can be restricted per table
  },
}
```

## Organization Context

Organization ID from Better Auth is used for:

1. **Isolation**: Users can only access data from their organization
2. **Auto-injection**: Records are automatically tagged with user's organization ID
3. **Multi-tenancy**: Each organization's data is isolated

```typescript
// Get organization ID from authenticated user
const userOrgId = c.get('organizationId')

// Use in database queries
const records = await db.query.records.findMany({
  where: eq(records.organization_id, userOrgId),
})

// Auto-inject on create
const newRecord = await db.insert(records).values({
  ...recordData,
  organization_id: userOrgId,
})
```

## Accessing User Context in Routes

```typescript
// src/presentation/api/routes/tables/records.ts
import { Hono } from 'hono'
import { requireAuth } from '@/presentation/api/middleware/auth'

const app = new Hono()

app.get('/tables/:tableId/records', requireAuth, async (c) => {
  // Extract user context from Hono context
  const user = c.get('user')
  const organizationId = c.get('organizationId')
  const role = c.get('role')

  // Use in authorization checks
  const canRead = await checkTablePermission(user, tableId, 'read')

  if (!canRead) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  // Use organizationId in query filters
  const records = await db.query.records.findMany({
    where: eq(records.organization_id, organizationId),
  })

  return c.json({ records })
})
```

## Session Token Validation

Better Auth handles:

- Token extraction from `Authorization: Bearer <token>` header
- Token validation and expiration
- Session renewal (if configured)

No manual token validation needed in application code.

## Error Scenarios

### Missing Token

```typescript
// Request without Authorization header
await auth.api.getSession({ headers: request.headers })
// Returns: null

// Middleware response:
return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401)
```

### Expired Token

```typescript
// Request with expired token
await auth.api.getSession({ headers: request.headers })
// Returns: null

// Middleware response:
return c.json({ error: 'Unauthorized', message: 'Session expired' }, 401)
```

### Invalid Token

```typescript
// Request with malformed/invalid token
await auth.api.getSession({ headers: request.headers })
// Returns: null

// Middleware response:
return c.json({ error: 'Unauthorized', message: 'Invalid authentication token' }, 401)
```

## Organization Membership Validation

Better Auth Organization plugin ensures:

- Users always have an `organizationId` in session
- Users can only belong to one organization (based on config)
- Organization membership is validated on each request

No manual organization membership check needed.

## Testing with Better Auth

For E2E tests, create test sessions:

```typescript
// In test setup
const testUser = {
  id: 1,
  email: 'test@example.com',
  organizationId: 'org_123',
  role: 'admin',
}

// Mock Better Auth session
vi.mock('@/infrastructure/auth/better-auth', () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue({
        user: testUser,
        session: { id: 'session_123', expiresAt: new Date('2025-12-31') },
      }),
    },
  },
}))
```

## Integration with Authorization Service

The authorization service receives user context from Better Auth:

```typescript
// Authorization service receives user object
interface User {
  id: string
  organizationId: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
}

// Check permissions using user context
async function checkTablePermission(
  user: User,
  tableId: number,
  operation: 'read' | 'create' | 'update' | 'delete'
): Promise<boolean> {
  // Fetch table permissions configuration
  const permissions = await getTablePermissions(tableId, user.organizationId)

  // Check if user role has permission for operation
  return permissions[user.role]?.table?.[operation] ?? false
}
```

## Related Documentation

- API Routes Authorization: `authorization-api-routes.md`
- Effect Service Implementation: `authorization-effect-service.md`
- Organization Isolation: `authorization-organization-isolation.md`
