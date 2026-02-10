# Admin User Management

> **Feature Area**: Authentication (Admin)
> **Schema**: `src/domain/models/app/auth/`
> **API Routes**: `POST /api/auth/admin/create-user`, `GET /api/auth/admin/list-users`, `GET /api/auth/admin/get-user/:id`, `POST /api/auth/admin/set-role`, `POST /api/auth/admin/set-user-password`, `GET /api/auth/admin/list-user-sessions`, `POST /api/auth/admin/revoke-user-session`, `POST /api/auth/admin/impersonate-user`, `POST /api/auth/admin/stop-impersonating`

---

## US-AUTH-ADMIN-001: Create User

**As a** business admin,
**I want to** create user accounts,
**so that** I can onboard users without requiring self-registration.

### Configuration

```yaml
auth:
  strategies:
    - type: emailAndPassword
  defaultRole: 'member'
```

### Acceptance Criteria

| ID     | Criterion                                            | E2E Spec                                | Status |
| ------ | ---------------------------------------------------- | --------------------------------------- | ------ |
| AC-001 | Admin can create user with email, name, and password | `API-AUTH-ADMIN-CREATE-USER-001`        | ✅     |
| AC-002 | Returns 201 Created with user data                   | `API-AUTH-ADMIN-CREATE-USER-002`        | ✅     |
| AC-003 | Returns 400 when email is missing                    | `API-AUTH-ADMIN-CREATE-USER-003`        | ✅     |
| AC-004 | Returns 400 when password is missing                 | `API-AUTH-ADMIN-CREATE-USER-004`        | ✅     |
| AC-005 | Returns 400 for invalid email format                 | `API-AUTH-ADMIN-CREATE-USER-005`        | ✅     |
| AC-006 | Returns 422 when email already exists                | `API-AUTH-ADMIN-CREATE-USER-006`        | ✅     |
| AC-007 | Returns 401 when not authenticated                   | `API-AUTH-ADMIN-CREATE-USER-007`        | ✅     |
| AC-008 | Returns 403 when user is not admin                   | `API-AUTH-ADMIN-CREATE-USER-008`        | ✅     |
| AC-009 | Can set initial role for created user                | `API-AUTH-ADMIN-CREATE-USER-009`        | ✅     |
| AC-010 | Can set emailVerified status on creation             | `API-AUTH-ADMIN-CREATE-USER-010`        | ✅     |
| AC-011 | Admin creates new user account (regression)          | `API-AUTH-ADMIN-CREATE-USER-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/admin/create-user/post.spec.ts`

---

## US-AUTH-ADMIN-002: List Users

**As a** business admin,
**I want to** list all users,
**so that** I can view and manage the user base.

### Acceptance Criteria

| ID     | Criterion                                    | E2E Spec                               | Status |
| ------ | -------------------------------------------- | -------------------------------------- | ------ |
| AC-001 | Returns paginated list of users              | `API-AUTH-ADMIN-LIST-USERS-001`        | ✅     |
| AC-002 | Supports limit and offset parameters         | `API-AUTH-ADMIN-LIST-USERS-002`        | ✅     |
| AC-003 | Returns user count metadata                  | `API-AUTH-ADMIN-LIST-USERS-003`        | ✅     |
| AC-004 | Each user includes id, email, name, role     | `API-AUTH-ADMIN-LIST-USERS-004`        | ✅     |
| AC-005 | Returns 401 when not authenticated           | `API-AUTH-ADMIN-LIST-USERS-005`        | ✅     |
| AC-006 | Returns 403 when user is not admin           | `API-AUTH-ADMIN-LIST-USERS-006`        | ✅     |
| AC-007 | Supports search/filter by email or name      | `API-AUTH-ADMIN-LIST-USERS-007`        | ✅     |
| AC-008 | Admin views paginated user list (regression) | `API-AUTH-ADMIN-LIST-USERS-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/admin/list-users/get.spec.ts`

---

## US-AUTH-ADMIN-003: Get User Details

**As a** business admin,
**I want to** view detailed user information,
**so that** I can manage individual user accounts.

### Acceptance Criteria

| ID     | Criterion                                       | E2E Spec                             | Status |
| ------ | ----------------------------------------------- | ------------------------------------ | ------ |
| AC-001 | Returns full user details for valid user ID     | `API-AUTH-ADMIN-GET-USER-001`        | ✅     |
| AC-002 | Includes user role and permissions              | `API-AUTH-ADMIN-GET-USER-002`        | ✅     |
| AC-003 | Includes account status (banned, emailVerified) | `API-AUTH-ADMIN-GET-USER-003`        | ✅     |
| AC-004 | Returns 404 for non-existent user               | `API-AUTH-ADMIN-GET-USER-004`        | ✅     |
| AC-005 | Returns 401 when not authenticated              | `API-AUTH-ADMIN-GET-USER-005`        | ✅     |
| AC-006 | Returns 403 when user is not admin              | `API-AUTH-ADMIN-GET-USER-006`        | ✅     |
| AC-007 | Admin views user details (regression)           | `API-AUTH-ADMIN-GET-USER-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/admin/get-user/get.spec.ts`

