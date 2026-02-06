# Health Check API

> **Feature Area**: API - System Monitoring
> **Schema**: `src/presentation/api/routes/health.ts`
> **API Routes**: `GET /api/health`
> **E2E Specs**: `specs/api/health/get.spec.ts`

---

## Overview

Sovrium provides a health check endpoint for monitoring system status. This endpoint is used by load balancers, monitoring tools, and deployment pipelines to verify that the application is running and responsive.

---

## US-API-HEALTH-001: Health Check Endpoint

**As a** developer,
**I want to** check the health status of the application via API,
**so that** I can monitor the system and integrate with deployment tools.

### API Request

```
GET /api/health
```

### Response

```json
{
  "status": "healthy",
  "version": "0.0.1",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

### Acceptance Criteria

| ID     | Criterion                                              | E2E Spec                | Status |
| ------ | ------------------------------------------------------ | ----------------------- | ------ |
| AC-001 | Returns 200 OK with healthy status                     | `API-HEALTH-001`        | ❓     |
| AC-002 | Includes application version in response               | `API-HEALTH-002`        | ❓     |
| AC-003 | Includes current timestamp in response                 | `API-HEALTH-003`        | ❓     |
| AC-004 | Returns 503 Service Unavailable when unhealthy         | `API-HEALTH-004`        | ❓     |
| AC-005 | Does not require authentication                        | `API-HEALTH-005`        | ❓     |
| AC-006 | Includes database connectivity status                  | `API-HEALTH-006`        | ❓     |
| AC-007 | Health endpoint returns expected response (regression) | `API-HEALTH-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/presentation/api/routes/health.ts`
- **E2E Spec**: `specs/api/health/get.spec.ts`

---

## Regression Tests

| Spec ID                 | Workflow                              | Status |
| ----------------------- | ------------------------------------- | ------ |
| `API-HEALTH-REGRESSION` | Health endpoint returns expected data | `[x]`  |

---

## Coverage Summary

| User Story        | Title                 | Spec Count           | Status   |
| ----------------- | --------------------- | -------------------- | -------- |
| US-API-HEALTH-001 | Health Check Endpoint | 7                    | Complete |
| **Total**         |                       | **7 + 1 regression** |          |
