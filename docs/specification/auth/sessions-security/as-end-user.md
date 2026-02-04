# Auth > Sessions & Security > As End User

> **Domain**: auth
> **Feature Area**: sessions-security
> **Role**: End User
> **Schema Path**: `src/domain/models/app/auth/`
> **Spec Path**: `specs/api/auth/`

---

## User Stories

### US-AUTH-SESSION-USER-001: View Active Sessions

**Story**: As an end user, I want to see my active sessions so that I know where I'm logged in.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                          | Spec Test                    | Schema | Status |
| ------ | ---------------------------------- | ---------------------------- | ------ | ------ |
| AC-001 | Lists all active sessions          | `API-AUTH-LIST-SESSIONS-001` | `auth` | `[x]`  |
| AC-002 | Shows device/browser info          | `API-AUTH-LIST-SESSIONS-002` | `auth` | `[x]`  |
| AC-003 | Shows last activity time           | `API-AUTH-LIST-SESSIONS-003` | `auth` | `[x]`  |
| AC-004 | Returns 401 without authentication | `API-AUTH-LIST-SESSIONS-004` | `auth` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/` `[x] Exists`
- **E2E Spec**: `specs/api/auth/list-sessions/get.spec.ts` `[x] Exists`
- **API Route**: `/api/auth/list-sessions` `[x] Implemented`

---

### US-AUTH-SESSION-USER-002: Log Out of Specific Sessions

**Story**: As an end user, I want to log out of specific sessions so that I can secure my account.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                            | Spec Test                     | Schema | Status |
| ------ | ------------------------------------ | ----------------------------- | ------ | ------ |
| AC-001 | Revokes specific session by ID       | `API-AUTH-REVOKE-SESSION-001` | `auth` | `[x]`  |
| AC-002 | Returns 200 OK on success            | `API-AUTH-REVOKE-SESSION-002` | `auth` | `[x]`  |
| AC-003 | Returns 401 without authentication   | `API-AUTH-REVOKE-SESSION-003` | `auth` | `[x]`  |
| AC-004 | Returns 404 for non-existent session | `API-AUTH-REVOKE-SESSION-004` | `auth` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/` `[x] Exists`
- **E2E Spec**: `specs/api/auth/revoke-session/post.spec.ts` `[x] Exists`
- **API Route**: `/api/auth/revoke-session` `[x] Implemented`

---

### US-AUTH-SESSION-USER-003: Log Out of All Sessions

**Story**: As an end user, I want to log out of all sessions so that I can ensure I'm signed out everywhere.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                          | Spec Test                            | Schema | Status |
| ------ | ---------------------------------- | ------------------------------------ | ------ | ------ |
| AC-001 | Revokes all other sessions         | `API-AUTH-REVOKE-OTHER-SESSIONS-001` | `auth` | `[x]`  |
| AC-002 | Keeps current session active       | `API-AUTH-REVOKE-OTHER-SESSIONS-002` | `auth` | `[x]`  |
| AC-003 | Returns 200 OK on success          | `API-AUTH-REVOKE-OTHER-SESSIONS-003` | `auth` | `[x]`  |
| AC-004 | Returns 401 without authentication | `API-AUTH-REVOKE-OTHER-SESSIONS-004` | `auth` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/auth/` `[x] Exists`
- **E2E Spec**: `specs/api/auth/revoke-other-sessions/post.spec.ts` `[x] Exists`
- **API Route**: `/api/auth/revoke-other-sessions` `[x] Implemented`

---

## Coverage Summary

| Story ID                 | Title                        | Status         | Criteria Met |
| ------------------------ | ---------------------------- | -------------- | ------------ |
| US-AUTH-SESSION-USER-001 | View Active Sessions         | `[x]` Complete | 4/4          |
| US-AUTH-SESSION-USER-002 | Log Out of Specific Sessions | `[x]` Complete | 4/4          |
| US-AUTH-SESSION-USER-003 | Log Out of All Sessions      | `[x]` Complete | 4/4          |

**Total**: 3 complete, 0 partial, 0 not started (100% complete)

---

> **Navigation**: [← Back to Auth Domain](../README.md) | [← Sessions & Security as Developer](./as-developer.md)
