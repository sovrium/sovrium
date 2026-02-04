# Forms > Form Fields > As Developer

> **Domain**: forms
> **Feature Area**: form-fields
> **Role**: Developer
> **Schema Path**: `src/domain/models/forms/fields/`
> **Spec Path**: `specs/api/forms/fields/`

---

## User Stories

### US-FORM-FIELD-001: Text Input Fields

**Story**: As a developer, I want text input fields so that users can enter short text.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                     | Spec Test           | Schema         | Status |
| ------ | ----------------------------- | ------------------- | -------------- | ------ |
| AC-001 | Text input renders correctly  | `API-FORM-TEXT-001` | `forms.fields` | `[ ]`  |
| AC-002 | Max length configurable       | `API-FORM-TEXT-002` | `forms.fields` | `[ ]`  |
| AC-003 | Accessible with proper labels | `API-FORM-TEXT-003` | `forms.fields` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/forms/fields/text.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/forms/fields/text.spec.ts` `[ ] Needs Creation`

---

### US-FORM-FIELD-002: Textarea Fields

**Story**: As a developer, I want textarea fields so that users can enter long text.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                      | Spec Test               | Schema         | Status |
| ------ | ------------------------------ | ----------------------- | -------------- | ------ |
| AC-001 | Textarea renders correctly     | `API-FORM-TEXTAREA-001` | `forms.fields` | `[ ]`  |
| AC-002 | Rows/columns configurable      | `API-FORM-TEXTAREA-002` | `forms.fields` | `[ ]`  |
| AC-003 | Character count display option | `API-FORM-TEXTAREA-003` | `forms.fields` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/forms/fields/textarea.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/forms/fields/textarea.spec.ts` `[ ] Needs Creation`

---

### US-FORM-FIELD-003: Email Fields

**Story**: As a developer, I want email fields with validation so that I collect valid email addresses.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                             | Spec Test            | Schema         | Status |
| ------ | ------------------------------------- | -------------------- | -------------- | ------ |
| AC-001 | Email input renders with correct type | `API-FORM-EMAIL-001` | `forms.fields` | `[ ]`  |
| AC-002 | Email format validated                | `API-FORM-EMAIL-002` | `forms.fields` | `[ ]`  |
| AC-003 | Invalid email shows error message     | `API-FORM-EMAIL-003` | `forms.fields` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/forms/fields/email.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/forms/fields/email.spec.ts` `[ ] Needs Creation`

---

### US-FORM-FIELD-004: Number Fields

**Story**: As a developer, I want number fields so that users can enter numeric values.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                          | Spec Test             | Schema         | Status |
| ------ | ---------------------------------- | --------------------- | -------------- | ------ |
| AC-001 | Number input renders correctly     | `API-FORM-NUMBER-001` | `forms.fields` | `[ ]`  |
| AC-002 | Min/max values configurable        | `API-FORM-NUMBER-002` | `forms.fields` | `[ ]`  |
| AC-003 | Step value configurable (decimals) | `API-FORM-NUMBER-003` | `forms.fields` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/forms/fields/number.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/forms/fields/number.spec.ts` `[ ] Needs Creation`

---

### US-FORM-FIELD-005: Date/Time Picker Fields

**Story**: As a developer, I want date/time picker fields so that users can select dates.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                     | Spec Test           | Schema         | Status |
| ------ | ----------------------------- | ------------------- | -------------- | ------ |
| AC-001 | Date picker renders correctly | `API-FORM-DATE-001` | `forms.fields` | `[ ]`  |
| AC-002 | Date-only and date-time modes | `API-FORM-DATE-002` | `forms.fields` | `[ ]`  |
| AC-003 | Min/max date constraints      | `API-FORM-DATE-003` | `forms.fields` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/forms/fields/datetime.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/forms/fields/datetime.spec.ts` `[ ] Needs Creation`

---

### US-FORM-FIELD-006: Dropdown (Select) Fields

**Story**: As a developer, I want dropdown (select) fields so that users choose from predefined options.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                         | Spec Test             | Schema         | Status |
| ------ | --------------------------------- | --------------------- | -------------- | ------ |
| AC-001 | Select dropdown renders correctly | `API-FORM-SELECT-001` | `forms.fields` | `[ ]`  |
| AC-002 | Options configurable              | `API-FORM-SELECT-002` | `forms.fields` | `[ ]`  |
| AC-003 | Multi-select option available     | `API-FORM-SELECT-003` | `forms.fields` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/forms/fields/select.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/forms/fields/select.spec.ts` `[ ] Needs Creation`

