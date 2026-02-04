# Integrations > Connected Accounts > As Developer

> **Domain**: integrations
> **Feature Area**: connected-accounts
> **Role**: Developer
> **Schema Path**: `src/domain/models/integrations/accounts/`
> **Spec Path**: `specs/api/integrations/accounts/`

---

## User Stories

### US-INTEG-ACCT-001: Configure Redirect URIs

**Story**: As a developer, I want to configure redirect URIs for OAuth flows so that callbacks work correctly.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                                | Spec Test                     | Schema                  | Status |
| ------ | ---------------------------------------- | ----------------------------- | ----------------------- | ------ |
| AC-001 | Redirect URIs configurable in app schema | `API-INTEG-ACCT-REDIRECT-001` | `integrations.accounts` | `[ ]`  |
| AC-002 | Multiple redirect URIs supported         | `API-INTEG-ACCT-REDIRECT-002` | `integrations.accounts` | `[ ]`  |
| AC-003 | URIs validated for security              | `API-INTEG-ACCT-REDIRECT-003` | `integrations.accounts` | `[ ]`  |
| AC-004 | Returns 401 without authentication       | `API-INTEG-ACCT-REDIRECT-004` | `integrations.accounts` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/integrations/accounts/redirect.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/integrations/accounts/redirect.spec.ts` `[ ] Needs Creation`

---

### US-INTEG-ACCT-002: Test OAuth Flows

**Story**: As a developer, I want to test OAuth flows in development environment so that I can debug integration issues.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                               | Spec Test                 | Schema                  | Status |
| ------ | --------------------------------------- | ------------------------- | ----------------------- | ------ |
| AC-001 | Development OAuth credentials supported | `API-INTEG-ACCT-TEST-001` | `integrations.accounts` | `[ ]`  |
| AC-002 | Test mode distinguishes from production | `API-INTEG-ACCT-TEST-002` | `integrations.accounts` | `[ ]`  |
| AC-003 | OAuth flow debuggable with logging      | `API-INTEG-ACCT-TEST-003` | `integrations.accounts` | `[ ]`  |
| AC-004 | Returns 401 without authentication      | `API-INTEG-ACCT-TEST-004` | `integrations.accounts` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/integrations/accounts/test-mode.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/integrations/accounts/test-mode.spec.ts` `[ ] Needs Creation`

---

### US-INTEG-ACCT-003: Error Logging for OAuth

**Story**: As a developer, I want error logging for failed OAuth operations so that I can troubleshoot problems.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                                | Spec Test                  | Schema                  | Status |
| ------ | ---------------------------------------- | -------------------------- | ----------------------- | ------ |
| AC-001 | OAuth errors logged with details         | `API-INTEG-ACCT-ERROR-001` | `integrations.accounts` | `[ ]`  |
| AC-002 | Error context includes provider and user | `API-INTEG-ACCT-ERROR-002` | `integrations.accounts` | `[ ]`  |
| AC-003 | Logs accessible for debugging            | `API-INTEG-ACCT-ERROR-003` | `integrations.accounts` | `[ ]`  |
| AC-004 | Returns 401 without authentication       | `API-INTEG-ACCT-ERROR-004` | `integrations.accounts` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/integrations/accounts/error-log.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/integrations/accounts/error-log.spec.ts` `[ ] Needs Creation`

---

## Coverage Summary

| Story ID          | Title                   | Status            | Criteria Met |
| ----------------- | ----------------------- | ----------------- | ------------ |
| US-INTEG-ACCT-001 | Configure Redirect URIs | `[ ]` Not Started | 0/4          |
| US-INTEG-ACCT-002 | Test OAuth Flows        | `[ ]` Not Started | 0/4          |
| US-INTEG-ACCT-003 | Error Logging           | `[ ]` Not Started | 0/4          |

**Total**: 0 complete, 0 partial, 3 not started (0% complete)

---

> **Navigation**: [← Back to Integrations Domain](../README.md) | [← Connected Accounts as App Administrator](./as-app-administrator.md)
