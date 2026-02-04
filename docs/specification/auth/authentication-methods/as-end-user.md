# Auth > Authentication Methods > As End User

> **Domain**: auth
> **Feature Area**: authentication-methods
> **Role**: End User
> **Schema Path**: `src/domain/models/app/auth/methods/`
> **Spec Path**: `specs/api/auth/`

---

## User Stories

### US-AUTH-METHOD-USER-001: Sign Up with Email and Password

**Story**: As an end user, I want to sign up with email and password so that I can create an account.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                                   | Spec Test                    | Schema                  | Status |
| ------ | ------------------------------------------- | ---------------------------- | ----------------------- | ------ |
| AC-001 | Creates account with valid email/password   | `API-AUTH-SIGN-UP-EMAIL-001` | `auth.emailAndPassword` | `[x]`  |
| AC-002 | Receives user data and session token        | `API-AUTH-SIGN-UP-EMAIL-002` | `auth.emailAndPassword` | `[x]`  |
| AC-003 | Receives validation error for invalid email | `API-AUTH-SIGN-UP-EMAIL-003` | `auth.emailAndPassword` | `[x]`  |
| AC-004 | Receives validation error for weak password | `API-AUTH-SIGN-UP-EMAIL-004` | `auth.emailAndPassword` | `[x]`  |
| AC-005 | Cannot create duplicate account             | `API-AUTH-SIGN-UP-EMAIL-005` | `auth.emailAndPassword` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/methods/email-and-password.ts` `[x] Exists`
- **E2E Spec**: `specs/api/auth/sign-up/email/post.spec.ts` `[x] Exists`
- **API Route**: `/api/auth/sign-up/email` `[x] Implemented`

---

### US-AUTH-METHOD-USER-002: Sign In with Social Accounts

**Story**: As an end user, I want to sign in with my social accounts so that I don't need another password.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                                | Spec Test                   | Schema                        | Status |
| ------ | ---------------------------------------- | --------------------------- | ----------------------------- | ------ |
| AC-001 | Can sign in with Google                  | `API-AUTH-OAUTH-GOOGLE-001` | `auth.oauth.providers.google` | `[x]`  |
| AC-002 | Can sign in with GitHub                  | `API-AUTH-OAUTH-GITHUB-001` | `auth.oauth.providers.github` | `[x]`  |
| AC-003 | Account is created on first social login | `API-AUTH-OAUTH-CREATE-001` | `auth.oauth`                  | `[x]`  |
| AC-004 | Social account links to existing email   | `API-AUTH-OAUTH-LINK-001`   | `auth.oauth`                  | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/oauth/providers.ts` `[x] Exists`
- **E2E Spec**: OAuth flow tested via provider mocks
- **API Route**: `/api/auth/callback/{provider}` `[x] Implemented`

---

### US-AUTH-METHOD-USER-003: Reset Password

**Story**: As an end user, I want to reset my password if I forget it so that I can regain access.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                        | Spec Test                             | Schema                  | Status |
| ------ | -------------------------------- | ------------------------------------- | ----------------------- | ------ |
| AC-001 | Requests password reset email    | `API-AUTH-REQUEST-PASSWORD-RESET-001` | `auth.emailAndPassword` | `[x]`  |
| AC-002 | Receives email with reset link   | `API-AUTH-REQUEST-PASSWORD-RESET-002` | `auth.emailAndPassword` | `[x]`  |
| AC-003 | Resets password with valid token | `API-AUTH-RESET-PASSWORD-001`         | `auth.emailAndPassword` | `[x]`  |
| AC-004 | Rejects expired reset token      | `API-AUTH-RESET-PASSWORD-002`         | `auth.emailAndPassword` | `[x]`  |
| AC-005 | Rejects invalid reset token      | `API-AUTH-RESET-PASSWORD-003`         | `auth.emailAndPassword` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/methods/email-and-password.ts` `[x] Exists`
- **E2E Spec**: `specs/api/auth/request-password-reset/post.spec.ts` `[x] Exists`
- **E2E Spec**: `specs/api/auth/reset-password/post.spec.ts` `[x] Exists`
- **API Route**: `/api/auth/request-password-reset` `[x] Implemented`
- **API Route**: `/api/auth/reset-password` `[x] Implemented`

---

### US-AUTH-METHOD-USER-004: Change Password

**Story**: As an end user, I want to change my password so that I can maintain security.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                                    | Spec Test                      | Schema                  | Status |
| ------ | -------------------------------------------- | ------------------------------ | ----------------------- | ------ |
| AC-001 | Changes password with valid current password | `API-AUTH-CHANGE-PASSWORD-001` | `auth.emailAndPassword` | `[x]`  |
| AC-002 | Rejects invalid current password             | `API-AUTH-CHANGE-PASSWORD-002` | `auth.emailAndPassword` | `[x]`  |
| AC-003 | Validates new password strength              | `API-AUTH-CHANGE-PASSWORD-003` | `auth.emailAndPassword` | `[x]`  |
| AC-004 | Returns 401 without authentication           | `API-AUTH-CHANGE-PASSWORD-004` | `auth.emailAndPassword` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/methods/email-and-password.ts` `[x] Exists`
- **E2E Spec**: `specs/api/auth/change-password/post.spec.ts` `[x] Exists`
- **API Route**: `/api/auth/change-password` `[x] Implemented`

---

### US-AUTH-METHOD-USER-005: Update Profile Information

**Story**: As an end user, I want to update my profile information so that my account is accurate.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                          | Spec Test                  | Schema | Status |
| ------ | ---------------------------------- | -------------------------- | ------ | ------ |
| AC-001 | Updates user name                  | `API-AUTH-UPDATE-USER-001` | `auth` | `[x]`  |
| AC-002 | Updates user image                 | `API-AUTH-UPDATE-USER-002` | `auth` | `[x]`  |
| AC-003 | Returns 401 without authentication | `API-AUTH-UPDATE-USER-003` | `auth` | `[x]`  |
| AC-004 | Validates field values             | `API-AUTH-UPDATE-USER-004` | `auth` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/` `[x] Exists`
- **E2E Spec**: `specs/api/auth/update-user/post.spec.ts` `[x] Exists`
- **API Route**: `/api/auth/update-user` `[x] Implemented`

---

## Coverage Summary

| Story ID                | Title                           | Status         | Criteria Met |
| ----------------------- | ------------------------------- | -------------- | ------------ |
| US-AUTH-METHOD-USER-001 | Sign Up with Email and Password | `[x]` Complete | 5/5          |
| US-AUTH-METHOD-USER-002 | Sign In with Social Accounts    | `[x]` Complete | 4/4          |
| US-AUTH-METHOD-USER-003 | Reset Password                  | `[x]` Complete | 5/5          |
| US-AUTH-METHOD-USER-004 | Change Password                 | `[x]` Complete | 4/4          |
| US-AUTH-METHOD-USER-005 | Update Profile Information      | `[x]` Complete | 4/4          |

**Total**: 5 complete, 0 partial, 0 not started (100% complete)

---

> **Navigation**: [← Back to Auth Domain](../README.md) | [← Authentication Methods as Developer](./as-developer.md)
