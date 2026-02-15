# Relationships

> **Feature Area**: Tables - Relationships
> **Schema**: `src/domain/models/app/table/`
> **E2E Specs**: `specs/app/tables/field-types/`

---

## Overview

Sovrium supports relational data modeling with linked records, lookups, rollups, and counts. Relationships are implemented as foreign key constraints in PostgreSQL with configurable cascade behaviors.

---

## US-TABLES-RELATIONSHIPS-000: Foreign Key Constraints

**As a** developer,
**I want to** create foreign key constraints between tables,
**so that** referential integrity is enforced at the database level.

### Configuration

```yaml
tables:
  - id: 1
    name: customers
    fields:
      - id: 1
        name: name
        type: single-line-text
        required: true

  - id: 2
    name: orders
    fields:
      - id: 1
        name: customer_id
        type: relationship
        relatedTable: customers
        relationType: many-to-one
        onDelete: cascade
        onUpdate: cascade
```

### Acceptance Criteria

| ID     | Criterion                                                | E2E Spec                   | Status |
| ------ | -------------------------------------------------------- | -------------------------- | ------ |
| AC-001 | Creates foreign key column referencing parent table      | `APP-TABLES-FK-001`        | ✅     |
| AC-002 | Rejects INSERT when foreign key references non-existent  | `APP-TABLES-FK-002`        | ✅     |
| AC-003 | Rejects DELETE of parent record with dependent children  | `APP-TABLES-FK-003`        | ✅     |
| AC-004 | CASCADE DELETE removes child records with parent         | `APP-TABLES-FK-004`        | ✅     |
| AC-005 | SET NULL on child records when parent is deleted         | `APP-TABLES-FK-005`        | ✅     |
| AC-006 | Supports self-referential foreign keys                   | `APP-TABLES-FK-006`        | ✅     |
| AC-007 | Allows circular dependencies between tables              | `APP-TABLES-FK-007`        | ✅     |
| AC-008 | Creates index on foreign key column by default           | `APP-TABLES-FK-008`        | ✅     |
| AC-009 | Supports composite foreign keys                          | `APP-TABLES-FK-009`        | ✅     |
| AC-010 | Rejects FK creation when parent table does not exist     | `APP-TABLES-FK-010`        | ✅     |
| AC-011 | Rejects FK when referenced column is not unique/PK       | `APP-TABLES-FK-011`        | ✅     |
| AC-012 | CASCADE UPDATE updates child records when parent changes | `APP-TABLES-FK-012`        | ✅     |
| AC-013 | Supports one-to-one relationship via unique FK           | `APP-TABLES-FK-013`        | ✅     |
| AC-014 | Supports many-to-many via junction table with FKs        | `APP-TABLES-FK-014`        | ✅     |
| AC-015 | User can complete full foreign key workflow (regression) | `APP-TABLES-FK-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/relationships/foreign-keys.spec.ts`

---

## US-TABLES-RELATIONSHIPS-001: Many-to-One Relationships

**As a** developer,
**I want to** define many-to-one relationships between tables,
**so that** I can link multiple records to a single parent record.

### Configuration

```yaml
tables:
  - id: 1
    name: authors
    fields:
      - id: 1
        name: name
        type: single-line-text
        required: true

  - id: 2
    name: books
    fields:
      - id: 1
        name: title
        type: single-line-text
        required: true
      - id: 2
        name: author_id
        type: relationship
        relatedTable: authors
        relationType: many-to-one
        onDelete: cascade
        onUpdate: cascade
        indexed: true
```

### Acceptance Criteria

| ID     | Criterion                                          | E2E Spec                                  | Status |
| ------ | -------------------------------------------------- | ----------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL INTEGER column with FOREIGN KEY | `APP-TABLES-FIELD-TYPES-RELATIONSHIP-001` | ✅     |
| AC-002 | Validates referenced record exists                 | `APP-TABLES-FIELD-TYPES-RELATIONSHIP-002` | ✅     |
| AC-003 | Creates index on relationship column by default    |                                           |        |
| AC-004 | Returns related record when expanded               |                                           |        |
| AC-005 | Supports filtering by related record ID            |                                           |        |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/relationship-field.spec.ts`

---

## US-TABLES-RELATIONSHIPS-002: One-to-One Relationships

**As a** developer,
**I want to** define one-to-one relationships between tables,
**so that** I can create exclusive links between records.

### Configuration

```yaml
tables:
  - id: 1
    name: users
    fields:
      - id: 1
        name: email
        type: email
        required: true

  - id: 2
    name: user_profiles
    fields:
      - id: 1
        name: user_id
        type: relationship
        relatedTable: users
        relationType: one-to-one
        onDelete: cascade
        unique: true
      - id: 2
        name: bio
        type: long-text
