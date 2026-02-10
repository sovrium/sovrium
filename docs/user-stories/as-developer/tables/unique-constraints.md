# Unique Constraints

> **Feature Area**: Tables - Unique Constraints
> **Schema**: `src/domain/models/app/table/`
> **E2E Specs**: `specs/app/tables/unique-constraints/`

---

## Overview

Sovrium supports unique constraints at both the single-field and composite (multi-field) level. These constraints are enforced at the PostgreSQL database level and follow SQL standard behavior for NULL handling.

---

## US-TABLES-UNIQUE-001: Single-Field Unique Constraint

**As a** developer,
**I want to** mark individual fields as unique,
**so that** no two records can have the same value for that field.

### Configuration

```yaml
tables:
  - id: 1
    name: users
    fields:
      - id: 1
        name: email
        type: email
        unique: true # No duplicate emails allowed
      - id: 2
        name: username
        type: single-line-text
        unique: true # No duplicate usernames allowed
      - id: 3
        name: name
        type: single-line-text
        unique: false # Duplicates allowed (default)
```

### Acceptance Criteria

| ID     | Criterion                                                     | E2E Spec                      | Status |
| ------ | ------------------------------------------------------------- | ----------------------------- | ------ |
| AC-001 | Creates PostgreSQL UNIQUE constraint on field                 | `APP-TABLES-FIELD-UNIQUE-001` | ✅     |
| AC-002 | Insert with duplicate value returns 400 with constraint error | `APP-TABLES-FIELD-UNIQUE-002` | ✅     |
| AC-003 | Update to duplicate value returns 400 with constraint error   | `APP-TABLES-FIELD-UNIQUE-003` | ✅     |
| AC-004 | Unique constraint is case-sensitive by default                | `APP-TABLES-FIELD-UNIQUE-004` | ✅     |
| AC-005 | Unique constraint allows multiple NULL values (SQL standard)  | `APP-TABLES-FIELD-UNIQUE-005` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/common/unique.spec.ts`

---

## US-TABLES-UNIQUE-002: Composite Unique Constraints

**As a** developer,
**I want to** define unique constraints across multiple fields,
**so that** I can enforce uniqueness on field combinations.

### Configuration

```yaml
tables:
  - id: 1
    name: order_items
    fields:
      - id: 1
        name: order_id
        type: integer
        required: true
      - id: 2
        name: product_id
        type: integer
        required: true
      - id: 3
        name: quantity
        type: integer
    uniqueConstraints:
      - name: unique_order_product
        fields: [order_id, product_id] # Same product can't be in order twice

  - id: 2
    name: user_roles
    fields:
      - id: 1
        name: user_id
        type: integer
      - id: 2
        name: role_id
        type: integer
      - id: 3
        name: organization_id
        type: integer
    uniqueConstraints:
      - name: unique_user_role_org
        fields: [user_id, role_id, organization_id] # 3-field composite
```

### Acceptance Criteria

| ID     | Criterion                                                           | E2E Spec                                  | Status |
| ------ | ------------------------------------------------------------------- | ----------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL UNIQUE constraint on field combination           | `APP-TABLES-UNIQUECONSTRAINTS-001`        | ✅     |
| AC-002 | Insert with duplicate combination returns 400 with constraint error | `APP-TABLES-UNIQUECONSTRAINTS-002`        | ✅     |
| AC-003 | Update to duplicate combination returns 400 with constraint error   | `APP-TABLES-UNIQUECONSTRAINTS-003`        | ✅     |
| AC-004 | Constraint name is generated if not provided                        | `APP-TABLES-UNIQUECONSTRAINTS-004`        | ✅     |
| AC-005 | Supports 2 or more fields in composite constraint                   | `APP-TABLES-UNIQUECONSTRAINTS-005`        | ✅     |
| AC-006 | Duplicate constraint names are rejected                             | `APP-TABLES-UNIQUECONSTRAINTS-006`        | ✅     |
| AC-007 | Invalid field names in constraint are rejected                      | `APP-TABLES-UNIQUECONSTRAINTS-007`        | ✅     |
| AC-008 | Constraint is updated when field is renamed                         | `APP-TABLES-UNIQUECONSTRAINTS-008`        | ✅     |
| AC-009 | Constraint is dropped when field is deleted                         | `APP-TABLES-UNIQUECONSTRAINTS-009`        | ✅     |
| AC-010 | User can complete full unique constraints workflow (regression)     | `APP-TABLES-UNIQUECONSTRAINTS-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/table/unique-constraints.ts`

---

## US-TABLES-UNIQUE-003: NULL Handling in Unique Constraints

**As a** developer,
**I want to** understand how NULL values interact with unique constraints,
**so that** I can design schemas correctly for optional unique fields.

### Configuration

```yaml
tables:
  - id: 1
    name: profiles
    fields:
      - id: 1
        name: user_id
        type: integer
        required: true
      - id: 2
        name: phone
        type: phone
        required: false # Optional
        unique: true # Unique when provided
      - id: 3
        name: linkedin_url
        type: url
        required: false
        unique: true
