# Email & Password Authentication

> **Feature Area**: Authentication
> **Schema**: `src/domain/models/app/auth/`
> **API Routes**: `POST /api/auth/sign-up/email`, `POST /api/auth/sign-in/email`

---

## US-AUTH-EMAIL-001: User Registration

**As a** developer building a Sovrium app,
**I want to** enable email/password registration for my users,
**so that** they can create accounts and access my application securely.

### Configuration

```yaml
auth:
  emailAndPassword:
    minPasswordLength: 8
```

### Acceptance Criteria

| ID     | Criterion                                                                   | E2E Spec                            | Status |
| ------ | --------------------------------------------------------------------------- | ----------------------------------- | ------ |
| AC-001 | User receives 200 OK with user data and session token on valid registration | `API-AUTH-SIGN-UP-EMAIL-001`        | ✅     |
| AC-002 | Registration fails with 422 when name is missing                            | `API-AUTH-SIGN-UP-EMAIL-002`        | ✅     |
| AC-003 | Registration fails with 400 when email is missing                           | `API-AUTH-SIGN-UP-EMAIL-003`        | ✅     |
| AC-004 | Registration fails when password is missing                                 | `API-AUTH-SIGN-UP-EMAIL-004`        | ✅     |
| AC-005 | Registration fails with 400 for invalid email format                        | `API-AUTH-SIGN-UP-EMAIL-005`        | ✅     |
| AC-006 | Registration fails with 400 when password is too short                      | `API-AUTH-SIGN-UP-EMAIL-006`        | ✅     |
| AC-007 | Registration fails with 422 when email already exists                       | `API-AUTH-SIGN-UP-EMAIL-007`        | ✅     |
| AC-008 | Email matching is case-insensitive (returns 422 for duplicate)              | `API-AUTH-SIGN-UP-EMAIL-008`        | ✅     |
| AC-009 | XSS payloads in name field are sanitized                                    | `API-AUTH-SIGN-UP-EMAIL-009`        | ✅     |
| AC-010 | Unicode characters in name are preserved correctly                          | `API-AUTH-SIGN-UP-EMAIL-010`        | ✅     |
| AC-011 | User completes full sign-up workflow (regression)                           | `API-AUTH-SIGN-UP-EMAIL-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/sign-up/email/post.spec.ts`

---

## US-AUTH-EMAIL-002: Email Verification

**As a** developer,
**I want to** require email verification before users can sign in,
**so that** I can ensure email addresses are valid and reduce spam accounts.

### Configuration

```yaml
auth:
  emailAndPassword:
    requireEmailVerification: true
```

### Acceptance Criteria

| ID     | Criterion                                                           | E2E Spec                     | Status |
| ------ | ------------------------------------------------------------------- | ---------------------------- | ------ |
| AC-001 | Verification email is sent when requireEmailVerification is enabled | `API-AUTH-SIGN-UP-EMAIL-011` | ✅     |
| AC-002 | Sign-in is blocked before email is verified                         | `API-AUTH-SIGN-UP-EMAIL-012` | ✅     |
| AC-003 | Sign-in is allowed after email is verified                          | `API-AUTH-SIGN-UP-EMAIL-013` | ✅     |
| AC-004 | Protected resources are blocked without email verification          | `API-AUTH-SIGN-UP-EMAIL-014` | ✅     |
| AC-005 | Protected resources are accessible after email verification         | `API-AUTH-SIGN-UP-EMAIL-015` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/sign-up/email/post.spec.ts`

---

## US-AUTH-EMAIL-003: User Sign-In

**As a** developer,
**I want to** authenticate users with email and password,
**so that** returning users can access their accounts securely.

### Configuration

```yaml
auth:
  emailAndPassword: true
