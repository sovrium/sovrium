# Auth Specs Gap Analysis for Tables API Authorization Testing

**Date**: 2025-11-25
**Context**: Tables API has comprehensive authorization specs (RBAC + field-level permissions). Need auth management endpoints to support E2E testing.

---

## Executive Summary

### Current State

- **Existing auth specs**: 11 endpoints covering basic user auth flows (sign-up, sign-in, sessions, password management)
- **Better Auth integration**: Organization plugin installed and configured (`src/infrastructure/auth/better-auth/auth.ts`)
- **Tables API authorization**: Comprehensive specs with 28 permission-related test cases covering:
  - 401 Unauthorized (unauthenticated)
  - 403 Forbidden (insufficient permissions)
  - 404 Organization isolation (multi-tenancy)
  - Field-level read/write filtering
  - Sort/filter/aggregate permission checks

### Gap Assessment

**Missing**: Organization and member management endpoints needed for test fixture setup.

**Impact**: Cannot create isolated test scenarios for authorization testing without:

1. Creating test organizations
2. Adding users to organizations with specific roles
3. Managing member roles dynamically during tests

### Recommendation

**Action**: Document Better Auth Organization plugin endpoints (not create new specs).
**Rationale**: Better Auth provides these endpoints out-of-the-box via the Organization plugin.

---

## Better Auth Organization Plugin - Available Endpoints

### 1. Organization Management (Built-in)

Better Auth Organization plugin provides these endpoints automatically when mounted at `/api/auth/*`:

#### Create Organization

```typescript
POST /api/auth/organization/create
Body: { name, slug, logo?, metadata? }
Response: { organization, member }
```

#### List Organizations

```typescript
GET /api/auth/organization/list
Response: { organizations: Organization[] }
```

#### Get Full Organization

```typescript
GET /api/auth/organization/full
Query: { organizationId?, organizationSlug? }
Response: { organization, members, invitations }
```

#### Set Active Organization

```typescript
POST /api/auth/organization/set-active
Body: { organizationId?, organizationSlug? }
Response: { session }
```

#### Update Organization

```typescript
POST /api/auth/organization/update
Body: { data: { name?, slug?, logo?, metadata? } }
Response: { organization }
```

#### Delete Organization

```typescript
POST /api/auth/organization/delete
Body: { organizationId }
Response: { success: true }
```

### 2. Member Management (Built-in)

#### Add Member (Direct, no invitation)

```typescript
POST /api/auth/organization/add-member
Body: { userId?, role, organizationId?, teamId? }
Response: { member }
```

**Note**: Server-only endpoint, requires admin/owner permission

#### List Members

```typescript
GET /api/auth/organization/members
Query: { organizationId?, limit?, offset?, sortBy?, sortDirection?, filterField?, filterOperator?, filterValue? }
Response: { members: Member[] }
```

#### Remove Member

```typescript
POST /api/auth/organization/remove-member
Body: { memberIdOrEmail, organizationId? }
Response: { success: true }
```

#### Update Member Role

```typescript
POST /api/auth/organization/update-member-role
Body: { memberId, role, organizationId? }
Response: { member }
```

#### Get Active Member

```typescript
GET / api / auth / organization / member / active
Response: {
  member
}
```

#### Get Active Member Role

```typescript
GET / api / auth / organization / member / role
Response: {
  role
}
```

#### Leave Organization

```typescript
POST / api / auth / organization / leave
Body: {
  organizationId
}
Response: {
  success: true
}
```

### 3. Invitation Management (Built-in)

#### Create Invitation

```typescript
POST /api/auth/organization/invite-member
Body: { email, role, organizationId?, resend?, teamId? }
Response: { invitation }
```

#### Accept Invitation

```typescript
POST / api / auth / organization / accept - invitation
Body: {
  invitationId
}
Response: {
  ;(member, organization)
}
```

#### Reject Invitation

```typescript
POST / api / auth / organization / reject - invitation
Body: {
  invitationId
}
Response: {
  success: true
}
```

#### Cancel Invitation

```typescript
POST / api / auth / organization / cancel - invitation
Body: {
  invitationId
}
Response: {
  success: true
}
```

#### Get Invitation

```typescript
GET / api / auth / organization / invitation
Query: {
  id
}
Response: {
  invitation
}
```

#### List Invitations (for organization)

```typescript
GET /api/auth/organization/invitations
Query: { organizationId? }
Response: { invitations: Invitation[] }
```

#### List User Invitations

```typescript
GET /api/auth/organization/user-invitations
Query: { email? }
Response: { invitations: Invitation[] }
```

---

## Test Fixture Patterns for Tables API Authorization

### Pattern 1: Test User with Specific Role