---

## US-AUTH-ADMIN-004: Set User Role

**As a** business admin,
**I want to** change user roles,
**so that** I can manage user permissions and access levels.

### Acceptance Criteria

| ID     | Criterion                             | E2E Spec                             | Status |
| ------ | ------------------------------------- | ------------------------------------ | ------ |
| AC-001 | Admin can set user role to valid role | `API-AUTH-ADMIN-SET-ROLE-001`        | ✅     |
| AC-002 | Returns updated user with new role    | `API-AUTH-ADMIN-SET-ROLE-002`        | ✅     |
| AC-003 | Returns 400 when role is invalid      | `API-AUTH-ADMIN-SET-ROLE-003`        | ✅     |
| AC-004 | Returns 400 when userId is missing    | `API-AUTH-ADMIN-SET-ROLE-004`        | ✅     |
| AC-005 | Returns 404 for non-existent user     | `API-AUTH-ADMIN-SET-ROLE-005`        | ✅     |
| AC-006 | Returns 401 when not authenticated    | `API-AUTH-ADMIN-SET-ROLE-006`        | ✅     |
| AC-007 | Returns 403 when user is not admin    | `API-AUTH-ADMIN-SET-ROLE-007`        | ✅     |
| AC-008 | Cannot set role higher than own role  | `API-AUTH-ADMIN-SET-ROLE-008`        | ✅     |
| AC-009 | Admin changes user role (regression)  | `API-AUTH-ADMIN-SET-ROLE-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/admin/set-role/post.spec.ts`

---

## US-AUTH-ADMIN-005: Set User Password

**As a** business admin,
**I want to** reset user passwords,
**so that** I can help users who are locked out of their accounts.

### Acceptance Criteria

| ID     | Criterion                               | E2E Spec                                      | Status |
| ------ | --------------------------------------- | --------------------------------------------- | ------ |
| AC-001 | Admin can set new password for user     | `API-AUTH-ADMIN-SET-USER-PASSWORD-001`        | ✅     |
| AC-002 | Returns 200 OK on success               | `API-AUTH-ADMIN-SET-USER-PASSWORD-002`        | ✅     |
| AC-003 | Returns 400 when newPassword is missing | `API-AUTH-ADMIN-SET-USER-PASSWORD-003`        | ✅     |
| AC-004 | Returns 400 when password is too short  | `API-AUTH-ADMIN-SET-USER-PASSWORD-004`        | ✅     |
| AC-005 | Returns 404 for non-existent user       | `API-AUTH-ADMIN-SET-USER-PASSWORD-005`        | ✅     |
| AC-006 | Returns 401 when not authenticated      | `API-AUTH-ADMIN-SET-USER-PASSWORD-006`        | ✅     |
| AC-007 | Returns 403 when user is not admin      | `API-AUTH-ADMIN-SET-USER-PASSWORD-007`        | ✅     |
| AC-008 | Admin resets user password (regression) | `API-AUTH-ADMIN-SET-USER-PASSWORD-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/admin/set-user-password/post.spec.ts`

---

## US-AUTH-ADMIN-006: List User Sessions

**As a** business admin,
**I want to** view a user's active sessions,
**so that** I can monitor and manage user access.

### Acceptance Criteria

| ID     | Criterion                                          | E2E Spec                                       | Status |
| ------ | -------------------------------------------------- | ---------------------------------------------- | ------ |
| AC-001 | Returns list of active sessions for specified user | `API-AUTH-ADMIN-LIST-USER-SESSIONS-001`        | ✅     |
| AC-002 | Each session includes device/browser information   | `API-AUTH-ADMIN-LIST-USER-SESSIONS-002`        | ✅     |
| AC-003 | Each session includes createdAt and expiresAt      | `API-AUTH-ADMIN-LIST-USER-SESSIONS-003`        | ✅     |
| AC-004 | Returns 400 when userId is missing                 | `API-AUTH-ADMIN-LIST-USER-SESSIONS-004`        | ✅     |
| AC-005 | Returns 404 for non-existent user                  | `API-AUTH-ADMIN-LIST-USER-SESSIONS-005`        | ✅     |
| AC-006 | Returns 401 when not authenticated                 | `API-AUTH-ADMIN-LIST-USER-SESSIONS-006`        | ✅     |
| AC-007 | Returns 403 when user is not admin                 | `API-AUTH-ADMIN-LIST-USER-SESSIONS-007`        | ✅     |
| AC-008 | Admin views user sessions (regression)             | `API-AUTH-ADMIN-LIST-USER-SESSIONS-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/admin/list-user-sessions/get.spec.ts`

