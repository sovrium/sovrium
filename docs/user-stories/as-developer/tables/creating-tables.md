# Creating Tables

> **Feature Area**: Tables
> **Schema**: `src/domain/models/app/table/`, `src/domain/models/app/tables.ts`
> **API Routes**: `GET /api/tables`, `GET /api/tables/:tableId`

---

## US-TABLES-DEFINITION-001: Define a Table

**As a** developer,
**I want to** define data tables in my application schema,
**so that** I can store structured data for my application.

### Configuration

```yaml
tables:
  - id: 1
    name: products
    fields:
      - id: 1
        name: title
        type: single-line-text
        required: true
      - id: 2
        name: price
        type: decimal
        required: true
```

### Acceptance Criteria

| ID     | Criterion                                                                      | E2E Spec                | Status |
| ------ | ------------------------------------------------------------------------------ | ----------------------- | ------ |
| AC-001 | PostgreSQL table is created with columns when table configuration is applied   | `APP-TABLES-001`        | ✅     |
| AC-002 | Table is created with correct column types for different field types           | `APP-TABLES-002`        | ✅     |
| AC-003 | Multiple tables can be created in same schema                                  | `APP-TABLES-003`        | ✅     |
| AC-004 | Table includes automatic id column with PRIMARY KEY                            | `APP-TABLES-004`        | ✅     |
| AC-005 | Table includes automatic timestamp fields (created_at, updated_at, deleted_at) | `APP-TABLES-005`        | ✅     |
| AC-006 | Table name follows PostgreSQL naming conventions                               | `APP-TABLES-006`        | ✅     |
| AC-007 | Invalid table configuration returns validation error                           | `APP-TABLES-007`        | ✅     |
| AC-008 | Empty fields array creates table with only automatic columns                   | `APP-TABLES-008`        | ✅     |
| AC-009 | User can complete full table definition workflow (regression)                  | `APP-TABLES-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/table/index.ts`
- **E2E Spec**: `specs/app/tables/tables.spec.ts`

---

## US-TABLES-DEFINITION-002: Configure Table Name

**As a** developer,
**I want to** configure a human-readable name for my tables,
**so that** users can identify tables in the UI.

### Acceptance Criteria

| ID     | Criterion                                                | E2E Spec                     | Status |
| ------ | -------------------------------------------------------- | ---------------------------- | ------ |
| AC-001 | Table name is stored and returned in API responses       | `APP-TABLES-NAME-001`        | ✅     |
| AC-002 | Table name can include spaces and special characters     | `APP-TABLES-NAME-002`        | ✅     |
| AC-003 | Table name is used for PostgreSQL table name (sanitized) | `APP-TABLES-NAME-003`        | ✅     |
| AC-004 | Empty table name returns validation error                | `APP-TABLES-NAME-004`        | ✅     |
| AC-005 | Duplicate table names return validation error            | `APP-TABLES-NAME-005`        | ✅     |
| AC-006 | User can complete full table name workflow (regression)  | `APP-TABLES-NAME-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/table/index.ts`
- **E2E Spec**: `specs/app/tables/name.spec.ts`

---

## US-TABLES-DEFINITION-003: Configure Table ID

**As a** developer,
**I want to** assign unique identifiers to tables,
**so that** I can reference them reliably in my application.

### Acceptance Criteria

| ID     | Criterion                                             | E2E Spec                   | Status |
| ------ | ----------------------------------------------------- | -------------------------- | ------ |
| AC-001 | Table ID is numeric and auto-incremented              | `APP-TABLES-ID-001`        | ✅     |
| AC-002 | Table ID is unique within the application             | `APP-TABLES-ID-002`        | ✅     |
| AC-003 | Table ID is used in API routes (/api/tables/:tableId) | `APP-TABLES-ID-003`        | ✅     |
| AC-004 | Duplicate table IDs return validation error           | `APP-TABLES-ID-004`        | ✅     |
| AC-005 | Accepts simple string table IDs                       | `APP-TABLES-ID-005`        | ✅     |
| AC-006 | Ensures uniqueness across multiple tables             | `APP-TABLES-ID-006`        | ✅     |
| AC-007 | User can complete full table ID workflow (regression) | `APP-TABLES-ID-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/table/index.ts`
- **E2E Spec**: `specs/app/tables/id.spec.ts`

