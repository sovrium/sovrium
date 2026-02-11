# Permissions

> **Feature Area**: Tables - Permissions & Access Control
> **Schema**: `src/domain/models/app/table/`, `src/domain/models/app/permissions/`
> **E2E Specs**: `specs/app/tables/permissions/`, `specs/api/tables/permissions/`

---

## Overview

Sovrium implements a layered permission system with Better Auth integration. Permissions are defined at two levels: table-level and field-level, with support for role-based access control (RBAC).

Permission values use a simplified 3-format system:

- `all` — Everyone (including unauthenticated users)
- `authenticated` — Any logged-in user
- `['admin', 'editor']` — Specific role names (array)

---

## US-TABLES-PERMISSIONS-001: Table-Level Access Control

**As a** developer,
**I want to** define table-level permissions for CRUD operations and comments,
**so that** I can control which users can read, create, update, delete, or comment on records in each table.

### Configuration

```yaml
tables:
  - name: articles
    permissions:
      read: all
      comment: authenticated
      create: ['admin', 'editor']
      update: ['admin', 'editor']
      delete: ['admin']
```

### Permission Format

Each operation accepts one of 3 formats:

| Format          | Meaning                        | Example                  |
| --------------- | ------------------------------ | ------------------------ |
| `all`           | Everyone (including anonymous) | `read: all`              |
| `authenticated` | Any logged-in user             | `comment: authenticated` |
| Role array      | Specific roles only            | `create: ['admin']`      |

### Acceptance Criteria

| ID     | Criterion                                                          | E2E Spec                                  | Status |
| ------ | ------------------------------------------------------------------ | ----------------------------------------- | ------ |
| AC-001 | `all` permission allows unauthenticated access                     | `APP-TABLES-TABLE-PERMISSIONS-001`        | ✅     |
| AC-002 | `authenticated` permission requires login for the operation        | `APP-TABLES-TABLE-PERMISSIONS-002`        | ✅     |
| AC-003 | Role array permission restricts to listed roles                    | `APP-TABLES-TABLE-PERMISSIONS-003`        | ✅     |
| AC-004 | Returns 401 for unauthenticated access to non-`all` operations     |                                           |        |
| AC-005 | Returns 403 for unauthorized role attempting restricted ops        |                                           |        |
| AC-006 | User can complete full table-permissions workflow (regression)     | `APP-TABLES-TABLE-PERMISSIONS-REGRESSION` | ✅     |
| AC-007 | `comment` permission controls who can add comments to records      |                                           |        |
| AC-008 | All 5 operations (read, comment, create, update, delete) supported |                                           |        |
| AC-009 | Unknown role names in permissions trigger validation warning       |                                           |        |
| AC-010 | Omitted operations default to deny                                 |                                           |        |

### Implementation References

- **E2E Spec**: `specs/app/tables/permissions/table-permissions.spec.ts`

---

## US-TABLES-PERMISSIONS-002: Role-Based Access Control (RBAC)

**As a** developer,
**I want to** use roles to control table permissions,
**so that** I can implement fine-grained access control based on user roles.

### Configuration

```yaml
auth:
  strategies:
    - type: emailAndPassword
  defaultRole: viewer
  roles:
    - name: editor
      description: 'Can edit content'
      level: 30

tables:
  - name: articles
    permissions:
      read: all
      create: ['admin', 'editor']
      update: ['admin', 'editor']
      delete: ['admin']
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
| AC-009 | Role changes take effect immediately without re-login    |                                     |        |
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
  - name: employees
    fields:
      - name: name
        type: single-line-text
      - name: salary
        type: currency
      - name: department
        type: single-line-text
    permissions:
      read: all
      create: ['admin']
      update: ['admin']
      delete: ['admin']
      fields:
        - field: name
          read: all
          write: ['admin', 'hr']
        - field: salary
          read: ['admin', 'hr']
          write: ['admin']
        - field: department
          read: all
          write: ['admin']
```

### Acceptance Criteria

