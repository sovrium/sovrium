# Health Check API

> **Feature Area**: API - System Monitoring
> **Implementation**: `src/infrastructure/server/route-setup/api-routes.ts`
> **Schema**: `src/domain/models/api/`
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
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "app": {
    "name": "my-app"
  }
}
```

### Acceptance Criteria

| ID     | Criterion                                              | E2E Spec                | Status |
| ------ | ------------------------------------------------------ | ----------------------- | ------ |
| AC-001 | Returns 200 OK with status `ok` and JSON structure     | `API-HEALTH-001`        | ✅     |
| AC-002 | Includes current ISO 8601 timestamp in response        | `API-HEALTH-002`        | ✅     |
| AC-003 | Does not require authentication                        | `API-HEALTH-003`        | ✅     |
| AC-004 | Health endpoint returns expected response (regression) | `API-HEALTH-REGRESSION` | ✅     |

### Removed Acceptance Criteria

The following criteria were removed because they do not match the current implementation and are not planned:

| ID     | Original Criterion                             | Reason Removed                                                                                                |
| ------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| AC-002 | Includes application version in response       | Health endpoint returns `app.name`, not a `version` field. Version is not part of the health response schema. |
| AC-004 | Returns 503 Service Unavailable when unhealthy | No 503 path exists in the implementation. The endpoint returns 200 or 500 (internal error) only.              |
| AC-006 | Includes database connectivity status          | Health endpoint does not perform database connectivity checks. It returns app status and metadata only.       |

### Implementation Notes

- The health endpoint response shape is `{ status: 'ok', timestamp: string, app: { name: string } }`
- The `status` field is always the literal `'ok'` (validated by Zod schema with `z.literal('ok')`)
- The `timestamp` is ISO 8601 format with millisecond precision (e.g., `2025-01-15T10:30:00.000Z`)
- The `app.name` field comes from the application schema configuration
- The health route is registered before authentication middleware, making it always accessible
- Response is validated against `healthResponseSchema` (Zod) before being sent

### Implementation References

- **Route Setup**: `src/infrastructure/server/route-setup/api-routes.ts` (lines 182-222)
- **Response Schema**: `src/domain/models/api/health.ts`
- **OpenAPI Schema**: `src/infrastructure/server/route-setup/openapi-schema.ts`
- **E2E Spec**: `specs/api/health/get.spec.ts`

---

## Regression Tests

| Spec ID                 | Workflow                              | Status |
| ----------------------- | ------------------------------------- | ------ |
| `API-HEALTH-REGRESSION` | Health endpoint returns expected data | `[x]`  |

---

## Coverage Summary

| User Story        | Title                 | Spec Count              | Status   |
| ----------------- | --------------------- | ----------------------- | -------- |
| US-API-HEALTH-001 | Health Check Endpoint | 3 @spec + 1 @regression | Complete |
| **Total**         |                       | **4 tests**             |          |