```typescript
// specs/api/paths/tables/{tableId}/records/get.spec.ts (example)

test('viewer cannot read sensitive field', async ({ page, startServerWithSchema }) => {
  // GIVEN: Server with auth + organizations
  await startServerWithSchema({ name: 'auth-test', useDatabase: true })

  // AND: Create test organization
  const orgResponse = await page.request.post('/api/auth/organization/create', {
    data: { name: 'Test Org', slug: 'test-org' },
  })
  const { organization } = await orgResponse.json()

  // AND: Create viewer user
  const viewerSignup = await page.request.post('/api/auth/sign-up/email', {
    data: { email: 'viewer@test.com', password: 'pass123', name: 'Viewer User' },
  })
  const { user: viewerUser } = await viewerSignup.json()

  // AND: Add viewer to organization with 'viewer' role
  await page.request.post('/api/auth/organization/add-member', {
    data: {
      userId: viewerUser.id,
      role: 'viewer',
      organizationId: organization.id,
    },
  })

  // WHEN: Viewer attempts to list records with sensitive field
  const response = await page.request.get('/api/tables/1/records', {
    headers: { Authorization: `Bearer ${viewerUser.token}` },
  })

  // THEN: Sensitive fields are filtered out
  const data = await response.json()
  expect(data.records[0]).not.toHaveProperty('salary')
})
```

### Pattern 2: Multi-Organization Isolation

```typescript
test('user cannot access other organization records', async ({ page, startServerWithSchema }) => {
  // GIVEN: Two separate organizations
  const org1 = await createTestOrg(page, 'Org 1')
  const org2 = await createTestOrg(page, 'Org 2')

  // AND: User in Org 1
  const user1 = await createTestUser(page, 'user1@org1.com')
  await addMemberToOrg(page, user1.id, org1.id, 'admin')

  // AND: User in Org 2
  const user2 = await createTestUser(page, 'user2@org2.com')
  await addMemberToOrg(page, user2.id, org2.id, 'admin')

  // AND: Table with records from both orgs
  await createTableWithRecords(page, 'projects', [
    { name: 'Project A', organization_id: org1.id },
    { name: 'Project B', organization_id: org2.id },
  ])

  // WHEN: User 1 lists records
  const response = await page.request.get('/api/tables/1/records', {
    headers: { Authorization: `Bearer ${user1.token}` },
  })

  // THEN: Only Org 1 records returned
  const data = await response.json()
  expect(data.pagination.total).toBe(1)
  expect(data.records[0].name).toBe('Project A')
})
```

### Pattern 3: Role-Based Field Access

```typescript
test('different roles see different fields', async ({ page, startServerWithSchema }) => {
  // GIVEN: Organization with admin and member users
  const org = await createTestOrg(page, 'Test Org')
  const admin = await createTestUser(page, 'admin@test.com')
  const member = await createTestUser(page, 'member@test.com')

  await addMemberToOrg(page, admin.id, org.id, 'admin')
  await addMemberToOrg(page, member.id, org.id, 'member')

  // AND: Table with field-level permissions configured
  await createTableWithPermissions(page, 'employees', {
    admin: {
      table: { read: true, create: true, update: true, delete: true },
      fields: { salary: { read: true, write: true } },
    },
    member: {
      table: { read: true, create: false, update: true, delete: false },
      fields: { salary: { read: false, write: false } },
    },
  })

  // WHEN: Admin lists records
  const adminResponse = await page.request.get('/api/tables/1/records', {
    headers: { Authorization: `Bearer ${admin.token}` },
  })
  const adminData = await adminResponse.json()

  // THEN: Admin sees salary field
  expect(adminData.records[0]).toHaveProperty('salary')

  // WHEN: Member lists records
  const memberResponse = await page.request.get('/api/tables/1/records', {
    headers: { Authorization: `Bearer ${member.token}` },
  })
  const memberData = await memberResponse.json()

  // THEN: Member does NOT see salary field
  expect(memberData.records[0]).not.toHaveProperty('salary')
})
```

---

## Recommendations

### 1. No New Specs Required ✅

**Rationale**: Better Auth Organization plugin provides all necessary endpoints out-of-the-box when mounted at `/api/auth/*`. These endpoints are:

- **Production-ready**: Used by thousands of Better Auth users
- **Well-documented**: Full API reference in Better Auth docs
- **Type-safe**: TypeScript definitions included
- **Tested**: Covered by Better Auth's own test suite

### 2. Document Test Fixture Helpers

**Action**: Create test utilities for common auth setup patterns:

```typescript
// specs/fixtures/auth-helpers.ts (suggested)

export async function createTestOrg(
  page: Page,
  name: string,
  slug?: string
): Promise<Organization> {
  const response = await page.request.post('/api/auth/organization/create', {
    data: { name, slug: slug || slugify(name) },
  })
  return (await response.json()).organization
}

export async function createTestUser(
  page: Page,
  email: string,
  password = 'password123'
): Promise<User> {
  const response = await page.request.post('/api/auth/sign-up/email', {
    data: { email, password, name: email.split('@')[0] },
  })
  return (await response.json()).user
}

export async function addMemberToOrg(
  page: Page,
  userId: string,
  organizationId: string,
  role: 'owner' | 'admin' | 'member' | 'viewer'
): Promise<Member> {
  const response = await page.request.post('/api/auth/organization/add-member', {
    data: { userId, role, organizationId },
  })
  return (await response.json()).member
}
```