---

## US-TABLES-DEFINITION-004: Configure Primary Key

**As a** developer,
**I want to** configure custom primary keys for my tables,
**so that** I can use natural keys or composite keys when needed.

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
    primaryKey:
      type: composite
      fields: [order_id, product_id]
```

### Acceptance Criteria

| ID     | Criterion                                                 | E2E Spec                           | Status |
| ------ | --------------------------------------------------------- | ---------------------------------- | ------ |
| AC-001 | Generates sequential primary key starting at 1            | `APP-TABLES-PRIMARYKEY-001`        | ✅     |
| AC-002 | Generates UUID v4 primary key when configured             | `APP-TABLES-PRIMARYKEY-002`        | ✅     |
| AC-003 | Creates PRIMARY KEY constraint on auto-incremented column | `APP-TABLES-PRIMARYKEY-003`        | ✅     |
| AC-004 | Rejects NULL values in primary key column                 | `APP-TABLES-PRIMARYKEY-004`        | ✅     |
| AC-005 | Automatically creates index on primary key column         | `APP-TABLES-PRIMARYKEY-005`        | ✅     |
| AC-006 | Allows UPDATE of non-primary key columns                  | `APP-TABLES-PRIMARYKEY-006`        | ✅     |
| AC-007 | Uses BIGINT for auto-incrementing primary key             | `APP-TABLES-PRIMARYKEY-007`        | ✅     |
| AC-008 | Creates PRIMARY KEY on composite key fields               | `APP-TABLES-PRIMARYKEY-008`        | ✅     |
| AC-009 | Rejects composite key when field is not defined           | `APP-TABLES-PRIMARYKEY-009`        | ✅     |
| AC-010 | Rejects composite key when field names are duplicated     | `APP-TABLES-PRIMARYKEY-010`        | ✅     |
| AC-011 | User can complete full primary key workflow (regression)  | `APP-TABLES-PRIMARYKEY-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/table/index.ts`
- **E2E Spec**: `specs/app/tables/primary-key.spec.ts`

---

## US-TABLES-DEFINITION-005: Define Table Fields

**As a** developer,
**I want to** define fields (columns) for my tables,
**so that** I can store specific data types for my application.

### Acceptance Criteria

| ID     | Criterion                                             | E2E Spec                       | Status |
| ------ | ----------------------------------------------------- | ------------------------------ | ------ |
| AC-001 | Fields are created as PostgreSQL columns              | `APP-TABLES-FIELDS-001`        | ✅     |
| AC-002 | Field ID is unique within the table                   | `APP-TABLES-FIELDS-002`        | ✅     |
| AC-003 | Field name follows PostgreSQL naming conventions      | `APP-TABLES-FIELDS-003`        | ✅     |
| AC-004 | Field type determines PostgreSQL column type          | `APP-TABLES-FIELDS-004`        | ✅     |
| AC-005 | Required fields are NOT NULL in PostgreSQL            | `APP-TABLES-FIELDS-005`        | ✅     |
| AC-006 | Optional fields allow NULL values                     | `APP-TABLES-FIELDS-006`        | ✅     |
| AC-007 | Default values are applied in PostgreSQL              | `APP-TABLES-FIELDS-007`        | ✅     |
| AC-008 | Invalid field configuration returns validation error  | `APP-TABLES-FIELDS-008`        | ✅     |
| AC-009 | Rejects invalid field type                            | `APP-TABLES-FIELDS-009`        | ✅     |
| AC-010 | Rejects integer field with invalid min/max            | `APP-TABLES-FIELDS-010`        | ✅     |
| AC-011 | Rejects decimal field with invalid precision          | `APP-TABLES-FIELDS-011`        | ✅     |
| AC-012 | Rejects single-select field without options           | `APP-TABLES-FIELDS-012`        | ✅     |
| AC-013 | Rejects multi-select field without options            | `APP-TABLES-FIELDS-013`        | ✅     |
| AC-014 | Rejects decimal field with missing scale              | `APP-TABLES-FIELDS-014`        | ✅     |
| AC-015 | Rejects relationship field without related table      | `APP-TABLES-FIELDS-015`        | ✅     |
| AC-016 | Rejects relationship field with invalid relation type | `APP-TABLES-FIELDS-016`        | ✅     |
| AC-017 | User can complete full fields workflow (regression)   | `APP-TABLES-FIELDS-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/table/index.ts`
- **E2E Spec**: `specs/app/tables/fields.spec.ts`

---

## US-TABLES-DEFINITION-006: Configure Indexes

**As a** developer,
**I want to** create indexes on table columns,
**so that** I can optimize query performance.

### Configuration

```yaml
tables:
  - id: 1
    name: users
    fields:
      - id: 1
        name: email
        type: email
        indexed: true
      - id: 2
        name: created_at
        type: datetime
        indexed: true
