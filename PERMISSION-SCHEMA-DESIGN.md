# Permission Schema Design with Custom Role Support

## Executive Summary

This document outlines the unified permission schema design that mirrors Better Auth's API exactly while supporting both built-in contexts (organization, team, owner, admin, member) and custom user-defined roles (marketing, product, finance, etc.).

**Key Decisions:**

- ✅ Mirror Better Auth field names exactly (no custom abstractions)
- ✅ Context-based permission approach (not resource:action strings)
- ✅ Support for custom roles via string-based role names
- ✅ Breaking changes acceptable with spec refactoring

---

## 1. Permission Schema Design

### 1.1 Core Permission Types

```typescript
// src/domain/models/app/table/permissions/permission.ts

/**
 * Table Permission Schema
 *
 * Union of all permission types for a single CRUD operation.
 * Supports both built-in contexts and custom user-defined roles.
 */
export const TablePermissionSchema = Schema.Union(
  PublicPermissionSchema, // { type: 'public' }
  AuthenticatedPermissionSchema, // { type: 'authenticated' }
  RolesPermissionSchema, // { type: 'roles', roles: ['admin', 'marketing'] }
  OwnerPermissionSchema, // { type: 'owner', field: 'owner_id' }
  CustomPermissionSchema // { type: 'custom', condition: '{userId} = owner_id' }
)
```

### 1.2 Roles Permission Schema (Updated)

```typescript
// src/domain/models/app/table/permissions/roles.ts

/**
 * Roles Permission Schema
 *
 * Restricts access to users with specific roles.
 * Supports BOTH built-in roles (owner, admin, member, viewer)
 * AND custom application roles (marketing, product, finance, etc.).
 *
 * Generates RLS policy:
 * `USING (auth.user_has_role('admin') OR auth.user_has_role('marketing'))`
 *
 * @example
 * // Built-in roles
 * { type: 'roles', roles: ['admin', 'member'] }
 *
 * // Custom roles
 * { type: 'roles', roles: ['marketing', 'product'] }
 *
 * // Mixed built-in + custom
 * { type: 'roles', roles: ['admin', 'marketing', 'finance'] }
 */
export const RolesPermissionSchema = Schema.Struct({
  type: Schema.Literal('roles'),

  /**
   * List of roles that have access.
   *
   * - Built-in roles: 'owner', 'admin', 'member', 'viewer'
   * - Custom roles: Any string defined by the application
   *   (e.g., 'marketing', 'product', 'finance', 'hr', 'engineer')
   *
   * Multiple roles are OR'd together in the generated RLS policy.
   *
   * Role validation is intentionally disabled to support custom application roles.
   * This allows organizations to define their own role hierarchies beyond the
   * default set provided by Better Auth.
   */
  roles: Schema.Array(Schema.String).pipe(
    Schema.minItems(1),
    Schema.annotations({
      description:
        'List of roles that have access. Supports both built-in roles (owner, admin, member, viewer) ' +
        'and custom application roles (marketing, product, finance, etc.)',
      examples: [
        ['admin'], // Built-in role only
        ['marketing'], // Custom role only
        ['admin', 'marketing'], // Mixed built-in + custom
        ['owner', 'admin', 'product', 'hr'], // Multiple mixed
      ],
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'Roles Permission',
    description:
      'Only users with specified roles can access. Supports both built-in (owner, admin, member, viewer) ' +
      'and custom application roles. Generates RLS policy with auth.user_has_role().',
    examples: [
      { type: 'roles' as const, roles: ['admin'] },
      { type: 'roles' as const, roles: ['marketing', 'product'] },
      { type: 'roles' as const, roles: ['admin', 'marketing'] },
    ],
  })
)

export type RolesPermission = Schema.Schema.Type<typeof RolesPermissionSchema>
```

### 1.3 Permission Context Types

The schema supports these permission contexts:

| Context Type      | Description                          | Example Use Case                      |
| ----------------- | ------------------------------------ | ------------------------------------- |
| **public**        | Anyone can access (no auth required) | Public blog posts, product catalog    |
| **authenticated** | Any logged-in user                   | User profiles, comments               |
| **roles**         | Specific roles (built-in OR custom)  | Admin panel, department-specific data |
| **owner**         | Record owner only                    | User's own documents                  |
| **custom**        | Custom SQL condition                 | Complex business rules                |

### 1.4 Built-in vs Custom Roles

