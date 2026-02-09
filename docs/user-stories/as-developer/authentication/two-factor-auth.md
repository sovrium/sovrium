# Two-Factor Authentication (2FA)

> **Feature Area**: Authentication
> **Schema**: `src/domain/models/app/auth/`
> **API Routes**: `POST /api/auth/two-factor/enable`, `POST /api/auth/two-factor/verify`, `POST /api/auth/two-factor/disable`

---

## US-AUTH-2FA-001: Enable Two-Factor Authentication

**As a** developer,
**I want to** offer TOTP-based two-factor authentication,
**so that** my users can add an extra layer of security to their accounts.

### Configuration

```yaml
auth:
  plugins:
    twoFactor:
      enabled: true
      issuer: 'My App'
      backupCodes: true
```

### Acceptance Criteria

| ID     | Criterion                                               | E2E Spec                                | Status |
| ------ | ------------------------------------------------------- | --------------------------------------- | ------ |
| AC-001 | Authenticated user receives TOTP secret and QR code URL | `API-AUTH-TWO-FACTOR-ENABLE-001`        | ✅     |
| AC-002 | Backup codes are included when configured               | `API-AUTH-TWO-FACTOR-ENABLE-002`        | ✅     |
| AC-003 | Returns 401 when user is not authenticated              | `API-AUTH-TWO-FACTOR-ENABLE-003`        | ✅     |
| AC-004 | User can regenerate TOTP setup                          | `API-AUTH-TWO-FACTOR-ENABLE-004`        | ✅     |
| AC-005 | Returns 400 when 2FA plugin is not enabled              | `API-AUTH-TWO-FACTOR-ENABLE-005`        | ✅     |
| AC-006 | User completes 2FA enable workflow (regression)         | `API-AUTH-TWO-FACTOR-ENABLE-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/two-factor/enable/post.spec.ts`

---

## US-AUTH-2FA-002: Verify Two-Factor Code

**As a** developer,
**I want to** verify TOTP codes during sign-in,
**so that** I can confirm the user has access to their authenticator app.

### Acceptance Criteria

| ID     | Criterion                                           | E2E Spec                                | Status |
| ------ | --------------------------------------------------- | --------------------------------------- | ------ |
| AC-001 | Valid TOTP code is verified successfully            | `API-AUTH-TWO-FACTOR-VERIFY-001`        | ✅     |
| AC-002 | Invalid TOTP code is rejected                       | `API-AUTH-TWO-FACTOR-VERIFY-002`        | ✅     |
| AC-003 | Backup code is accepted when enabled                | `API-AUTH-TWO-FACTOR-VERIFY-003`        | ✅     |
| AC-004 | Returns 401 when user is not authenticated          | `API-AUTH-TWO-FACTOR-VERIFY-004`        | ✅     |
| AC-005 | Returns 400 when code is missing                    | `API-AUTH-TWO-FACTOR-VERIFY-005`        | ✅     |
| AC-006 | Returns 404 when twoFactor plugin is not configured | `API-AUTH-TWO-FACTOR-VERIFY-006`        | ✅     |
| AC-007 | User completes 2FA verify workflow (regression)     | `API-AUTH-TWO-FACTOR-VERIFY-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/two-factor/verify/post.spec.ts`

---

## US-AUTH-2FA-003: Disable Two-Factor Authentication

**As a** developer,
**I want to** allow users to disable 2FA,
**so that** they can manage their security preferences.

### Acceptance Criteria

| ID     | Criterion                                           | E2E Spec                                 | Status |
| ------ | --------------------------------------------------- | ---------------------------------------- | ------ |
| AC-001 | 2FA is disabled with valid password confirmation    | `API-AUTH-TWO-FACTOR-DISABLE-001`        | ✅     |
| AC-002 | Returns 401 with incorrect password                 | `API-AUTH-TWO-FACTOR-DISABLE-002`        | ✅     |
| AC-003 | Returns 401 when user is not authenticated          | `API-AUTH-TWO-FACTOR-DISABLE-003`        | ✅     |
| AC-004 | Returns 400 when 2FA is not enabled for user        | `API-AUTH-TWO-FACTOR-DISABLE-004`        | ✅     |
| AC-005 | Returns 404 when twoFactor plugin is not configured | `API-AUTH-TWO-FACTOR-DISABLE-005`        | ✅     |
| AC-006 | User completes 2FA disable workflow (regression)    | `API-AUTH-TWO-FACTOR-DISABLE-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/two-factor/disable/post.spec.ts`

---

## Regression Tests

| Spec ID                                  | Workflow                                      | Status |
| ---------------------------------------- | --------------------------------------------- | ------ |
| `API-AUTH-TWO-FACTOR-ENABLE-REGRESSION`  | User completes full 2FA enable workflow       | `[x]`  |
| `API-AUTH-TWO-FACTOR-VERIFY-REGRESSION`  | User completes full 2FA verification workflow | `[x]`  |
| `API-AUTH-TWO-FACTOR-DISABLE-REGRESSION` | User completes full 2FA disable workflow      | `[x]`  |

---

## Coverage Summary

| User Story      | Title                             | Spec Count            | Status   |
| --------------- | --------------------------------- | --------------------- | -------- |
| US-AUTH-2FA-001 | Enable Two-Factor Authentication  | 5                     | Complete |
| US-AUTH-2FA-002 | Verify Two-Factor Code            | 6                     | Complete |
| US-AUTH-2FA-003 | Disable Two-Factor Authentication | 5                     | Complete |
| **Total**       |                                   | **16 + 3 regression** |          |
