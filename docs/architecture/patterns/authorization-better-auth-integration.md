# Better Auth Integration for Authorization

## Overview

Better Auth (v1.3.34) provides authentication and user session management. This document describes how to extract user context and organization information from Better Auth for authorization purposes.

## Better Auth Setup

### Organization Plugin Configuration

Sovrium uses Better Auth's organization plugin for multi-tenancy. The plugin is **conditionally enabled** based on app schema configuration.

**File**: `src/infrastructure/auth/better-auth/auth.ts`

```typescript
import { betterAuth } from 'better-auth'
import { organization } from 'better-auth/plugins'

// Organization plugin builder (conditionally enabled)
const buildOrganizationPlugin = (
  handlers: ReturnType<typeof createEmailHandlers>,
  authConfig?: Auth
) =>
  authConfig?.plugins?.organization
    ? [
        organization({
          sendInvitationEmail: handlers.organizationInvitation,
          schema: {
            organization: { modelName: '_sovrium_auth_organizations' },
            member: { modelName: '_sovrium_auth_members' },
            invitation: { modelName: '_sovrium_auth_invitations' },
          },
        }),
      ]
    : []

// Better Auth instance with conditional organization plugin
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: drizzleSchema, // Custom table names with _sovrium_auth_ prefix
  }),
  plugins: [
    openAPI(), // Always enabled (provides /api/auth/openapi endpoint)
    ...buildAdminPlugin(authConfig),
    ...buildOrganizationPlugin(handlers, authConfig),
    ...buildTwoFactorPlugin(authConfig),
    ...buildApiKeyPlugin(authConfig),
  ],
})
```

**Organization Plugin Features**:

- **Namespace Isolation**: Tables prefixed with `_sovrium_auth_` to prevent conflicts
- **Email Invitations**: Custom email handler with variable substitution
- **Multi-tenancy**: Organization-based data isolation
- **Role Management**: Per-organization roles (admin, member, viewer)

### Database Schema

**Organization Tables** (Drizzle ORM):

```typescript
// File: src/infrastructure/auth/better-auth/schema.ts

export const organizations = pgTable('_sovrium_auth_organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logo: text('logo'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const members = pgTable('_sovrium_auth_members', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'owner', 'admin', 'member', 'viewer'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const invitations = pgTable('_sovrium_auth_invitations', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role').notNull(),
  status: text('status').notNull(), // 'pending', 'accepted', 'rejected'
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  inviterId: text('inviter_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```

**Key Design Decisions**:

1. **Table Prefix**: `_sovrium_auth_` prevents conflicts with user-defined tables
2. **Cascade Deletion**: Organization deletion removes all members and invitations
3. **Text IDs**: UUIDs for better security (not sequential integers)
4. **Metadata Field**: JSON storage for extensibility (organization settings, branding)

### Organization Invitation Email

**Email Template Variables**:

- `$organizationName` - Organization name
- `$inviterName` - Inviter's display name
- `$email` - Recipient email
- `$url` - Invitation acceptance URL

**Default Template**:

```
Subject: You have been invited to join {organizationName}

Hi,

{inviterName} has invited you to join {organizationName}.

Click here to accept the invitation: {url}
```

**Custom Template Example** (app schema):

```json
{
  "auth": {
    "emailTemplates": {
      "organizationInvitation": {
        "subject": "Join $organizationName on Sovrium",
        "html": "<p>Hi,</p><p>$inviterName invited you to $organizationName.</p><p><a href=\"$url\">Accept Invitation</a></p>",
        "text": "Hi,\n\n$inviterName invited you to $organizationName.\n\nAccept: $url"
      }
    }
  }
}
```

### Conditional Plugin Behavior

**When Organization Plugin is Disabled**:

- ❌ No `/api/auth/organization/*` endpoints
- ❌ No organization tables created
- ❌ No organization invitation emails
- ✅ User authentication still works (email/password, OAuth)
- ✅ Users exist without organization affiliation

**When Organization Plugin is Enabled**:

- ✅ Users can create organizations
- ✅ Users can invite members to organizations
- ✅ Session includes organization context
- ✅ Multi-tenant data isolation possible
- ✅ Organization-based RBAC

> **Note**: Sovrium uses role-based access control with Better Auth roles. The organization plugin can be enabled for multi-organization support via app schema configuration.

**Configuration in App Schema**:

```json
{
  "auth": {
    "plugins": {
      "organization": true, // Enable organization plugin
      "admin": true, // Enable admin plugin (user roles, banning)
      "twoFactor": false, // Disable 2FA plugin
      "apiKeys": false // Disable API key plugin
    }
  }
}
```

## User Context Structure

Better Auth session contains:

```typescript
interface Session {
  user: {
    id: string
    email: string
    name: string
    userId: string // From organization plugin
    role: 'admin' | 'member' | 'viewer'
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
  c.set('userId', session.user.userId)
  c.set('role', session.user.role)

  await next()
})
```

## Roles and Their Default Permissions

Better Auth Organization plugin provides these roles:

```typescript
type Role = 'admin' | 'member' | 'viewer'

// Default permission patterns by role:
const DEFAULT_PERMISSIONS = {
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
const userId = c.get('userId')

// Use in database queries
const records = await db.query.records.findMany({
  where: eq(records.userId, userId),
})

// Auto-inject on create
const newRecord = await db.insert(records).values({
  ...recordData,
  userId: userId,
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
  const userId = c.get('userId')
  const role = c.get('role')

  // Use in authorization checks
  const canRead = await checkTablePermission(user, tableId, 'read')

  if (!canRead) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  // Use userId in query filters
  const records = await db.query.records.findMany({
    where: eq(records.userId, userId),
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

- Users always have an `userId` in session
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
  userId: 'org_123',
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
  userId: string
  role: 'admin' | 'member' | 'viewer'
}

// Check permissions using user context
async function checkTablePermission(
  user: User,
  tableId: number,
  operation: 'read' | 'create' | 'update' | 'delete'
): Promise<boolean> {
  // Fetch table permissions configuration
  const permissions = await getTablePermissions(tableId, user.userId)

  // Check if user role has permission for operation
  return permissions[user.role]?.table?.[operation] ?? false
}
```

## Related Documentation

- API Routes Authorization: `authorization-api-routes.md`
- Effect Service Implementation: `authorization-effect-service.md`
