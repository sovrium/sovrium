# Auth > Authorization > As App Administrator

> **Domain**: auth
> **Feature Area**: authorization
> **Role**: App Administrator
> **Schema Path**: `src/domain/models/app/auth/`
> **Spec Path**: `specs/api/auth/admin/`

---

## User Stories

### US-AUTH-AUTHZ-ADMIN-001: View Role Permissions

**Story**: As an app administrator, I want to see which permissions each role has so that I can audit access.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                              | Spec Test                       | Schema       | Status |
| ------ | -------------------------------------- | ------------------------------- | ------------ | ------ |
| AC-001 | Lists all roles with their permissions | `API-AUTH-ADMIN-VIEW-ROLES-001` | `auth.admin` | `[x]`  |
| AC-002 | Shows permission inheritance chain     | `API-AUTH-ADMIN-VIEW-ROLES-002` | `auth.admin` | `[x]`  |
| AC-003 | Returns 401 without authentication     | `API-AUTH-ADMIN-VIEW-ROLES-003` | `auth.admin` | `[x]`  |
| AC-004 | Returns 403 for non-admin users        | `API-AUTH-ADMIN-VIEW-ROLES-004` | `auth.admin` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/plugins/admin.ts` `[x] Exists`
- **E2E Spec**: Role permissions viewing tested via admin API
- **API Route**: `/api/auth/admin/roles` `[x] Implemented`

---

### US-AUTH-AUTHZ-ADMIN-002: Modify Role Permissions

**Story**: As an app administrator, I want to modify role permissions from the Admin Space so that I can adjust access without code.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                               | Spec Test                       | Schema       | Status |
| ------ | --------------------------------------- | ------------------------------- | ------------ | ------ |
| AC-001 | Modifies permissions for existing roles | `API-AUTH-ADMIN-EDIT-ROLES-001` | `auth.admin` | `[ ]`  |
| AC-002 | Validates permission values             | `API-AUTH-ADMIN-EDIT-ROLES-002` | `auth.admin` | `[ ]`  |
| AC-003 | Changes take effect immediately         | `API-AUTH-ADMIN-EDIT-ROLES-003` | `auth.admin` | `[ ]`  |
| AC-004 | Returns 401 without authentication      | `API-AUTH-ADMIN-EDIT-ROLES-004` | `auth.admin` | `[ ]`  |
| AC-005 | Returns 403 for non-admin users         | `API-AUTH-ADMIN-EDIT-ROLES-005` | `auth.admin` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/plugins/admin.ts` `[x] Exists`
- **E2E Spec**: `specs/api/auth/admin/edit-roles/post.spec.ts` `[ ] Needs Creation`
- **API Route**: `/api/auth/admin/edit-roles` `[ ] Not Implemented`

---

### US-AUTH-AUTHZ-ADMIN-003: View User Role Assignments

**Story**: As an app administrator, I want to see which users have which roles so that I can manage assignments.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                             | Spec Test                       | Schema       | Status |
| ------ | ------------------------------------- | ------------------------------- | ------------ | ------ |
| AC-001 | Lists users with their assigned roles | `API-AUTH-ADMIN-USER-ROLES-001` | `auth.admin` | `[x]`  |
| AC-002 | Supports filtering by role            | `API-AUTH-ADMIN-USER-ROLES-002` | `auth.admin` | `[x]`  |
| AC-003 | Returns 401 without authentication    | `API-AUTH-ADMIN-USER-ROLES-003` | `auth.admin` | `[x]`  |
| AC-004 | Returns 403 for non-admin users       | `API-AUTH-ADMIN-USER-ROLES-004` | `auth.admin` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/plugins/admin.ts` `[x] Exists`
- **E2E Spec**: `specs/api/auth/admin/list-users/get.spec.ts` `[x] Exists`
- **API Route**: `/api/auth/admin/list-users` `[x] Implemented`

---

## Coverage Summary

| Story ID                | Title                      | Status            | Criteria Met |
| ----------------------- | -------------------------- | ----------------- | ------------ |
| US-AUTH-AUTHZ-ADMIN-001 | View Role Permissions      | `[x]` Complete    | 4/4          |
| US-AUTH-AUTHZ-ADMIN-002 | Modify Role Permissions    | `[ ]` Not Started | 0/5          |
| US-AUTH-AUTHZ-ADMIN-003 | View User Role Assignments | `[x]` Complete    | 4/4          |

**Total**: 2 complete, 0 partial, 1 not started (67% complete)

---

> **Navigation**: [← Back to Auth Domain](../README.md) | [← Authorization as Developer](./as-developer.md)
