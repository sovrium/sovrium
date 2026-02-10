# Magic Link Authentication

> **Feature Area**: Authentication
> **Schema**: `src/domain/models/app/auth/`
> **API Routes**: `POST /api/auth/magic-link/send`, `POST /api/auth/magic-link/verify`

---

## US-AUTH-MAGIC-001: Send Magic Link

**As a** developer,
**I want to** offer passwordless authentication via email links,
**so that** my users can sign in without remembering passwords.

### Configuration

```yaml
auth:
  strategies:
    - type: magicLink
      expirationMinutes: 15
```

### Acceptance Criteria

| ID     | Criterion                                                        | E2E Spec                              | Status |
| ------ | ---------------------------------------------------------------- | ------------------------------------- | ------ |
| AC-001 | Magic link email is sent to registered user with custom template | `API-AUTH-MAGIC-LINK-SEND-001`        | ✅     |
| AC-002 | Magic link is sent to unregistered user for signup               | `API-AUTH-MAGIC-LINK-SEND-002`        | ✅     |
| AC-003 | Returns 400 when email is missing                                | `API-AUTH-MAGIC-LINK-SEND-003`        | ✅     |
| AC-004 | Returns 400 with invalid email format                            | `API-AUTH-MAGIC-LINK-SEND-004`        | ✅     |
| AC-005 | Returns 400 when magic link plugin is not enabled                | `API-AUTH-MAGIC-LINK-SEND-005`        | ✅     |
| AC-006 | User completes magic link send workflow (regression)             | `API-AUTH-MAGIC-LINK-SEND-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/magic-link/send/post.spec.ts`

---

## US-AUTH-MAGIC-002: Verify Magic Link

**As a** developer,
**I want to** authenticate users when they click a magic link,
**so that** they can access their accounts without a password.

### Acceptance Criteria

| ID     | Criterion                                                     | E2E Spec                                | Status |
| ------ | ------------------------------------------------------------- | --------------------------------------- | ------ |
| AC-001 | User is authenticated with valid magic link token             | `API-AUTH-MAGIC-LINK-VERIFY-001`        | ✅     |
| AC-002 | New account is created for unregistered user with valid token | `API-AUTH-MAGIC-LINK-VERIFY-002`        | ✅     |
| AC-003 | Returns 400 with invalid token                                | `API-AUTH-MAGIC-LINK-VERIFY-003`        | ✅     |
| AC-004 | Returns 400 with expired token                                | `API-AUTH-MAGIC-LINK-VERIFY-004`        | ✅     |
| AC-005 | Returns 400 when token is missing                             | `API-AUTH-MAGIC-LINK-VERIFY-005`        | ✅     |
| AC-006 | User completes magic link verify workflow (regression)        | `API-AUTH-MAGIC-LINK-VERIFY-REGRESSION` | ✅     |

### Implementation References

---

## Regression Tests

| Spec ID                                 | Workflow                                             | Status |
| --------------------------------------- | ---------------------------------------------------- | ------ |
| `API-AUTH-MAGIC-LINK-SEND-REGRESSION`   | User completes full magic link send workflow         | `[x]`  |
| `API-AUTH-MAGIC-LINK-VERIFY-REGRESSION` | User completes full magic link verification workflow | `[x]`  |

---

## Coverage Summary

| User Story        | Title             | Spec Count            | Status   |
| ----------------- | ----------------- | --------------------- | -------- |
| US-AUTH-MAGIC-001 | Send Magic Link   | 5                     | Complete |
| US-AUTH-MAGIC-002 | Verify Magic Link | 5                     | Complete |
| **Total**         |                   | **10 + 2 regression** |          |
