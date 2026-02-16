# Role Definitions

> **Feature Area**: Authentication - Role Definitions
> **Schema**: `src/domain/models/app/auth/roles.ts`

---

## US-AUTH-ROLES-001: Define Custom Roles

**As a** developer building a Sovrium app,
**I want to** define custom roles with hierarchy levels in my app config,
**so that** I can use these roles consistently across table and field permissions.

### Configuration

```yaml
auth:
  strategies:
    - type: emailAndPassword
  roles:
    - name: editor
      description: 'Can edit content but not manage users'
      level: 30
    - name: moderator
      description: 'Can moderate comments and content'
      level: 20
```

### Built-in Roles

The following roles are always available without configuration:

| Role   | Level | Description                               |
| ------ | ----- | ----------------------------------------- |
| admin  | 80    | Can manage members and settings           |
| member | 40    | Standard access to organization resources |
| viewer | 10    | Read-only access                          |

### Acceptance Criteria

| ID     | Criterion                                                                  | E2E Spec                    | Status |
| ------ | -------------------------------------------------------------------------- | --------------------------- | ------ |
| AC-001 | Built-in roles (admin=80, member=40, viewer=10) are always available       | `APP-AUTH-ROLES-001`        | ⏳     |
| AC-002 | Custom roles defined with `name`, optional `description`, optional `level` | `APP-AUTH-ROLES-002`        | ⏳     |
| AC-003 | Role names must be unique (no duplicates including built-in roles)         | `APP-AUTH-ROLES-003`        | ⏳     |
| AC-004 | Role names follow naming convention (lowercase, alphanumeric, hyphens)     | `APP-AUTH-ROLES-004`        | ⏳     |
| AC-005 | Hierarchy level determines role ordering (higher = more permissions)       | `APP-AUTH-ROLES-005`        | ⏳     |
| AC-006 | Roles used in table permissions are validated against defined roles        | `APP-AUTH-ROLES-006`        | ⏳     |
| AC-007 | Schema validation error when table permission references undefined role    | `APP-AUTH-ROLES-007`        | ⏳     |
| AC-008 | Empty roles array is valid (only built-in roles available)                 | `APP-AUTH-ROLES-008`        | ⏳     |
| AC-009 | Role definition workflow completes successfully (regression)               | `APP-AUTH-ROLES-REGRESSION` | ⏳     |

### Implementation References

- **Schema**: `src/domain/models/app/auth/roles.ts`
- **E2E Spec**: `specs/app/auth/roles.spec.ts`

---

## US-AUTH-ROLES-002: Default Role Assignment

**As a** developer,
**I want to** configure which role is assigned to new users by default,
**so that** new users have appropriate permissions without manual role assignment.

### Configuration

```yaml
auth:
  strategies:
    - type: emailAndPassword
  defaultRole: viewer
  roles:
    - name: editor
      level: 30
```

### Acceptance Criteria

| ID     | Criterion                                                                 | E2E Spec             | Status |
| ------ | ------------------------------------------------------------------------- | -------------------- | ------ |
| AC-001 | `auth.defaultRole` accepts built-in roles (admin, member, viewer)         | `APP-AUTH-ROLES-009` | ⏳     |
| AC-002 | `auth.defaultRole` accepts custom role names (if defined in auth.roles)   | `APP-AUTH-ROLES-010` | ⏳     |
| AC-003 | Default role defaults to `member` when not specified                      | `APP-AUTH-ROLES-011` | ⏳     |
| AC-004 | Schema validation error when defaultRole references undefined custom role | `APP-AUTH-ROLES-012` | ⏳     |

### Implementation References

- **Schema**: `src/domain/models/app/auth/index.ts`
- **E2E Spec**: `specs/app/auth/roles.spec.ts`

---

## Coverage Summary

| User Story        | Title                   | Spec Count | Status  |
| ----------------- | ----------------------- | ---------- | ------- |
| US-AUTH-ROLES-001 | Define Custom Roles     | 8          | Pending |
| US-AUTH-ROLES-002 | Default Role Assignment | 4          | Pending |
| **Total**         |                         | **12**     |         |

### E2E Test Coverage

| Spec Test ID                | Description                                               | Status |
| --------------------------- | --------------------------------------------------------- | ------ |
| `APP-AUTH-ROLES-001`        | Built-in roles (admin=80, member=40, viewer=10) available | ⏳     |
| `APP-AUTH-ROLES-002`        | Custom roles with name, description, level                | ⏳     |
| `APP-AUTH-ROLES-003`        | Role names must be unique                                 | ⏳     |
| `APP-AUTH-ROLES-004`        | Role names follow naming convention                       | ⏳     |
| `APP-AUTH-ROLES-005`        | Hierarchy level determines ordering                       | ⏳     |
| `APP-AUTH-ROLES-006`        | Table permissions validated against roles                 | ⏳     |
| `APP-AUTH-ROLES-007`        | Error when permission references undefined role           | ⏳     |
| `APP-AUTH-ROLES-008`        | Empty roles array valid                                   | ⏳     |
| `APP-AUTH-ROLES-009`        | defaultRole accepts built-in roles                        | ⏳     |
| `APP-AUTH-ROLES-010`        | defaultRole accepts custom roles                          | ⏳     |
| `APP-AUTH-ROLES-011`        | defaultRole defaults to member                            | ⏳     |
| `APP-AUTH-ROLES-012`        | Error when defaultRole references undefined role          | ⏳     |
| `APP-AUTH-ROLES-REGRESSION` | Role definition workflow completes successfully           | ⏳     |
