# Integrations > Connected Accounts > As App Administrator

> **Domain**: integrations
> **Feature Area**: connected-accounts
> **Role**: App Administrator
> **Schema Path**: `src/domain/models/integrations/accounts/`
> **Spec Path**: `specs/app/integrations/accounts/`

---

## User Stories

### US-INTEG-ACCT-ADMIN-001: View Integration Status

**Story**: As an app administrator, I want to see all OAuth integrations and their status (connected, expired, error) so that I can monitor health.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                                    | Spec Test                   | Schema                  | Status |
| ------ | -------------------------------------------- | --------------------------- | ----------------------- | ------ |
| AC-001 | List all configured OAuth integrations       | `APP-INTEG-ACCT-STATUS-001` | `integrations.accounts` | `[ ]`  |
| AC-002 | Status displayed (connected, expired, error) | `APP-INTEG-ACCT-STATUS-002` | `integrations.accounts` | `[ ]`  |
| AC-003 | User count per integration shown             | `APP-INTEG-ACCT-STATUS-003` | `integrations.accounts` | `[ ]`  |
| AC-004 | Returns 401 without authentication           | `APP-INTEG-ACCT-STATUS-004` | `integrations.accounts` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/integrations/accounts/status.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/app/integrations/accounts/status.spec.ts` `[ ] Needs Creation`
- **UI Route**: `/admin/integrations` `[ ] Not Implemented`

---

### US-INTEG-ACCT-ADMIN-002: Re-Authorize Expired Tokens

**Story**: As an app administrator, I want to re-authorize expired tokens with one click so that I can restore functionality.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                                   | Spec Test                   | Schema                  | Status |
| ------ | ------------------------------------------- | --------------------------- | ----------------------- | ------ |
| AC-001 | Re-authorize button for expired connections | `APP-INTEG-ACCT-REAUTH-001` | `integrations.accounts` | `[ ]`  |
| AC-002 | OAuth flow initiated for re-authorization   | `APP-INTEG-ACCT-REAUTH-002` | `integrations.accounts` | `[ ]`  |
| AC-003 | Tokens updated without losing user data     | `APP-INTEG-ACCT-REAUTH-003` | `integrations.accounts` | `[ ]`  |
| AC-004 | Returns 401 without authentication          | `APP-INTEG-ACCT-REAUTH-004` | `integrations.accounts` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/integrations/accounts/reauthorize.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/app/integrations/accounts/reauthorize.spec.ts` `[ ] Needs Creation`

---

### US-INTEG-ACCT-ADMIN-003: View Usage Statistics

**Story**: As an app administrator, I want to see usage statistics per integration (API calls made, rate limit status) so that I can plan capacity.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                                | Spec Test                  | Schema                  | Status |
| ------ | ---------------------------------------- | -------------------------- | ----------------------- | ------ |
| AC-001 | API call count displayed per integration | `APP-INTEG-ACCT-USAGE-001` | `integrations.accounts` | `[ ]`  |
| AC-002 | Rate limit status visible                | `APP-INTEG-ACCT-USAGE-002` | `integrations.accounts` | `[ ]`  |
| AC-003 | Usage trends over time shown             | `APP-INTEG-ACCT-USAGE-003` | `integrations.accounts` | `[ ]`  |
| AC-004 | Returns 401 without authentication       | `APP-INTEG-ACCT-USAGE-004` | `integrations.accounts` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/integrations/accounts/usage.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/app/integrations/accounts/usage.spec.ts` `[ ] Needs Creation`

---

### US-INTEG-ACCT-ADMIN-004: Disconnect with Data Retention

**Story**: As an app administrator, I want to safely disconnect integrations with data retention options so that I can clean up unused connections.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                                     | Spec Test                       | Schema                  | Status |
| ------ | --------------------------------------------- | ------------------------------- | ----------------------- | ------ |
| AC-001 | Disconnect option with data retention choices | `APP-INTEG-ACCT-DISCONNECT-001` | `integrations.accounts` | `[ ]`  |
| AC-002 | Option to keep or delete associated data      | `APP-INTEG-ACCT-DISCONNECT-002` | `integrations.accounts` | `[ ]`  |
| AC-003 | Confirmation required before disconnect       | `APP-INTEG-ACCT-DISCONNECT-003` | `integrations.accounts` | `[ ]`  |
| AC-004 | Returns 401 without authentication            | `APP-INTEG-ACCT-DISCONNECT-004` | `integrations.accounts` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/integrations/accounts/disconnect.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/app/integrations/accounts/disconnect.spec.ts` `[ ] Needs Creation`

---

## Coverage Summary

| Story ID                | Title                     | Status            | Criteria Met |
| ----------------------- | ------------------------- | ----------------- | ------------ |
| US-INTEG-ACCT-ADMIN-001 | View Integration Status   | `[ ]` Not Started | 0/4          |
| US-INTEG-ACCT-ADMIN-002 | Re-Authorize Expired      | `[ ]` Not Started | 0/4          |
| US-INTEG-ACCT-ADMIN-003 | View Usage Statistics     | `[ ]` Not Started | 0/4          |
| US-INTEG-ACCT-ADMIN-004 | Disconnect with Retention | `[ ]` Not Started | 0/4          |

**Total**: 0 complete, 0 partial, 4 not started (0% complete)

---

> **Navigation**: [← Back to Integrations Domain](../README.md) | [Connected Accounts as Developer →](./as-developer.md)
