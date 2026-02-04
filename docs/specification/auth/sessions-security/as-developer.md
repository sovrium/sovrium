# Auth > Sessions & Security > As Developer

> **Domain**: auth
> **Feature Area**: sessions-security
> **Role**: Developer
> **Schema Path**: `src/domain/models/app/auth/`
> **Spec Path**: `specs/api/auth/`

---

## User Stories

### US-AUTH-SESSION-DEV-001: Configurable Session Duration

**Story**: As a developer, I want configurable session duration so that I can control how long users stay logged in.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                             | Spec Test                      | Schema                   | Status |
| ------ | ------------------------------------- | ------------------------------ | ------------------------ | ------ |
| AC-001 | Configures session expiration time    | `APP-AUTH-SESSION-CONFIG-001`  | `auth.session.expiresIn` | `[x]`  |
| AC-002 | Configures session refresh behavior   | `APP-AUTH-SESSION-CONFIG-002`  | `auth.session.updateAge` | `[x]`  |
| AC-003 | Session expires after configured time | `API-AUTH-SESSION-EXPIRE-001`  | `auth.session`           | `[x]`  |
| AC-004 | Session refreshes when accessed       | `API-AUTH-SESSION-REFRESH-001` | `auth.session`           | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/config.ts` `[x] Exists`
- **E2E Spec**: Session configuration tested via auth fixtures
- **Config**: Controlled via Better Auth session configuration

---

### US-AUTH-SESSION-DEV-002: Secure Session Handling

**Story**: As a developer, I want secure session handling (HttpOnly cookies, CSRF protection) so that sessions are safe.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                         | Spec Test                    | Schema | Status |
| ------ | --------------------------------- | ---------------------------- | ------ | ------ |
| AC-001 | Uses HttpOnly cookies for session | `API-AUTH-SECURE-COOKIE-001` | `auth` | `[x]`  |
| AC-002 | Uses Secure flag in production    | `API-AUTH-SECURE-COOKIE-002` | `auth` | `[x]`  |
| AC-003 | Validates CSRF token on mutations | `API-AUTH-CSRF-001`          | `auth` | `[x]`  |
| AC-004 | Sets SameSite cookie attribute    | `API-AUTH-SECURE-COOKIE-003` | `auth` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/config.ts` `[x] Exists`
- **E2E Spec**: Security features tested via Better Auth defaults
- **Implementation**: Better Auth handles secure cookie settings

---

### US-AUTH-SESSION-DEV-003: Force Logout All Sessions

**Story**: As a developer, I want to force logout all sessions for a user so that I can respond to security concerns.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                          | Spec Test                                | Schema       | Status |
| ------ | ---------------------------------- | ---------------------------------------- | ------------ | ------ |
| AC-001 | Revokes all user sessions          | `API-AUTH-ADMIN-REVOKE-USER-SESSION-001` | `auth.admin` | `[x]`  |
| AC-002 | Returns 401 for revoked sessions   | `API-AUTH-ADMIN-REVOKE-USER-SESSION-002` | `auth.admin` | `[x]`  |
| AC-003 | Returns 401 without authentication | `API-AUTH-ADMIN-REVOKE-USER-SESSION-003` | `auth.admin` | `[x]`  |
| AC-004 | Returns 403 for non-admin users    | `API-AUTH-ADMIN-REVOKE-USER-SESSION-004` | `auth.admin` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/plugins/admin.ts` `[x] Exists`
- **E2E Spec**: `specs/api/auth/admin/revoke-user-session/post.spec.ts` `[x] Exists`
- **API Route**: `/api/auth/admin/revoke-user-session` `[x] Implemented`

---

### US-AUTH-SESSION-DEV-004: Two-Factor Authentication Support

**Story**: As a developer, I want two-factor authentication (TOTP) support so that accounts are more secure.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                         | Spec Test                  | Schema                   | Status |
| ------ | --------------------------------- | -------------------------- | ------------------------ | ------ |
| AC-001 | Enables 2FA configuration         | `APP-AUTH-2FA-CONFIG-001`  | `auth.plugins.twoFactor` | `[x]`  |
| AC-002 | Generates TOTP secret             | `API-AUTH-2FA-ENABLE-001`  | `auth.plugins.twoFactor` | `[x]`  |
| AC-003 | Returns QR code for authenticator | `API-AUTH-2FA-ENABLE-002`  | `auth.plugins.twoFactor` | `[x]`  |
| AC-004 | Verifies TOTP code                | `API-AUTH-2FA-VERIFY-001`  | `auth.plugins.twoFactor` | `[x]`  |
| AC-005 | Disables 2FA with verification    | `API-AUTH-2FA-DISABLE-001` | `auth.plugins.twoFactor` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/plugins/two-factor.ts` `[x] Exists`
- **E2E Spec**: `specs/api/auth/two-factor/enable/post.spec.ts` `[x] Exists`
- **E2E Spec**: `specs/api/auth/two-factor/verify/post.spec.ts` `[x] Exists`
- **E2E Spec**: `specs/api/auth/two-factor/disable/post.spec.ts` `[x] Exists`
- **API Route**: `/api/auth/two-factor/enable` `[x] Implemented`
- **API Route**: `/api/auth/two-factor/verify` `[x] Implemented`
- **API Route**: `/api/auth/two-factor/disable` `[x] Implemented`

