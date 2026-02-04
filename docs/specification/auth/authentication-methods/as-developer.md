# Auth > Authentication Methods > As Developer

> **Domain**: auth
> **Feature Area**: authentication-methods
> **Role**: Developer
> **Schema Path**: `src/domain/models/app/auth/methods/`
> **Spec Path**: `specs/api/auth/`

---

## User Stories

### US-AUTH-METHOD-DEV-001: Email/Password Authentication

**Story**: As a developer, I want email/password authentication so that users can create accounts traditionally.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                                | Spec Test                    | Schema                  | Status |
| ------ | ---------------------------------------- | ---------------------------- | ----------------------- | ------ |
| AC-001 | Returns 200 OK with user data on sign-up | `API-AUTH-SIGN-UP-EMAIL-001` | `auth.emailAndPassword` | `[x]`  |
| AC-002 | Creates user record in database          | `API-AUTH-SIGN-UP-EMAIL-002` | `auth.emailAndPassword` | `[x]`  |
| AC-003 | Validates email format                   | `API-AUTH-SIGN-UP-EMAIL-003` | `auth.emailAndPassword` | `[x]`  |
| AC-004 | Validates password strength              | `API-AUTH-SIGN-UP-EMAIL-004` | `auth.emailAndPassword` | `[x]`  |
| AC-005 | Rejects duplicate email                  | `API-AUTH-SIGN-UP-EMAIL-005` | `auth.emailAndPassword` | `[x]`  |
| AC-006 | Hashes password securely                 | `API-AUTH-SIGN-UP-EMAIL-006` | `auth.emailAndPassword` | `[x]`  |
| AC-007 | Signs in with valid credentials          | `API-AUTH-SIGN-IN-EMAIL-001` | `auth.emailAndPassword` | `[x]`  |
| AC-008 | Rejects invalid password                 | `API-AUTH-SIGN-IN-EMAIL-002` | `auth.emailAndPassword` | `[x]`  |
| AC-009 | Rejects non-existent email               | `API-AUTH-SIGN-IN-EMAIL-003` | `auth.emailAndPassword` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/methods/email-and-password.ts` `[x] Exists`
- **E2E Spec**: `specs/api/auth/sign-up/email/post.spec.ts` `[x] Exists`
- **E2E Spec**: `specs/api/auth/sign-in/email/post.spec.ts` `[x] Exists`
- **API Route**: `/api/auth/sign-up/email` `[x] Implemented`
- **API Route**: `/api/auth/sign-in/email` `[x] Implemented`

---

### US-AUTH-METHOD-DEV-002: OAuth Social Login

**Story**: As a developer, I want OAuth social login (Google, GitHub, etc.) so that users can sign in with existing accounts.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                             | Spec Test                   | Schema                        | Status |
| ------ | ------------------------------------- | --------------------------- | ----------------------------- | ------ |
| AC-001 | Configures OAuth providers in schema  | `APP-AUTH-OAUTH-001`        | `auth.oauth.providers`        | `[x]`  |
| AC-002 | Supports Google OAuth                 | `APP-AUTH-OAUTH-GOOGLE-001` | `auth.oauth.providers.google` | `[x]`  |
| AC-003 | Supports GitHub OAuth                 | `APP-AUTH-OAUTH-GITHUB-001` | `auth.oauth.providers.github` | `[x]`  |
| AC-004 | Creates user on first OAuth login     | `API-AUTH-OAUTH-CREATE-001` | `auth.oauth`                  | `[x]`  |
| AC-005 | Links OAuth to existing user by email | `API-AUTH-OAUTH-LINK-001`   | `auth.oauth`                  | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/oauth/providers.ts` `[x] Exists`
- **Schema**: `src/domain/models/app/auth/oauth/index.ts` `[x] Exists`
- **E2E Spec**: OAuth flow tested via provider mocks
- **API Route**: `/api/auth/callback/{provider}` `[x] Implemented`

---

### US-AUTH-METHOD-DEV-003: SSO Support (SAML, OIDC)

