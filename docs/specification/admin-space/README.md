# Admin Space Domain

> **Description**: Sovrium's command center for managing applications. The Admin Space provides visual management capabilities that complement configuration files, enabling both developers and business users to work effectively.
> **Schema Path**: `src/domain/models/admin-space/`
> **Spec Path**: `specs/app/admin-space/`

---

## Feature Areas

| Feature Area      | Description                                  | Roles                              |
| ----------------- | -------------------------------------------- | ---------------------------------- |
| dashboard         | App health overview, activity, alerts        | App Administrator                  |
| app-editor        | Configuration editing modes (JSON, Form, AI) | Developer, Business User, Any User |
| schema-versioning | Version history, rollback, diff, audit trail | App Administrator                  |
| test-environment  | Staging, preview, deployment workflow        | Developer, App Administrator       |
| settings          | App settings, environment variables, backup  | App Administrator                  |

---

## User Stories by Feature Area

### [Dashboard](./dashboard/)

| File                                                           | Stories | Status            |
| -------------------------------------------------------------- | ------- | ----------------- |
| [as-app-administrator.md](./dashboard/as-app-administrator.md) | 4       | `[ ]` Not Started |

### [App Editor](./app-editor/)

| File                                                    | Stories | Status            |
| ------------------------------------------------------- | ------- | ----------------- |
| [as-developer.md](./app-editor/as-developer.md)         | 4       | `[ ]` Not Started |
| [as-business-user.md](./app-editor/as-business-user.md) | 3       | `[ ]` Not Started |
| [as-any-user.md](./app-editor/as-any-user.md)           | 4       | `[ ]` Not Started |

### [Schema Versioning](./schema-versioning/)

| File                                                                   | Stories | Status            |
| ---------------------------------------------------------------------- | ------- | ----------------- |
| [as-app-administrator.md](./schema-versioning/as-app-administrator.md) | 5       | `[ ]` Not Started |

### [Test Environment](./test-environment/)

| File                                                                  | Stories | Status            |
| --------------------------------------------------------------------- | ------- | ----------------- |
| [as-developer.md](./test-environment/as-developer.md)                 | 4       | `[ ]` Not Started |
| [as-app-administrator.md](./test-environment/as-app-administrator.md) | 2       | `[ ]` Not Started |

### [Settings](./settings/)

| File                                                          | Stories | Status            |
| ------------------------------------------------------------- | ------- | ----------------- |
| [as-app-administrator.md](./settings/as-app-administrator.md) | 5       | `[ ]` Not Started |

---

## Coverage Summary

| Feature Area      | Total Stories | Complete | Partial | Not Started | Coverage |
| ----------------- | ------------- | -------- | ------- | ----------- | -------- |
| dashboard         | 4             | 0        | 0       | 4           | 0%       |
| app-editor        | 11            | 0        | 0       | 11          | 0%       |
| schema-versioning | 5             | 0        | 0       | 5           | 0%       |
| test-environment  | 6             | 0        | 0       | 6           | 0%       |
| settings          | 5             | 0        | 0       | 5           | 0%       |
| **Total**         | **31**        | **0**    | **0**   | **31**      | **0%**   |

---

> **Navigation**: [← Back to Specification](../README.md)
