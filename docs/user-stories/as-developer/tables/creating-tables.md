# Creating Tables

> **Feature Area**: Tables
> **Schema**: `src/domain/models/app/table/`
> **API Routes**: `GET /api/tables`, `GET /api/tables/:tableId`

---

## US-TABLES-001: Define a Table

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

| ID     | Criterion                                                                      | E2E Spec         |
| ------ | ------------------------------------------------------------------------------ | ---------------- |
| AC-001 | PostgreSQL table is created with columns when table configuration is applied   | `APP-TABLES-001` |
| AC-002 | Table is created with correct column types for different field types           | `APP-TABLES-002` |
| AC-003 | Multiple tables can be created in same schema                                  | `APP-TABLES-003` |
| AC-004 | Table includes automatic id column with PRIMARY KEY                            | `APP-TABLES-004` |
| AC-005 | Table includes automatic timestamp fields (created_at, updated_at, deleted_at) | `APP-TABLES-005` |
| AC-006 | Table name follows PostgreSQL naming conventions                               | `APP-TABLES-006` |
| AC-007 | Invalid table configuration returns validation error                           | `APP-TABLES-007` |
| AC-008 | Empty fields array creates table with only automatic columns                   | `APP-TABLES-008` |

### Implementation References

- **Schema**: `src/domain/models/app/table/index.ts`
- **E2E Spec**: `specs/app/tables/tables.spec.ts`

---

## US-TABLES-002: Configure Table Name

**As a** developer,
**I want to** configure a human-readable name for my tables,
**so that** users can identify tables in the UI.

### Acceptance Criteria

| ID     | Criterion                                                | E2E Spec              |
| ------ | -------------------------------------------------------- | --------------------- |
| AC-001 | Table name is stored and returned in API responses       | `APP-TABLES-NAME-001` |
| AC-002 | Table name can include spaces and special characters     | `APP-TABLES-NAME-002` |
| AC-003 | Table name is used for PostgreSQL table name (sanitized) | `APP-TABLES-NAME-003` |
| AC-004 | Empty table name returns validation error                | `APP-TABLES-NAME-004` |
| AC-005 | Duplicate table names return validation error            | `APP-TABLES-NAME-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/index.ts`
- **E2E Spec**: `specs/app/tables/name.spec.ts`

---

## US-TABLES-003: Configure Table ID

**As a** developer,
**I want to** assign unique identifiers to tables,
**so that** I can reference them reliably in my application.

### Acceptance Criteria

| ID     | Criterion                                             | E2E Spec            |
| ------ | ----------------------------------------------------- | ------------------- |
| AC-001 | Table ID is numeric and auto-incremented              | `APP-TABLES-ID-001` |
| AC-002 | Table ID is unique within the application             | `APP-TABLES-ID-002` |
| AC-003 | Table ID is used in API routes (/api/tables/:tableId) | `APP-TABLES-ID-003` |
| AC-004 | Duplicate table IDs return validation error           | `APP-TABLES-ID-004` |

### Implementation References

- **Schema**: `src/domain/models/app/table/index.ts`
- **E2E Spec**: `specs/app/tables/id.spec.ts`

---

## US-TABLES-004: Configure Primary Key

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

| ID     | Criterion                                             | E2E Spec                     |
| ------ | ----------------------------------------------------- | ---------------------------- |
| AC-001 | Default primary key is auto-incrementing integer 'id' | `APP-TABLES-PRIMARY-KEY-001` |
| AC-002 | Composite primary key uses multiple fields            | `APP-TABLES-PRIMARY-KEY-002` |
| AC-003 | Primary key enforces uniqueness                       | `APP-TABLES-PRIMARY-KEY-003` |
| AC-004 | Invalid primary key configuration returns error       | `APP-TABLES-PRIMARY-KEY-004` |
| AC-005 | Primary key fields must be required                   | `APP-TABLES-PRIMARY-KEY-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/index.ts`
- **E2E Spec**: `specs/app/tables/primary-key.spec.ts`

---

## US-TABLES-005: Define Table Fields

**As a** developer,
**I want to** define fields (columns) for my tables,
**so that** I can store specific data types for my application.

### Acceptance Criteria

| ID     | Criterion                                            | E2E Spec                |
| ------ | ---------------------------------------------------- | ----------------------- |
| AC-001 | Fields are created as PostgreSQL columns             | `APP-TABLES-FIELDS-001` |
| AC-002 | Field ID is unique within the table                  | `APP-TABLES-FIELDS-002` |
| AC-003 | Field name follows PostgreSQL naming conventions     | `APP-TABLES-FIELDS-003` |
| AC-004 | Field type determines PostgreSQL column type         | `APP-TABLES-FIELDS-004` |
| AC-005 | Required fields are NOT NULL in PostgreSQL           | `APP-TABLES-FIELDS-005` |
| AC-006 | Optional fields allow NULL values                    | `APP-TABLES-FIELDS-006` |
| AC-007 | Default values are applied in PostgreSQL             | `APP-TABLES-FIELDS-007` |
| AC-008 | Invalid field configuration returns validation error | `APP-TABLES-FIELDS-008` |

### Implementation References

