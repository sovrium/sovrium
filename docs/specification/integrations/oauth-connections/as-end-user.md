# Integrations > OAuth Connections > As End User

> **Domain**: integrations
> **Feature Area**: oauth-connections
> **Role**: End User
> **Schema Path**: `src/domain/models/integrations/oauth/`
> **Spec Path**: `specs/app/integrations/oauth/`

---

## User Stories

### US-INTEG-OAUTH-USER-001: Connect External Accounts

**Story**: As an end user, I want to connect my external accounts (Google, GitHub, etc.) so that I can use integrated features.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                                 | Spec Test                     | Schema               | Status |
| ------ | ----------------------------------------- | ----------------------------- | -------------------- | ------ |
| AC-001 | OAuth flow initiated from user settings   | `APP-INTEG-OAUTH-CONNECT-001` | `integrations.oauth` | `[ ]`  |
| AC-002 | User redirected to provider authorization | `APP-INTEG-OAUTH-CONNECT-002` | `integrations.oauth` | `[ ]`  |
| AC-003 | Callback handled and tokens stored        | `APP-INTEG-OAUTH-CONNECT-003` | `integrations.oauth` | `[ ]`  |
| AC-004 | Returns 401 without authentication        | `APP-INTEG-OAUTH-CONNECT-004` | `integrations.oauth` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/integrations/oauth/user-connections.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/app/integrations/oauth/connect.spec.ts` `[ ] Needs Creation`
- **UI Route**: `/settings/integrations/connect/:provider` `[ ] Not Implemented`

---

### US-INTEG-OAUTH-USER-002: View Connected Accounts

**Story**: As an end user, I want to see which accounts are connected so that I know my current integrations.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                                     | Spec Test                  | Schema               | Status |
| ------ | --------------------------------------------- | -------------------------- | -------------------- | ------ |
| AC-001 | List of connected accounts visible            | `APP-INTEG-OAUTH-VIEW-001` | `integrations.oauth` | `[ ]`  |
| AC-002 | Connection status displayed (active, expired) | `APP-INTEG-OAUTH-VIEW-002` | `integrations.oauth` | `[ ]`  |
| AC-003 | Provider details shown (email, username)      | `APP-INTEG-OAUTH-VIEW-003` | `integrations.oauth` | `[ ]`  |
| AC-004 | Returns 401 without authentication            | `APP-INTEG-OAUTH-VIEW-004` | `integrations.oauth` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/integrations/oauth/user-connections.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/app/integrations/oauth/view.spec.ts` `[ ] Needs Creation`
- **UI Route**: `/settings/integrations` `[ ] Not Implemented`

---

### US-INTEG-OAUTH-USER-003: Disconnect Accounts

**Story**: As an end user, I want to disconnect accounts when I no longer need them so that I can revoke access.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                               | Spec Test                        | Schema               | Status |
| ------ | --------------------------------------- | -------------------------------- | -------------------- | ------ |
| AC-001 | Disconnect button available per account | `APP-INTEG-OAUTH-DISCONNECT-001` | `integrations.oauth` | `[ ]`  |
| AC-002 | Confirmation required before disconnect | `APP-INTEG-OAUTH-DISCONNECT-002` | `integrations.oauth` | `[ ]`  |
| AC-003 | Tokens removed on disconnect            | `APP-INTEG-OAUTH-DISCONNECT-003` | `integrations.oauth` | `[ ]`  |
| AC-004 | Returns 401 without authentication      | `APP-INTEG-OAUTH-DISCONNECT-004` | `integrations.oauth` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/integrations/oauth/user-connections.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/app/integrations/oauth/disconnect.spec.ts` `[ ] Needs Creation`

---

## Coverage Summary

| Story ID                | Title               | Status            | Criteria Met |
| ----------------------- | ------------------- | ----------------- | ------------ |
| US-INTEG-OAUTH-USER-001 | Connect External    | `[ ]` Not Started | 0/4          |
| US-INTEG-OAUTH-USER-002 | View Connected      | `[ ]` Not Started | 0/4          |
| US-INTEG-OAUTH-USER-003 | Disconnect Accounts | `[ ]` Not Started | 0/4          |

**Total**: 0 complete, 0 partial, 3 not started (0% complete)

---

> **Navigation**: [← Back to Integrations Domain](../README.md) | [← OAuth Connections as Developer](./as-developer.md)
