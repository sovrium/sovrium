# API > Auth Endpoints > As API Consumer

> **Domain**: api
> **Feature Area**: auth-endpoints
> **Role**: API Consumer
> **Schema Path**: `src/domain/models/api/auth/`
> **Spec Path**: `specs/api/auth/`

---

## User Stories

### US-API-AUTH-CONSUMER-001: Token Authentication

**Story**: As an API consumer, I want to authenticate via API and receive a session token so that I can make authenticated requests.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                                | Spec Test                | Schema     | Status |
| ------ | ---------------------------------------- | ------------------------ | ---------- | ------ |
| AC-001 | Login returns session token/cookie       | `APP-API-AUTH-TOKEN-001` | `api.auth` | `[x]`  |
| AC-002 | Token can be used in subsequent requests | `APP-API-AUTH-TOKEN-002` | `api.auth` | `[x]`  |
| AC-003 | Token format is documented               | `APP-API-AUTH-TOKEN-003` | `api.auth` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/api/auth/index.ts` `[x] Exists`
- **E2E Spec**: Token authentication tested via API calls
- **Implementation**: Cookie-based sessions with Better Auth

---

### US-API-AUTH-CONSUMER-002: Authentication Error Messages

**Story**: As an API consumer, I want clear error messages when authentication fails so that I can debug issues.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                            | Spec Test                | Schema       | Status |
| ------ | ------------------------------------ | ------------------------ | ------------ | ------ |
| AC-001 | 401 returned for invalid credentials | `APP-API-AUTH-ERROR-001` | `api.errors` | `[x]`  |
| AC-002 | Error includes descriptive message   | `APP-API-AUTH-ERROR-002` | `api.errors` | `[x]`  |
| AC-003 | Error codes are documented           | `APP-API-AUTH-ERROR-003` | `api.errors` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/api/errors/index.ts` `[x] Exists`
- **E2E Spec**: Error responses tested via invalid auth attempts
- **Implementation**: Standardized error response format

---

### US-API-AUTH-CONSUMER-003: Session Refresh

**Story**: As an API consumer, I want to refresh sessions before they expire so that users stay logged in.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                            | Spec Test                  | Schema        | Status |
| ------ | ------------------------------------ | -------------------------- | ------------- | ------ |
| AC-001 | POST /auth/refresh extends session   | `APP-API-AUTH-REFRESH-001` | `api.session` | `[ ]`  |
| AC-002 | Refresh returns new token/cookie     | `APP-API-AUTH-REFRESH-002` | `api.session` | `[ ]`  |
| AC-003 | Expired sessions cannot be refreshed | `APP-API-AUTH-REFRESH-003` | `api.session` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/api/auth/session.ts` `[x] Exists`
- **E2E Spec**: `specs/api/auth/refresh.spec.ts` `[ ] Needs Creation`
- **API Route**: `/api/auth/refresh` `[ ] Not Implemented`

---

## Coverage Summary

| Story ID                 | Title                | Status            | Criteria Met |
| ------------------------ | -------------------- | ----------------- | ------------ |
| US-API-AUTH-CONSUMER-001 | Token Authentication | `[x]` Complete    | 3/3          |
| US-API-AUTH-CONSUMER-002 | Error Messages       | `[x]` Complete    | 3/3          |
| US-API-AUTH-CONSUMER-003 | Session Refresh      | `[ ]` Not Started | 0/3          |

**Total**: 2 complete, 0 partial, 1 not started (67% complete)

---

> **Navigation**: [← Back to API Domain](../README.md) | [← Auth Endpoints as Developer](./as-developer.md)