```typescript
// Built-in roles (from Better Auth Organization plugin)
type BuiltInRole = 'owner' | 'admin' | 'member' | 'viewer'

// Custom roles (application-defined, unlimited)
type CustomRole = string // 'marketing' | 'product' | 'finance' | 'hr' | ...

// RolesPermission accepts ANY string
type RolePermission = {
  type: 'roles'
  roles: string[] // ['admin', 'marketing', 'product']
}
```

**Key Design Decision:**

- NO validation of role names at schema level
- Role validation happens at runtime via Better Auth
- Allows unlimited custom roles without schema changes

---

## 2. Example Table Configurations

### 2.1 Marketing Dashboard (Custom Role)

```json
{
  "id": 1,
  "name": "campaigns",
  "fields": [
    { "id": 1, "name": "id", "type": "integer", "required": true },
    { "id": 2, "name": "name", "type": "single-line-text" },
    { "id": 3, "name": "budget", "type": "decimal" },
    { "id": 4, "name": "roi", "type": "decimal" },
    { "id": 5, "name": "status", "type": "single-line-text" }
  ],
  "primaryKey": { "type": "composite", "fields": ["id"] },
  "permissions": {
    "read": {
      "type": "roles",
      "roles": ["marketing", "admin"]
    },
    "create": {
      "type": "roles",
      "roles": ["marketing"]
    },
    "update": {
      "type": "roles",
      "roles": ["marketing"]
    },
    "delete": {
      "type": "roles",
      "roles": ["admin"]
    },
    "fields": [
      {
        "field": "budget",
        "read": {
          "type": "roles",
          "roles": ["marketing", "finance", "admin"]
        },
        "write": {
          "type": "roles",
          "roles": ["finance", "admin"]
        }
      }
    ]
  }
}
```

**Generated RLS Policies:**

```sql
-- Table-level read: marketing OR admin
CREATE POLICY campaigns_read ON campaigns FOR SELECT
USING (
  auth.user_has_role('marketing') OR
  auth.user_has_role('admin')
);

-- Table-level create: marketing only
CREATE POLICY campaigns_create ON campaigns FOR INSERT
WITH CHECK (auth.user_has_role('marketing'));

-- Field-level read for budget: marketing OR finance OR admin
-- (Implemented via PostgreSQL column-level GRANT)
GRANT SELECT(budget) ON campaigns TO marketing_role, finance_role, admin_role;

-- Field-level write for budget: finance OR admin
REVOKE UPDATE(budget) ON campaigns FROM marketing_role;
GRANT UPDATE(budget) ON campaigns TO finance_role, admin_role;
```

### 2.2 HR Employee Data (Multiple Custom Roles)

```json
{
  "id": 2,
  "name": "employees",
  "fields": [
    { "id": 1, "name": "id", "type": "integer", "required": true },
    { "id": 2, "name": "name", "type": "single-line-text" },
    { "id": 3, "name": "email", "type": "email" },
    { "id": 4, "name": "salary", "type": "decimal" },
    { "id": 5, "name": "performance_review", "type": "long-text" },
    { "id": 6, "name": "department", "type": "single-line-text" }
  ],
  "primaryKey": { "type": "composite", "fields": ["id"] },
  "permissions": {
    "read": {
      "type": "roles",
      "roles": ["hr", "admin"]
    },
    "fields": [
      {
        "field": "salary",
        "read": {
          "type": "roles",
          "roles": ["hr", "finance", "admin"]
        },
        "write": {
          "type": "roles",
          "roles": ["hr", "admin"]
        }
      },
      {
        "field": "performance_review",
        "read": {
          "type": "roles",
          "roles": ["hr", "admin"]
        },
        "write": {
          "type": "roles",
          "roles": ["hr"]
        }
      }
    ]
  }
}
```

### 2.3 Mixed Built-in + Custom Roles

```json
{
  "id": 3,
  "name": "projects",
  "fields": [
    { "id": 1, "name": "id", "type": "integer", "required": true },
    { "id": 2, "name": "title", "type": "single-line-text" },
    { "id": 3, "name": "budget", "type": "decimal" },
    { "id": 4, "name": "owner_id", "type": "user" }
  ],
  "primaryKey": { "type": "composite", "fields": ["id"] },
  "permissions": {
    "read": {
      "type": "roles",
      "roles": ["member", "product", "engineering"]
    },
    "create": {
      "type": "roles",
      "roles": ["admin", "product"]
    },
    "update": {
      "type": "owner",
      "field": "owner_id"
    },
    "fields": [
      {
        "field": "budget",
        "read": {
          "type": "roles",
          "roles": ["admin", "finance", "product"]
        },
        "write": {
          "type": "roles",
          "roles": ["admin", "finance"]
        }
      }
    ],
    "records": [
      {
        "action": "delete",
        "condition": "{userId} = owner_id OR auth.user_has_role('admin')"
      }
    ]
  }
}
```

