# Session Management

> **Feature Area**: Authentication
> **Schema**: `src/domain/models/app/auth/`
> **API Routes**: `GET /api/auth/get-session`, `POST /api/auth/sign-out`, `GET /api/auth/list-sessions`, `POST /api/auth/revoke-session`, `POST /api/auth/revoke-other-sessions`

---

## US-AUTH-SESSION-001: Get Current Session

**As a** developer,
**I want to** retrieve the current user's session information,
**so that** I can display user data and manage authentication state in my application.

### Configuration

```yaml
auth:
  emailAndPassword: true
# Note: Session configuration (expiresIn, updateAge) is managed at the
# Better Auth server level, not in the AppSchema. The auth config enables
# the authentication methods whose sessions are managed by Better Auth.
```

### Acceptance Criteria

| ID     | Criterion                                                | E2E Spec                          | Status |
| ------ | -------------------------------------------------------- | --------------------------------- | ------ |
| AC-001 | Returns session data for authenticated user              | `API-AUTH-GET-SESSION-001`        | ✅     |
| AC-002 | Returns null for unauthenticated request                 | `API-AUTH-GET-SESSION-002`        | ✅     |
| AC-003 | Session includes user object with id, email, name        | `API-AUTH-GET-SESSION-003`        | ✅     |
| AC-004 | Session includes session metadata (createdAt, expiresAt) | `API-AUTH-GET-SESSION-004`        | ✅     |
| AC-005 | Expired session returns null                             | `API-AUTH-GET-SESSION-005`        | ✅     |
| AC-006 | User retrieves session information (regression)          | `API-AUTH-GET-SESSION-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/get-session/get.spec.ts`

---

## US-AUTH-SESSION-002: User Sign-Out

**As a** developer,
**I want to** allow users to sign out of their current session,
**so that** they can securely end their authenticated session.

### Acceptance Criteria

| ID     | Criterion                                          | E2E Spec                       | Status |
| ------ | -------------------------------------------------- | ------------------------------ | ------ |
| AC-001 | Current session is invalidated on sign-out         | `API-AUTH-SIGN-OUT-001`        | ✅     |
| AC-002 | Returns 200 OK on successful sign-out              | `API-AUTH-SIGN-OUT-002`        | ✅     |
| AC-003 | Session cookie is cleared                          | `API-AUTH-SIGN-OUT-003`        | ✅     |
| AC-004 | Returns 401 when not authenticated                 | `API-AUTH-SIGN-OUT-004`        | ✅     |
| AC-005 | Subsequent requests with old token are rejected    | `API-AUTH-SIGN-OUT-005`        | ✅     |
| AC-006 | User completes full sign-out workflow (regression) | `API-AUTH-SIGN-OUT-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/sign-out/post.spec.ts`

---

## US-AUTH-SESSION-003: List Active Sessions

**As a** developer,
**I want to** allow users to view all their active sessions,
**so that** they can monitor account access across devices.

### Acceptance Criteria

| ID     | Criterion                                            | E2E Spec                            | Status |
| ------ | ---------------------------------------------------- | ----------------------------------- | ------ |
| AC-001 | Returns list of all active sessions for user         | `API-AUTH-LIST-SESSIONS-001`        | ✅     |
| AC-002 | Each session includes device/browser information     | `API-AUTH-LIST-SESSIONS-002`        | ✅     |
| AC-003 | Each session includes createdAt timestamp            | `API-AUTH-LIST-SESSIONS-003`        | ✅     |
| AC-004 | Current session is identified in the list            | `API-AUTH-LIST-SESSIONS-004`        | ✅     |
| AC-005 | Returns 401 when not authenticated                   | `API-AUTH-LIST-SESSIONS-005`        | ✅     |
| AC-006 | Expired sessions are not included                    | `API-AUTH-LIST-SESSIONS-006`        | ✅     |
| AC-007 | Sessions are ordered by creation date (newest first) | `API-AUTH-LIST-SESSIONS-007`        | ✅     |
| AC-008 | User views all active sessions (regression)          | `API-AUTH-LIST-SESSIONS-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/list-sessions/get.spec.ts`

