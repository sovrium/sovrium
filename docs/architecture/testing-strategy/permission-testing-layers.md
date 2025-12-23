# Permission Testing Strategy - Layer Separation

## Overview

Sovrium uses a defense-in-depth testing strategy for permissions, with tests at three distinct architectural layers.

## Layer 1: Database Schema (specs/app/tables/permissions/)

Tests PostgreSQL RLS policy generation from domain models.

**What it tests:**

- RLS policy existence and correctness
- Policy SQL definitions
- Session variable usage (`app.user_id`, `app.organization_id`, `app.user_role`)
- Field-level permission metadata

**Key spec files:**

- `organization-isolation.spec.ts` - Organization-scoped RLS policies
- `rls-enforcement.spec.ts` - General RLS policy validation
- `session-context.spec.ts` - PostgreSQL session variable setup

## Layer 2: API Endpoints (specs/api/auth/\*)

Tests Better Auth API functionality and workflow correctness.

**What it tests:**

- HTTP status codes
- Response schemas
- API workflow completion
- Authentication flows

**Key spec files:**

- `specs/api/auth/organization/` - Organization management API
- `specs/api/auth/get-session/` - Session retrieval
- `specs/api/auth/sign-in/`, `sign-up/`, etc. - Auth workflows

## Layer 3: Security Enforcement (specs/api/auth/enforcement/)

Tests attack prevention and authorization boundaries.

**What it tests:**

- Horizontal privilege escalation (user A accessing user B's data)
- Vertical privilege escalation (regular user accessing admin endpoints)
- IDOR attacks
- Session isolation and fixation
- Organization boundary enforcement

**Key spec files:**

- `authorization-bypass.spec.ts` - Authorization attack scenarios
- `session-enforcement.spec.ts` - Session security
- `admin-enforcement.spec.ts` - Admin role enforcement

## Why Three Layers?

Each layer catches different failure modes:

| Layer                | Failure Mode Caught                                                               |
| -------------------- | --------------------------------------------------------------------------------- |
| Database Schema      | Wrong policy definitions, missing policies, incorrect session variable references |
| API Endpoints        | Broken API contracts, incorrect responses, workflow failures                      |
| Security Enforcement | API bypassing RLS, parameter tampering, IDOR attacks                              |

## Cross-References

All permission-related spec files include "Related Tests:" comments in their headers to help developers understand the full testing picture.