```

### Acceptance Criteria

| ID     | Criterion                                            | E2E Spec                        | Status |
| ------ | ---------------------------------------------------- | ------------------------------- | ------ |
| AC-001 | Indexed field creates PostgreSQL index               | `APP-TABLES-INDEXES-001`        | ✅     |
| AC-002 | Unique indexed field creates unique index            | `APP-TABLES-INDEXES-002`        | ✅     |
| AC-003 | Composite index can include multiple fields          | `APP-TABLES-INDEXES-003`        | ✅     |
| AC-004 | Index improves query performance                     | `APP-TABLES-INDEXES-004`        | ✅     |
| AC-005 | Index is automatically named                         | `APP-TABLES-INDEXES-005`        | ✅     |
| AC-006 | Optimizes ORDER BY queries on indexed column         | `APP-TABLES-INDEXES-006`        | ✅     |
| AC-007 | Enforces uniqueness on unique indexed column         | `APP-TABLES-INDEXES-007`        | ✅     |
| AC-008 | Enables efficient range queries on indexed column    | `APP-TABLES-INDEXES-008`        | ✅     |
| AC-009 | Rejects index referencing non-existent field         | `APP-TABLES-INDEXES-009`        | ✅     |
| AC-010 | Rejects duplicate index names in same table          | `APP-TABLES-INDEXES-010`        | ✅     |
| AC-011 | User can complete full indexes workflow (regression) | `APP-TABLES-INDEXES-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/table/index.ts`
- **E2E Spec**: `specs/app/tables/indexes.spec.ts`

---

## US-TABLES-DEFINITION-007: List Tables via API

**As a** developer,
**I want to** retrieve a list of all tables via API,
**so that** I can display available tables in my application.

### Acceptance Criteria

| ID     | Criterion                                        | E2E Spec                     | Status |
| ------ | ------------------------------------------------ | ---------------------------- | ------ |
| AC-001 | Returns 200 OK with array of tables              | `API-TABLES-LIST-001`        | ✅     |
| AC-002 | Returns 200 OK with empty array when no tables   | `API-TABLES-LIST-002`        | ✅     |
| AC-003 | Returns 401 when not authenticated               | `API-TABLES-LIST-003`        | ✅     |
| AC-004 | Only returns tables user has read permission for | `API-TABLES-LIST-004`        | ✅     |
| AC-005 | Each table includes id, name, and field count    | `API-TABLES-LIST-005`        | ✅     |
| AC-006 | User lists all available tables (regression)     | `API-TABLES-LIST-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/presentation/api/routes/tables.ts`
- **E2E Spec**: `specs/api/tables/get.spec.ts`

---

## US-TABLES-DEFINITION-008: Get Table Details via API

**As a** developer,
**I want to** retrieve details of a specific table via API,
**so that** I can display table schema in my application.

### Acceptance Criteria

| ID     | Criterion                                          | E2E Spec                    | Status |
| ------ | -------------------------------------------------- | --------------------------- | ------ |
| AC-001 | Returns 200 OK with table details                  | `API-TABLES-GET-001`        | ✅     |
| AC-002 | Returns 404 Not Found for non-existent table       | `API-TABLES-GET-002`        | ✅     |
| AC-003 | Returns 401 when not authenticated                 | `API-TABLES-GET-003`        | ✅     |
| AC-004 | Returns 403 when user lacks read permission        | `API-TABLES-GET-004`        | ✅     |
| AC-005 | Response includes fields array with types          | `API-TABLES-GET-005`        | ✅     |
| AC-006 | Response includes views array                      | `API-TABLES-GET-006`        | ⏳     |
| AC-007 | Response includes permissions configuration        | `API-TABLES-GET-007`        | ⏳     |
| AC-008 | User retrieves specific table details (regression) | `API-TABLES-GET-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/presentation/api/routes/tables.ts`
- **E2E Spec**: `specs/api/tables/{tableId}/get.spec.ts`

---

## US-TABLES-DEFINITION-009: Disable Tables

**As a** developer,
**I want to** disable tables without deleting them,
**so that** I can temporarily hide tables from users.

### Configuration

> **Note**: The `disabled` property is not yet available in the AppSchema. The YAML format below represents the target design and will be implemented in a future release.

### Acceptance Criteria

| ID     | Criterion                                              | E2E Spec                         | Status |
| ------ | ------------------------------------------------------ | -------------------------------- | ------ |
| AC-001 | Disabled tables are not returned in list API           | `API-TABLES-DISABLED-001`        | ✅     |
| AC-002 | Disabled tables return 404 on direct access            | `API-TABLES-DISABLED-002`        | ✅     |
| AC-003 | Disabled tables preserve data in PostgreSQL            | `API-TABLES-DISABLED-003`        | ✅     |
| AC-004 | Tables can be re-enabled by removing disabled flag     | `API-TABLES-DISABLED-004`        | ✅     |
| AC-005 | All tables endpoints hidden when disabled (regression) | `API-TABLES-DISABLED-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/table/index.ts`
- **E2E Spec**: `specs/api/tables/disabled-tables.spec.ts`

---

## US-TABLES-DEFINITION-010: PostgreSQL Data Types

**As a** developer,
**I want to** define fields with specific PostgreSQL data types,
**so that** my data is stored with the correct column types.

### Acceptance Criteria

| ID     | Criterion                                                      | E2E Spec         | Status |
| ------ | -------------------------------------------------------------- | ---------------- | ------ |
| AC-001 | Decimal field creates PostgreSQL NUMERIC(10,2) column          | `APP-TABLES-009` | ✅     |
| AC-002 | Checkbox field creates PostgreSQL BOOLEAN column with DEFAULT  | `APP-TABLES-010` | ✅     |
| AC-003 | Datetime field creates PostgreSQL TIMESTAMP with DEFAULT NOW() | `APP-TABLES-020` | ✅     |
| AC-004 | Single-select field creates VARCHAR with CHECK constraint      | `APP-TABLES-021` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/table/index.ts`
- **E2E Spec**: `specs/app/tables/tables.spec.ts`