---

### US-AUTH-SESSION-DEV-005: Account Lockout After Failed Attempts

**Story**: As a developer, I want account lockout after failed attempts so that brute force attacks are prevented.

**Status**: `[~]` Partial

#### Acceptance Criteria

| ID     | Criterion                           | Spec Test                     | Schema           | Status |
| ------ | ----------------------------------- | ----------------------------- | ---------------- | ------ |
| AC-001 | Configures failed attempt threshold | `APP-AUTH-LOCKOUT-CONFIG-001` | `auth.rateLimit` | `[~]`  |
| AC-002 | Locks account after threshold       | `API-AUTH-LOCKOUT-001`        | `auth.rateLimit` | `[~]`  |
| AC-003 | Returns 429 when locked             | `API-AUTH-RATE-LIMIT-001`     | `auth.rateLimit` | `[x]`  |
| AC-004 | Unlocks after configured time       | `API-AUTH-LOCKOUT-002`        | `auth.rateLimit` | `[ ]`  |

#### Implementation Notes

- **Schema**: Rate limiting implemented via Better Auth
- **E2E Spec**: `specs/api/auth/rate-limiting.spec.ts` `[x] Exists`
- **Status**: Rate limiting exists but account lockout duration configurable not yet implemented

---

### US-AUTH-SESSION-DEV-006: Password Strength Requirements

**Story**: As a developer, I want password strength requirements so that users create secure passwords.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                       | Spec Test                        | Schema                  | Status |
| ------ | ------------------------------- | -------------------------------- | ----------------------- | ------ |
| AC-001 | Enforces minimum length         | `API-AUTH-PASSWORD-STRENGTH-001` | `auth.emailAndPassword` | `[x]`  |
| AC-002 | Enforces character requirements | `API-AUTH-PASSWORD-STRENGTH-002` | `auth.emailAndPassword` | `[x]`  |
| AC-003 | Rejects weak passwords          | `API-AUTH-SIGN-UP-EMAIL-004`     | `auth.emailAndPassword` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/methods/email-and-password.ts` `[x] Exists`
- **E2E Spec**: `specs/api/auth/sign-up/email/post.spec.ts` `[x] Exists`
- **Implementation**: Better Auth enforces password requirements

---

### US-AUTH-SESSION-DEV-007: Email Verification for New Accounts

**Story**: As a developer, I want email verification for new accounts so that email addresses are confirmed.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                           | Spec Test                        | Schema                  | Status |
| ------ | ----------------------------------- | -------------------------------- | ----------------------- | ------ |
| AC-001 | Sends verification email on sign-up | `API-AUTH-SEND-VERIFICATION-001` | `auth.emailAndPassword` | `[x]`  |
| AC-002 | Verifies email with token           | `API-AUTH-VERIFY-EMAIL-001`      | `auth.emailAndPassword` | `[x]`  |
| AC-003 | Marks email as verified             | `API-AUTH-VERIFY-EMAIL-002`      | `auth.emailAndPassword` | `[x]`  |
| AC-004 | Rejects expired verification token  | `API-AUTH-VERIFY-EMAIL-003`      | `auth.emailAndPassword` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/methods/email-and-password.ts` `[x] Exists`
- **E2E Spec**: `specs/api/auth/send-verification-email/post.spec.ts` `[x] Exists`
- **E2E Spec**: `specs/api/auth/verify-email/get.spec.ts` `[x] Exists`
- **API Route**: `/api/auth/send-verification-email` `[x] Implemented`
- **API Route**: `/api/auth/verify-email` `[x] Implemented`

---

## Coverage Summary

| Story ID                | Title                          | Status         | Criteria Met |
| ----------------------- | ------------------------------ | -------------- | ------------ |
| US-AUTH-SESSION-DEV-001 | Configurable Session Duration  | `[x]` Complete | 4/4          |
| US-AUTH-SESSION-DEV-002 | Secure Session Handling        | `[x]` Complete | 4/4          |
| US-AUTH-SESSION-DEV-003 | Force Logout All Sessions      | `[x]` Complete | 4/4          |
| US-AUTH-SESSION-DEV-004 | Two-Factor Authentication      | `[x]` Complete | 5/5          |
| US-AUTH-SESSION-DEV-005 | Account Lockout                | `[~]` Partial  | 2/4          |
| US-AUTH-SESSION-DEV-006 | Password Strength Requirements | `[x]` Complete | 3/3          |
| US-AUTH-SESSION-DEV-007 | Email Verification             | `[x]` Complete | 4/4          |

**Total**: 6 complete, 1 partial, 0 not started (93% complete)

---

> **Navigation**: [← Back to Auth Domain](../README.md) | [Sessions & Security as End User →](./as-end-user.md)
