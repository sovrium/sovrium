# Tables > Field Types > As Developer

> **Domain**: tables
> **Feature Area**: field-types
> **Role**: Developer
> **Schema Path**: `src/domain/models/app/tables/fields/`
> **Spec Path**: `specs/api/tables/`

---

## User Stories

### US-TABLE-FIELD-001: Text Fields

**Story**: As a developer, I want text fields with optional length limits so that I can store strings.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                       | Spec Test                  | Schema        | Status |
| ------ | ------------------------------- | -------------------------- | ------------- | ------ |
| AC-001 | Text field stores string values | `APP-TABLE-FIELD-TEXT-001` | `fields.text` | `[x]`  |
| AC-002 | Min/max length validation works | `APP-TABLE-FIELD-TEXT-002` | `fields.text` | `[x]`  |
| AC-003 | Supports multiline text option  | `APP-TABLE-FIELD-TEXT-003` | `fields.text` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/tables/fields/text.ts` `[x] Exists`
- **E2E Spec**: Field type validation tested via API routes
- **Implementation**: Effect Schema string with length constraints

---

### US-TABLE-FIELD-002: Number Fields

**Story**: As a developer, I want number fields with integer/decimal options so that I can store numeric data.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                          | Spec Test                    | Schema          | Status |
| ------ | ---------------------------------- | ---------------------------- | --------------- | ------ |
| AC-001 | Number field stores numeric values | `APP-TABLE-FIELD-NUMBER-001` | `fields.number` | `[x]`  |
| AC-002 | Integer mode rejects decimals      | `APP-TABLE-FIELD-NUMBER-002` | `fields.number` | `[x]`  |
| AC-003 | Min/max value validation works     | `APP-TABLE-FIELD-NUMBER-003` | `fields.number` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/tables/fields/number.ts` `[x] Exists`
- **E2E Spec**: Field type validation tested via API routes
- **Implementation**: Effect Schema number with integer/float variants

---

### US-TABLE-FIELD-003: Date and DateTime Fields

**Story**: As a developer, I want date and datetime fields so that I can track time-based data.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                             | Spec Test                  | Schema        | Status |
| ------ | ------------------------------------- | -------------------------- | ------------- | ------ |
| AC-001 | Date field stores date values         | `APP-TABLE-FIELD-DATE-001` | `fields.date` | `[x]`  |
| AC-002 | DateTime field stores full timestamps | `APP-TABLE-FIELD-DATE-002` | `fields.date` | `[x]`  |
| AC-003 | Timezone handling works correctly     | `APP-TABLE-FIELD-DATE-003` | `fields.date` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/tables/fields/date.ts` `[x] Exists`
- **E2E Spec**: Field type validation tested via API routes
- **Implementation**: Effect.DateTime for date handling

---

### US-TABLE-FIELD-004: Boolean Fields

**Story**: As a developer, I want boolean fields so that I can store true/false values.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                          | Spec Test                     | Schema           | Status |
| ------ | ---------------------------------- | ----------------------------- | ---------------- | ------ |
| AC-001 | Boolean field stores true/false    | `APP-TABLE-FIELD-BOOLEAN-001` | `fields.boolean` | `[x]`  |
| AC-002 | Default value can be set           | `APP-TABLE-FIELD-BOOLEAN-002` | `fields.boolean` | `[x]`  |
| AC-003 | Coerces truthy/falsy string values | `APP-TABLE-FIELD-BOOLEAN-003` | `fields.boolean` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/tables/fields/boolean.ts` `[x] Exists`
- **E2E Spec**: Field type validation tested via API routes
- **Implementation**: Effect Schema boolean with defaults

---

### US-TABLE-FIELD-005: Email Fields

**Story**: As a developer, I want email fields with format validation so that I can ensure valid email addresses.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                          | Spec Test                   | Schema         | Status |
| ------ | ---------------------------------- | --------------------------- | -------------- | ------ |
| AC-001 | Email field validates email format | `APP-TABLE-FIELD-EMAIL-001` | `fields.email` | `[x]`  |
| AC-002 | Rejects invalid email addresses    | `APP-TABLE-FIELD-EMAIL-002` | `fields.email` | `[x]`  |
| AC-003 | Normalizes email case (lowercase)  | `APP-TABLE-FIELD-EMAIL-003` | `fields.email` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/tables/fields/text.ts` (email variant) `[x] Exists`
- **E2E Spec**: Field type validation tested via API routes
- **Implementation**: Effect Schema with email pattern validation

---

### US-TABLE-FIELD-006: URL Fields

**Story**: As a developer, I want URL fields with format validation so that I can ensure valid links.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                      | Spec Test                 | Schema       | Status |
| ------ | ------------------------------ | ------------------------- | ------------ | ------ |
| AC-001 | URL field validates URL format | `APP-TABLE-FIELD-URL-001` | `fields.url` | `[x]`  |
| AC-002 | Rejects invalid URLs           | `APP-TABLE-FIELD-URL-002` | `fields.url` | `[x]`  |
| AC-003 | Supports http, https protocols | `APP-TABLE-FIELD-URL-003` | `fields.url` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/tables/fields/text.ts` (url variant) `[x] Exists`
- **E2E Spec**: Field type validation tested via API routes
- **Implementation**: Effect Schema with URL pattern validation

---

### US-TABLE-FIELD-007: Single-Select Fields