---

## US-AUTH-ADMIN-007: Revoke User Session

**As a** business admin,
**I want to** revoke specific user sessions,
**so that** I can force logout from suspicious or compromised sessions.

### Acceptance Criteria

| ID     | Criterion                                | E2E Spec                                        | Status |
| ------ | ---------------------------------------- | ----------------------------------------------- | ------ |
| AC-001 | Admin can revoke specific user session   | `API-AUTH-ADMIN-REVOKE-USER-SESSION-001`        | ✅     |
| AC-002 | Returns 200 OK on successful revocation  | `API-AUTH-ADMIN-REVOKE-USER-SESSION-002`        | ✅     |
| AC-003 | Returns 400 when sessionToken is missing | `API-AUTH-ADMIN-REVOKE-USER-SESSION-003`        | ✅     |
| AC-004 | Returns 404 for non-existent session     | `API-AUTH-ADMIN-REVOKE-USER-SESSION-004`        | ✅     |
| AC-005 | Returns 401 when not authenticated       | `API-AUTH-ADMIN-REVOKE-USER-SESSION-005`        | ✅     |
| AC-006 | Returns 403 when user is not admin       | `API-AUTH-ADMIN-REVOKE-USER-SESSION-006`        | ✅     |
| AC-007 | Revoked session is immediately invalid   | `API-AUTH-ADMIN-REVOKE-USER-SESSION-007`        | ✅     |
| AC-008 | Can revoke multiple sessions in batch    | `API-AUTH-ADMIN-REVOKE-USER-SESSION-008`        | ✅     |
| AC-009 | Admin revokes user session (regression)  | `API-AUTH-ADMIN-REVOKE-USER-SESSION-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/admin/revoke-user-session/post.spec.ts`

---

## US-AUTH-ADMIN-008: Impersonate User

**As a** business admin,
**I want to** impersonate users,
**so that** I can troubleshoot issues by seeing the application as that user.

### Configuration

```yaml
auth:
  strategies:
    - type: emailAndPassword
# Note: Impersonation settings (e.g., allowImpersonatingAdmins) are
# configured at the Better Auth server level, not in the AppSchema.
```

### Acceptance Criteria

| ID     | Criterion                                                  | E2E Spec                                     | Status |
| ------ | ---------------------------------------------------------- | -------------------------------------------- | ------ |
| AC-001 | Admin can start impersonation session                      | `API-AUTH-ADMIN-IMPERSONATE-USER-001`        | ✅     |
| AC-002 | Returns impersonation session token                        | `API-AUTH-ADMIN-IMPERSONATE-USER-002`        | ✅     |
| AC-003 | Impersonation session has limited duration                 | `API-AUTH-ADMIN-IMPERSONATE-USER-003`        | ✅     |
| AC-004 | Returns 404 for non-existent user                          | `API-AUTH-ADMIN-IMPERSONATE-USER-004`        | ✅     |
| AC-005 | Returns 401 when not authenticated                         | `API-AUTH-ADMIN-IMPERSONATE-USER-005`        | ✅     |
| AC-006 | Returns 403 when trying to impersonate admin (if disabled) | `API-AUTH-ADMIN-IMPERSONATE-USER-006`        | ✅     |
| AC-007 | Admin completes impersonation workflow (regression)        | `API-AUTH-ADMIN-IMPERSONATE-USER-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/admin/impersonate-user/post.spec.ts`

---

## US-AUTH-ADMIN-009: Stop Impersonating

**As a** business admin,
**I want to** end impersonation sessions,
**so that** I can return to my own account.

### Acceptance Criteria

| ID     | Criterion                                              | E2E Spec                                       | Status |
| ------ | ------------------------------------------------------ | ---------------------------------------------- | ------ |
| AC-001 | Admin can stop impersonation and return to own session | `API-AUTH-ADMIN-STOP-IMPERSONATING-001`        | ✅     |
| AC-002 | Returns original admin session                         | `API-AUTH-ADMIN-STOP-IMPERSONATING-002`        | ✅     |
| AC-003 | Returns 400 when not currently impersonating           | `API-AUTH-ADMIN-STOP-IMPERSONATING-003`        | ✅     |
| AC-004 | Returns 401 when not authenticated                     | `API-AUTH-ADMIN-STOP-IMPERSONATING-004`        | ✅     |
| AC-005 | Impersonation session is invalidated                   | `API-AUTH-ADMIN-STOP-IMPERSONATING-005`        | ✅     |
| AC-006 | Admin stops impersonating user (regression)            | `API-AUTH-ADMIN-STOP-IMPERSONATING-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/admin/stop-impersonating/post.spec.ts`

