# Forms > Form Definition > As Developer

> **Domain**: forms
> **Feature Area**: form-definition
> **Role**: Developer
> **Schema Path**: `src/domain/models/forms/`
> **Spec Path**: `specs/api/forms/`

---

## User Stories

### US-FORM-DEF-001: Form-to-Table Mapping

**Story**: As a developer, I want to define forms that map to table fields so that submissions create records.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                                  | Spec Test          | Schema      | Status |
| ------ | ------------------------------------------ | ------------------ | ----------- | ------ |
| AC-001 | Forms link to target table                 | `API-FORM-MAP-001` | `forms.def` | `[ ]`  |
| AC-002 | Form fields map to table columns           | `API-FORM-MAP-002` | `forms.def` | `[ ]`  |
| AC-003 | Submissions create records in target table | `API-FORM-MAP-003` | `forms.def` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/forms/definition.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/forms/mapping.spec.ts` `[ ] Needs Creation`
- **Implementation**: Form schema with table relationship

---

### US-FORM-DEF-002: Validation Rules

**Story**: As a developer, I want to configure validation rules (required, format, length) so that submissions are validated.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                            | Spec Test            | Schema        | Status |
| ------ | ------------------------------------ | -------------------- | ------------- | ------ |
| AC-001 | Required validation enforced         | `API-FORM-VALID-001` | `forms.valid` | `[ ]`  |
| AC-002 | Format validation (email, URL, etc.) | `API-FORM-VALID-002` | `forms.valid` | `[ ]`  |
| AC-003 | Length validation (min, max)         | `API-FORM-VALID-003` | `forms.valid` | `[ ]`  |
| AC-004 | Validation runs on client and server | `API-FORM-VALID-004` | `forms.valid` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/forms/validation.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/forms/validation.spec.ts` `[ ] Needs Creation`
- **Implementation**: Effect Schema for server, Zod for client

---

### US-FORM-DEF-003: Success/Error Messages

**Story**: As a developer, I want to define success/error messages so that users get appropriate feedback.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                                  | Spec Test          | Schema           | Status |
| ------ | ------------------------------------------ | ------------------ | ---------------- | ------ |
| AC-001 | Custom success message configurable        | `API-FORM-MSG-001` | `forms.messages` | `[ ]`  |
| AC-002 | Custom error messages per validation rule  | `API-FORM-MSG-002` | `forms.messages` | `[ ]`  |
| AC-003 | Error messages display near relevant field | `API-FORM-MSG-003` | `forms.messages` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/forms/messages.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/forms/messages.spec.ts` `[ ] Needs Creation`
- **Implementation**: Message templates with field interpolation

---

### US-FORM-DEF-004: Post-Submission Actions

**Story**: As a developer, I want to configure what happens after submission (redirect, message, trigger automation) so that I control the flow.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                                | Spec Test             | Schema          | Status |
| ------ | ---------------------------------------- | --------------------- | --------------- | ------ |
| AC-001 | Redirect to URL after submission         | `API-FORM-ACTION-001` | `forms.actions` | `[ ]`  |
| AC-002 | Display success message after submission | `API-FORM-ACTION-002` | `forms.actions` | `[ ]`  |
| AC-003 | Trigger automation after submission      | `API-FORM-ACTION-003` | `forms.actions` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/forms/actions.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/forms/actions.spec.ts` `[ ] Needs Creation`
- **Implementation**: Action handler with automation trigger support

---

## Coverage Summary

| Story ID        | Title                   | Status            | Criteria Met |
| --------------- | ----------------------- | ----------------- | ------------ |
| US-FORM-DEF-001 | Form-to-Table Mapping   | `[ ]` Not Started | 0/3          |
| US-FORM-DEF-002 | Validation Rules        | `[ ]` Not Started | 0/4          |
| US-FORM-DEF-003 | Success/Error Messages  | `[ ]` Not Started | 0/3          |
| US-FORM-DEF-004 | Post-Submission Actions | `[ ]` Not Started | 0/3          |

**Total**: 0 complete, 0 partial, 4 not started (0% complete)

---

> **Navigation**: [← Back to Forms Domain](../README.md) | [Form Definition as App Administrator →](./as-app-administrator.md)