| ID     | Criterion                                                      | E2E Spec                                  | Status |
| ------ | -------------------------------------------------------------- | ----------------------------------------- | ------ |
| AC-001 | Fields with read restriction are omitted from API response     | `APP-TABLES-FIELD-PERMISSIONS-001`        | ✅     |
| AC-002 | Fields with write restriction reject update attempts           | `APP-TABLES-FIELD-PERMISSIONS-002`        | ✅     |
| AC-003 | Field permissions override table-level permissions             | `APP-TABLES-FIELD-PERMISSIONS-003`        | ✅     |
| AC-004 | Returns 403 when attempting to write read-only field           | `APP-TABLES-FIELD-PERMISSIONS-004`        | ✅     |
| AC-005 | Hidden fields are not included in list/detail responses        | `APP-TABLES-FIELD-PERMISSIONS-005`        | ✅     |
| AC-006 | Field permission `all` grants access to all roles              | `APP-TABLES-FIELD-PERMISSIONS-006`        | ✅     |
| AC-007 | Field permissions use same 3-format system as table-level      | `APP-TABLES-FIELD-PERMISSIONS-007`        | ✅     |
| AC-008 | Computed fields respect source field permissions               | `APP-TABLES-FIELD-PERMISSIONS-008`        | ✅     |
| AC-009 | Relationship fields respect related table permissions          | `APP-TABLES-FIELD-PERMISSIONS-009`        | ✅     |
| AC-010 | User can complete full field-permissions workflow (regression) | `APP-TABLES-FIELD-PERMISSIONS-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/permissions/field-permissions.spec.ts`

---

## US-TABLES-PERMISSIONS-005: API Field Permission Enforcement

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

## US-TABLES-PERMISSIONS-006: Permission Inheritance

**As a** developer,
**I want to** define permission inheritance rules,
**so that** I can avoid duplicating permission configuration across related tables.

### Configuration

> **Note**: Permission inheritance (`inherit`, `override`) is not yet available in the AppSchema. The configuration format below represents the target design and will be implemented in a future release.

### Acceptance Criteria

| ID     | Criterion                                                           | E2E Spec                                       | Status |
| ------ | ------------------------------------------------------------------- | ---------------------------------------------- | ------ |
| AC-001 | Child table inherits parent table permissions                       | `APP-TABLES-PERMISSION-INHERITANCE-001`        | ✅     |
| AC-002 | Override permissions take precedence over inherited                 | `APP-TABLES-PERMISSION-INHERITANCE-002`        | ✅     |
| AC-003 | Circular inheritance is detected and rejected                       | `APP-TABLES-PERMISSION-INHERITANCE-003`        | ⏳     |
| AC-004 | Inherited permissions update when parent changes                    | `APP-TABLES-PERMISSION-INHERITANCE-004`        | ⏳     |
| AC-005 | Multiple levels of inheritance are supported                        | `APP-TABLES-PERMISSION-INHERITANCE-005`        | ⏳     |
| AC-006 | Inheritance chain is validated at configuration time                | `APP-TABLES-PERMISSION-INHERITANCE-006`        | ⏳     |
| AC-007 | User can complete full permission-inheritance workflow (regression) | `APP-TABLES-PERMISSION-INHERITANCE-REGRESSION` | ⏳     |

### Implementation References

- **E2E Spec**: `specs/app/tables/permissions/permission-inheritance.spec.ts`

---

## US-TABLES-PERMISSIONS-007: Check User Permissions

**As a** developer,
**I want to** check what permissions a user has for a specific table,
**so that** I can conditionally show/hide UI elements based on user capabilities.

### API Request

```
GET /api/tables/:tableId/permissions
```

### Response

```json
{
  "table": {
    "read": true,
    "create": true,
    "update": true,
    "delete": false
  },
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

| Spec ID                                        | Workflow                                                 | Status |
| ---------------------------------------------- | -------------------------------------------------------- | ------ |
| `APP-TABLES-PERMISSIONS-REGRESSION`            | Developer configures RBAC and permissions work correctly | `[x]`  |
| `API-TABLES-PERMISSIONS-CHECK-REGRESSION`      | User checks table permissions                            | `[x]`  |
| `API-TABLES-PERMISSIONS-FIELD-REGRESSION`      | Complete field permission enforcement workflow           | `[x]`  |
| `APP-TABLES-PERMISSION-INHERITANCE-REGRESSION` | Permission inheritance workflow                          | `[ ]`  |

---

## Coverage Summary

| User Story                | Title                        | Spec Count            | Status   |
| ------------------------- | ---------------------------- | --------------------- | -------- |
| US-TABLES-PERMISSIONS-001 | Table-Level Access Control   | 10                    | Partial  |
| US-TABLES-PERMISSIONS-002 | Role-Based Access Control    | 11                    | Complete |
| US-TABLES-PERMISSIONS-003 | Field-Level Permissions      | 10                    | Complete |
| US-TABLES-PERMISSIONS-005 | API Field Permission Enforce | 6                     | Complete |
| US-TABLES-PERMISSIONS-006 | Permission Inheritance       | 6                     | Pending  |
| US-TABLES-PERMISSIONS-007 | Check User Permissions       | 7                     | Complete |
| **Total**                 |                              | **50 + 3 regression** |          |
