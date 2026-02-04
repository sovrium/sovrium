# Tables > Table Definition > As Developer

> **Domain**: tables
> **Feature Area**: table-definition
> **Role**: Developer
> **Schema Path**: `src/domain/models/app/tables/`
> **Spec Path**: `specs/api/tables/`

---

## User Stories

### US-TABLE-DEF-001: Define Tables with Custom Fields

**Story**: As a developer, I want to define tables with custom fields so that I can model my business data.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                                   | Spec Test           | Schema   | Status |
| ------ | ------------------------------------------- | ------------------- | -------- | ------ |
| AC-001 | Tables are defined in configuration         | `APP-TABLE-DEF-001` | `tables` | `[x]`  |
| AC-002 | Tables are reflected in the database        | `APP-TABLE-DEF-002` | `tables` | `[x]`  |
| AC-003 | Custom fields are created with proper types | `APP-TABLE-DEF-003` | `tables` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/tables/table.ts` `[x] Exists`
- **E2E Spec**: Table definition tested via app schema validation
- **Implementation**: Tables defined in app configuration

---

### US-TABLE-DEF-002: Specify Field Types

**Story**: As a developer, I want to specify field types (text, number, date, boolean, etc.) so that data is properly validated.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                                     | Spec Test                  | Schema          | Status |
| ------ | --------------------------------------------- | -------------------------- | --------------- | ------ |
| AC-001 | Field types map to appropriate database types | `APP-TABLE-FIELD-TYPE-001` | `tables.fields` | `[x]`  |
| AC-002 | Type validation is enforced on input          | `APP-TABLE-FIELD-TYPE-002` | `tables.fields` | `[x]`  |
| AC-003 | Type coercion works for compatible types      | `APP-TABLE-FIELD-TYPE-003` | `tables.fields` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/tables/fields/` `[x] Exists`
- **E2E Spec**: Field type validation tested via API routes
- **Implementation**: Effect Schema validation per field type

---

### US-TABLE-DEF-003: Define Relationships Between Tables

**Story**: As a developer, I want to define relationships between tables (one-to-many, many-to-many) so that I can model complex data structures.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                                        | Spec Test                    | Schema                 | Status |
| ------ | ------------------------------------------------ | ---------------------------- | ---------------------- | ------ |
| AC-001 | One-to-many relationships create foreign keys    | `APP-TABLE-RELATIONSHIP-001` | `tables.relationships` | `[x]`  |
| AC-002 | Many-to-many relationships create junction table | `APP-TABLE-RELATIONSHIP-002` | `tables.relationships` | `[x]`  |
| AC-003 | Cascading delete respects relationship config    | `APP-TABLE-RELATIONSHIP-003` | `tables.relationships` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/tables/relationships/` `[x] Exists`
- **E2E Spec**: Relationship handling tested via API routes
- **Implementation**: Drizzle ORM foreign key constraints

---

### US-TABLE-DEF-004: Set Validation Rules on Fields

**Story**: As a developer, I want to set validation rules on fields (required, unique, min/max, pattern) so that data integrity is enforced.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                                     | Spec Test                  | Schema              | Status |
| ------ | --------------------------------------------- | -------------------------- | ------------------- | ------ |
| AC-001 | Required fields reject empty values           | `API-TABLE-VALIDATION-001` | `tables.validation` | `[x]`  |
| AC-002 | Unique constraints prevent duplicates         | `API-TABLE-VALIDATION-002` | `tables.validation` | `[x]`  |
| AC-003 | Min/max rules enforce value boundaries        | `API-TABLE-VALIDATION-003` | `tables.validation` | `[x]`  |
| AC-004 | Pattern rules validate against regex          | `API-TABLE-VALIDATION-004` | `tables.validation` | `[x]`  |
| AC-005 | Validation enforced at both API and DB levels | `API-TABLE-VALIDATION-005` | `tables.validation` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/tables/validation.ts` `[x] Exists`
- **E2E Spec**: Validation rules tested via API routes
- **Implementation**: Effect Schema + Drizzle constraints

---

## Coverage Summary

| Story ID         | Title                            | Status         | Criteria Met |
| ---------------- | -------------------------------- | -------------- | ------------ |
| US-TABLE-DEF-001 | Define Tables with Custom Fields | `[x]` Complete | 3/3          |
| US-TABLE-DEF-002 | Specify Field Types              | `[x]` Complete | 3/3          |
| US-TABLE-DEF-003 | Define Relationships             | `[x]` Complete | 3/3          |
| US-TABLE-DEF-004 | Set Validation Rules             | `[x]` Complete | 5/5          |

**Total**: 4 complete, 0 partial, 0 not started (100% complete)

---

> **Navigation**: [← Back to Tables Domain](../README.md) | [Table Definition as App Administrator →](./as-app-administrator.md)