**Story**: As a developer, I want single-select fields with predefined options so that I can constrain choices.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                                | Spec Test                    | Schema          | Status |
| ------ | ---------------------------------------- | ---------------------------- | --------------- | ------ |
| AC-001 | Single-select stores one option          | `APP-TABLE-FIELD-SELECT-001` | `fields.select` | `[x]`  |
| AC-002 | Rejects values not in options list       | `APP-TABLE-FIELD-SELECT-002` | `fields.select` | `[x]`  |
| AC-003 | Options can be added/removed dynamically | `APP-TABLE-FIELD-SELECT-003` | `fields.select` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/tables/fields/select.ts` `[x] Exists`
- **E2E Spec**: Field type validation tested via API routes
- **Implementation**: Effect Schema enum with dynamic options

---

### US-TABLE-FIELD-008: Multi-Select Fields

**Story**: As a developer, I want multi-select fields so that I can allow multiple choices.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                            | Spec Test                         | Schema               | Status |
| ------ | ------------------------------------ | --------------------------------- | -------------------- | ------ |
| AC-001 | Multi-select stores array of options | `APP-TABLE-FIELD-MULTISELECT-001` | `fields.multiselect` | `[x]`  |
| AC-002 | Rejects values not in options list   | `APP-TABLE-FIELD-MULTISELECT-002` | `fields.multiselect` | `[x]`  |
| AC-003 | Supports min/max selection count     | `APP-TABLE-FIELD-MULTISELECT-003` | `fields.multiselect` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/tables/fields/select.ts` (multi variant) `[x] Exists`
- **E2E Spec**: Field type validation tested via API routes
- **Implementation**: Effect Schema array of enums with constraints

---

### US-TABLE-FIELD-009: File/Attachment Fields

**Story**: As a developer, I want file/attachment fields so that I can store documents and images.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                        | Spec Test                  | Schema        | Status |
| ------ | -------------------------------- | -------------------------- | ------------- | ------ |
| AC-001 | File field stores file reference | `APP-TABLE-FIELD-FILE-001` | `fields.file` | `[x]`  |
| AC-002 | Supports file type restrictions  | `APP-TABLE-FIELD-FILE-002` | `fields.file` | `[x]`  |
| AC-003 | Enforces max file size limit     | `APP-TABLE-FIELD-FILE-003` | `fields.file` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/tables/fields/file.ts` `[x] Exists`
- **E2E Spec**: Field type validation tested via API routes
- **Implementation**: File metadata storage with type/size validation

---

### US-TABLE-FIELD-010: Formula Fields

**Story**: As a developer, I want formula fields so that I can compute derived values.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                              | Spec Test                     | Schema           | Status |
| ------ | -------------------------------------- | ----------------------------- | ---------------- | ------ |
| AC-001 | Formula field computes derived values  | `APP-TABLE-FIELD-FORMULA-001` | `fields.formula` | `[x]`  |
| AC-002 | Supports mathematical operations       | `APP-TABLE-FIELD-FORMULA-002` | `fields.formula` | `[x]`  |
| AC-003 | References other fields in same record | `APP-TABLE-FIELD-FORMULA-003` | `fields.formula` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/tables/fields/formula.ts` `[x] Exists`
- **E2E Spec**: Field type validation tested via API routes
- **Implementation**: Formula parser with field reference resolution

---

### US-TABLE-FIELD-011: Linked Record Fields

**Story**: As a developer, I want linked record fields so that I can reference other tables.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                             | Spec Test                    | Schema                 | Status |
| ------ | ------------------------------------- | ---------------------------- | ---------------------- | ------ |
| AC-001 | Linked field references another table | `APP-TABLE-FIELD-LINKED-001` | `fields.linked-record` | `[x]`  |
| AC-002 | Validates referenced record exists    | `APP-TABLE-FIELD-LINKED-002` | `fields.linked-record` | `[x]`  |
| AC-003 | Supports single and multiple links    | `APP-TABLE-FIELD-LINKED-003` | `fields.linked-record` | `[x]`  |
| AC-004 | Handles cascading delete behavior     | `APP-TABLE-FIELD-LINKED-004` | `fields.linked-record` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/tables/fields/linked-record.ts` `[x] Exists`
- **E2E Spec**: Field type validation tested via API routes
- **Implementation**: Foreign key references with cascade options

---

## Coverage Summary

| Story ID           | Title                | Status         | Criteria Met |
| ------------------ | -------------------- | -------------- | ------------ |
| US-TABLE-FIELD-001 | Text Fields          | `[x]` Complete | 3/3          |
| US-TABLE-FIELD-002 | Number Fields        | `[x]` Complete | 3/3          |
| US-TABLE-FIELD-003 | Date/DateTime Fields | `[x]` Complete | 3/3          |
| US-TABLE-FIELD-004 | Boolean Fields       | `[x]` Complete | 3/3          |
| US-TABLE-FIELD-005 | Email Fields         | `[x]` Complete | 3/3          |
| US-TABLE-FIELD-006 | URL Fields           | `[x]` Complete | 3/3          |
| US-TABLE-FIELD-007 | Single-Select Fields | `[x]` Complete | 3/3          |
| US-TABLE-FIELD-008 | Multi-Select Fields  | `[x]` Complete | 3/3          |
| US-TABLE-FIELD-009 | File/Attachment      | `[x]` Complete | 3/3          |
| US-TABLE-FIELD-010 | Formula Fields       | `[x]` Complete | 3/3          |
| US-TABLE-FIELD-011 | Linked Record Fields | `[x]` Complete | 4/4          |

**Total**: 11 complete, 0 partial, 0 not started (100% complete)

---

> **Navigation**: [← Back to Tables Domain](../README.md)