**Story**: As a developer, I want SSO (SAML, OIDC) support so that enterprise users can use corporate identity providers.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                               | Spec Test               | Schema          | Status |
| ------ | --------------------------------------- | ----------------------- | --------------- | ------ |
| AC-001 | Configures SAML provider                | `APP-AUTH-SSO-SAML-001` | `auth.sso.saml` | `[ ]`  |
| AC-002 | Configures OIDC provider                | `APP-AUTH-SSO-OIDC-001` | `auth.sso.oidc` | `[ ]`  |
| AC-003 | Maps SAML attributes to user fields     | `APP-AUTH-SSO-SAML-002` | `auth.sso.saml` | `[ ]`  |
| AC-004 | Maps OIDC claims to user fields         | `APP-AUTH-SSO-OIDC-002` | `auth.sso.oidc` | `[ ]`  |
| AC-005 | Supports Just-in-Time user provisioning | `APP-AUTH-SSO-JIT-001`  | `auth.sso`      | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/sso/` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/auth/sso/` `[ ] Needs Creation`
- **API Route**: `/api/auth/sso/{provider}` `[ ] Not Implemented`

---

### US-AUTH-METHOD-DEV-004: Magic Link Authentication

**Story**: As a developer, I want magic link authentication so that users can sign in without passwords.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                         | Spec Test                        | Schema           | Status |
| ------ | --------------------------------- | -------------------------------- | ---------------- | ------ |
| AC-001 | Sends magic link email            | `API-AUTH-MAGIC-LINK-SEND-001`   | `auth.magicLink` | `[x]`  |
| AC-002 | Returns 200 OK on successful send | `API-AUTH-MAGIC-LINK-SEND-002`   | `auth.magicLink` | `[x]`  |
| AC-003 | Validates email exists            | `API-AUTH-MAGIC-LINK-SEND-003`   | `auth.magicLink` | `[x]`  |
| AC-004 | Verifies magic link token         | `API-AUTH-MAGIC-LINK-VERIFY-001` | `auth.magicLink` | `[x]`  |
| AC-005 | Creates session on verification   | `API-AUTH-MAGIC-LINK-VERIFY-002` | `auth.magicLink` | `[x]`  |
| AC-006 | Rejects expired tokens            | `API-AUTH-MAGIC-LINK-VERIFY-003` | `auth.magicLink` | `[x]`  |
| AC-007 | Rejects already-used tokens       | `API-AUTH-MAGIC-LINK-VERIFY-004` | `auth.magicLink` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/methods/magic-link.ts` `[x] Exists`
- **E2E Spec**: `specs/api/auth/magic-link/send/post.spec.ts` `[x] Exists`
- **E2E Spec**: `specs/api/auth/magic-link/verify/get.spec.ts` `[x] Exists`
- **API Route**: `/api/auth/magic-link/send` `[x] Implemented`
- **API Route**: `/api/auth/magic-link/verify` `[x] Implemented`

---

### US-AUTH-METHOD-DEV-005: Configure Enabled Auth Methods

**Story**: As a developer, I want to configure which auth methods are enabled so that I can control the sign-in experience.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                        | Spec Test               | Schema                  | Status |
| ------ | -------------------------------- | ----------------------- | ----------------------- | ------ |
| AC-001 | Enables/disables email/password  | `APP-AUTH-CONFIG-001`   | `auth.emailAndPassword` | `[x]`  |
| AC-002 | Enables/disables magic link      | `APP-AUTH-CONFIG-002`   | `auth.magicLink`        | `[x]`  |
| AC-003 | Enables/disables OAuth providers | `APP-AUTH-CONFIG-003`   | `auth.oauth`            | `[x]`  |
| AC-004 | Disabled method returns 404      | `API-AUTH-DISABLED-001` | `auth`                  | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/config.ts` `[x] Exists`
- **Schema**: `src/domain/models/app/auth/index.ts` `[x] Exists`
- **E2E Spec**: `specs/api/auth/enforcement/disabled-auth.spec.ts` `[x] Exists`
- **API Route**: Controlled via auth configuration in app schema

---

## Coverage Summary

| Story ID               | Title                          | Status            | Criteria Met |
| ---------------------- | ------------------------------ | ----------------- | ------------ |
| US-AUTH-METHOD-DEV-001 | Email/Password Authentication  | `[x]` Complete    | 9/9          |
| US-AUTH-METHOD-DEV-002 | OAuth Social Login             | `[x]` Complete    | 5/5          |
| US-AUTH-METHOD-DEV-003 | SSO Support (SAML, OIDC)       | `[ ]` Not Started | 0/5          |
| US-AUTH-METHOD-DEV-004 | Magic Link Authentication      | `[x]` Complete    | 7/7          |
| US-AUTH-METHOD-DEV-005 | Configure Enabled Auth Methods | `[x]` Complete    | 4/4          |

**Total**: 4 complete, 0 partial, 1 not started (80% complete)

---

> **Navigation**: [← Back to Auth Domain](../README.md) | [Authentication Methods as End User →](./as-end-user.md)
