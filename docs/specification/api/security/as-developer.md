# API > Security > As Developer

> **Domain**: api
> **Feature Area**: security
> **Role**: Developer
> **Schema Path**: `src/domain/models/api/security/`
> **Spec Path**: `specs/api/security/`

---

## User Stories

### US-API-SECURITY-001: API Authentication

**Story**: As a developer, I want API authentication via session cookies or bearer tokens so that requests are authorized.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                             | Spec Test               | Schema         | Status |
| ------ | ------------------------------------- | ----------------------- | -------------- | ------ |
| AC-001 | Session cookies authenticate requests | `API-SECURITY-AUTH-001` | `api.security` | `[x]`  |
| AC-002 | Bearer tokens authenticate requests   | `API-SECURITY-AUTH-002` | `api.security` | `[x]`  |
| AC-003 | Unauthenticated requests return 401   | `API-SECURITY-AUTH-003` | `api.security` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/api/security/auth.ts` `[x] Exists`
- **E2E Spec**: Authentication tested via Better Auth
- **Implementation**: Better Auth session management

---

### US-API-SECURITY-002: Rate Limiting

**Story**: As a developer, I want rate limiting to protect against abuse so that the API remains available.

**Status**: `[~]` Partial

#### Acceptance Criteria

| ID     | Criterion                            | Spec Test               | Schema         | Status |
| ------ | ------------------------------------ | ----------------------- | -------------- | ------ |
| AC-001 | Rate limits enforced per endpoint    | `API-SECURITY-RATE-001` | `api.security` | `[~]`  |
| AC-002 | 429 returned with retry-after header | `API-SECURITY-RATE-002` | `api.security` | `[~]`  |
| AC-003 | Rate limits configurable             | `API-SECURITY-RATE-003` | `api.security` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/api/security/rate-limit.ts` `[~] Partial`
- **E2E Spec**: Rate limiting partially tested
- **Implementation**: Basic rate limiting in place, configurability pending

---

### US-API-SECURITY-003: API Keys

**Story**: As a developer, I want API keys for machine-to-machine access so that external systems can integrate securely.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                               | Spec Test              | Schema         | Status |
| ------ | --------------------------------------- | ---------------------- | -------------- | ------ |
| AC-001 | API keys authenticate requests          | `API-SECURITY-KEY-001` | `api.security` | `[ ]`  |
| AC-002 | Keys can be scoped to tables/operations | `API-SECURITY-KEY-002` | `api.security` | `[ ]`  |
| AC-003 | Keys can be created and revoked         | `API-SECURITY-KEY-003` | `api.security` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/api/security/api-keys.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/security/api-keys.spec.ts` `[ ] Needs Creation`
- **API Route**: `/api/auth/keys` `[ ] Not Implemented`

---

### US-API-SECURITY-004: CORS Configuration

**Story**: As a developer, I want CORS configuration so that browser-based clients can access the API.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                               | Spec Test               | Schema         | Status |
| ------ | --------------------------------------- | ----------------------- | -------------- | ------ |
| AC-001 | CORS headers set based on configuration | `API-SECURITY-CORS-001` | `api.security` | `[x]`  |
| AC-002 | Allowed origins configurable            | `API-SECURITY-CORS-002` | `api.security` | `[x]`  |
| AC-003 | Preflight OPTIONS handled               | `API-SECURITY-CORS-003` | `api.security` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/api/security/cors.ts` `[x] Exists`
- **E2E Spec**: CORS tested via cross-origin requests
- **Implementation**: Hono CORS middleware

---

## Coverage Summary

| Story ID            | Title              | Status            | Criteria Met |
| ------------------- | ------------------ | ----------------- | ------------ |
| US-API-SECURITY-001 | API Authentication | `[x]` Complete    | 3/3          |
| US-API-SECURITY-002 | Rate Limiting      | `[~]` Partial     | 2/3          |
| US-API-SECURITY-003 | API Keys           | `[ ]` Not Started | 0/3          |
| US-API-SECURITY-004 | CORS Configuration | `[x]` Complete    | 3/3          |

**Total**: 2 complete, 1 partial, 1 not started (63% complete)

---

> **Navigation**: [← Back to API Domain](../README.md) | [Security as App Administrator →](./as-app-administrator.md)
