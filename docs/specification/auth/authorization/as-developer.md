# Auth > Authorization > As Developer

> **Domain**: auth
> **Feature Area**: authorization
> **Role**: Developer
> **Schema Path**: `src/domain/models/app/auth/`
> **Spec Path**: `specs/api/auth/`

---

## User Stories

### US-AUTH-AUTHZ-DEV-001: Define Custom Roles

**Story**: As a developer, I want to define custom roles so that I can model my application's permission structure.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                                          | Spec Test               | Schema       | Status |
| ------ | -------------------------------------------------- | ----------------------- | ------------ | ------ |
| AC-001 | Roles can be defined in app schema                 | `APP-AUTH-ROLE-DEF-001` | `auth.roles` | `[x]`  |
| AC-002 | Role names are validated                           | `APP-AUTH-ROLE-DEF-002` | `auth.roles` | `[x]`  |
| AC-003 | Default roles (owner, admin, member, viewer) exist | `APP-AUTH-ROLE-DEF-003` | `auth.roles` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/` `[x] Exists`
- **E2E Spec**: Role definition tested via app schema validation
- **Config**: Controlled via Better Auth admin plugin with default role configuration

---

### US-AUTH-AUTHZ-DEV-002: Assign Permissions to Roles

**Story**: As a developer, I want to assign permissions to roles so that I can control what each role can do.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                              | Spec Test                  | Schema             | Status |
| ------ | -------------------------------------- | -------------------------- | ------------------ | ------ |
| AC-001 | Permissions can be assigned to roles   | `APP-AUTH-PERM-ASSIGN-001` | `auth.permissions` | `[x]`  |
| AC-002 | Permission inheritance works correctly | `APP-AUTH-PERM-ASSIGN-002` | `auth.permissions` | `[x]`  |
| AC-003 | Invalid permissions are rejected       | `APP-AUTH-PERM-ASSIGN-003` | `auth.permissions` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/` `[x] Exists`
- **E2E Spec**: Permission assignment tested via role configuration
- **Implementation**: Better Auth RBAC with field-level permissions

---

### US-AUTH-AUTHZ-DEV-003: Restrict Table Access by Role

**Story**: As a developer, I want to restrict table access by role so that data is protected.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                                  | Spec Test                   | Schema          | Status |
| ------ | ------------------------------------------ | --------------------------- | --------------- | ------ |
| AC-001 | Tables can be restricted to specific roles | `API-AUTH-TABLE-ACCESS-001` | `tables.access` | `[x]`  |
| AC-002 | Unauthorized access returns 404            | `API-AUTH-TABLE-ACCESS-002` | `tables.access` | `[x]`  |
| AC-003 | Owner isolation enforced on all queries    | `API-AUTH-TABLE-ACCESS-003` | `tables.access` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/tables/` `[x] Exists`
- **E2E Spec**: Table access control tested via API routes
- **Security**: Returns 404 for unauthorized access (prevents enumeration)

---

### US-AUTH-AUTHZ-DEV-004: Restrict Page Access by Role

**Story**: As a developer, I want to restrict page access by role so that users only see what they should.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                                 | Spec Test                  | Schema         | Status |
| ------ | ----------------------------------------- | -------------------------- | -------------- | ------ |
| AC-001 | Pages can be restricted to specific roles | `API-AUTH-PAGE-ACCESS-001` | `pages.access` | `[x]`  |
| AC-002 | Unauthorized access returns 404           | `API-AUTH-PAGE-ACCESS-002` | `pages.access` | `[x]`  |
| AC-003 | Navigation hides restricted pages         | `API-AUTH-PAGE-ACCESS-003` | `pages.access` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/pages/` `[x] Exists`
- **E2E Spec**: Page access control tested via API routes
- **Security**: Returns 404 for unauthorized access (prevents enumeration)

---

### US-AUTH-AUTHZ-DEV-005: Field-Level Permissions

**Story**: As a developer, I want field-level permissions so that I can hide sensitive fields from certain roles.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                                  | Spec Test                 | Schema               | Status |
| ------ | ------------------------------------------ | ------------------------- | -------------------- | ------ |
| AC-001 | Fields can have read/write permissions     | `API-AUTH-FIELD-PERM-001` | `fields.permissions` | `[x]`  |
| AC-002 | Hidden fields omitted from API responses   | `API-AUTH-FIELD-PERM-002` | `fields.permissions` | `[x]`  |
| AC-003 | Write-protected fields reject updates      | `API-AUTH-FIELD-PERM-003` | `fields.permissions` | `[x]`  |
| AC-004 | Permission changes take effect immediately | `API-AUTH-FIELD-PERM-004` | `fields.permissions` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/tables/fields/` `[x] Exists`
- **E2E Spec**: Field-level permissions tested via API routes
- **Implementation**: Granular read/write control per field based on role

---

## Coverage Summary

| Story ID              | Title                       | Status         | Criteria Met |
| --------------------- | --------------------------- | -------------- | ------------ |
| US-AUTH-AUTHZ-DEV-001 | Define Custom Roles         | `[x]` Complete | 3/3          |
| US-AUTH-AUTHZ-DEV-002 | Assign Permissions to Roles | `[x]` Complete | 3/3          |
| US-AUTH-AUTHZ-DEV-003 | Restrict Table Access       | `[x]` Complete | 3/3          |
| US-AUTH-AUTHZ-DEV-004 | Restrict Page Access        | `[x]` Complete | 3/3          |
| US-AUTH-AUTHZ-DEV-005 | Field-Level Permissions     | `[x]` Complete | 4/4          |

**Total**: 5 complete, 0 partial, 0 not started (100% complete)

---

> **Navigation**: [← Back to Auth Domain](../README.md) | [Authorization as App Administrator →](./as-app-administrator.md)