### 3. Update Existing Table Specs

**Action**: Enhance existing table API specs to use Better Auth organization endpoints for test setup.

**Example modification**:

```typescript
// Before (incomplete)
{
  "id": "API-TABLES-RECORDS-LIST-PERMISSIONS-FIELD-FILTER-MEMBER-001",
  "validation": {
    "setup": {
      "authUser": {
        "id": 2,
        "organizationId": "org_123",
        "role": "member"
      }
    }
  }
}

// After (complete with fixture setup)
{
  "id": "API-TABLES-RECORDS-LIST-PERMISSIONS-FIELD-FILTER-MEMBER-001",
  "validation": {
    "setup": {
      "executeSetup": [
        "const org = await createTestOrg(page, 'Test Org')",
        "const member = await createTestUser(page, 'member@test.com')",
        "await addMemberToOrg(page, member.id, org.id, 'member')",
        "await setActiveOrg(page, org.id)"
      ]
    }
  }
}
```

### 4. Better Auth API Reference

**Location**: `/docs/infrastructure/framework/better-auth/123-plugins-organization.md`

**Key Sections**:

- Line 82-145: Organization creation
- Line 517-614: List organizations
- Line 762-809: Get full organization
- Line 811-869: Update organization
- Line 871-926: Delete organization
- Line 1286-1360: List members
- Line 1362-1400: Remove member
- Line 1402-1446: Update member role
- Line 1498-1548: Add member (direct, no invitation)

### 5. OpenAPI Documentation

**Action**: Ensure Better Auth endpoints are included in OpenAPI schema export.

Better Auth's `openAPI()` plugin automatically generates OpenAPI specs for all organization endpoints. Verify inclusion in:

```
/api/openapi.json (generated runtime endpoint)
```

---

## Missing Permission Configuration API

### Gap Identified: Table Permission Configuration

**Problem**: Table API specs reference `tableConfig.permissions` in test setup, but no API exists to configure table permissions dynamically.

**Example from specs**:

```json
{
  "tableConfig": {
    "id": 1,
    "name": "employees",
    "permissions": {
      "member": {
        "table": { "read": true, "create": false, "update": true, "delete": false },
        "fields": {
          "salary": { "read": false, "write": false }
        }
      }
    }
  }
}
```

**Question for User**: How are table permissions configured?

1. **Option A**: Static configuration in table schema metadata (database column)
2. **Option B**: Separate permission configuration table (requires CRUD API)
3. **Option C**: Configuration files (not testable via API)

**Recommendation**: If Option B, we need permission configuration endpoints:

```
POST /api/admin/tables/{tableId}/permissions
GET /api/admin/tables/{tableId}/permissions
PUT /api/admin/tables/{tableId}/permissions
DELETE /api/admin/tables/{tableId}/permissions
```

---

## Test Data Setup Strategy

### Approach 1: API-Based Setup (Recommended)

- Use Better Auth organization endpoints to create test organizations
- Use sign-up endpoint to create test users
- Use add-member endpoint to assign roles
- Use table permission API to configure permissions (if exists)

**Pros**: Tests external-facing API contracts, closest to production usage
**Cons**: Slower test execution, requires full server setup

### Approach 2: Database Fixture Setup

- Directly insert test data into database tables
- Seed organizations, users, members, permissions

**Pros**: Faster test execution, no API dependencies
**Cons**: Bypasses business logic, fragile to schema changes

### Approach 3: Hybrid

- Use API for user/org creation (validates auth flows)
- Use database for bulk record insertion (performance)

**Recommendation**: Start with Approach 1 (API-based) for authorization tests. These are critical security tests that should validate the full request path.

---

## Implementation Checklist

- [ ] 1. Document Better Auth organization endpoints in project docs
- [ ] 2. Create `specs/fixtures/auth-helpers.ts` with test utilities
- [ ] 3. Update table API specs with complete setup procedures
- [ ] 4. Clarify table permission configuration strategy (static vs dynamic)
- [ ] 5. If dynamic permissions: Design permission configuration API specs
- [ ] 6. Verify Better Auth OpenAPI schema includes organization endpoints
- [ ] 7. Write example E2E tests demonstrating auth fixture patterns
- [ ] 8. Update test fixtures documentation with multi-tenant patterns

---

## Conclusion

**No new auth specs required**. Better Auth Organization plugin provides all necessary endpoints for:

- ✅ Organization CRUD
- ✅ Member management (add, remove, update role, list)
- ✅ Invitation workflows (create, accept, reject, cancel)
- ✅ Active organization management

**Action items**:

1. **Document** available Better Auth endpoints for developers
2. **Create** test fixture helper utilities
3. **Clarify** table permission configuration approach
4. **Update** existing table specs with complete setup procedures

**Blocker identified**: Table permission configuration mechanism needs specification. User clarification required before proceeding with authorization test implementation.