---

## US-AUTH-SESSION-004: Revoke Specific Session

**As a** developer,
**I want to** allow users to revoke a specific session,
**so that** they can log out from a particular device remotely.

### Acceptance Criteria

| ID     | Criterion                                    | E2E Spec                             | Status |
| ------ | -------------------------------------------- | ------------------------------------ | ------ |
| AC-001 | Session is revoked with valid session ID     | `API-AUTH-REVOKE-SESSION-001`        | ✅     |
| AC-002 | Returns 200 OK on successful revocation      | `API-AUTH-REVOKE-SESSION-002`        | ✅     |
| AC-003 | Returns 401 when not authenticated           | `API-AUTH-REVOKE-SESSION-003`        | ✅     |
| AC-004 | Returns 404 for non-existent session ID      | `API-AUTH-REVOKE-SESSION-004`        | ✅     |
| AC-005 | Cannot revoke another user's session         | `API-AUTH-REVOKE-SESSION-005`        | ✅     |
| AC-006 | User revokes a specific session (regression) | `API-AUTH-REVOKE-SESSION-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/revoke-session/post.spec.ts`

---

## US-AUTH-SESSION-005: Revoke All Other Sessions

**As a** developer,
**I want to** allow users to revoke all sessions except the current one,
**so that** they can secure their account if they suspect unauthorized access.

### Acceptance Criteria

| ID     | Criterion                                    | E2E Spec                                    | Status |
| ------ | -------------------------------------------- | ------------------------------------------- | ------ |
| AC-001 | All sessions except current are revoked      | `API-AUTH-REVOKE-OTHER-SESSIONS-001`        | ✅     |
| AC-002 | Current session remains active               | `API-AUTH-REVOKE-OTHER-SESSIONS-002`        | ✅     |
| AC-003 | Returns count of revoked sessions            | `API-AUTH-REVOKE-OTHER-SESSIONS-003`        | ✅     |
| AC-004 | Returns 401 when not authenticated           | `API-AUTH-REVOKE-OTHER-SESSIONS-004`        | ✅     |
| AC-005 | Returns 0 count when no other sessions exist | `API-AUTH-REVOKE-OTHER-SESSIONS-005`        | ✅     |
| AC-006 | User revokes all other sessions (regression) | `API-AUTH-REVOKE-OTHER-SESSIONS-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/revoke-other-sessions/post.spec.ts`

---

## Regression Tests

| Spec ID                                     | Workflow                              | Status |
| ------------------------------------------- | ------------------------------------- | ------ |
| `API-AUTH-GET-SESSION-REGRESSION`           | User retrieves session information    | `[x]`  |
| `API-AUTH-SIGN-OUT-REGRESSION`              | User completes full sign-out workflow | `[x]`  |
| `API-AUTH-LIST-SESSIONS-REGRESSION`         | User views all active sessions        | `[x]`  |
| `API-AUTH-REVOKE-SESSION-REGRESSION`        | User revokes a specific session       | `[x]`  |
| `API-AUTH-REVOKE-OTHER-SESSIONS-REGRESSION` | User revokes all other sessions       | `[x]`  |

---

## Coverage Summary

| User Story          | Title                     | Spec Count            | Status   |
| ------------------- | ------------------------- | --------------------- | -------- |
| US-AUTH-SESSION-001 | Get Current Session       | 5                     | Complete |
| US-AUTH-SESSION-002 | User Sign-Out             | 5                     | Complete |
| US-AUTH-SESSION-003 | List Active Sessions      | 7                     | Complete |
| US-AUTH-SESSION-004 | Revoke Specific Session   | 5                     | Complete |
| US-AUTH-SESSION-005 | Revoke All Other Sessions | 5                     | Complete |
| **Total**           |                           | **27 + 5 regression** |          |
