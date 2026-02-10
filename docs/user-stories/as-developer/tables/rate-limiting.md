# Rate Limiting

> **Feature Area**: Tables - API Protection
> **Schema**: `src/domain/models/app/table/`
> **API Routes**: All `/api/tables/*` endpoints
> **E2E Specs**: `specs/api/tables/rate-limiting.spec.ts`

---

## Overview

Sovrium implements rate limiting to protect API endpoints from abuse and ensure fair usage. Rate limits can be configured per table, per endpoint type, and per user role. Rate limiting uses a sliding window algorithm with configurable limits and reset intervals.

---

## US-TABLES-RATE-001: Table Endpoint Rate Limiting

**As a** developer,
**I want to** configure rate limits for table API endpoints,
**so that** I can protect my application from abuse and ensure fair usage.

### Configuration

> **Note**: Rate limiting configuration is not yet available in the AppSchema. The YAML format below represents the target design and will be implemented in a future release.

### Acceptance Criteria

| ID     | Criterion                                               | E2E Spec                     | Status |
| ------ | ------------------------------------------------------- | ---------------------------- | ------ |
| AC-001 | Returns 429 after exceeding table read rate limit       | `API-TABLES-RATE-001`        | ✅     |
| AC-002 | Returns 429 after exceeding table write rate limit      | `API-TABLES-RATE-002`        | ✅     |
| AC-003 | Returns 429 after exceeding table delete rate limit     | `API-TABLES-RATE-003`        | ✅     |
| AC-004 | Resets rate limit counter after window expires          | `API-TABLES-RATE-004`        | ✅     |
| AC-005 | Includes Retry-After header in 429 response             | `API-TABLES-RATE-005`        | ✅     |
| AC-006 | Rate limits are applied per IP address                  | `API-TABLES-RATE-006`        | ✅     |
| AC-007 | Rate limiting protects all table endpoints (regression) | `API-TABLES-RATE-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/tables/rate-limiting.spec.ts`

---

## Regression Tests

| Spec ID                      | Workflow                               | Status |
| ---------------------------- | -------------------------------------- | ------ |
| `API-TABLES-RATE-REGRESSION` | Rate limiting protects table endpoints | `[x]`  |

---

## Coverage Summary

| User Story         | Title                        | Spec Count           | Status   |
| ------------------ | ---------------------------- | -------------------- | -------- |
| US-TABLES-RATE-001 | Table Endpoint Rate Limiting | 7                    | Complete |
| **Total**          |                              | **7 + 1 regression** |          |
