# API > Auth Endpoints > As Developer

> **Domain**: api
> **Feature Area**: auth-endpoints
> **Role**: Developer
> **Schema Path**: `src/domain/models/api/auth/`
> **Spec Path**: `specs/api/auth/`

---

## User Stories

### US-API-AUTH-001: Authentication Endpoints

**Story**: As a developer, I want API endpoints for user authentication (login, logout, signup) so that I can build custom auth flows.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                              | Spec Test             | Schema     | Status |
| ------ | -------------------------------------- | --------------------- | ---------- | ------ |
| AC-001 | POST /auth/login authenticates users   | `API-AUTH-LOGIN-001`  | `api.auth` | `[x]`  |
| AC-002 | POST /auth/logout terminates session   | `API-AUTH-LOGOUT-001` | `api.auth` | `[x]`  |
| AC-003 | POST /auth/signup creates new user     | `API-AUTH-SIGNUP-001` | `api.auth` | `[x]`  |
| AC-004 | Login returns session token on success | `API-AUTH-LOGIN-002`  | `api.auth` | `[x]`  |
| AC-005 | Login returns 401 on failure           | `API-AUTH-LOGIN-003`  | `api.auth` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/api/auth/index.ts` `[x] Exists`
- **E2E Spec**: Authentication tested via Better Auth endpoints
- **Implementation**: Better Auth with email/password provider

---

### US-API-AUTH-002: Session Management Endpoints

**Story**: As a developer, I want session management endpoints so that I can check auth status.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                                 | Spec Test              | Schema        | Status |
| ------ | ----------------------------------------- | ---------------------- | ------------- | ------ |
| AC-001 | GET /auth/session returns current session | `API-AUTH-SESSION-001` | `api.session` | `[x]`  |
| AC-002 | Session includes user data                | `API-AUTH-SESSION-002` | `api.session` | `[x]`  |
| AC-003 | Session tokens expire according to config | `API-AUTH-SESSION-003` | `api.session` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/api/auth/session.ts` `[x] Exists`
- **E2E Spec**: Session endpoints tested via auth flows
- **Implementation**: Better Auth session management with cookie-based sessions

---

### US-API-AUTH-003: OAuth Endpoints

**Story**: As a developer, I want OAuth endpoints for social login so that users can authenticate with external providers.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                                 | Spec Test            | Schema      | Status |
| ------ | ----------------------------------------- | -------------------- | ----------- | ------ |
| AC-001 | GET /auth/oauth/{provider} initiates flow | `API-AUTH-OAUTH-001` | `api.oauth` | `[x]`  |
| AC-002 | OAuth callback handles authorization code | `API-AUTH-OAUTH-002` | `api.oauth` | `[x]`  |
| AC-003 | OAuth flows create or link user accounts  | `API-AUTH-OAUTH-003` | `api.oauth` | `[x]`  |
| AC-004 | OAuth redirects correctly after auth      | `API-AUTH-OAUTH-004` | `api.oauth` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/api/auth/oauth.ts` `[x] Exists`
- **E2E Spec**: OAuth tested via social login providers
- **Implementation**: Better Auth social providers (Google, GitHub, etc.)

---

### US-API-AUTH-004: Password Reset Endpoints

**Story**: As a developer, I want password reset endpoints so that users can recover their accounts.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                                    | Spec Test            | Schema         | Status |
| ------ | -------------------------------------------- | -------------------- | -------------- | ------ |
| AC-001 | POST /auth/forgot-password sends reset email | `API-AUTH-RESET-001` | `api.password` | `[x]`  |
| AC-002 | Reset link is secure and time-limited        | `API-AUTH-RESET-002` | `api.password` | `[x]`  |
| AC-003 | POST /auth/reset-password updates password   | `API-AUTH-RESET-003` | `api.password` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/api/auth/password.ts` `[x] Exists`
- **E2E Spec**: Password reset tested via email flow
- **Implementation**: Better Auth password reset with email verification

---

## Coverage Summary

| Story ID        | Title                    | Status         | Criteria Met |
| --------------- | ------------------------ | -------------- | ------------ |
| US-API-AUTH-001 | Authentication Endpoints | `[x]` Complete | 5/5          |
| US-API-AUTH-002 | Session Management       | `[x]` Complete | 3/3          |
| US-API-AUTH-003 | OAuth Endpoints          | `[x]` Complete | 4/4          |
| US-API-AUTH-004 | Password Reset           | `[x]` Complete | 3/3          |

**Total**: 4 complete, 0 partial, 0 not started (100% complete)

---

> **Navigation**: [← Back to API Domain](../README.md) | [Auth Endpoints as API Consumer →](./as-api-consumer.md)