```

### Acceptance Criteria

| ID     | Criterion                                             | E2E Spec                                  | Status |
| ------ | ----------------------------------------------------- | ----------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL FOREIGN KEY with UNIQUE constraint | `APP-TABLES-FIELD-TYPES-RELATIONSHIP-006` | ✅     |
| AC-002 | Prevents multiple records linking to same parent      | `APP-TABLES-FIELD-TYPES-RELATIONSHIP-007` | ✅     |
| AC-003 | Returns 400 on duplicate link attempt                 | `APP-TABLES-FIELD-TYPES-RELATIONSHIP-008` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/relationship-field.spec.ts`

---

## US-TABLES-RELATIONSHIPS-003: Many-to-Many Relationships

**As a** developer,
**I want to** define many-to-many relationships between tables,
**so that** I can link multiple records to multiple records.

### Configuration

```yaml
tables:
  - id: 1
    name: students
    fields:
      - id: 1
        name: name
        type: single-line-text
        required: true

  - id: 2
    name: courses
    fields:
      - id: 1
        name: title
        type: single-line-text
        required: true
      - id: 2
        name: students
        type: relationship
        relatedTable: students
        relationType: many-to-many
        reciprocalField: courses # Creates reverse link on students table
```

### Acceptance Criteria

| ID     | Criterion                                            | E2E Spec                                  | Status |
| ------ | ---------------------------------------------------- | ----------------------------------------- | ------ |
| AC-001 | Auto-creates junction table ({table1}\_{table2})     | `APP-TABLES-FIELD-TYPES-RELATIONSHIP-009` | ✅     |
| AC-002 | Junction table has composite primary key             |                                           |        |
| AC-003 | Supports linking multiple records                    | `APP-TABLES-FIELD-TYPES-RELATIONSHIP-011` | ✅     |
| AC-004 | Returns array of related records when expanded       | `APP-TABLES-FIELD-TYPES-RELATIONSHIP-012` | ✅     |
| AC-005 | Creates reciprocal field on related table (optional) | `APP-TABLES-FIELD-TYPES-RELATIONSHIP-013` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/relationship-field.spec.ts`

---

## US-TABLES-RELATIONSHIPS-004: Self-Referencing Relationships

**As a** developer,
**I want to** define self-referencing relationships,
**so that** I can create hierarchical data structures.

### Configuration

```yaml
tables:
  - id: 1
    name: categories
    fields:
      - id: 1
        name: name
        type: single-line-text
        required: true
      - id: 2
        name: parent_id
        type: relationship
        relatedTable: categories # Self-reference
        relationType: many-to-one
        onDelete: set-null
```

### Acceptance Criteria

| ID     | Criterion                                          | E2E Spec                                  | Status |
| ------ | -------------------------------------------------- | ----------------------------------------- | ------ |
| AC-001 | Creates self-referential foreign key               | `APP-TABLES-FIELD-TYPES-RELATIONSHIP-014` | ✅     |
| AC-002 | Allows NULL for root-level records                 | `APP-TABLES-FIELD-TYPES-RELATIONSHIP-015` | ✅     |
| AC-003 | Supports tree traversal queries                    | `APP-TABLES-FIELD-TYPES-RELATIONSHIP-016` | ✅     |
| AC-004 | Prevents circular references (optional validation) | `APP-TABLES-FIELD-TYPES-RELATIONSHIP-017` | ✅     |
| AC-005 | Returns ancestors/descendants when requested       | `APP-TABLES-FIELD-TYPES-RELATIONSHIP-018` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/relationship-field.spec.ts`

---

## US-TABLES-RELATIONSHIPS-005: Cascade Behaviors

**As a** developer,
**I want to** configure cascade behaviors for relationships,
**so that** I can control what happens when related records are modified or deleted.

### Configuration

```yaml
tables:
  - id: 1
    name: orders
    fields:
      - id: 1
        name: customer_id
        type: relationship
        relatedTable: customers
        relationType: many-to-one
        onDelete: restrict # Prevent deletion if orders exist
        onUpdate: cascade # Update foreign key if customer ID changes

  - id: 2
    name: order_items
    fields:
      - id: 1
        name: order_id
        type: relationship
        relatedTable: orders
        relationType: many-to-one
        onDelete: cascade # Delete items when order is deleted
```