- **Schema**: `src/domain/models/app/table/index.ts`
- **E2E Spec**: `specs/app/tables/fields.spec.ts`

---

## US-TABLES-006: Configure Indexes

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

| ID     | Criterion                                   | E2E Spec                 |
| ------ | ------------------------------------------- | ------------------------ |
| AC-001 | Indexed field creates PostgreSQL index      | `APP-TABLES-INDEXES-001` |
| AC-002 | Unique indexed field creates unique index   | `APP-TABLES-INDEXES-002` |
| AC-003 | Composite index can include multiple fields | `APP-TABLES-INDEXES-003` |
| AC-004 | Index improves query performance            | `APP-TABLES-INDEXES-004` |
| AC-005 | Index is automatically named                | `APP-TABLES-INDEXES-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/index.ts`
- **E2E Spec**: `specs/app/tables/indexes.spec.ts`

---

## US-TABLES-007: List Tables via API

**As a** developer,
**I want to** retrieve a list of all tables via API,
**so that** I can display available tables in my application.

### Acceptance Criteria

| ID     | Criterion                                        | E2E Spec              |
| ------ | ------------------------------------------------ | --------------------- |
| AC-001 | Returns 200 OK with array of tables              | `API-TABLES-LIST-001` |
| AC-002 | Returns 200 OK with empty array when no tables   | `API-TABLES-LIST-002` |
| AC-003 | Returns 401 when not authenticated               | `API-TABLES-LIST-003` |
| AC-004 | Only returns tables user has read permission for | `API-TABLES-LIST-004` |
| AC-005 | Each table includes id, name, and field count    | `API-TABLES-LIST-005` |

### Implementation References

- **Schema**: `src/presentation/api/routes/tables.ts`
- **E2E Spec**: `specs/api/tables/get.spec.ts`

---

## US-TABLES-008: Get Table Details via API

**As a** developer,
**I want to** retrieve details of a specific table via API,
**so that** I can display table schema in my application.

### Acceptance Criteria

| ID     | Criterion                                    | E2E Spec             |
| ------ | -------------------------------------------- | -------------------- |
| AC-001 | Returns 200 OK with table details            | `API-TABLES-GET-001` |
| AC-002 | Returns 404 Not Found for non-existent table | `API-TABLES-GET-002` |
| AC-003 | Returns 401 when not authenticated           | `API-TABLES-GET-003` |
| AC-004 | Returns 403 when user lacks read permission  | `API-TABLES-GET-004` |
| AC-005 | Response includes fields array with types    | `API-TABLES-GET-005` |
| AC-006 | Response includes views array                | `API-TABLES-GET-006` |
| AC-007 | Response includes permissions configuration  | `API-TABLES-GET-007` |

### Implementation References

- **Schema**: `src/presentation/api/routes/tables.ts`
- **E2E Spec**: `specs/api/tables/{tableId}/get.spec.ts`

---

## US-TABLES-009: Disable Tables

**As a** developer,
**I want to** disable tables without deleting them,
**so that** I can temporarily hide tables from users.

### Configuration

```yaml
tables:
  - id: 1
    name: archived_data
    disabled: true
    fields: [...]
```

### Acceptance Criteria

| ID     | Criterion                                          | E2E Spec                  |
| ------ | -------------------------------------------------- | ------------------------- |
| AC-001 | Disabled tables are not returned in list API       | `API-TABLES-DISABLED-001` |
| AC-002 | Disabled tables return 404 on direct access        | `API-TABLES-DISABLED-002` |
| AC-003 | Disabled tables preserve data in PostgreSQL        | `API-TABLES-DISABLED-003` |
| AC-004 | Tables can be re-enabled by removing disabled flag | `API-TABLES-DISABLED-004` |

### Implementation References

- **Schema**: `src/domain/models/app/table/index.ts`
- **E2E Spec**: `specs/api/tables/disabled-tables.spec.ts`

---

## Regression Tests

| Spec ID                      | Workflow                                                 | Status |
| ---------------------------- | -------------------------------------------------------- | ------ |
| `APP-TABLES-REGRESSION`      | Developer defines tables with fields and creates records | `[x]`  |
| `API-TABLES-LIST-REGRESSION` | User lists all available tables                          | `[x]`  |
| `API-TABLES-GET-REGRESSION`  | User retrieves specific table details                    | `[x]`  |

---

## Coverage Summary

| User Story    | Title                     | Spec Count            | Status   |
| ------------- | ------------------------- | --------------------- | -------- |
| US-TABLES-001 | Define a Table            | 8                     | Complete |
| US-TABLES-002 | Configure Table Name      | 5                     | Complete |
| US-TABLES-003 | Configure Table ID        | 4                     | Complete |
| US-TABLES-004 | Configure Primary Key     | 5                     | Complete |
| US-TABLES-005 | Define Table Fields       | 8                     | Complete |
| US-TABLES-006 | Configure Indexes         | 5                     | Complete |
| US-TABLES-007 | List Tables via API       | 5                     | Complete |
| US-TABLES-008 | Get Table Details via API | 7                     | Complete |
| US-TABLES-009 | Disable Tables            | 4                     | Complete |
| **Total**     |                           | **51 + 3 regression** |          |