---

## US-TABLES-DEFINITION-011: Constraint Enforcement

**As a** developer,
**I want to** define constraints on table columns,
**so that** data integrity is enforced at the database level.

### Acceptance Criteria

| ID     | Criterion                                     | E2E Spec         | Status |
| ------ | --------------------------------------------- | ---------------- | ------ |
| AC-001 | Unique constraint rejects duplicate values    | `APP-TABLES-011` | ✅     |
| AC-002 | NOT NULL constraint rejects NULL values       | `APP-TABLES-012` | ✅     |
| AC-003 | CHECK constraint rejects values outside range | `APP-TABLES-013` | ✅     |
| AC-004 | PRIMARY KEY constraint spans multiple columns | `APP-TABLES-023` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/table/index.ts`
- **E2E Spec**: `specs/app/tables/tables.spec.ts`

---

## US-TABLES-DEFINITION-012: Index Creation

**As a** developer,
**I want to** create indexes on columns,
**so that** query performance is optimized.

### Acceptance Criteria

| ID     | Criterion                                     | E2E Spec         | Status |
| ------ | --------------------------------------------- | ---------------- | ------ |
| AC-001 | Index is created and queryable via pg_indexes | `APP-TABLES-014` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/table/index.ts`
- **E2E Spec**: `specs/app/tables/tables.spec.ts`

