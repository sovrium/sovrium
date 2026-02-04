# Automations > Triggers > As Developer

> **Domain**: automations
> **Feature Area**: triggers
> **Role**: Developer
> **Schema Path**: `src/domain/models/automations/triggers/`
> **Spec Path**: `specs/api/automations/triggers/`

---

## User Stories

### US-AUTO-TRIGGER-001: Record Creation Trigger

**Story**: As a developer, I want triggers for record creation so that workflows run when data is added.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                                 | Spec Test                     | Schema                 | Status |
| ------ | ----------------------------------------- | ----------------------------- | ---------------------- | ------ |
| AC-001 | Trigger fires on record creation          | `API-AUTO-TRIGGER-CREATE-001` | `automations.triggers` | `[ ]`  |
| AC-002 | Trigger scoped to specific table          | `API-AUTO-TRIGGER-CREATE-002` | `automations.triggers` | `[ ]`  |
| AC-003 | Created record data available to workflow | `API-AUTO-TRIGGER-CREATE-003` | `automations.triggers` | `[ ]`  |
| AC-004 | Returns 401 without authentication        | `API-AUTO-TRIGGER-CREATE-004` | `automations.triggers` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/automations/triggers/record-create.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/automations/triggers/record-create.spec.ts` `[ ] Needs Creation`

---

### US-AUTO-TRIGGER-002: Record Update Trigger

**Story**: As a developer, I want triggers for record updates so that workflows run when data changes.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                                 | Spec Test                     | Schema                 | Status |
| ------ | ----------------------------------------- | ----------------------------- | ---------------------- | ------ |
| AC-001 | Trigger fires on record update            | `API-AUTO-TRIGGER-UPDATE-001` | `automations.triggers` | `[ ]`  |
| AC-002 | Can filter on specific field changes      | `API-AUTO-TRIGGER-UPDATE-002` | `automations.triggers` | `[ ]`  |
| AC-003 | Before/after values available to workflow | `API-AUTO-TRIGGER-UPDATE-003` | `automations.triggers` | `[ ]`  |
| AC-004 | Returns 401 without authentication        | `API-AUTO-TRIGGER-UPDATE-004` | `automations.triggers` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/automations/triggers/record-update.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/automations/triggers/record-update.spec.ts` `[ ] Needs Creation`

---

### US-AUTO-TRIGGER-003: Record Deletion Trigger

**Story**: As a developer, I want triggers for record deletion so that workflows run when data is removed.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                                 | Spec Test                     | Schema                 | Status |
| ------ | ----------------------------------------- | ----------------------------- | ---------------------- | ------ |
| AC-001 | Trigger fires on record deletion          | `API-AUTO-TRIGGER-DELETE-001` | `automations.triggers` | `[ ]`  |
| AC-002 | Deleted record data available to workflow | `API-AUTO-TRIGGER-DELETE-002` | `automations.triggers` | `[ ]`  |
| AC-003 | Trigger fires before or after deletion    | `API-AUTO-TRIGGER-DELETE-003` | `automations.triggers` | `[ ]`  |
| AC-004 | Returns 401 without authentication        | `API-AUTO-TRIGGER-DELETE-004` | `automations.triggers` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/automations/triggers/record-delete.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/automations/triggers/record-delete.spec.ts` `[ ] Needs Creation`

---

### US-AUTO-TRIGGER-004: Scheduled Trigger

**Story**: As a developer, I want triggers for scheduled times (cron) so that workflows run periodically.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                            | Spec Test                       | Schema                 | Status |
| ------ | ------------------------------------ | ------------------------------- | ---------------------- | ------ |
| AC-001 | Cron expression supported            | `API-AUTO-TRIGGER-SCHEDULE-001` | `automations.triggers` | `[ ]`  |
| AC-002 | Timezone configurable                | `API-AUTO-TRIGGER-SCHEDULE-002` | `automations.triggers` | `[ ]`  |
| AC-003 | Execution time available to workflow | `API-AUTO-TRIGGER-SCHEDULE-003` | `automations.triggers` | `[ ]`  |
| AC-004 | Returns 401 without authentication   | `API-AUTO-TRIGGER-SCHEDULE-004` | `automations.triggers` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/automations/triggers/schedule.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/automations/triggers/schedule.spec.ts` `[ ] Needs Creation`

