# Auth > Admin Plugin > As App Administrator

> **Domain**: auth
> **Feature Area**: admin-plugin
> **Role**: App Administrator
> **Schema Path**: `src/domain/models/app/auth/plugins/admin.ts`
> **Spec Path**: `specs/api/auth/admin/`

---

## User Stories

### US-AUTH-ADMIN-001: Admin Login at Startup

**Story**: As an app administrator, I want to be able to login as an admin at startup without auth config needed so that I can access the Admin Space immediately.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                          | Spec Test                      | Schema       | Status |
| ------ | ---------------------------------- | ------------------------------ | ------------ | ------ |
| AC-001 | Admin can log in on first run      | `API-AUTH-ADMIN-BOOTSTRAP-001` | `auth.admin` | `[x]`  |
| AC-002 | No additional auth config required | `API-AUTH-ADMIN-BOOTSTRAP-002` | `auth.admin` | `[x]`  |
| AC-003 | Admin has full Admin Space access  | `API-AUTH-ADMIN-BOOTSTRAP-003` | `auth.admin` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/plugins/admin.ts` `[x] Exists`
- **E2E Spec**: `specs/api/auth/admin/bootstrap/admin-bootstrap.spec.ts` `[x] Exists`
- **Implementation**: Better Auth admin plugin with bootstrap configuration

---

### US-AUTH-ADMIN-002: Default Admin Account Creation

**Story**: As an app administrator, I want a default admin account created on first run so that I can configure the app.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                                        | Spec Test                      | Schema       | Status |
| ------ | ------------------------------------------------ | ------------------------------ | ------------ | ------ |
| AC-001 | First startup creates admin account              | `API-AUTH-ADMIN-BOOTSTRAP-004` | `auth.admin` | `[x]`  |
| AC-002 | Admin credentials can be configured or generated | `API-AUTH-ADMIN-BOOTSTRAP-005` | `auth.admin` | `[x]`  |
| AC-003 | Admin account has owner role                     | `API-AUTH-ADMIN-BOOTSTRAP-006` | `auth.admin` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/plugins/admin.ts` `[x] Exists`
- **E2E Spec**: `specs/api/auth/admin/bootstrap/admin-bootstrap.spec.ts` `[x] Exists`
- **Implementation**: Auto-generated or configured credentials on first startup

---

### US-AUTH-ADMIN-003: Impersonate Users

**Story**: As an app administrator, I want to impersonate users so that I can troubleshoot issues from their perspective.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                               | Spec Test                             | Schema       | Status |
| ------ | --------------------------------------- | ------------------------------------- | ------------ | ------ |
| AC-001 | Can impersonate any non-admin user      | `API-AUTH-ADMIN-IMPERSONATE-001`      | `auth.admin` | `[x]`  |
| AC-002 | Impersonation creates temporary session | `API-AUTH-ADMIN-IMPERSONATE-002`      | `auth.admin` | `[x]`  |
| AC-003 | Can stop impersonation                  | `API-AUTH-ADMIN-STOP-IMPERSONATE-001` | `auth.admin` | `[x]`  |
| AC-004 | Returns 401 without authentication      | `API-AUTH-ADMIN-IMPERSONATE-003`      | `auth.admin` | `[x]`  |
| AC-005 | Returns 403 for non-admin users         | `API-AUTH-ADMIN-IMPERSONATE-004`      | `auth.admin` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/plugins/admin.ts` `[x] Exists`
- **E2E Spec**: `specs/api/auth/admin/impersonate-user/post.spec.ts` `[x] Exists`
- **E2E Spec**: `specs/api/auth/admin/stop-impersonating/post.spec.ts` `[x] Exists`
- **API Route**: `/api/auth/admin/impersonate-user` `[x] Implemented`
- **API Route**: `/api/auth/admin/stop-impersonating` `[x] Implemented`

---

### US-AUTH-ADMIN-004: Require 2FA for Roles

**Story**: As an app administrator, I want to require 2FA for certain roles so that privileged accounts are protected.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                                | Spec Test                    | Schema       | Status |
| ------ | ---------------------------------------- | ---------------------------- | ------------ | ------ |
| AC-001 | Can configure 2FA requirement per role   | `API-AUTH-ADMIN-2FA-REQ-001` | `auth.admin` | `[ ]`  |
| AC-002 | Enforces 2FA on login for required roles | `API-AUTH-ADMIN-2FA-REQ-002` | `auth.admin` | `[ ]`  |
| AC-003 | Prompts 2FA setup if not enrolled        | `API-AUTH-ADMIN-2FA-REQ-003` | `auth.admin` | `[ ]`  |
| AC-004 | Returns 401 without authentication       | `API-AUTH-ADMIN-2FA-REQ-004` | `auth.admin` | `[ ]`  |
| AC-005 | Returns 403 for non-admin users          | `API-AUTH-ADMIN-2FA-REQ-005` | `auth.admin` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/plugins/admin.ts` `[x] Exists`
- **E2E Spec**: `specs/api/auth/admin/require-2fa/post.spec.ts` `[ ] Needs Creation`
- **API Route**: `/api/auth/admin/require-2fa` `[ ] Not Implemented`