---

## 3. Spec Files Requiring Updates

### 3.1 High Priority (Breaking Changes)

These specs MUST be refactored because they test the permission schema structure:

| Spec File                                                 | Current Issue                                  | Required Change                             |
| --------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------- |
| `specs/app/tables/permissions/permissions.spec.ts`        | Uses old `{ type: 'roles', roles: ['admin'] }` | ✅ ALREADY CORRECT (no changes needed)      |
| `specs/app/tables/permissions/field-permissions.spec.ts`  | Uses role-based permissions                    | Verify custom role support                  |
| `specs/app/tables/permissions/record-permissions.spec.ts` | Uses role-based permissions                    | Verify custom role support                  |
| `specs/app/tables/permissions/rls-enforcement.spec.ts`    | Uses `hr`, `manager` custom roles              | ✅ ALREADY CORRECT (validates custom roles) |
| `specs/app/tables/permissions/table-permissions.spec.ts`  | Table-level role permissions                   | Verify schema compliance                    |

### 3.2 Medium Priority (API Integration)

API specs that interact with permissions:

| Spec File                                                            | Current Issue            | Required Change                          |
| -------------------------------------------------------------------- | ------------------------ | ---------------------------------------- |
| `specs/api/tables/permissions/*.spec.ts`                             | API permission endpoints | Test custom role permissions via API     |
| `specs/api/auth/organization/dynamic-roles/create-role/post.spec.ts` | Creates custom roles     | ✅ ALREADY CORRECT (tests role creation) |
| `specs/api/auth/organization/dynamic-roles/assign-role/post.spec.ts` | Assigns custom roles     | Test role assignment flow                |

### 3.3 Low Priority (No Changes Required)

These specs don't need updates:

- `specs/api/security/*.spec.ts` - Security specs don't depend on permission schema structure
- `specs/api/auth/admin/*.spec.ts` - Admin plugin specs (separate concern)
- `specs/api/auth/api-key/*.spec.ts` - API key permissions (separate implementation)

---

## 4. Implementation Roadmap

### Phase 1: Schema Updates (DONE)

- ✅ Remove role validation from `RolesPermissionSchema`
- ✅ Update JSDoc to document custom role support
- ✅ Add examples with custom roles

### Phase 2: Spec Refactoring (CURRENT)

#### A. Verify Existing Specs (1-2 hours)

1. Run all permission specs: `bun test:e2e -- specs/app/tables/permissions`
2. Identify which specs already support custom roles
3. Document passing vs failing specs

#### B. Update Failing Specs (2-4 hours)

1. Add custom role examples to existing tests
2. Test mixed built-in + custom roles
3. Verify RLS policy generation with custom roles

#### C. Mark Unimplemented Features (1 hour)

For features not yet implemented:

1. Mark tests with `.fixme()`
2. Add comment: `// FIXME: Custom role implementation pending`
3. Track in TDD automation queue

### Phase 3: RLS Policy Generator Updates (FUTURE)

- Update RLS policy generator to handle custom roles
- Ensure `auth.user_has_role()` supports custom role names
- Test policy enforcement with Better Auth dynamic roles

---

## 5. Testing Strategy

### 5.1 Test Categories

| Category                | Description                          | Example                              |
| ----------------------- | ------------------------------------ | ------------------------------------ |
| **Built-in roles only** | Test default Better Auth roles       | `['admin', 'member']`                |
| **Custom roles only**   | Test application-defined roles       | `['marketing', 'product']`           |
| **Mixed roles**         | Test built-in + custom together      | `['admin', 'marketing']`             |
| **Field-level**         | Test custom roles on specific fields | Budget field: `['finance', 'admin']` |
| **Record-level**        | Test custom roles in RLS conditions  | `auth.user_has_role('hr')`           |

### 5.2 Example Test Structure

