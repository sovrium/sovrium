# Forms > Form Definition > As App Administrator

> **Domain**: forms
> **Feature Area**: form-definition
> **Role**: App Administrator
> **Schema Path**: `src/domain/models/forms/`
> **Spec Path**: `specs/api/forms/admin/`

---

## User Stories

### US-FORM-DEF-ADMIN-001: Visual Form Builder

**Story**: As an app administrator, I want to create forms visually in the Admin Space so that I can build data collection without code.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                              | Spec Test                  | Schema        | Status |
| ------ | -------------------------------------- | -------------------------- | ------------- | ------ |
| AC-001 | Form builder accessible in Admin Space | `API-FORM-ADMIN-BUILD-001` | `forms.admin` | `[ ]`  |
| AC-002 | Drag-and-drop field arrangement        | `API-FORM-ADMIN-BUILD-002` | `forms.admin` | `[ ]`  |
| AC-003 | Field properties editable in sidebar   | `API-FORM-ADMIN-BUILD-003` | `forms.admin` | `[ ]`  |
| AC-004 | Returns 401 without authentication     | `API-FORM-ADMIN-BUILD-004` | `forms.admin` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/forms/admin/builder.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/forms/admin/builder.spec.ts` `[ ] Needs Creation`
- **API Route**: `/api/admin/forms` `[ ] Not Implemented`

---

### US-FORM-DEF-ADMIN-002: Form Preview

**Story**: As an app administrator, I want to preview forms before publishing so that I can verify appearance and behavior.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                                    | Spec Test                    | Schema        | Status |
| ------ | -------------------------------------------- | ---------------------------- | ------------- | ------ |
| AC-001 | Preview mode shows form as users will see it | `API-FORM-ADMIN-PREVIEW-001` | `forms.admin` | `[ ]`  |
| AC-002 | Preview updates in real-time during editing  | `API-FORM-ADMIN-PREVIEW-002` | `forms.admin` | `[ ]`  |
| AC-003 | Preview allows testing validation            | `API-FORM-ADMIN-PREVIEW-003` | `forms.admin` | `[ ]`  |
| AC-004 | Returns 401 without authentication           | `API-FORM-ADMIN-PREVIEW-004` | `forms.admin` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/forms/admin/preview.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/forms/admin/preview.spec.ts` `[ ] Needs Creation`
- **API Route**: `/api/admin/forms/:id/preview` `[ ] Not Implemented`

---

### US-FORM-DEF-ADMIN-003: Form Enable/Disable

**Story**: As an app administrator, I want to enable/disable forms without deleting them so that I can control availability.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                               | Spec Test                   | Schema        | Status |
| ------ | --------------------------------------- | --------------------------- | ------------- | ------ |
| AC-001 | Toggle to enable/disable form           | `API-FORM-ADMIN-TOGGLE-001` | `forms.admin` | `[ ]`  |
| AC-002 | Disabled forms reject submissions       | `API-FORM-ADMIN-TOGGLE-002` | `forms.admin` | `[ ]`  |
| AC-003 | Disabled forms show appropriate message | `API-FORM-ADMIN-TOGGLE-003` | `forms.admin` | `[ ]`  |
| AC-004 | Returns 401 without authentication      | `API-FORM-ADMIN-TOGGLE-004` | `forms.admin` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/forms/admin/status.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/forms/admin/toggle.spec.ts` `[ ] Needs Creation`
- **API Route**: `/api/admin/forms/:id/status` `[ ] Not Implemented`

---

## Coverage Summary

| Story ID              | Title               | Status            | Criteria Met |
| --------------------- | ------------------- | ----------------- | ------------ |
| US-FORM-DEF-ADMIN-001 | Visual Form Builder | `[ ]` Not Started | 0/4          |
| US-FORM-DEF-ADMIN-002 | Form Preview        | `[ ]` Not Started | 0/4          |
| US-FORM-DEF-ADMIN-003 | Form Enable/Disable | `[ ]` Not Started | 0/4          |

**Total**: 0 complete, 0 partial, 3 not started (0% complete)

---

> **Navigation**: [← Back to Forms Domain](../README.md) | [← Form Definition as Developer](./as-developer.md)
