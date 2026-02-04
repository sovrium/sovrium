# Permission Testing Strategy - Layer Separation

## Overview

Sovrium uses a comprehensive testing strategy for permissions, with tests at two distinct architectural layers.

## Layer 1: API Endpoints (specs/api/auth/\*)

Tests Better Auth API functionality and workflow correctness.

**What it tests:**

- HTTP status codes
- Response schemas
- API workflow completion
- Authentication flows
- Permission enforcement

**Key spec files:**

- `specs/api/auth/organization/` - Organization management API
- `specs/api/auth/get-session/` - Session retrieval
- `specs/api/auth/sign-in/`, `sign-up/`, etc. - Auth workflows

## Layer 2: Security Enforcement (specs/api/auth/enforcement/)

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

## Why Two Layers?

Each layer catches different failure modes:

| Layer                | Failure Mode Caught                                          |
| -------------------- | ------------------------------------------------------------ |
| API Endpoints        | Broken API contracts, incorrect responses, workflow failures |
| Security Enforcement | API authorization bypass, parameter tampering, IDOR attacks  |

## Cross-References

All permission-related spec files include "Related Tests:" comments in their headers to help developers understand the full testing picture.
