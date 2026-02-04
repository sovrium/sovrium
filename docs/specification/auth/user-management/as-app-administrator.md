# Auth > User Management > As App Administrator

> **Domain**: auth
> **Feature Area**: user-management
> **Role**: App Administrator
> **Schema Path**: `src/domain/models/app/auth/plugins/admin.ts`
> **Spec Path**: `specs/api/auth/admin/`

---

## User Stories

### US-AUTH-USER-001: List All Users

**Story**: As an app administrator, I want to see a list of all users so that I can manage access.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                               | Spec Test                       | Schema       | Status |
| ------ | --------------------------------------- | ------------------------------- | ------------ | ------ |
| AC-001 | Returns 200 OK with paginated user list | `API-AUTH-ADMIN-LIST-USERS-001` | `auth.admin` | `[x]`  |
| AC-002 | Supports pagination with limit/offset   | `API-AUTH-ADMIN-LIST-USERS-002` | `auth.admin` | `[x]`  |
| AC-003 | Supports sorting by email/name          | `API-AUTH-ADMIN-LIST-USERS-003` | `auth.admin` | `[x]`  |
| AC-004 | Returns 401 without authentication      | `API-AUTH-ADMIN-LIST-USERS-004` | `auth.admin` | `[x]`  |
| AC-005 | Returns 403 for non-admin users         | `API-AUTH-ADMIN-LIST-USERS-005` | `auth.admin` | `[x]`  |
| AC-006 | Excludes password field from response   | `API-AUTH-ADMIN-LIST-USERS-006` | `auth.admin` | `[x]`  |
| AC-007 | Returns empty list when no other users  | `API-AUTH-ADMIN-LIST-USERS-007` | `auth.admin` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/plugins/admin.ts` `[x] Exists`
- **E2E Spec**: `specs/api/auth/admin/list-users/get.spec.ts` `[x] Exists`
- **API Route**: `/api/auth/admin/list-users` `[x] Implemented`

---

### US-AUTH-USER-002: Invite New Users

**Story**: As an app administrator, I want to invite new users as members so that I can grant access to others.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                                     | Spec Test                        | Schema       | Status |
| ------ | --------------------------------------------- | -------------------------------- | ------------ | ------ |
| AC-001 | Sends invitation email with signup link       | `API-AUTH-ADMIN-INVITE-USER-001` | `auth.admin` | `[ ]`  |
| AC-002 | Creates pending invitation record             | `API-AUTH-ADMIN-INVITE-USER-002` | `auth.admin` | `[ ]`  |
| AC-003 | Invitation link expires after configured time | `API-AUTH-ADMIN-INVITE-USER-003` | `auth.admin` | `[ ]`  |
| AC-004 | Returns 401 without authentication            | `API-AUTH-ADMIN-INVITE-USER-004` | `auth.admin` | `[ ]`  |
| AC-005 | Returns 403 for non-admin users               | `API-AUTH-ADMIN-INVITE-USER-005` | `auth.admin` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/plugins/admin.ts` `[x] Exists`
- **E2E Spec**: `specs/api/auth/admin/invite-user/post.spec.ts` `[ ] Needs Creation`
- **API Route**: `/api/auth/admin/invite-user` `[ ] Not Implemented`

---

### US-AUTH-USER-003: Assign Roles to Users

