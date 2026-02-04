# Automations > Actions > As Developer

> **Domain**: automations
> **Feature Area**: actions
> **Role**: Developer
> **Schema Path**: `src/domain/models/automations/actions/`
> **Spec Path**: `specs/api/automations/actions/`

---

## User Stories

### US-AUTO-ACTION-001: Send Email

**Story**: As a developer, I want actions to send emails so that workflows can notify users.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                            | Spec Test                   | Schema                | Status |
| ------ | ------------------------------------ | --------------------------- | --------------------- | ------ |
| AC-001 | Email sent to configured recipients  | `API-AUTO-ACTION-EMAIL-001` | `automations.actions` | `[ ]`  |
| AC-002 | Email subject and body configurable  | `API-AUTO-ACTION-EMAIL-002` | `automations.actions` | `[ ]`  |
| AC-003 | Template variables from trigger data | `API-AUTO-ACTION-EMAIL-003` | `automations.actions` | `[ ]`  |
| AC-004 | Returns 401 without authentication   | `API-AUTO-ACTION-EMAIL-004` | `automations.actions` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/automations/actions/email.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/automations/actions/email.spec.ts` `[ ] Needs Creation`

---

### US-AUTO-ACTION-002: Modify Records

**Story**: As a developer, I want actions to create/update/delete records so that workflows can modify data.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                          | Spec Test                    | Schema                | Status |
| ------ | ---------------------------------- | ---------------------------- | --------------------- | ------ |
| AC-001 | Action can create new records      | `API-AUTO-ACTION-RECORD-001` | `automations.actions` | `[ ]`  |
| AC-002 | Action can update existing records | `API-AUTO-ACTION-RECORD-002` | `automations.actions` | `[ ]`  |
| AC-003 | Action can delete records          | `API-AUTO-ACTION-RECORD-003` | `automations.actions` | `[ ]`  |
| AC-004 | Returns 401 without authentication | `API-AUTO-ACTION-RECORD-004` | `automations.actions` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/automations/actions/record.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/automations/actions/record.spec.ts` `[ ] Needs Creation`

---

### US-AUTO-ACTION-003: Call External API

**Story**: As a developer, I want actions to call external APIs (webhooks) so that workflows can integrate with other systems.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                              | Spec Test                 | Schema                | Status |
| ------ | -------------------------------------- | ------------------------- | --------------------- | ------ |
| AC-001 | HTTP requests to external URLs         | `API-AUTO-ACTION-API-001` | `automations.actions` | `[ ]`  |
| AC-002 | Configurable method, headers, body     | `API-AUTO-ACTION-API-002` | `automations.actions` | `[ ]`  |
| AC-003 | Response data available to next action | `API-AUTO-ACTION-API-003` | `automations.actions` | `[ ]`  |
| AC-004 | Returns 401 without authentication     | `API-AUTO-ACTION-API-004` | `automations.actions` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/automations/actions/http.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/automations/actions/http.spec.ts` `[ ] Needs Creation`

---

### US-AUTO-ACTION-004: Send Notification

**Story**: As a developer, I want actions to send notifications (in-app, push) so that users are informed in real-time.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                          | Spec Test                    | Schema                | Status |
| ------ | ---------------------------------- | ---------------------------- | --------------------- | ------ |
| AC-001 | In-app notifications supported     | `API-AUTO-ACTION-NOTIFY-001` | `automations.actions` | `[ ]`  |
| AC-002 | Push notifications supported       | `API-AUTO-ACTION-NOTIFY-002` | `automations.actions` | `[ ]`  |
| AC-003 | Notification content configurable  | `API-AUTO-ACTION-NOTIFY-003` | `automations.actions` | `[ ]`  |
| AC-004 | Returns 401 without authentication | `API-AUTO-ACTION-NOTIFY-004` | `automations.actions` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/automations/actions/notification.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/automations/actions/notification.spec.ts` `[ ] Needs Creation`

---

### US-AUTO-ACTION-005: Delay/Wait

**Story**: As a developer, I want actions to delay/wait for a period so that I can build time-based sequences.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                          | Spec Test                   | Schema                | Status |
| ------ | ---------------------------------- | --------------------------- | --------------------- | ------ |
| AC-001 | Delay duration configurable        | `API-AUTO-ACTION-DELAY-001` | `automations.actions` | `[ ]`  |
| AC-002 | Wait until specific time supported | `API-AUTO-ACTION-DELAY-002` | `automations.actions` | `[ ]`  |
| AC-003 | Delayed actions resume after wait  | `API-AUTO-ACTION-DELAY-003` | `automations.actions` | `[ ]`  |
| AC-004 | Returns 401 without authentication | `API-AUTO-ACTION-DELAY-004` | `automations.actions` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/automations/actions/delay.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/automations/actions/delay.spec.ts` `[ ] Needs Creation`

---

### US-AUTO-ACTION-006: Conditional Branch

**Story**: As a developer, I want actions to branch based on conditions so that workflows can have different paths.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                           | Spec Test                    | Schema                | Status |
| ------ | ----------------------------------- | ---------------------------- | --------------------- | ------ |
| AC-001 | If/else branching supported         | `API-AUTO-ACTION-BRANCH-001` | `automations.actions` | `[ ]`  |
| AC-002 | Multiple branches (switch/case)     | `API-AUTO-ACTION-BRANCH-002` | `automations.actions` | `[ ]`  |
| AC-003 | Branch conditions use workflow data | `API-AUTO-ACTION-BRANCH-003` | `automations.actions` | `[ ]`  |
| AC-004 | Returns 401 without authentication  | `API-AUTO-ACTION-BRANCH-004` | `automations.actions` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/automations/actions/branch.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/automations/actions/branch.spec.ts` `[ ] Needs Creation`

---

## Coverage Summary

| Story ID           | Title              | Status            | Criteria Met |
| ------------------ | ------------------ | ----------------- | ------------ |
| US-AUTO-ACTION-001 | Send Email         | `[ ]` Not Started | 0/4          |
| US-AUTO-ACTION-002 | Modify Records     | `[ ]` Not Started | 0/4          |
| US-AUTO-ACTION-003 | Call External API  | `[ ]` Not Started | 0/4          |
| US-AUTO-ACTION-004 | Send Notification  | `[ ]` Not Started | 0/4          |
| US-AUTO-ACTION-005 | Delay/Wait         | `[ ]` Not Started | 0/4          |
| US-AUTO-ACTION-006 | Conditional Branch | `[ ]` Not Started | 0/4          |

**Total**: 0 complete, 0 partial, 6 not started (0% complete)

---

> **Navigation**: [← Back to Automations Domain](../README.md)