---

### US-AUTH-ADMIN-005: View Failed Login Attempts

**Story**: As an app administrator, I want to see failed login attempts so that I can identify attacks.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                                | Spec Test                         | Schema       | Status |
| ------ | ---------------------------------------- | --------------------------------- | ------------ | ------ |
| AC-001 | Lists failed login attempts with details | `API-AUTH-ADMIN-FAILED-LOGIN-001` | `auth.admin` | `[ ]`  |
| AC-002 | Shows IP address and timestamp           | `API-AUTH-ADMIN-FAILED-LOGIN-002` | `auth.admin` | `[ ]`  |
| AC-003 | Supports filtering by user or timeframe  | `API-AUTH-ADMIN-FAILED-LOGIN-003` | `auth.admin` | `[ ]`  |
| AC-004 | Returns 401 without authentication       | `API-AUTH-ADMIN-FAILED-LOGIN-004` | `auth.admin` | `[ ]`  |
| AC-005 | Returns 403 for non-admin users          | `API-AUTH-ADMIN-FAILED-LOGIN-005` | `auth.admin` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/audit/` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/auth/admin/failed-logins/get.spec.ts` `[ ] Needs Creation`
- **API Route**: `/api/auth/admin/failed-logins` `[ ] Not Implemented`

---

### US-AUTH-ADMIN-006: Unlock Locked Accounts

**Story**: As an app administrator, I want to unlock locked accounts so that legitimate users can regain access.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                          | Spec Test                   | Schema       | Status |
| ------ | ---------------------------------- | --------------------------- | ------------ | ------ |
| AC-001 | Can unlock a locked user account   | `API-AUTH-ADMIN-UNLOCK-001` | `auth.admin` | `[ ]`  |
| AC-002 | Resets failed login counter        | `API-AUTH-ADMIN-UNLOCK-002` | `auth.admin` | `[ ]`  |
| AC-003 | Returns 401 without authentication | `API-AUTH-ADMIN-UNLOCK-003` | `auth.admin` | `[ ]`  |
| AC-004 | Returns 403 for non-admin users    | `API-AUTH-ADMIN-UNLOCK-004` | `auth.admin` | `[ ]`  |
| AC-005 | Returns 404 for non-existent user  | `API-AUTH-ADMIN-UNLOCK-005` | `auth.admin` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/plugins/admin.ts` `[x] Exists`
- **E2E Spec**: `specs/api/auth/admin/unlock-user/post.spec.ts` `[ ] Needs Creation`
- **API Route**: `/api/auth/admin/unlock-user` `[ ] Not Implemented`

---

## Coverage Summary

| Story ID          | Title                      | Status            | Criteria Met |
| ----------------- | -------------------------- | ----------------- | ------------ |
| US-AUTH-ADMIN-001 | Admin Login at Startup     | `[x]` Complete    | 3/3          |
| US-AUTH-ADMIN-002 | Default Admin Account      | `[x]` Complete    | 3/3          |
| US-AUTH-ADMIN-003 | Impersonate Users          | `[x]` Complete    | 5/5          |
| US-AUTH-ADMIN-004 | Require 2FA for Roles      | `[ ]` Not Started | 0/5          |
| US-AUTH-ADMIN-005 | View Failed Login Attempts | `[ ]` Not Started | 0/5          |
| US-AUTH-ADMIN-006 | Unlock Locked Accounts     | `[ ]` Not Started | 0/5          |

**Total**: 3 complete, 0 partial, 3 not started (50% complete)

---

> **Navigation**: [← Back to Auth Domain](../README.md)