**Story**: As an app administrator, I want to assign roles to users so that I can control their permissions.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                          | Spec Test                     | Schema       | Status |
| ------ | ---------------------------------- | ----------------------------- | ------------ | ------ |
| AC-001 | Sets user role successfully        | `API-AUTH-ADMIN-SET-ROLE-001` | `auth.admin` | `[x]`  |
| AC-002 | Validates role exists in system    | `API-AUTH-ADMIN-SET-ROLE-002` | `auth.admin` | `[x]`  |
| AC-003 | Returns 401 without authentication | `API-AUTH-ADMIN-SET-ROLE-003` | `auth.admin` | `[x]`  |
| AC-004 | Returns 403 for non-admin users    | `API-AUTH-ADMIN-SET-ROLE-004` | `auth.admin` | `[x]`  |
| AC-005 | Returns 404 for non-existent user  | `API-AUTH-ADMIN-SET-ROLE-005` | `auth.admin` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/plugins/admin.ts` `[x] Exists`
- **E2E Spec**: `specs/api/auth/admin/set-role/post.spec.ts` `[x] Exists`
- **API Route**: `/api/auth/admin/set-role` `[x] Implemented`

---

### US-AUTH-USER-004: View User Activity Logs

**Story**: As an app administrator, I want to view user activity logs so that I can audit their actions.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                               | Spec Test                          | Schema       | Status |
| ------ | --------------------------------------- | ---------------------------------- | ------------ | ------ |
| AC-001 | Returns paginated activity log for user | `API-AUTH-ADMIN-USER-ACTIVITY-001` | `auth.admin` | `[ ]`  |
| AC-002 | Includes login/logout events            | `API-AUTH-ADMIN-USER-ACTIVITY-002` | `auth.admin` | `[ ]`  |
| AC-003 | Includes profile changes                | `API-AUTH-ADMIN-USER-ACTIVITY-003` | `auth.admin` | `[ ]`  |
| AC-004 | Includes IP address and user agent      | `API-AUTH-ADMIN-USER-ACTIVITY-004` | `auth.admin` | `[ ]`  |
| AC-005 | Returns 401 without authentication      | `API-AUTH-ADMIN-USER-ACTIVITY-005` | `auth.admin` | `[ ]`  |
| AC-006 | Returns 403 for non-admin users         | `API-AUTH-ADMIN-USER-ACTIVITY-006` | `auth.admin` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/audit/` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/auth/admin/user-activity/get.spec.ts` `[ ] Needs Creation`
- **API Route**: `/api/auth/admin/user-activity` `[ ] Not Implemented`

---

### US-AUTH-USER-005: Deactivate/Reactivate User Accounts

**Story**: As an app administrator, I want to deactivate/reactivate user accounts so that I can manage access without deletion.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                            | Spec Test                       | Schema       | Status |
| ------ | ------------------------------------ | ------------------------------- | ------------ | ------ |
| AC-001 | Deactivates user account             | `API-AUTH-ADMIN-BAN-USER-001`   | `auth.admin` | `[ ]`  |
| AC-002 | Reactivates user account             | `API-AUTH-ADMIN-UNBAN-USER-001` | `auth.admin` | `[ ]`  |
| AC-003 | Deactivated user cannot login        | `API-AUTH-ADMIN-BAN-USER-002`   | `auth.admin` | `[ ]`  |
| AC-004 | Deactivated user's data is preserved | `API-AUTH-ADMIN-BAN-USER-003`   | `auth.admin` | `[ ]`  |
| AC-005 | Returns 401 without authentication   | `API-AUTH-ADMIN-BAN-USER-004`   | `auth.admin` | `[ ]`  |
| AC-006 | Returns 403 for non-admin users      | `API-AUTH-ADMIN-BAN-USER-005`   | `auth.admin` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/plugins/admin.ts` `[x] Exists` (Better Auth supports ban/unban)
- **E2E Spec**: `specs/api/auth/admin/ban-user/post.spec.ts` `[ ] Needs Creation`
- **API Route**: `/api/auth/admin/ban-user` `[ ] Not Implemented`

---

### US-AUTH-USER-006: Delete User Accounts

**Story**: As an app administrator, I want to delete user accounts so that I can remove users entirely.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                          | Spec Test                        | Schema       | Status |
| ------ | ---------------------------------- | -------------------------------- | ------------ | ------ |
| AC-001 | Deletes user account permanently   | `API-AUTH-ADMIN-REMOVE-USER-001` | `auth.admin` | `[ ]`  |
| AC-002 | Removes all user sessions          | `API-AUTH-ADMIN-REMOVE-USER-002` | `auth.admin` | `[ ]`  |
| AC-003 | Returns 401 without authentication | `API-AUTH-ADMIN-REMOVE-USER-003` | `auth.admin` | `[ ]`  |
| AC-004 | Returns 403 for non-admin users    | `API-AUTH-ADMIN-REMOVE-USER-004` | `auth.admin` | `[ ]`  |
| AC-005 | Returns 404 for non-existent user  | `API-AUTH-ADMIN-REMOVE-USER-005` | `auth.admin` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/plugins/admin.ts` `[x] Exists` (Better Auth supports removeUser)
- **E2E Spec**: `specs/api/auth/admin/remove-user/post.spec.ts` `[ ] Needs Creation`
- **API Route**: `/api/auth/admin/remove-user` `[ ] Not Implemented`

---

## Coverage Summary

| Story ID         | Title                          | Status            | Criteria Met |
| ---------------- | ------------------------------ | ----------------- | ------------ |
| US-AUTH-USER-001 | List All Users                 | `[x]` Complete    | 7/7          |
| US-AUTH-USER-002 | Invite New Users               | `[ ]` Not Started | 0/5          |
| US-AUTH-USER-003 | Assign Roles to Users          | `[x]` Complete    | 5/5          |
| US-AUTH-USER-004 | View User Activity Logs        | `[ ]` Not Started | 0/6          |
| US-AUTH-USER-005 | Deactivate/Reactivate Accounts | `[ ]` Not Started | 0/6          |
| US-AUTH-USER-006 | Delete User Accounts           | `[ ]` Not Started | 0/5          |

**Total**: 2 complete, 0 partial, 4 not started (33% complete)

---

> **Navigation**: [← Back to Auth Domain](../README.md) | [User Management as Developer →](./as-developer.md)
