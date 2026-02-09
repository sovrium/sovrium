# Security Enforcement

> **Feature Area**: Authentication - Security Features
> **Schema**: `src/domain/models/app/auth/`
> **E2E Specs**: `specs/api/auth/rate-limiting.spec.ts`, `specs/api/auth/enforcement/disabled-auth.spec.ts`

---

## US-AUTH-SECURITY-001: Rate Limiting

**As a** developer,
**I want to** protect authentication endpoints from brute force attacks,
**so that** malicious actors cannot guess user credentials.

### Configuration

```yaml
auth:
  rateLimit:
    enabled: true
    window: 60 # seconds
    maxAttempts: 5
```

### Acceptance Criteria

| ID     | Criterion                                              | E2E Spec                   | Status |
| ------ | ------------------------------------------------------ | -------------------------- | ------ |
| AC-001 | Returns 429 after exceeding sign-in rate limit         | `API-AUTH-RATE-001`        | ✅     |
| AC-002 | Resets sign-in rate limit after window expires         | `API-AUTH-RATE-002`        | ✅     |
| AC-003 | Returns 429 after exceeding sign-up rate limit         | `API-AUTH-RATE-003`        | ✅     |
| AC-004 | Returns 429 after exceeding password reset rate limit  | `API-AUTH-RATE-004`        | ✅     |
| AC-005 | Includes Retry-After header in 429 response            | `API-AUTH-RATE-005`        | ✅     |
| AC-006 | Rate limits by IP address, not session                 | `API-AUTH-RATE-006`        | ✅     |
| AC-007 | Rate limiting protects all auth endpoints (regression) | `API-AUTH-RATE-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/rate-limiting.spec.ts`

---

## US-AUTH-SECURITY-002: Disabled Authentication

**As a** developer,
**I want to** completely disable authentication,
**so that** I can build public-only applications without auth overhead.

### Configuration

```yaml
auth:
  enabled: false
```

### Acceptance Criteria

| ID     | Criterion                                            | E2E Spec                       | Status |
| ------ | ---------------------------------------------------- | ------------------------------ | ------ |
| AC-001 | Returns 404 for sign-in when auth disabled           | `API-AUTH-DISABLED-001`        | ✅     |
| AC-002 | Returns 404 for sign-up when auth disabled           | `API-AUTH-DISABLED-002`        | ✅     |
| AC-003 | Returns 404 for session endpoints when auth disabled | `API-AUTH-DISABLED-003`        | ✅     |
| AC-004 | Returns 404 for admin endpoints when auth disabled   | `API-AUTH-DISABLED-004`        | ✅     |
| AC-005 | All auth endpoints hidden when disabled (regression) | `API-AUTH-DISABLED-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/enforcement/disabled-auth.spec.ts`

---

## Regression Tests

| Spec ID                        | Workflow                              | Status |
| ------------------------------ | ------------------------------------- | ------ |
| `API-AUTH-RATE-REGRESSION`     | Rate limiting protects authentication | `[x]`  |
| `API-AUTH-DISABLED-REGRESSION` | Auth endpoints properly disabled      | `[x]`  |

---

## Coverage Summary

| User Story           | Title                   | Spec Count | Status   |
| -------------------- | ----------------------- | ---------- | -------- |
| US-AUTH-SECURITY-001 | Rate Limiting           | 7          | Complete |
| US-AUTH-SECURITY-002 | Disabled Authentication | 5          | Complete |
| **Total**            |                         | **12**     |          |