### Acceptance Criteria

| ID     | Criterion                                         | E2E Spec                                  | Status |
| ------ | ------------------------------------------------- | ----------------------------------------- | ------ |
| AC-001 | onDelete: cascade deletes child records           | `APP-TABLES-FIELD-TYPES-RELATIONSHIP-003` | ✅     |
| AC-002 | onDelete: set-null sets foreign key to NULL       | `APP-TABLES-FIELD-TYPES-RELATIONSHIP-004` | ✅     |
| AC-003 | onDelete: restrict prevents parent deletion       | `APP-TABLES-FIELD-TYPES-RELATIONSHIP-005` | ✅     |
| AC-004 | onUpdate: cascade updates foreign keys            | `APP-TABLES-FIELD-TYPES-RELATIONSHIP-010` | ✅     |
| AC-005 | Returns appropriate error on constraint violation | `APP-TABLES-FIELD-TYPES-RELATIONSHIP-019` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/relationship-field.spec.ts`

---

## US-TABLES-RELATIONSHIPS-006: Lookup Fields

**As a** developer,
**I want to** define lookup fields to display values from related records,
**so that** I can show related data without additional queries.

### Configuration

```yaml
tables:
  - id: 1
    name: orders
    fields:
      - id: 1
        name: customer_id
        type: relationship
        relatedTable: customers
        relationType: many-to-one
      - id: 2
        name: customer_name
        type: lookup
        relationshipField: customer_id
        relatedField: name # Field from customers table
      - id: 3
        name: customer_email
        type: lookup
        relationshipField: customer_id
        relatedField: email
```

### Acceptance Criteria

| ID     | Criterion                                           | E2E Spec                            | Status |
| ------ | --------------------------------------------------- | ----------------------------------- | ------ |
| AC-001 | Does not create database column (computed at query) | `APP-TABLES-FIELD-TYPES-LOOKUP-001` | ✅     |
| AC-002 | Returns value from related record                   | `APP-TABLES-FIELD-TYPES-LOOKUP-002` | ✅     |
| AC-003 | Updates automatically when source record changes    | `APP-TABLES-FIELD-TYPES-LOOKUP-003` | ✅     |
| AC-004 | Returns NULL when relationship is NULL              | `APP-TABLES-FIELD-TYPES-LOOKUP-004` | ✅     |
| AC-005 | Supports nested lookups (lookup from lookup)        | `APP-TABLES-FIELD-TYPES-LOOKUP-005` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/lookup-field.spec.ts`

---

## US-TABLES-RELATIONSHIPS-007: Rollup Fields

**As a** developer,
**I want to** define rollup fields to aggregate values from related records,
**so that** I can calculate summaries like totals, counts, and averages.

### Configuration

```yaml
tables:
  - id: 1
    name: orders
    fields:
      - id: 1
        name: customer_id
        type: relationship
        relatedTable: customers
        relationType: many-to-one

  - id: 2
    name: customers
    fields:
      - id: 1
        name: name
        type: single-line-text
      - id: 2
        name: total_orders
        type: rollup
        relationshipField: orders
        relatedField: id
        aggregation: count
      - id: 3
        name: total_spent
        type: rollup
        relationshipField: orders
        relatedField: total
        aggregation: sum
      - id: 4
        name: average_order
        type: rollup
        relationshipField: orders
        relatedField: total
        aggregation: avg
```

### Acceptance Criteria

| ID     | Criterion                                            | E2E Spec                            | Status |
| ------ | ---------------------------------------------------- | ----------------------------------- | ------ |
| AC-001 | Supports COUNT aggregation                           | `APP-TABLES-FIELD-TYPES-ROLLUP-001` | ✅     |
| AC-002 | Supports SUM aggregation                             | `APP-TABLES-FIELD-TYPES-ROLLUP-002` | ✅     |
| AC-003 | Supports AVG aggregation                             | `APP-TABLES-FIELD-TYPES-ROLLUP-003` | ✅     |
| AC-004 | Supports MIN/MAX aggregation                         | `APP-TABLES-FIELD-TYPES-ROLLUP-004` | ✅     |
| AC-005 | Updates automatically when linked records change     | `APP-TABLES-FIELD-TYPES-ROLLUP-005` | ✅     |
| AC-006 | Supports filtering linked records before aggregation | `APP-TABLES-FIELD-TYPES-ROLLUP-006` | ✅     |
| AC-007 | Returns 0 or NULL when no linked records exist       | `APP-TABLES-FIELD-TYPES-ROLLUP-007` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/rollup-field.spec.ts`

---

## US-TABLES-RELATIONSHIPS-008: Count Fields

**As a** developer,
**I want to** define count fields to count related records,
**so that** I can display relationship counts efficiently.

### Configuration

```yaml
tables:
  - id: 1
    name: authors
    fields:
      - id: 1
        name: name
        type: single-line-text
      - id: 2
        name: book_count
        type: count
        relationshipField: books # Count books linked to this author