---

### US-AUTO-TRIGGER-005: Form Submission Trigger

**Story**: As a developer, I want triggers for form submissions so that workflows process user input.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                          | Spec Test                   | Schema                 | Status |
| ------ | ---------------------------------- | --------------------------- | ---------------------- | ------ |
| AC-001 | Trigger fires on form submission   | `API-AUTO-TRIGGER-FORM-001` | `automations.triggers` | `[ ]`  |
| AC-002 | Form data available to workflow    | `API-AUTO-TRIGGER-FORM-002` | `automations.triggers` | `[ ]`  |
| AC-003 | Scoped to specific forms           | `API-AUTO-TRIGGER-FORM-003` | `automations.triggers` | `[ ]`  |
| AC-004 | Returns 401 without authentication | `API-AUTO-TRIGGER-FORM-004` | `automations.triggers` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/automations/triggers/form-submit.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/automations/triggers/form-submit.spec.ts` `[ ] Needs Creation`

---

### US-AUTO-TRIGGER-006: Webhook Trigger

**Story**: As a developer, I want triggers for webhook events so that external systems can start workflows.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                              | Spec Test                      | Schema                 | Status |
| ------ | -------------------------------------- | ------------------------------ | ---------------------- | ------ |
| AC-001 | Webhook URL generated per workflow     | `API-AUTO-TRIGGER-WEBHOOK-001` | `automations.triggers` | `[ ]`  |
| AC-002 | Incoming payload available to workflow | `API-AUTO-TRIGGER-WEBHOOK-002` | `automations.triggers` | `[ ]`  |
| AC-003 | Webhook authentication configurable    | `API-AUTO-TRIGGER-WEBHOOK-003` | `automations.triggers` | `[ ]`  |
| AC-004 | Returns 401 without authentication     | `API-AUTO-TRIGGER-WEBHOOK-004` | `automations.triggers` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/automations/triggers/webhook.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/automations/triggers/webhook.spec.ts` `[ ] Needs Creation`

---

### US-AUTO-TRIGGER-007: Authentication Trigger

**Story**: As a developer, I want triggers for user actions (login, signup) so that I can respond to authentication events.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                          | Spec Test                   | Schema                 | Status |
| ------ | ---------------------------------- | --------------------------- | ---------------------- | ------ |
| AC-001 | Trigger fires on user login        | `API-AUTO-TRIGGER-AUTH-001` | `automations.triggers` | `[ ]`  |
| AC-002 | Trigger fires on user signup       | `API-AUTO-TRIGGER-AUTH-002` | `automations.triggers` | `[ ]`  |
| AC-003 | User data available to workflow    | `API-AUTO-TRIGGER-AUTH-003` | `automations.triggers` | `[ ]`  |
| AC-004 | Returns 401 without authentication | `API-AUTO-TRIGGER-AUTH-004` | `automations.triggers` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/automations/triggers/auth.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/automations/triggers/auth.spec.ts` `[ ] Needs Creation`

---

## Coverage Summary

| Story ID            | Title           | Status            | Criteria Met |
| ------------------- | --------------- | ----------------- | ------------ |
| US-AUTO-TRIGGER-001 | Record Creation | `[ ]` Not Started | 0/4          |
| US-AUTO-TRIGGER-002 | Record Update   | `[ ]` Not Started | 0/4          |
| US-AUTO-TRIGGER-003 | Record Deletion | `[ ]` Not Started | 0/4          |
| US-AUTO-TRIGGER-004 | Scheduled       | `[ ]` Not Started | 0/4          |
| US-AUTO-TRIGGER-005 | Form Submission | `[ ]` Not Started | 0/4          |
| US-AUTO-TRIGGER-006 | Webhook         | `[ ]` Not Started | 0/4          |
| US-AUTO-TRIGGER-007 | Authentication  | `[ ]` Not Started | 0/4          |

**Total**: 0 complete, 0 partial, 7 not started (0% complete)

---

> **Navigation**: [← Back to Automations Domain](../README.md)
