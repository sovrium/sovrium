# Forms > Form Fields > As App Administrator

> **Domain**: forms
> **Feature Area**: form-fields
> **Role**: App Administrator
> **Schema Path**: `src/domain/models/forms/fields/`
> **Spec Path**: `specs/api/forms/fields/admin/`

---

## User Stories

### US-FORM-FIELD-ADMIN-001: Required Fields

**Story**: As an app administrator, I want to mark fields as required so that essential data is collected.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                                  | Spec Test                | Schema         | Status |
| ------ | ------------------------------------------ | ------------------------ | -------------- | ------ |
| AC-001 | Toggle to mark field as required           | `API-FORM-FIELD-REQ-001` | `forms.fields` | `[ ]`  |
| AC-002 | Required fields show indicator (asterisk)  | `API-FORM-FIELD-REQ-002` | `forms.fields` | `[ ]`  |
| AC-003 | Form cannot submit without required fields | `API-FORM-FIELD-REQ-003` | `forms.fields` | `[ ]`  |
| AC-004 | Returns 401 without authentication         | `API-FORM-FIELD-REQ-004` | `forms.fields` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/forms/fields/required.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/forms/fields/admin/required.spec.ts` `[ ] Needs Creation`

---

### US-FORM-FIELD-ADMIN-002: Placeholder and Help Text

**Story**: As an app administrator, I want to set placeholder text and help text so that users understand what to enter.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                          | Spec Test                 | Schema         | Status |
| ------ | ---------------------------------- | ------------------------- | -------------- | ------ |
| AC-001 | Placeholder text configurable      | `API-FORM-FIELD-HELP-001` | `forms.fields` | `[ ]`  |
| AC-002 | Help text displayed below field    | `API-FORM-FIELD-HELP-002` | `forms.fields` | `[ ]`  |
| AC-003 | Help text supports links           | `API-FORM-FIELD-HELP-003` | `forms.fields` | `[ ]`  |
| AC-004 | Returns 401 without authentication | `API-FORM-FIELD-HELP-004` | `forms.fields` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/forms/fields/help.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/forms/fields/admin/help.spec.ts` `[ ] Needs Creation`

---

### US-FORM-FIELD-ADMIN-003: Default Values

**Story**: As an app administrator, I want to set default values so that common answers are pre-filled.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                             | Spec Test                    | Schema         | Status |
| ------ | ------------------------------------- | ---------------------------- | -------------- | ------ |
| AC-001 | Default values configurable per field | `API-FORM-FIELD-DEFAULT-001` | `forms.fields` | `[ ]`  |
| AC-002 | Default values shown when form loads  | `API-FORM-FIELD-DEFAULT-002` | `forms.fields` | `[ ]`  |
| AC-003 | Dynamic defaults (e.g., current date) | `API-FORM-FIELD-DEFAULT-003` | `forms.fields` | `[ ]`  |
| AC-004 | Returns 401 without authentication    | `API-FORM-FIELD-DEFAULT-004` | `forms.fields` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/forms/fields/defaults.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/forms/fields/admin/defaults.spec.ts` `[ ] Needs Creation`

---

### US-FORM-FIELD-ADMIN-004: Conditional Fields

**Story**: As an app administrator, I want conditional fields that show/hide based on other answers so that forms are dynamic.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                                | Spec Test                 | Schema               | Status |
| ------ | ---------------------------------------- | ------------------------- | -------------------- | ------ |
| AC-001 | Conditional logic configurable per field | `API-FORM-FIELD-COND-001` | `forms.conditionals` | `[ ]`  |
| AC-002 | Fields show/hide without page reload     | `API-FORM-FIELD-COND-002` | `forms.conditionals` | `[ ]`  |
| AC-003 | Multiple conditions supported (AND/OR)   | `API-FORM-FIELD-COND-003` | `forms.conditionals` | `[ ]`  |
| AC-004 | Returns 401 without authentication       | `API-FORM-FIELD-COND-004` | `forms.conditionals` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/forms/conditionals/index.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/forms/fields/admin/conditionals.spec.ts` `[ ] Needs Creation`

---

## Coverage Summary

| Story ID                | Title              | Status            | Criteria Met |
| ----------------------- | ------------------ | ----------------- | ------------ |
| US-FORM-FIELD-ADMIN-001 | Required Fields    | `[ ]` Not Started | 0/4          |
| US-FORM-FIELD-ADMIN-002 | Placeholder/Help   | `[ ]` Not Started | 0/4          |
| US-FORM-FIELD-ADMIN-003 | Default Values     | `[ ]` Not Started | 0/4          |
| US-FORM-FIELD-ADMIN-004 | Conditional Fields | `[ ]` Not Started | 0/4          |

**Total**: 0 complete, 0 partial, 4 not started (0% complete)

---

> **Navigation**: [← Back to Forms Domain](../README.md) | [← Form Fields as Developer](./as-developer.md)
