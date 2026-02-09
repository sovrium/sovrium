# Permissions

> **Feature Area**: Tables - Permissions & Access Control
> **Schema**: `src/domain/models/app/table/`
> **E2E Specs**: `specs/app/tables/permissions/`, `specs/api/tables/permissions/`

---

## Overview

Sovrium implements a layered permission system using PostgreSQL Row-Level Security (RLS) and Better Auth integration. Permissions are defined at three levels: table-level, field-level, and record-level, with support for role-based access control (RBAC).

---

## US-TABLES-PERMISSIONS-001: Table-Level Access Control

**As a** developer,
**I want to** define table-level permissions for different roles,
**so that** I can control which users can read, create, update, or delete records in each table.

### Configuration

```yaml
tables:
  - id: 1
    name: products
    permissions:
      public: false # Require authentication
      roles:
        admin:
          read: true
          create: true
          update: true
          delete: true
        member:
          read: true
          create: true
          update: true
          delete: false
        viewer:
          read: true
          create: false
          update: false
          delete: false
```

### Acceptance Criteria

| ID     | Criterion                                                      | E2E Spec                           | Status |
| ------ | -------------------------------------------------------------- | ---------------------------------- | ------ |
| AC-001 | Public tables allow unauthenticated read access                | `APP-TABLES-TABLE-PERMISSIONS-001` | ✅     |
| AC-002 | Private tables require authentication for all operations       | `APP-TABLES-TABLE-PERMISSIONS-002` | ✅     |
| AC-003 | Role-based permissions are enforced at table level             | `APP-TABLES-TABLE-PERMISSIONS-003` | ✅     |
| AC-004 | Returns 401 for unauthenticated access to private tables       | `APP-TABLES-TABLE-PERMISSIONS-004` | ✅     |
| AC-005 | Returns 403 for unauthorized role attempting restricted ops    | `APP-TABLES-TABLE-PERMISSIONS-005` | ✅     |
| AC-006 | User can complete full table-permissions workflow (regression) | `APP-TABLES-TBL-PERMS-REGRESSION`  | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/permissions/table-permissions.spec.ts`

---

## US-TABLES-PERMISSIONS-002: Role-Based Access Control (RBAC)

**As a** developer,
**I want to** define custom roles with specific permissions,
**so that** I can implement fine-grained access control based on user roles.

### Configuration

```yaml
auth:
  emailAndPassword: true
  admin:
    defaultRole: 'viewer'
    # Roles (admin, member, viewer, owner) are built into Better Auth.
    # Custom role definitions are managed via auth.admin configuration.

tables:
  - id: 1
    name: articles
    permissions:
      roles:
        admin: { read: true, create: true, update: true, delete: true }
        editor: { read: true, create: true, update: true, delete: false }
        viewer: { read: true, create: false, update: false, delete: false }
```

### Acceptance Criteria

| ID     | Criterion                                                | E2E Spec                            | Status |
| ------ | -------------------------------------------------------- | ----------------------------------- | ------ |
| AC-001 | Custom roles can be defined in app configuration         | `APP-TABLES-PERMISSIONS-001`        | ✅     |
| AC-002 | Role permissions are inherited by users assigned to role | `APP-TABLES-PERMISSIONS-002`        | ✅     |
| AC-003 | Multiple roles can be assigned to a single user          | `APP-TABLES-PERMISSIONS-003`        | ✅     |
| AC-004 | Role permissions are combined (most permissive wins)     | `APP-TABLES-PERMISSIONS-004`        | ✅     |
| AC-005 | Default role is applied when user has no explicit role   | `APP-TABLES-PERMISSIONS-005`        | ✅     |
| AC-006 | Admin role has full access to all tables by default      | `APP-TABLES-PERMISSIONS-006`        | ✅     |
| AC-007 | Role hierarchy is respected (admin > editor > viewer)    | `APP-TABLES-PERMISSIONS-007`        | ✅     |
| AC-008 | Returns 403 when user role lacks required permission     | `APP-TABLES-PERMISSIONS-008`        | ✅     |
| AC-009 | Role changes take effect immediately without re-login    | `APP-TABLES-PERMISSIONS-009`        | ✅     |
| AC-010 | Role validation errors return descriptive messages       | `APP-TABLES-PERMISSIONS-010`        | ✅     |
| AC-011 | User can complete full permissions workflow (regression) | `APP-TABLES-PERMISSIONS-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/permissions/permissions.spec.ts`

---

## US-TABLES-PERMISSIONS-003: Field-Level Permissions

**As a** developer,
**I want to** define read/write permissions at the field level,
**so that** I can hide sensitive fields from certain roles or make fields read-only.

### Configuration

```yaml
tables:
  - id: 1
    name: employees
    fields:
      - id: 1
        name: name
        type: single-line-text
        permissions:
          read: [admin, hr, viewer]
          write: [admin, hr]
      - id: 2
        name: salary
        type: currency
        permissions:
          read: [admin, hr] # Hidden from viewer role
          write: [admin] # Only admin can update
      - id: 3
        name: department
        type: single-line-text
        permissions:
          read: all
          write: [admin]
