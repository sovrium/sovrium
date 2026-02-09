# Admin Bootstrap

> **Feature Area**: Authentication - Admin Account Creation
> **Schema**: `src/domain/models/app/auth/`
> **API Routes**: Bootstrap on server startup
> **E2E Specs**: `specs/api/auth/admin/bootstrap/`

---

## Overview

Sovrium supports automatic admin account creation on first startup using environment variables. This allows deployers to provision the initial administrator without manual database operations. The bootstrap process validates credentials, prevents duplicates, and logs the operation securely.

---

## US-AUTH-BOOTSTRAP-001: Admin Bootstrap on First Startup

**As a** business admin,
**I want to** have an admin account automatically created on first startup,
**so that** I can access the admin panel without manual database operations.

### Configuration

```bash
# Environment variables for admin bootstrap
SOVRIUM_ADMIN_EMAIL=admin@example.com
SOVRIUM_ADMIN_PASSWORD=SecureP@ssw0rd!
SOVRIUM_ADMIN_NAME=System Administrator  # Optional, defaults to "Admin"
```

### App Schema

```yaml
auth:
  emailAndPassword: true
  adminPlugin:
    enabled: true
    bootstrap:
      enabled: true # Enable env var bootstrap
```

### Acceptance Criteria

| ID     | Criterion                                                         | E2E Spec                              | Status |
| ------ | ----------------------------------------------------------------- | ------------------------------------- | ------ |
| AC-001 | Creates admin account on first startup when env vars are set      | `API-AUTH-ADMIN-BOOTSTRAP-001`        | ✅     |
| AC-002 | Creates admin with verified email status                          | `API-AUTH-ADMIN-BOOTSTRAP-002`        | ✅     |
| AC-003 | Allows admin to access admin-only endpoints after bootstrap       | `API-AUTH-ADMIN-BOOTSTRAP-003`        | ✅     |
| AC-004 | Does not create duplicate admin on subsequent startups            | `API-AUTH-ADMIN-BOOTSTRAP-004`        | ✅     |
| AC-005 | Does not modify existing user if email exists with different role | `API-AUTH-ADMIN-BOOTSTRAP-005`        | ✅     |
| AC-006 | Does not create admin when email env var is missing               | `API-AUTH-ADMIN-BOOTSTRAP-006`        | ✅     |
| AC-007 | Does not create admin when password env var is missing            | `API-AUTH-ADMIN-BOOTSTRAP-007`        | ✅     |
| AC-008 | Creates admin with default name when name env var is missing      | `API-AUTH-ADMIN-BOOTSTRAP-008`        | ✅     |
| AC-009 | Does not create admin with invalid email format                   | `API-AUTH-ADMIN-BOOTSTRAP-009`        | ✅     |
| AC-010 | Does not create admin with password shorter than minimum length   | `API-AUTH-ADMIN-BOOTSTRAP-010`        | ✅     |
| AC-011 | Does not create admin when admin plugin is not enabled            | `API-AUTH-ADMIN-BOOTSTRAP-011`        | ✅     |
| AC-012 | Does not create admin when auth is completely disabled            | `API-AUTH-ADMIN-BOOTSTRAP-012`        | ✅     |
| AC-013 | Logs admin creation success without exposing password             | `API-AUTH-ADMIN-BOOTSTRAP-013`        | ✅     |
| AC-014 | Admin bootstrap workflow completes successfully (regression)      | `API-AUTH-ADMIN-BOOTSTRAP-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/auth/admin/bootstrap/admin-bootstrap.spec.ts`

---

## Regression Tests

| Spec ID                               | Workflow                                        | Status |
| ------------------------------------- | ----------------------------------------------- | ------ |
| `API-AUTH-ADMIN-BOOTSTRAP-REGRESSION` | Admin bootstrap workflow completes successfully | ✅     |

---

## Coverage Summary

| User Story            | Title                      | Spec Count            | Status   |
| --------------------- | -------------------------- | --------------------- | -------- |
| US-AUTH-BOOTSTRAP-001 | Admin Bootstrap on Startup | 13                    | Complete |
| **Total**             |                            | **13 + 1 regression** |          |