```

### Acceptance Criteria

| ID     | Criterion                                        | E2E Spec                           | Status |
| ------ | ------------------------------------------------ | ---------------------------------- | ------ |
| AC-001 | Counts related records efficiently               | `APP-TABLES-FIELD-TYPES-COUNT-001` | ✅     |
| AC-002 | Updates automatically when linked records change | `APP-TABLES-FIELD-TYPES-COUNT-002` | ✅     |
| AC-003 | Returns 0 when no linked records exist           | `APP-TABLES-FIELD-TYPES-COUNT-003` | ✅     |
| AC-004 | Supports filtering before counting               | `APP-TABLES-FIELD-TYPES-COUNT-004` | ✅     |
| AC-005 | Excludes soft-deleted records by default         | `APP-TABLES-FIELD-TYPES-COUNT-005` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/count-field.spec.ts`

---

## US-TABLES-RELATIONSHIPS-009: Relationship Display Options

**As a** developer,
**I want to** configure how related records are displayed,
**so that** users see meaningful information in the UI.

### Configuration

```yaml
tables:
  - id: 1
    name: books
    fields:
      - id: 1
        name: author_id
        type: relationship
        relatedTable: authors
        relationType: many-to-one
        displayField: name # Show author name instead of ID
        limitToView: published_authors # Only show authors from this view
```

### Acceptance Criteria

| ID     | Criterion                                       | E2E Spec                                  | Status |
| ------ | ----------------------------------------------- | ----------------------------------------- | ------ |
| AC-001 | Uses displayField for UI representation         | `APP-TABLES-FIELD-TYPES-RELATIONSHIP-020` | ✅     |
| AC-002 | Filters available options based on limitToView  | `APP-TABLES-FIELD-TYPES-RELATIONSHIP-021` | ✅     |
| AC-003 | Supports multiple display fields (concatenated) | `APP-TABLES-FIELD-TYPES-RELATIONSHIP-022` | ✅     |
| AC-004 | Returns display value in API response           | `APP-TABLES-FIELD-TYPES-RELATIONSHIP-023` | ⏳     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/relationship-field.spec.ts`

---

## Regression Tests

| Spec ID                               | Workflow                                              | Status |
| ------------------------------------- | ----------------------------------------------------- | ------ |
| `APP-TABLES-FK-REGRESSION`            | Developer creates and manages foreign key constraints | `[x]`  |
| `APP-TABLES-RELATIONSHIPS-REGRESSION` | Developer creates tables with all relationship types  | `[x]`  |
| `APP-TABLES-CASCADE-REGRESSION`       | Cascade behaviors work correctly on CRUD operations   | `[x]`  |
| `APP-TABLES-LOOKUP-ROLLUP-REGRESSION` | Lookup and rollup fields compute correctly            | `[x]`  |

---

## Coverage Summary

| User Story                  | Title                      | Spec Count            | Status   |
| --------------------------- | -------------------------- | --------------------- | -------- |
| US-TABLES-RELATIONSHIPS-000 | Foreign Key Constraints    | 15                    | Complete |
| US-TABLES-RELATIONSHIPS-001 | Many-to-One Relationships  | 5                     | Partial  |
| US-TABLES-RELATIONSHIPS-002 | One-to-One Relationships   | 3                     | Complete |
| US-TABLES-RELATIONSHIPS-003 | Many-to-Many Relationships | 5                     | Partial  |
| US-TABLES-RELATIONSHIPS-004 | Self-Referencing           | 5                     | Complete |
| US-TABLES-RELATIONSHIPS-005 | Cascade Behaviors          | 5                     | Complete |
| US-TABLES-RELATIONSHIPS-006 | Lookup Fields              | 5                     | Complete |
| US-TABLES-RELATIONSHIPS-007 | Rollup Fields              | 7                     | Complete |
| US-TABLES-RELATIONSHIPS-008 | Count Fields               | 5                     | Complete |
| US-TABLES-RELATIONSHIPS-009 | Display Options            | 4                     | Complete |
| **Total**                   |                            | **59 + 4 regression** |          |
