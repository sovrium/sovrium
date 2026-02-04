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
    enabled: true
    minPasswordLength: 8
```

### Acceptance Criteria

| ID     | Criterion                                                                   | E2E Spec                     |
| ------ | --------------------------------------------------------------------------- | ---------------------------- |
| AC-001 | User receives 200 OK with user data and session token on valid registration | `API-AUTH-SIGN-UP-EMAIL-001` |
| AC-002 | Registration fails with 422 when name is missing                            | `API-AUTH-SIGN-UP-EMAIL-002` |
| AC-003 | Registration fails with 400 when email is missing                           | `API-AUTH-SIGN-UP-EMAIL-003` |
| AC-004 | Registration fails when password is missing                                 | `API-AUTH-SIGN-UP-EMAIL-004` |
| AC-005 | Registration fails with 400 for invalid email format                        | `API-AUTH-SIGN-UP-EMAIL-005` |
| AC-006 | Registration fails with 400 when password is too short                      | `API-AUTH-SIGN-UP-EMAIL-006` |
| AC-007 | Registration fails with 422 when email already exists                       | `API-AUTH-SIGN-UP-EMAIL-007` |
| AC-008 | Email matching is case-insensitive (returns 422 for duplicate)              | `API-AUTH-SIGN-UP-EMAIL-008` |
| AC-009 | XSS payloads in name field are sanitized                                    | `API-AUTH-SIGN-UP-EMAIL-009` |
| AC-010 | Unicode characters in name are preserved correctly                          | `API-AUTH-SIGN-UP-EMAIL-010` |

### Implementation References

- **Schema**: `src/domain/models/app/auth/auth.ts`
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
    enabled: true
    requireEmailVerification: true
```

### Acceptance Criteria

| ID     | Criterion                                                           | E2E Spec                     |
| ------ | ------------------------------------------------------------------- | ---------------------------- |
| AC-001 | Verification email is sent when requireEmailVerification is enabled | `API-AUTH-SIGN-UP-EMAIL-011` |
| AC-002 | Sign-in is blocked before email is verified                         | `API-AUTH-SIGN-UP-EMAIL-012` |
| AC-003 | Sign-in is allowed after email is verified                          | `API-AUTH-SIGN-UP-EMAIL-013` |
| AC-004 | Protected resources are blocked without email verification          | `API-AUTH-SIGN-UP-EMAIL-014` |
| AC-005 | Protected resources are accessible after email verification         | `API-AUTH-SIGN-UP-EMAIL-015` |

### Implementation References

- **Schema**: `src/domain/models/app/auth/auth.ts`
- **E2E Spec**: `specs/api/auth/sign-up/email/post.spec.ts`

---

## US-AUTH-EMAIL-003: User Sign-In

**As a** developer,
**I want to** authenticate users with email and password,
**so that** returning users can access their accounts securely.

### Configuration

```yaml
auth:
  emailAndPassword:
    enabled: true
```

### Acceptance Criteria

| ID     | Criterion                                                              | E2E Spec                     |
| ------ | ---------------------------------------------------------------------- | ---------------------------- |
| AC-001 | User receives 200 OK with session token and user data on valid sign-in | `API-AUTH-SIGN-IN-EMAIL-001` |
| AC-002 | Sign-in fails with 400 when email is missing                           | `API-AUTH-SIGN-IN-EMAIL-002` |
| AC-003 | Sign-in fails with 400 when password is missing                        | `API-AUTH-SIGN-IN-EMAIL-003` |
| AC-004 | Sign-in fails with 400 for invalid email format                        | `API-AUTH-SIGN-IN-EMAIL-004` |
| AC-005 | Sign-in fails with 401 for wrong password                              | `API-AUTH-SIGN-IN-EMAIL-005` |
| AC-006 | Sign-in fails with 401 for non-existent user                           | `API-AUTH-SIGN-IN-EMAIL-006` |
| AC-007 | Email matching is case-insensitive                                     | `API-AUTH-SIGN-IN-EMAIL-007` |
| AC-008 | RememberMe option extends session duration                             | `API-AUTH-SIGN-IN-EMAIL-008` |

### Implementation References

- **Schema**: `src/domain/models/app/auth/auth.ts`
- **E2E Spec**: `specs/api/auth/sign-in/email/post.spec.ts`

---

## Regression Tests

| Spec ID                             | Workflow                             | Status |
| ----------------------------------- | ------------------------------------ | ------ |
| `API-AUTH-SIGN-UP-EMAIL-REGRESSION` | User completes full sign-up workflow | `[x]`  |
| `API-AUTH-SIGN-IN-EMAIL-REGRESSION` | User completes full sign-in workflow | `[x]`  |

---

## Coverage Summary

| User Story        | Title              | Spec Count            | Status   |
| ----------------- | ------------------ | --------------------- | -------- |
| US-AUTH-EMAIL-001 | User Registration  | 10                    | Complete |
| US-AUTH-EMAIL-002 | Email Verification | 5                     | Complete |
| US-AUTH-EMAIL-003 | User Sign-In       | 8                     | Complete |
| **Total**         |                    | **23 + 2 regression** |          |
