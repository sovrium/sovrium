# Admin Space > App Editor > As Business User

> **Domain**: admin-space
> **Feature Area**: app-editor
> **Role**: Business User
> **Schema Path**: `src/domain/models/admin-space/editor/`
> **Spec Path**: `specs/app/admin-space/editor/`

---

## User Stories

### US-ADMIN-EDITOR-BIZ-001: Visual Form Editor

**Story**: As a business user, I want a visual Form Editor mode so that I can make changes without editing code.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                                   | Spec Test                   | Schema         | Status |
| ------ | ------------------------------------------- | --------------------------- | -------------- | ------ |
| AC-001 | Form-based editor renders all configuration | `APP-ADMIN-EDITOR-FORM-001` | `admin.editor` | `[ ]`  |
| AC-002 | Changes update underlying configuration     | `APP-ADMIN-EDITOR-FORM-002` | `admin.editor` | `[ ]`  |
| AC-003 | No coding knowledge required                | `APP-ADMIN-EDITOR-FORM-003` | `admin.editor` | `[ ]`  |
| AC-004 | Returns 401 without authentication          | `APP-ADMIN-EDITOR-FORM-004` | `admin.editor` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/admin-space/editor/form-editor.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/app/admin-space/editor/form-mode.spec.ts` `[ ] Needs Creation`
- **UI Route**: `/admin/editor?mode=form` `[ ] Not Implemented`

---

### US-ADMIN-EDITOR-BIZ-002: Field Validation and Help

**Story**: As a business user, I want field validation and contextual help in forms so that I understand what each setting does.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                           | Spec Test                   | Schema         | Status |
| ------ | ----------------------------------- | --------------------------- | -------------- | ------ |
| AC-001 | Each field has contextual help text | `APP-ADMIN-EDITOR-HELP-001` | `admin.editor` | `[ ]`  |
| AC-002 | Validation errors shown inline      | `APP-ADMIN-EDITOR-HELP-002` | `admin.editor` | `[ ]`  |
| AC-003 | Required fields clearly marked      | `APP-ADMIN-EDITOR-HELP-003` | `admin.editor` | `[ ]`  |
| AC-004 | Returns 401 without authentication  | `APP-ADMIN-EDITOR-HELP-004` | `admin.editor` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/admin-space/editor/field-help.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/app/admin-space/editor/field-help.spec.ts` `[ ] Needs Creation`

---

### US-ADMIN-EDITOR-BIZ-003: Dropdown Menus

**Story**: As a business user, I want dropdown menus for enumerated options so that I can select valid values easily.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                           | Spec Test                       | Schema         | Status |
| ------ | ----------------------------------- | ------------------------------- | -------------- | ------ |
| AC-001 | Enum fields render as dropdowns     | `APP-ADMIN-EDITOR-DROPDOWN-001` | `admin.editor` | `[ ]`  |
| AC-002 | Dropdown shows all valid options    | `APP-ADMIN-EDITOR-DROPDOWN-002` | `admin.editor` | `[ ]`  |
| AC-003 | Searchable dropdowns for long lists | `APP-ADMIN-EDITOR-DROPDOWN-003` | `admin.editor` | `[ ]`  |
| AC-004 | Returns 401 without authentication  | `APP-ADMIN-EDITOR-DROPDOWN-004` | `admin.editor` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/admin-space/editor/dropdowns.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/app/admin-space/editor/dropdowns.spec.ts` `[ ] Needs Creation`

---

## Coverage Summary

| Story ID                | Title                 | Status            | Criteria Met |
| ----------------------- | --------------------- | ----------------- | ------------ |
| US-ADMIN-EDITOR-BIZ-001 | Visual Form Editor    | `[ ]` Not Started | 0/4          |
| US-ADMIN-EDITOR-BIZ-002 | Field Validation/Help | `[ ]` Not Started | 0/4          |
| US-ADMIN-EDITOR-BIZ-003 | Dropdown Menus        | `[ ]` Not Started | 0/4          |

**Total**: 0 complete, 0 partial, 3 not started (0% complete)

---

> **Navigation**: [← Back to Admin Space Domain](../README.md) | [← App Editor as Developer](./as-developer.md) | [App Editor as Any User →](./as-any-user.md)