```

### Acceptance Criteria

| ID     | Criterion                                                              | E2E Spec                            | Status |
| ------ | ---------------------------------------------------------------------- | ----------------------------------- | ------ |
| AC-001 | User receives 200 OK with session token and user data on valid sign-in | `API-AUTH-SIGN-IN-EMAIL-001`        | ✅     |
| AC-002 | Sign-in fails with 400 when email is missing                           | `API-AUTH-SIGN-IN-EMAIL-002`        | ✅     |
| AC-003 | Sign-in fails with 400 when password is missing                        | `API-AUTH-SIGN-IN-EMAIL-003`        | ✅     |
| AC-004 | Sign-in fails with 400 for invalid email format                        | `API-AUTH-SIGN-IN-EMAIL-004`        | ✅     |
| AC-005 | Sign-in fails with 401 for wrong password                              | `API-AUTH-SIGN-IN-EMAIL-005`        | ✅     |
| AC-006 | Sign-in fails with 401 for non-existent user                           | `API-AUTH-SIGN-IN-EMAIL-006`        | ✅     |
| AC-007 | Email matching is case-insensitive                                     | `API-AUTH-SIGN-IN-EMAIL-007`        | ✅     |
| AC-008 | RememberMe option extends session duration                             | `API-AUTH-SIGN-IN-EMAIL-008`        | ✅     |
| AC-009 | User completes full sign-in workflow (regression)                      | `API-AUTH-SIGN-IN-EMAIL-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/sign-in/email/post.spec.ts`

---

## US-AUTH-EMAIL-004: Change Email Address

**As a** developer,
**I want to** allow users to change their email address,
**so that** they can update their login credentials when needed.

### Acceptance Criteria

| ID     | Criterion                                         | E2E Spec                           | Status |
| ------ | ------------------------------------------------- | ---------------------------------- | ------ |
| AC-001 | Returns 200 OK on successful email change         | `API-AUTH-CHANGE-EMAIL-001`        | ✅     |
| AC-002 | Returns 400 when new email is missing             | `API-AUTH-CHANGE-EMAIL-002`        | ✅     |
| AC-003 | Returns 400 for invalid email format              | `API-AUTH-CHANGE-EMAIL-003`        | ✅     |
| AC-004 | Returns 401 when not authenticated                | `API-AUTH-CHANGE-EMAIL-004`        | ✅     |
| AC-005 | Returns 409 when email is already in use          | `API-AUTH-CHANGE-EMAIL-005`        | ✅     |
| AC-006 | Handles same email gracefully                     | `API-AUTH-CHANGE-EMAIL-006`        | ✅     |
| AC-007 | Returns 409 for case-insensitive duplicate        | `API-AUTH-CHANGE-EMAIL-007`        | ✅     |
| AC-008 | User completes email change workflow (regression) | `API-AUTH-CHANGE-EMAIL-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/change-email/post.spec.ts`

---

## US-AUTH-EMAIL-005: Update User Profile

**As a** developer,
**I want to** allow users to update their profile information,
**so that** they can keep their account details current.

### Acceptance Criteria

| ID     | Criterion                                           | E2E Spec                          | Status |
| ------ | --------------------------------------------------- | --------------------------------- | ------ |
| AC-001 | Returns 200 OK on successful profile update         | `API-AUTH-UPDATE-USER-001`        | ✅     |
| AC-002 | Returns 200 OK when updating name                   | `API-AUTH-UPDATE-USER-002`        | ✅     |
| AC-003 | Returns 401 when not authenticated                  | `API-AUTH-UPDATE-USER-003`        | ✅     |
| AC-004 | Accepts name with special characters                | `API-AUTH-UPDATE-USER-004`        | ✅     |
| AC-005 | Preserves Unicode characters in name                | `API-AUTH-UPDATE-USER-005`        | ✅     |
| AC-006 | Allows removing optional fields                     | `API-AUTH-UPDATE-USER-006`        | ✅     |
| AC-007 | User completes profile update workflow (regression) | `API-AUTH-UPDATE-USER-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/update-user/post.spec.ts`

---

## US-AUTH-EMAIL-006: Verify Email Address

**As a** developer,
**I want to** allow users to verify their email address,
**so that** I can confirm email ownership before granting access.

### Acceptance Criteria

| ID     | Criterion                                       | E2E Spec                           | Status |
| ------ | ----------------------------------------------- | ---------------------------------- | ------ |
| AC-001 | Returns 200 OK on valid verification token      | `API-AUTH-VERIFY-EMAIL-001`        | ✅     |
| AC-002 | Returns 400 for invalid or expired token        | `API-AUTH-VERIFY-EMAIL-002`        | ✅     |
| AC-003 | Returns 401 for already verified email          | `API-AUTH-VERIFY-EMAIL-003`        | ✅     |
| AC-004 | Returns 401 for non-existent user token         | `API-AUTH-VERIFY-EMAIL-004`        | ✅     |
| AC-005 | Returns 200 OK when email verified successfully | `API-AUTH-VERIFY-EMAIL-005`        | ✅     |
| AC-006 | Handles already verified email gracefully       | `API-AUTH-VERIFY-EMAIL-006`        | ✅     |
| AC-007 | User completes email verification (regression)  | `API-AUTH-VERIFY-EMAIL-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/verify-email/get.spec.ts`

---

## US-AUTH-EMAIL-007: Send Verification Email

**As a** developer,
**I want to** allow users to request a new verification email,
**so that** they can verify their email if the original email was lost.

### Acceptance Criteria

| ID     | Criterion                                               | E2E Spec                                      | Status |
| ------ | ------------------------------------------------------- | --------------------------------------------- | ------ |
| AC-001 | Returns 200 OK on successful email send                 | `API-AUTH-SEND-VERIFICATION-EMAIL-001`        | ✅     |
| AC-002 | Returns 400 when callbackURL is missing                 | `API-AUTH-SEND-VERIFICATION-EMAIL-002`        | ✅     |
| AC-003 | Returns 401 when not authenticated                      | `API-AUTH-SEND-VERIFICATION-EMAIL-003`        | ✅     |
| AC-004 | Handles already verified email gracefully               | `API-AUTH-SEND-VERIFICATION-EMAIL-004`        | ✅     |
| AC-005 | Includes verification link in email body                | `API-AUTH-SEND-VERIFICATION-EMAIL-005`        | ✅     |
| AC-006 | Returns 400 for invalid callbackURL format              | `API-AUTH-SEND-VERIFICATION-EMAIL-006`        | ✅     |
| AC-007 | User sends verification email successfully (regression) | `API-AUTH-SEND-VERIFICATION-EMAIL-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/send-verification-email/post.spec.ts`

---

## Regression Tests

| Spec ID                             | Workflow                             | Status |
| ----------------------------------- | ------------------------------------ | ------ |
| `API-AUTH-SIGN-UP-EMAIL-REGRESSION` | User completes full sign-up workflow | `[x]`  |
| `API-AUTH-SIGN-IN-EMAIL-REGRESSION` | User completes full sign-in workflow | `[x]`  |

---

## Coverage Summary

| User Story        | Title                   | Spec Count | Status   |
| ----------------- | ----------------------- | ---------- | -------- |
| US-AUTH-EMAIL-001 | User Registration       | 11         | Complete |
| US-AUTH-EMAIL-002 | Email Verification      | 5          | Complete |
| US-AUTH-EMAIL-003 | User Sign-In            | 9          | Complete |
| US-AUTH-EMAIL-004 | Change Email Address    | 8          | Complete |
| US-AUTH-EMAIL-005 | Update User Profile     | 7          | Complete |
| US-AUTH-EMAIL-006 | Verify Email Address    | 4          | Complete |
| US-AUTH-EMAIL-007 | Send Verification Email | 7          | Complete |
| **Total**         |                         | **51**     |          |