---

## US-TABLES-DEFINITION-013: Schema Modification

**As a** developer,
**I want to** modify table schemas after creation,
**so that** I can evolve my data model over time.

### Acceptance Criteria

| ID     | Criterion                                              | E2E Spec         | Status |
| ------ | ------------------------------------------------------ | ---------------- | ------ |
| AC-001 | ALTER TABLE adds new column with correct type          | `APP-TABLES-015` | ✅     |
| AC-002 | DROP COLUMN removes column and keeps remaining columns | `APP-TABLES-016` | ✅     |
| AC-003 | DROP TABLE removes table completely                    | `APP-TABLES-022` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/table/index.ts`
- **E2E Spec**: `specs/app/tables/tables.spec.ts`

---

## US-TABLES-DEFINITION-014: CRUD Operations

**As a** developer,
**I want to** perform CRUD operations on table data,
**so that** I can manage records in my tables.

### Acceptance Criteria

| ID     | Criterion                                  | E2E Spec         | Status |
| ------ | ------------------------------------------ | ---------------- | ------ |
| AC-001 | INSERT returns row with generated ID       | `APP-TABLES-017` | ✅     |
| AC-002 | UPDATE modifies row and returns new value  | `APP-TABLES-018` | ✅     |
| AC-003 | DELETE removes row and decreases row count | `APP-TABLES-019` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/table/index.ts`
- **E2E Spec**: `specs/app/tables/tables.spec.ts`

---

## US-TABLES-DEFINITION-015: User Reference Fields

**As a** developer,
**I want to** create fields that reference authenticated users,
**so that** I can track record ownership and modifications.

### Acceptance Criteria

| ID     | Criterion                                        | E2E Spec         | Status |
| ------ | ------------------------------------------------ | ---------------- | ------ |
| AC-001 | User reference fields require auth config        | `APP-TABLES-024` | ✅     |
| AC-002 | Created-by field requires auth config            | `APP-TABLES-025` | ✅     |
| AC-003 | Updated-by field requires auth config            | `APP-TABLES-026` | ✅     |
| AC-004 | User fields accepted when auth config is present | `APP-TABLES-027` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/table/index.ts`
- **E2E Spec**: `specs/app/tables/tables.spec.ts`

---

## US-TABLES-DEFINITION-016: Table Name Validation

**As a** developer,
**I want to** receive clear validation errors for invalid table names,
**so that** I can fix configuration issues quickly.

### Acceptance Criteria

| ID     | Criterion                                           | E2E Spec         | Status |
| ------ | --------------------------------------------------- | ---------------- | ------ |
| AC-001 | Table name with invalid characters is rejected      | `APP-TABLES-028` | ✅     |
| AC-002 | Table name exceeding maximum length is rejected     | `APP-TABLES-029` | ✅     |
| AC-003 | Empty table name is rejected                        | `APP-TABLES-030` | ✅     |
| AC-004 | Duplicate table IDs within schema are rejected      | `APP-TABLES-031` | ✅     |
| AC-005 | Duplicate table names within schema are rejected    | `APP-TABLES-032` | ✅     |
| AC-006 | Table name starting with number is rejected         | `APP-TABLES-043` | ✅     |
| AC-007 | Table with reserved SQL keyword as name is rejected | `APP-TABLES-044` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/table/index.ts`
- **E2E Spec**: `specs/app/tables/tables.spec.ts`

---

## US-TABLES-DEFINITION-017: Field Name Validation

**As a** developer,
**I want to** receive clear validation errors for invalid field names,
**so that** I can fix field configuration issues quickly.

### Acceptance Criteria