```

### Acceptance Criteria

| ID     | Criterion                                                      | E2E Spec                                  | Status |
| ------ | -------------------------------------------------------------- | ----------------------------------------- | ------ |
| AC-001 | Fields with read restriction are omitted from API response     | `APP-TABLES-FIELD-PERMISSIONS-001`        | ✅     |
| AC-002 | Fields with write restriction reject update attempts           | `APP-TABLES-FIELD-PERMISSIONS-002`        | ✅     |
| AC-003 | Field permissions override table-level permissions             | `APP-TABLES-FIELD-PERMISSIONS-003`        | ✅     |
| AC-004 | Returns 403 when attempting to write read-only field           | `APP-TABLES-FIELD-PERMISSIONS-004`        | ✅     |
| AC-005 | Hidden fields are not included in list/detail responses        | `APP-TABLES-FIELD-PERMISSIONS-005`        | ✅     |
| AC-006 | Field permission "all" grants access to all roles              | `APP-TABLES-FIELD-PERMISSIONS-006`        | ✅     |
| AC-007 | Field permission "none" denies access to all roles             | `APP-TABLES-FIELD-PERMISSIONS-007`        | ✅     |
| AC-008 | Computed fields respect source field permissions               | `APP-TABLES-FIELD-PERMISSIONS-008`        | ⏳     |
| AC-009 | Relationship fields respect related table permissions          | `APP-TABLES-FIELD-PERMISSIONS-009`        | ✅     |
| AC-010 | User can complete full field-permissions workflow (regression) | `APP-TABLES-FIELD-PERMISSIONS-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/permissions/field-permissions.spec.ts`

---

## US-TABLES-PERMISSIONS-004: Record-Level Permissions

**As a** developer,
**I want to** define permissions at the record level based on ownership or conditions,
**so that** users can only access records they own or match specific criteria.

### Configuration

```yaml
tables:
  - id: 1
    name: user_profiles
    fields:
      - id: 1
        name: user_id
        type: relationship
        relatedTable: users
        relationType: many-to-one
    permissions:
      recordLevel:
        enabled: true
        ownerField: user_id # Users can only access their own profile
        conditions:
          - role: admin
            access: all # Admins can access all records
          - role: member
            access: owned # Members can only access owned records

  - id: 2
    name: documents
    permissions:
      recordLevel:
        enabled: true
        conditions:
          - role: admin
            access: all
          - role: editor
            filter:
              status: [draft, published] # Editors can only see draft/published
          - role: viewer
            filter:
              status: published # Viewers can only see published
```

### Acceptance Criteria

| ID     | Criterion                                                        | E2E Spec | Status |
| ------ | ---------------------------------------------------------------- | -------- | ------ |
| AC-001 | Owner-based filtering returns only records owned by current user |          | ❓     |
| AC-002 | Condition-based filtering applies role-specific filters          |          | ❓     |
| AC-003 | Admin role bypasses record-level restrictions                    |          | ❓     |
| AC-004 | Returns 404 for records user is not permitted to access          |          | ❓     |
| AC-005 | Record permissions combine with field permissions                |          | ❓     |

### Implementation References

---

## US-TABLES-PERMISSIONS-005: PostgreSQL Row-Level Security (RLS)

**As a** developer,
**I want to** enforce permissions using PostgreSQL Row-Level Security,
**so that** access control is enforced at the database level for maximum security.

### Configuration

```yaml
tables:
  - id: 1
    name: sensitive_data
    permissions:
      rls:
        enabled: true
        policies:
          - name: owner_policy
            operation: all
            using: "user_id = current_setting('app.user_id')::integer"
          - name: admin_bypass
            operation: all
            using: "current_setting('app.user_role') = 'admin'"
            withCheck: true