```typescript
test(
  'APP-TABLES-PERMISSIONS-012: should allow access with custom role',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
    // GIVEN: Table with custom role permission
    await startServerWithSchema({
      name: 'test-app',
      auth: {
        emailAndPassword: true,
        plugins: {
          organization: {
            dynamicRoles: true,
          },
        },
      },
      tables: [
        {
          id: 1,
          name: 'campaigns',
          fields: [
            { id: 1, name: 'id', type: 'integer', required: true },
            { id: 2, name: 'name', type: 'single-line-text' },
          ],
          primaryKey: { type: 'composite', fields: ['id'] },
          permissions: {
            read: {
              type: 'roles',
              roles: ['marketing', 'admin'],
            },
          },
        },
      ],
    })

    await executeQuery([
      'ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY',
      "CREATE POLICY marketing_read ON campaigns FOR SELECT USING (auth.user_has_role('marketing') OR auth.user_has_role('admin'))",
      "INSERT INTO campaigns (name) VALUES ('Q1 Campaign')",
    ])

    // WHEN: User with custom 'marketing' role accesses table
    const marketingUser = await createAuthenticatedUser({
      email: 'marketer@example.com',
      role: 'marketing', // Custom role
    })

    const result = await executeQuery([
      'SET ROLE marketing_user',
      `SET LOCAL app.user_id = '${marketingUser.user.id}'`,
      `SET LOCAL app.user_role = 'marketing'`,
      'SELECT COUNT(*) as count FROM campaigns',
    ])

    // THEN: User can access records
    expect(result.count).toBe('1')
  }
)
```

---

## 6. Migration Guide for Existing Specs

### 6.1 Before (Old Approach)

```typescript
// ❌ Old: Validation enforced predefined roles
permissions: {
  read: {
    type: 'roles',
    roles: ['admin', 'member']  // Only built-in roles allowed
  }
}
```

### 6.2 After (New Approach)

```typescript
// ✅ New: Any role string accepted
permissions: {
  read: {
    type: 'roles',
    roles: ['admin', 'marketing', 'product']  // Built-in + custom
  }
}
```

### 6.3 What Stays the Same

- ✅ Permission type names (`'public'`, `'authenticated'`, `'roles'`, `'owner'`, `'custom'`)
- ✅ Field-level permission structure
- ✅ Record-level permission structure
- ✅ RLS policy generation approach

### 6.4 What Changes

- ❌ Role validation removed (any string accepted)
- ✅ Custom role support added
- ✅ Documentation updated to reflect custom roles

---

## 7. Recommended Approach

### Option A: Incremental Refactoring (RECOMMENDED)

**Timeline:** 1-2 days
**Approach:**

1. ✅ Update schema (DONE)
2. Run all permission specs, identify failures
3. Add custom role test cases to existing specs
4. Mark unimplemented features as `.fixme()`
5. Let TDD automation queue handle implementation

**Pros:**

- Validates schema changes immediately
- Provides clear todo list for implementation
- Incremental progress visible

**Cons:**

- Some tests will fail initially
- Requires discipline to mark `.fixme()` vs fixing immediately

### Option B: Big Bang Refactoring (NOT RECOMMENDED)

**Timeline:** 3-5 days
**Approach:**

1. Refactor ALL specs at once
2. Implement ALL features before testing
3. Run full test suite at end

**Pros:**

- Complete solution delivered at once

**Cons:**

- High risk of missing edge cases
- Long feedback loop
- Harder to track progress

---

## 8. Validation Checklist

Before marking this design as complete, verify:

- [ ] Schema allows any string in `roles` array
- [ ] Documentation includes custom role examples
- [ ] Test cases cover built-in, custom, and mixed roles
- [ ] RLS policy generator supports custom roles
- [ ] Better Auth integration handles custom roles
- [ ] Field-level permissions work with custom roles
- [ ] Record-level conditions work with custom roles
- [ ] API endpoints accept custom role permissions
- [ ] Error messages guide users on role configuration

---

## 9. Next Steps

1. **Immediate:** Run permission spec suite to identify current state

   ```bash
   bun test:e2e -- specs/app/tables/permissions
   ```

2. **Short-term:** Add custom role test cases

   ```bash
   # Create new spec or extend existing:
   # specs/app/tables/permissions/custom-roles.spec.ts
   ```

3. **Medium-term:** Implement RLS policy generator for custom roles

   ```typescript
   // src/infrastructure/database/rls-policy-generator.ts
   ```

4. **Long-term:** Document custom role best practices
   ```markdown
   # docs/architecture/patterns/custom-roles.md
   ```

---

## 10. Success Criteria

This design is successful when:

✅ Schema accepts `{ type: 'roles', roles: ['marketing'] }`
✅ RLS policies generate with custom role names
✅ Better Auth dynamic roles integrate seamlessly
✅ Field-level permissions work with custom roles
✅ API endpoints accept custom role configurations
✅ All existing specs pass with new schema
✅ New specs demonstrate custom role capabilities
✅ Documentation explains custom role usage clearly

---

**Status:** DESIGN COMPLETE - READY FOR VALIDATION
**Next Action:** Run `bun test:e2e -- specs/app/tables/permissions` to identify required spec updates
