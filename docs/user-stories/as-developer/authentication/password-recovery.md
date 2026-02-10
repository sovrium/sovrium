# Password Recovery

> **Feature Area**: Authentication
> **Schema**: `src/domain/models/app/auth/`
> **API Routes**: `POST /api/auth/change-password`, `POST /api/auth/request-password-reset`, `POST /api/auth/reset-password`

---

## US-AUTH-PWD-001: Change Password

**As a** developer,
**I want to** allow authenticated users to change their password,
**so that** they can maintain account security.

### Configuration

```yaml
auth:
  strategies:
    - type: emailAndPassword
      minPasswordLength: 8
```

### Acceptance Criteria

| ID     | Criterion                                            | E2E Spec                              | Status |
| ------ | ---------------------------------------------------- | ------------------------------------- | ------ |
| AC-001 | Password is updated successfully with 200 OK         | `API-AUTH-CHANGE-PASSWORD-001`        | ✅     |
| AC-002 | New token is issued and other sessions are revoked   | `API-AUTH-CHANGE-PASSWORD-002`        | ✅     |
| AC-003 | Returns 400 without newPassword                      | `API-AUTH-CHANGE-PASSWORD-003`        | ✅     |
| AC-004 | Returns 400 without currentPassword                  | `API-AUTH-CHANGE-PASSWORD-004`        | ✅     |
| AC-005 | Returns 400 when new password is too short           | `API-AUTH-CHANGE-PASSWORD-005`        | ✅     |
| AC-006 | Returns 401 without authentication                   | `API-AUTH-CHANGE-PASSWORD-006`        | ✅     |
| AC-007 | Returns 401 with wrong current password              | `API-AUTH-CHANGE-PASSWORD-007`        | ✅     |
| AC-008 | Handles same password attempt appropriately          | `API-AUTH-CHANGE-PASSWORD-008`        | ✅     |
| AC-009 | User completes change-password workflow (regression) | `API-AUTH-CHANGE-PASSWORD-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/change-password/post.spec.ts`

---

## US-AUTH-PWD-002: Request Password Reset

**As a** developer,
**I want to** allow users to request a password reset email,
**so that** they can recover access to their accounts.

### Acceptance Criteria

| ID     | Criterion                                              | E2E Spec                                     | Status |
| ------ | ------------------------------------------------------ | -------------------------------------------- | ------ |
| AC-001 | Reset email is sent with custom template               | `API-AUTH-REQUEST-PASSWORD-RESET-001`        | ✅     |
| AC-002 | Returns 200 OK even for non-existent email (security)  | `API-AUTH-REQUEST-PASSWORD-RESET-002`        | ✅     |
| AC-003 | Returns 400 without email                              | `API-AUTH-REQUEST-PASSWORD-RESET-003`        | ✅     |
| AC-004 | Returns 400 with invalid email format                  | `API-AUTH-REQUEST-PASSWORD-RESET-004`        | ✅     |
| AC-005 | Email matching is case-insensitive                     | `API-AUTH-REQUEST-PASSWORD-RESET-005`        | ✅     |
| AC-006 | Old reset token is invalidated on new request          | `API-AUTH-REQUEST-PASSWORD-RESET-006`        | ✅     |
| AC-007 | RedirectTo URL is included in reset email              | `API-AUTH-REQUEST-PASSWORD-RESET-007`        | ✅     |
| AC-008 | User requests password reset successfully (regression) | `API-AUTH-REQUEST-PASSWORD-RESET-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/request-password-reset/post.spec.ts`

---

## US-AUTH-PWD-003: Reset Password

**As a** developer,
**I want to** allow users to set a new password using a reset token,
**so that** they can regain access to their accounts.

### Acceptance Criteria

| ID     | Criterion                                           | E2E Spec                             | Status |
| ------ | --------------------------------------------------- | ------------------------------------ | ------ |
| AC-001 | Password is updated with valid token                | `API-AUTH-RESET-PASSWORD-001`        | ✅     |
| AC-002 | Returns 400 without newPassword                     | `API-AUTH-RESET-PASSWORD-002`        | ✅     |
| AC-003 | Returns 400 when new password is too short          | `API-AUTH-RESET-PASSWORD-003`        | ✅     |
| AC-004 | Returns 401 with invalid token                      | `API-AUTH-RESET-PASSWORD-004`        | ✅     |
| AC-005 | Returns 401 with expired token                      | `API-AUTH-RESET-PASSWORD-005`        | ✅     |
| AC-006 | Returns 401 with already used token                 | `API-AUTH-RESET-PASSWORD-006`        | ✅     |
| AC-007 | Returns 400 without token                           | `API-AUTH-RESET-PASSWORD-007`        | ✅     |
| AC-008 | All sessions are revoked after password reset       | `API-AUTH-RESET-PASSWORD-008`        | ✅     |
| AC-009 | User completes password reset workflow (regression) | `API-AUTH-RESET-PASSWORD-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/reset-password/post.spec.ts`

---

## Regression Tests

| Spec ID                                      | Workflow                                            | Status |
| -------------------------------------------- | --------------------------------------------------- | ------ |
| `API-AUTH-CHANGE-PASSWORD-REGRESSION`        | User completes full change-password workflow        | `[x]`  |
| `API-AUTH-REQUEST-PASSWORD-RESET-REGRESSION` | User completes full request-password-reset workflow | `[x]`  |
| `API-AUTH-RESET-PASSWORD-REGRESSION`         | User completes full reset-password workflow         | `[x]`  |

---

## Coverage Summary

| User Story      | Title                  | Spec Count            | Status   |
| --------------- | ---------------------- | --------------------- | -------- |
| US-AUTH-PWD-001 | Change Password        | 8                     | Complete |
| US-AUTH-PWD-002 | Request Password Reset | 7                     | Complete |
| US-AUTH-PWD-003 | Reset Password         | 8                     | Complete |
| **Total**       |                        | **23 + 3 regression** |          |