---

### US-FORM-FIELD-007: Checkbox and Radio Fields

**Story**: As a developer, I want checkbox and radio button fields so that users make selections.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                        | Spec Test             | Schema         | Status |
| ------ | -------------------------------- | --------------------- | -------------- | ------ |
| AC-001 | Checkbox renders correctly       | `API-FORM-CHOICE-001` | `forms.fields` | `[ ]`  |
| AC-002 | Radio buttons render correctly   | `API-FORM-CHOICE-002` | `forms.fields` | `[ ]`  |
| AC-003 | Checkbox groups for multi-select | `API-FORM-CHOICE-003` | `forms.fields` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/forms/fields/choice.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/forms/fields/choice.spec.ts` `[ ] Needs Creation`

---

### US-FORM-FIELD-008: File Upload Fields

**Story**: As a developer, I want file upload fields so that users can attach documents.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                       | Spec Test           | Schema         | Status |
| ------ | ------------------------------- | ------------------- | -------------- | ------ |
| AC-001 | File upload renders correctly   | `API-FORM-FILE-001` | `forms.fields` | `[ ]`  |
| AC-002 | Allowed file types configurable | `API-FORM-FILE-002` | `forms.fields` | `[ ]`  |
| AC-003 | Max file size enforced          | `API-FORM-FILE-003` | `forms.fields` | `[ ]`  |
| AC-004 | Multiple files option available | `API-FORM-FILE-004` | `forms.fields` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/forms/fields/file.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/forms/fields/file.spec.ts` `[ ] Needs Creation`

---

### US-FORM-FIELD-009: Hidden Fields

**Story**: As a developer, I want hidden fields so that I can include metadata with submissions.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                                   | Spec Test             | Schema         | Status |
| ------ | ------------------------------------------- | --------------------- | -------------- | ------ |
| AC-001 | Hidden fields not visible to users          | `API-FORM-HIDDEN-001` | `forms.fields` | `[ ]`  |
| AC-002 | Hidden values included in submission        | `API-FORM-HIDDEN-002` | `forms.fields` | `[ ]`  |
| AC-003 | Dynamic values supported (URL params, etc.) | `API-FORM-HIDDEN-003` | `forms.fields` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/forms/fields/hidden.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/forms/fields/hidden.spec.ts` `[ ] Needs Creation`

---

## Coverage Summary

| Story ID          | Title             | Status            | Criteria Met |
| ----------------- | ----------------- | ----------------- | ------------ |
| US-FORM-FIELD-001 | Text Input        | `[ ]` Not Started | 0/3          |
| US-FORM-FIELD-002 | Textarea          | `[ ]` Not Started | 0/3          |
| US-FORM-FIELD-003 | Email             | `[ ]` Not Started | 0/3          |
| US-FORM-FIELD-004 | Number            | `[ ]` Not Started | 0/3          |
| US-FORM-FIELD-005 | Date/Time Picker  | `[ ]` Not Started | 0/3          |
| US-FORM-FIELD-006 | Dropdown (Select) | `[ ]` Not Started | 0/3          |
| US-FORM-FIELD-007 | Checkbox/Radio    | `[ ]` Not Started | 0/3          |
| US-FORM-FIELD-008 | File Upload       | `[ ]` Not Started | 0/4          |
| US-FORM-FIELD-009 | Hidden Fields     | `[ ]` Not Started | 0/3          |

**Total**: 0 complete, 0 partial, 9 not started (0% complete)

---

> **Navigation**: [← Back to Forms Domain](../README.md) | [Form Fields as App Administrator →](./as-app-administrator.md)