```

### Acceptance Criteria

| ID     | Criterion                                                         | E2E Spec                                       | Status |
| ------ | ----------------------------------------------------------------- | ---------------------------------------------- | ------ |
| AC-001 | Multiple NULL values are allowed for unique fields (SQL standard) | `APP-TABLES-UNIQUECONSTRAINTS-NULL-001`        | ✅     |
| AC-002 | Non-NULL duplicate values are rejected                            | `APP-TABLES-UNIQUECONSTRAINTS-NULL-002`        | ✅     |
| AC-003 | NULL does not conflict with any other value                       | `APP-TABLES-UNIQUECONSTRAINTS-NULL-003`        | ✅     |
| AC-004 | Composite constraints with NULL in any field allow duplicates     | `APP-TABLES-UNIQUECONSTRAINTS-NULL-004`        | ✅     |
| AC-005 | Updating NULL to existing value returns constraint error          | `APP-TABLES-UNIQUECONSTRAINTS-NULL-005`        | ✅     |
| AC-006 | Updating value to NULL is always allowed                          | `APP-TABLES-UNIQUECONSTRAINTS-NULL-006`        | ✅     |
| AC-007 | NULLS NOT DISTINCT option can be configured (PostgreSQL 15+)      | `APP-TABLES-UNIQUECONSTRAINTS-NULL-007`        | ✅     |
| AC-008 | User can complete full NULL constraints workflow (regression)     | `APP-TABLES-UNIQUECONSTRAINTS-NULL-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/table/unique-constraints.ts`

---

## Configuration Examples

### Basic Unique Constraint Example

```yaml
tables:
  - id: 1
    name: documents
    fields:
      - id: 1
        name: title
        type: single-line-text
      - id: 2
        name: status
        type: single-select
        options: [draft, published, archived]
    uniqueConstraints:
      - name: unique_document_title
        fields: [title]
```

### Single-Field Unique

```yaml
tables:
  - id: 1
    name: users
    fields:
      - id: 1
        name: email
        type: email
        unique: true
```

---

## Regression Tests

| Spec ID                                        | Workflow                                         | Status |
| ---------------------------------------------- | ------------------------------------------------ | ------ |
| `APP-TABLES-UNIQUECONSTRAINTS-REGRESSION`      | Developer creates tables with unique constraints | `[x]`  |
| `APP-TABLES-UNIQUECONSTRAINTS-NULL-REGRESSION` | NULL handling follows SQL standard behavior      | `[x]`  |

---

## Coverage Summary

| User Story           | Title                          | Spec Count            | Status   |
| -------------------- | ------------------------------ | --------------------- | -------- |
| US-TABLES-UNIQUE-001 | Single-Field Unique Constraint | 5                     | Complete |
| US-TABLES-UNIQUE-002 | Composite Unique Constraints   | 9                     | Complete |
| US-TABLES-UNIQUE-003 | NULL Handling                  | 7                     | Complete |
| **Total**            |                                | **21 + 2 regression** |          |