```

### Acceptance Criteria

| ID     | Criterion                                                    | E2E Spec | Status |
| ------ | ------------------------------------------------------------ | -------- | ------ |
| AC-001 | RLS policies are created when table is created               |          | ❓     |
| AC-002 | RLS is enabled on table when permissions.rls.enabled is true |          | ❓     |
| AC-003 | SELECT operations respect RLS using clause                   |          | ❓     |
| AC-004 | INSERT operations respect RLS with check clause              |          | ❓     |
| AC-005 | UPDATE operations respect RLS using and with check clauses   |          | ❓     |
| AC-006 | DELETE operations respect RLS using clause                   |          | ❓     |
| AC-007 | RLS policies are updated when permission config changes      |          | ❓     |
| AC-008 | RLS policies are dropped when table permissions are removed  |          | ❓     |
| AC-009 | Multiple RLS policies are combined with OR logic             |          | ❓     |
| AC-010 | RLS enforcement prevents data leakage in joins               |          | ❓     |
| AC-011 | RLS policies use parameterized session variables             |          | ❓     |
| AC-012 | Superuser can bypass RLS for maintenance operations          |          | ❓     |
| AC-013 | RLS errors return appropriate 403 response                   |          | ❓     |
| AC-014 | RLS policies are validated before table creation             |          | ❓     |

### Implementation References

---

## US-TABLES-PERMISSIONS-006: Session Context Integration

**As a** developer,
**I want to** use Better Auth session data for permission evaluation,
**so that** permissions are based on the current authenticated user's identity and roles.

### Configuration

```yaml
auth:
  emailAndPassword: true
  admin: true
# Note: Session context variables (user_id, user_role, user_email) are
# automatically set by Better Auth at the server level. They are available
# for RLS policies via current_setting('app.user_id'), etc.
```

### Acceptance Criteria

| ID     | Criterion                                                | E2E Spec | Status |
| ------ | -------------------------------------------------------- | -------- | ------ |
| AC-001 | Session context variables are set at connection start    |          | ❓     |
| AC-002 | Session user ID is available for owner-based permissions |          | ❓     |
| AC-003 | Session user role is available for RBAC evaluation       |          | ❓     |

### Implementation References

---

## US-TABLES-PERMISSIONS-007: API Field Permission Enforcement

**As a** developer,
**I want to** API responses to respect field-level permissions,
**so that** sensitive fields are automatically filtered from responses.

### Acceptance Criteria

| ID     | Criterion                                                    | E2E Spec                                  | Status |
| ------ | ------------------------------------------------------------ | ----------------------------------------- | ------ |
| AC-001 | GET /records excludes fields user lacks read permission for  | `API-TABLES-PERMISSIONS-FIELD-001`        | ✅     |
| AC-002 | GET /records/:id excludes restricted fields                  | `API-TABLES-PERMISSIONS-FIELD-002`        | ✅     |
| AC-003 | POST /records ignores fields user lacks write permission for | `API-TABLES-PERMISSIONS-FIELD-003`        | ⏳     |
| AC-004 | PATCH /records/:id rejects updates to restricted fields      | `API-TABLES-PERMISSIONS-FIELD-004`        | ⏳     |
| AC-005 | Batch operations respect field permissions per record        | `API-TABLES-PERMISSIONS-FIELD-005`        | ✅     |
| AC-006 | Complete field permission enforcement workflow (regression)  | `API-TABLES-PERMISSIONS-FIELD-REGRESSION` | ✅     |

### Implementation References

---

## US-TABLES-PERMISSIONS-008: API Record Permission Enforcement

**As a** developer,
**I want to** API endpoints to enforce record-level permissions,
**so that** users can only access and modify permitted records.

### Acceptance Criteria

| ID     | Criterion                                                 | E2E Spec | Status |
| ------ | --------------------------------------------------------- | -------- | ------ |
| AC-001 | GET /records returns only permitted records               |          | ❓     |
| AC-002 | GET /records/:id returns 404 for non-permitted records    |          | ❓     |
| AC-003 | POST /records sets owner field automatically              |          | ❓     |
| AC-004 | PATCH /records/:id rejects updates to non-owned records   |          | ❓     |
| AC-005 | DELETE /records/:id rejects deletion of non-owned records |          | ❓     |
| AC-006 | Record count respects permission filtering                |          | ❓     |
| AC-007 | Pagination metadata reflects permitted record count       |          | ❓     |

### Implementation References

---

## US-TABLES-PERMISSIONS-009: Permission Inheritance

**As a** developer,
**I want to** define permission inheritance rules,
**so that** I can avoid duplicating permission configuration across related tables.

### Configuration

```yaml
tables:
  - id: 1
    name: projects
    permissions:
      roles:
        admin: { read: true, create: true, update: true, delete: true }
        member: { read: true, create: false, update: false, delete: false }

  - id: 2
    name: tasks
    permissions:
      inherit: projects # Inherit permissions from projects table
      override:
        member:
          create: true # Members can create tasks in projects they can read
