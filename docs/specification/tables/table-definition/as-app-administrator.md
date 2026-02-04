# Tables > Table Definition > As App Administrator

> **Domain**: tables
> **Feature Area**: table-definition
> **Role**: App Administrator
> **Schema Path**: `src/domain/models/app/tables/`
> **Spec Path**: `specs/api/tables/admin/`

---

## User Stories

### US-TABLE-DEF-ADMIN-001: Create and Edit Tables from Admin Space

**Story**: As an app administrator, I want to create and edit tables from the Admin Space so that I don't need to edit configuration files.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                              | Spec Test                    | Schema         | Status |
| ------ | -------------------------------------- | ---------------------------- | -------------- | ------ |
| AC-001 | Can create new tables from Admin Space | `API-TABLE-ADMIN-CREATE-001` | `tables.admin` | `[ ]`  |
| AC-002 | Can edit existing table configuration  | `API-TABLE-ADMIN-EDIT-001`   | `tables.admin` | `[ ]`  |
| AC-003 | Changes take effect without restart    | `API-TABLE-ADMIN-EDIT-002`   | `tables.admin` | `[ ]`  |
| AC-004 | Returns 401 without authentication     | `API-TABLE-ADMIN-CREATE-002` | `tables.admin` | `[ ]`  |
| AC-005 | Returns 403 for non-admin users        | `API-TABLE-ADMIN-CREATE-003` | `tables.admin` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/tables/` `[x] Exists`
- **E2E Spec**: `specs/api/tables/admin/create/post.spec.ts` `[ ] Needs Creation`
- **API Route**: `/api/tables/admin/create` `[ ] Not Implemented`

---

### US-TABLE-DEF-ADMIN-002: Add/Remove/Modify Fields Visually

**Story**: As an app administrator, I want to add/remove/modify fields visually so that I can evolve the data model.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                             | Spec Test                          | Schema         | Status |
| ------ | ------------------------------------- | ---------------------------------- | -------------- | ------ |
| AC-001 | Can add new fields to existing tables | `API-TABLE-ADMIN-ADD-FIELD-001`    | `tables.admin` | `[ ]`  |
| AC-002 | Can remove fields from tables         | `API-TABLE-ADMIN-REMOVE-FIELD-001` | `tables.admin` | `[ ]`  |
| AC-003 | Can modify field properties           | `API-TABLE-ADMIN-MODIFY-FIELD-001` | `tables.admin` | `[ ]`  |
| AC-004 | Field changes preserve existing data  | `API-TABLE-ADMIN-MODIFY-FIELD-002` | `tables.admin` | `[ ]`  |
| AC-005 | Returns 401 without authentication    | `API-TABLE-ADMIN-ADD-FIELD-002`    | `tables.admin` | `[ ]`  |
| AC-006 | Returns 403 for non-admin users       | `API-TABLE-ADMIN-ADD-FIELD-003`    | `tables.admin` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/tables/` `[x] Exists`
- **E2E Spec**: `specs/api/tables/admin/fields/post.spec.ts` `[ ] Needs Creation`
- **API Route**: `/api/tables/:slug/admin/fields` `[ ] Not Implemented`

---

### US-TABLE-DEF-ADMIN-003: Visual Representation of Relationships

**Story**: As an app administrator, I want to see a visual representation of table relationships so that I understand the data structure.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                             | Spec Test                     | Schema         | Status |
| ------ | ------------------------------------- | ----------------------------- | -------------- | ------ |
| AC-001 | Shows all tables in visual diagram    | `API-TABLE-ADMIN-DIAGRAM-001` | `tables.admin` | `[ ]`  |
| AC-002 | Displays relationships between tables | `API-TABLE-ADMIN-DIAGRAM-002` | `tables.admin` | `[ ]`  |
| AC-003 | Shows relationship types (1:N, N:M)   | `API-TABLE-ADMIN-DIAGRAM-003` | `tables.admin` | `[ ]`  |
| AC-004 | Returns 401 without authentication    | `API-TABLE-ADMIN-DIAGRAM-004` | `tables.admin` | `[ ]`  |
| AC-005 | Returns 403 for non-admin users       | `API-TABLE-ADMIN-DIAGRAM-005` | `tables.admin` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/tables/` `[x] Exists`
- **E2E Spec**: `specs/api/tables/admin/diagram/get.spec.ts` `[ ] Needs Creation`
- **API Route**: `/api/tables/admin/diagram` `[ ] Not Implemented`

---

## Coverage Summary

| Story ID               | Title                              | Status            | Criteria Met |
| ---------------------- | ---------------------------------- | ----------------- | ------------ |
| US-TABLE-DEF-ADMIN-001 | Create and Edit Tables             | `[ ]` Not Started | 0/5          |
| US-TABLE-DEF-ADMIN-002 | Add/Remove/Modify Fields Visually  | `[ ]` Not Started | 0/6          |
| US-TABLE-DEF-ADMIN-003 | Visual Representation of Relations | `[ ]` Not Started | 0/5          |

**Total**: 0 complete, 0 partial, 3 not started (0% complete)

---

> **Navigation**: [← Back to Tables Domain](../README.md) | [← Table Definition as Developer](./as-developer.md)