---

## US-AUTH-ADMIN-010: Default Role Configuration

**As a** business admin,
**I want to** have new users assigned a default role,
**so that** all users get appropriate permissions when created.

### Configuration

```yaml
auth:
  strategies:
    - type: emailAndPassword
  defaultRole: 'member' # Default role assigned to new users
```

### Acceptance Criteria

| ID     | Criterion                                           | E2E Spec                                     | Status |
| ------ | --------------------------------------------------- | -------------------------------------------- | ------ |
| AC-001 | New users are assigned configured default role      | `API-AUTH-ADMIN-OPT-DEFAULT-ROLE-001`        | ✅     |
| AC-002 | Falls back to 'user' when defaultRole not specified | `API-AUTH-ADMIN-OPT-DEFAULT-ROLE-002`        | ✅     |
| AC-003 | Admin default role configuration works (regression) | `API-AUTH-ADMIN-OPT-DEFAULT-ROLE-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/admin/options/default-role.spec.ts`

---

## US-AUTH-ADMIN-011: Admin Plugin Disabled Behavior

**As a** business admin,
**I want to** have admin endpoints return 404 when the admin plugin is disabled,
**so that** unauthorized users cannot discover admin functionality.

### Configuration

```yaml
auth:
  strategies:
    - type: emailAndPassword
# Note: Admin features are always enabled when auth is configured.
# Disabling admin endpoints is handled at the server level.
```

### Acceptance Criteria

| ID     | Criterion                                             | E2E Spec                           | Status |
| ------ | ----------------------------------------------------- | ---------------------------------- | ------ |
| AC-001 | List users endpoint returns 404 when plugin disabled  | `API-AUTH-ADMIN-PLUGIN-001`        | ✅     |
| AC-002 | Get user endpoint returns 404 when plugin disabled    | `API-AUTH-ADMIN-PLUGIN-002`        | ✅     |
| AC-003 | Ban user endpoint returns 404 when plugin disabled    | `API-AUTH-ADMIN-PLUGIN-003`        | ✅     |
| AC-004 | Set role endpoint returns 404 when plugin disabled    | `API-AUTH-ADMIN-PLUGIN-004`        | ✅     |
| AC-005 | All admin endpoints hidden when disabled (regression) | `API-AUTH-ADMIN-PLUGIN-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/admin/plugin-disabled.spec.ts`

---

## Regression Tests

| Spec ID                                         | Workflow                               | Status |
| ----------------------------------------------- | -------------------------------------- | ------ |
| `API-AUTH-ADMIN-CREATE-USER-REGRESSION`         | Admin creates new user account         | `[x]`  |
| `API-AUTH-ADMIN-LIST-USERS-REGRESSION`          | Admin views paginated user list        | `[x]`  |
| `API-AUTH-ADMIN-GET-USER-REGRESSION`            | Admin views user details               | `[x]`  |
| `API-AUTH-ADMIN-SET-ROLE-REGRESSION`            | Admin changes user role                | `[x]`  |
| `API-AUTH-ADMIN-SET-USER-PASSWORD-REGRESSION`   | Admin resets user password             | `[x]`  |
| `API-AUTH-ADMIN-LIST-USER-SESSIONS-REGRESSION`  | Admin views user sessions              | `[x]`  |
| `API-AUTH-ADMIN-REVOKE-USER-SESSION-REGRESSION` | Admin revokes user session             | `[x]`  |
| `API-AUTH-ADMIN-IMPERSONATE-USER-REGRESSION`    | Admin completes impersonation workflow | `[x]`  |
| `API-AUTH-ADMIN-STOP-IMPERSONATING-REGRESSION`  | Admin stops impersonating user         | `[x]`  |

---

## Coverage Summary

| User Story        | Title               | Spec Count            | Status   |
| ----------------- | ------------------- | --------------------- | -------- |
| US-AUTH-ADMIN-001 | Create User         | 10                    | Complete |
| US-AUTH-ADMIN-002 | List Users          | 7                     | Complete |
| US-AUTH-ADMIN-003 | Get User Details    | 6                     | Complete |
| US-AUTH-ADMIN-004 | Set User Role       | 8                     | Complete |
| US-AUTH-ADMIN-005 | Set User Password   | 7                     | Complete |
| US-AUTH-ADMIN-006 | List User Sessions  | 7                     | Complete |
| US-AUTH-ADMIN-007 | Revoke User Session | 8                     | Complete |
| US-AUTH-ADMIN-008 | Impersonate User    | 6                     | Complete |
| US-AUTH-ADMIN-009 | Stop Impersonating  | 5                     | Complete |
| **Total**         |                     | **64 + 9 regression** |          |
