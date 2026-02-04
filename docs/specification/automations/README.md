# Automations Domain

> **Description**: Workflow automation in Sovrium applications. Automations define triggers, conditions, and actions that execute automatically, enabling powerful business logic without code.
> **Schema Path**: `src/domain/models/automations/`
> **Spec Path**: `specs/api/automations/`

---

## Feature Areas

| Feature Area         | Description                                         | Roles                        |
| -------------------- | --------------------------------------------------- | ---------------------------- |
| workflow-definition  | Define workflows with triggers, conditions, actions | Developer, App Administrator |
| triggers             | Event triggers (record, schedule, webhook, auth)    | Developer                    |
| actions              | Actions (email, records, API, notifications)        | Developer                    |
| execution-monitoring | Execution logs, status, retry, metrics              | Developer, App Administrator |

---

## User Stories by Feature Area

### [Workflow Definition](./workflow-definition/)

| File                                                                     | Stories | Status            |
| ------------------------------------------------------------------------ | ------- | ----------------- |
| [as-developer.md](./workflow-definition/as-developer.md)                 | 5       | `[ ]` Not Started |
| [as-app-administrator.md](./workflow-definition/as-app-administrator.md) | 3       | `[ ]` Not Started |

### [Triggers](./triggers/)

| File                                          | Stories | Status            |
| --------------------------------------------- | ------- | ----------------- |
| [as-developer.md](./triggers/as-developer.md) | 7       | `[ ]` Not Started |

### [Actions](./actions/)

| File                                         | Stories | Status            |
| -------------------------------------------- | ------- | ----------------- |
| [as-developer.md](./actions/as-developer.md) | 6       | `[ ]` Not Started |

### [Execution Monitoring](./execution-monitoring/)

| File                                                                      | Stories | Status            |
| ------------------------------------------------------------------------- | ------- | ----------------- |
| [as-app-administrator.md](./execution-monitoring/as-app-administrator.md) | 5       | `[ ]` Not Started |
| [as-developer.md](./execution-monitoring/as-developer.md)                 | 3       | `[ ]` Not Started |

---

## Coverage Summary

| Feature Area         | Total Stories | Complete | Partial | Not Started | Coverage |
| -------------------- | ------------- | -------- | ------- | ----------- | -------- |
| workflow-definition  | 8             | 0        | 0       | 8           | 0%       |
| triggers             | 7             | 0        | 0       | 7           | 0%       |
| actions              | 6             | 0        | 0       | 6           | 0%       |
| execution-monitoring | 8             | 0        | 0       | 8           | 0%       |
| **Total**            | **29**        | **0**    | **0**   | **29**      | **0%**   |

---

> **Navigation**: [← Back to Specification](../README.md)
