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

| ID     | Criterion                                                                  | E2E Spec | Status |
| ------ | -------------------------------------------------------------------------- | -------- | ------ |
| AC-001 | Built-in roles (admin=80, member=40, viewer=10) are always available       |          |        |
| AC-002 | Custom roles defined with `name`, optional `description`, optional `level` |          |        |
| AC-003 | Role names must be unique (no duplicates including built-in roles)         |          |        |
| AC-004 | Role names follow naming convention (lowercase, alphanumeric, hyphens)     |          |        |
| AC-005 | Hierarchy level determines role ordering (higher = more permissions)       |          |        |
| AC-006 | Roles used in table permissions are validated against defined roles        |          |        |
| AC-007 | Schema validation error when table permission references undefined role    |          |        |
| AC-008 | Empty roles array is valid (only built-in roles available)                 |          |        |

### Implementation References

- **Schema**: `src/domain/models/app/auth/roles.ts`

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

| ID     | Criterion                                                                 | E2E Spec | Status |
| ------ | ------------------------------------------------------------------------- | -------- | ------ |
| AC-001 | `auth.defaultRole` accepts built-in roles (admin, member, viewer)         |          |        |
| AC-002 | `auth.defaultRole` accepts custom role names (if defined in auth.roles)   |          |        |
| AC-003 | Default role defaults to `member` when not specified                      |          |        |
| AC-004 | Schema validation error when defaultRole references undefined custom role |          |        |

### Implementation References

- **Schema**: `src/domain/models/app/auth/index.ts`

---

## Coverage Summary

| User Story        | Title                   | Spec Count | Status  |
| ----------------- | ----------------------- | ---------- | ------- |
| US-AUTH-ROLES-001 | Define Custom Roles     | 8          | Pending |
| US-AUTH-ROLES-002 | Default Role Assignment | 4          | Pending |
| **Total**         |                         | **12**     |         |