| ID     | Criterion                                            | E2E Spec         | Status |
| ------ | ---------------------------------------------------- | ---------------- | ------ |
| AC-001 | Duplicate field IDs within same table are rejected   | `APP-TABLES-033` | ✅     |
| AC-002 | Duplicate field names within same table are rejected | `APP-TABLES-034` | ✅     |
| AC-003 | Field name with invalid format is rejected           | `APP-TABLES-035` | ✅     |
| AC-004 | Field name exceeding maximum length is rejected      | `APP-TABLES-036` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/table/index.ts`
- **E2E Spec**: `specs/app/tables/tables.spec.ts`

---

## US-TABLES-DEFINITION-018: Field Type Validation

**As a** developer,
**I want to** receive clear validation errors for invalid field configurations,
**so that** I can fix field type issues quickly.

### Acceptance Criteria

| ID     | Criterion                                           | E2E Spec         | Status |
| ------ | --------------------------------------------------- | ---------------- | ------ |
| AC-001 | Invalid field type is rejected                      | `APP-TABLES-037` | ✅     |
| AC-002 | Integer field with min greater than max is rejected | `APP-TABLES-038` | ✅     |
| AC-003 | Decimal field with min greater than max is rejected | `APP-TABLES-039` | ✅     |
| AC-004 | Single-select field without options is rejected     | `APP-TABLES-040` | ✅     |
| AC-005 | Multi-select field without options is rejected      | `APP-TABLES-041` | ✅     |
| AC-006 | Decimal field with invalid precision is rejected    | `APP-TABLES-042` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/table/index.ts`
- **E2E Spec**: `specs/app/tables/tables.spec.ts`

---

## Regression Tests

| Spec ID                            | Workflow                                                 | Status |
| ---------------------------------- | -------------------------------------------------------- | ------ |
| `APP-TABLES-REGRESSION`            | Developer defines tables with fields and creates records | `[x]`  |
| `APP-TABLES-NAME-REGRESSION`       | Developer configures table names correctly               | `[x]`  |
| `APP-TABLES-ID-REGRESSION`         | Developer configures table IDs correctly                 | `[x]`  |
| `APP-TABLES-PRIMARYKEY-REGRESSION` | Developer configures primary keys correctly              | `[x]`  |
| `APP-TABLES-INDEXES-REGRESSION`    | Developer creates and manages indexes                    | `[x]`  |
| `APP-TABLES-FIELDS-REGRESSION`     | Developer defines table fields correctly                 | `[x]`  |
| `API-TABLES-LIST-REGRESSION`       | User lists all available tables                          | `[x]`  |
| `API-TABLES-GET-REGRESSION`        | User retrieves specific table details                    | `[x]`  |

---

## Coverage Summary

| User Story               | Title                     | Spec Count             | Status   |
| ------------------------ | ------------------------- | ---------------------- | -------- |
| US-TABLES-DEFINITION-001 | Define a Table            | 9                      | Complete |
| US-TABLES-DEFINITION-002 | Configure Table Name      | 6                      | Complete |
| US-TABLES-DEFINITION-003 | Configure Table ID        | 7                      | Complete |
| US-TABLES-DEFINITION-004 | Configure Primary Key     | 11                     | Complete |
| US-TABLES-DEFINITION-005 | Define Table Fields       | 17                     | Complete |
| US-TABLES-DEFINITION-006 | Configure Indexes         | 11                     | Complete |
| US-TABLES-DEFINITION-007 | List Tables via API       | 6                      | Complete |
| US-TABLES-DEFINITION-008 | Get Table Details via API | 8                      | Complete |
| US-TABLES-DEFINITION-009 | Disable Tables            | 5                      | Complete |
| US-TABLES-DEFINITION-010 | PostgreSQL Data Types     | 4                      | Complete |
| US-TABLES-DEFINITION-011 | Constraint Enforcement    | 4                      | Complete |
| US-TABLES-DEFINITION-012 | Index Creation            | 1                      | Complete |
| US-TABLES-DEFINITION-013 | Schema Modification       | 3                      | Complete |
| US-TABLES-DEFINITION-014 | CRUD Operations           | 3                      | Complete |
| US-TABLES-DEFINITION-015 | User Reference Fields     | 4                      | Complete |
| US-TABLES-DEFINITION-016 | Table Name Validation     | 7                      | Complete |
| US-TABLES-DEFINITION-017 | Field Name Validation     | 4                      | Complete |
| US-TABLES-DEFINITION-018 | Field Type Validation     | 6                      | Complete |
| **Total**                |                           | **116 + 8 regression** |          |