```

### Acceptance Criteria

| ID     | Criterion                                            | E2E Spec | Status |
| ------ | ---------------------------------------------------- | -------- | ------ |
| AC-001 | Child table inherits parent table permissions        |          | ❓     |
| AC-002 | Override permissions take precedence over inherited  |          | ❓     |
| AC-003 | Circular inheritance is detected and rejected        |          | ❓     |
| AC-004 | Inherited permissions update when parent changes     |          | ❓     |
| AC-005 | Multiple levels of inheritance are supported         |          | ❓     |
| AC-006 | Inheritance chain is validated at configuration time |          | ❓     |

### Implementation References

---

## US-TABLES-PERMISSIONS-010: Check User Permissions

**As a** developer,
**I want to** check what permissions a user has for a specific table,
**so that** I can conditionally show/hide UI elements based on user capabilities.

### API Request

```
GET /api/tables/1/permissions
```

### Response

```json
{
  "read": true,
  "create": true,
  "update": true,
  "delete": false,
  "manage": false,
  "fields": {
    "name": { "read": true, "write": true },
    "salary": { "read": false, "write": false }
  }
}
```

### Acceptance Criteria

| ID     | Criterion                                        | E2E Spec                                  | Status |
| ------ | ------------------------------------------------ | ----------------------------------------- | ------ |
| AC-001 | Returns 200 OK with user's permissions for table | `API-TABLES-PERMISSIONS-CHECK-001`        | ✅     |
| AC-002 | Returns permissions reflecting user's role       | `API-TABLES-PERMISSIONS-CHECK-002`        | ✅     |
| AC-003 | Returns 404 Not Found for non-existent table     | `API-TABLES-PERMISSIONS-CHECK-003`        | ✅     |
| AC-004 | Returns 401 when not authenticated               | `API-TABLES-PERMISSIONS-CHECK-004`        | ✅     |
| AC-005 | Shows specific field permissions when configured | `API-TABLES-PERMISSIONS-CHECK-005`        | ✅     |
| AC-006 | Shows all permissions for admin role             | `API-TABLES-PERMISSIONS-CHECK-006`        | ✅     |
| AC-007 | User checks table permissions (regression)       | `API-TABLES-PERMISSIONS-CHECK-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/permissions/get.spec.ts`

---

## Regression Tests

| Spec ID                                   | Workflow                                                 | Status |
| ----------------------------------------- | -------------------------------------------------------- | ------ |
| `APP-TABLES-PERMISSIONS-REGRESSION`       | Developer configures RBAC and permissions work correctly | `[x]`  |
| `APP-TABLES-RLS-REGRESSION`               | RLS policies are enforced at database level              | `[x]`  |
| `API-TABLES-PERMISSIONS-REGRESSION`       | API respects all permission levels                       | `[x]`  |
| `API-TABLES-PERMISSIONS-CHECK-REGRESSION` | User checks table permissions                            | `[x]`  |
| `API-TABLES-PERMISSIONS-FIELD-REGRESSION` | Complete field permission enforcement workflow           | `[x]`  |

---

## Coverage Summary

| User Story                | Title                         | Spec Count            | Status   |
| ------------------------- | ----------------------------- | --------------------- | -------- |
| US-TABLES-PERMISSIONS-001 | Table-Level Access Control    | 5                     | Complete |
| US-TABLES-PERMISSIONS-002 | Role-Based Access Control     | 10                    | Complete |
| US-TABLES-PERMISSIONS-003 | Field-Level Permissions       | 9                     | Complete |
| US-TABLES-PERMISSIONS-004 | Record-Level Permissions      | 5                     | Complete |
| US-TABLES-PERMISSIONS-005 | PostgreSQL RLS                | 14                    | Complete |
| US-TABLES-PERMISSIONS-006 | Session Context Integration   | 3                     | Complete |
| US-TABLES-PERMISSIONS-007 | API Field Permission Enforce  | 6                     | Complete |
| US-TABLES-PERMISSIONS-008 | API Record Permission Enforce | 7                     | Complete |
| US-TABLES-PERMISSIONS-009 | Permission Inheritance        | 6                     | Complete |
| US-TABLES-PERMISSIONS-010 | Check User Permissions        | 7                     | Complete |
| **Total**                 |                               | **72 + 5 regression** |          |
