# Views

> **Feature Area**: Tables - Views
> **Schema**: `src/domain/models/app/table/`
> **API Routes**: `GET /api/tables/:tableId/views`, `GET /api/tables/:tableId/views/:viewId`
> **E2E Specs**: `specs/app/tables/views/`, `specs/api/tables/{tableId}/views/`

---

## Overview

Views in Sovrium provide saved configurations of filters, sorts, field visibility, and grouping. They allow users to create multiple perspectives on the same data without duplicating the underlying records.

---

## US-TABLES-VIEWS-001: Define Table Views

**As a** developer,
**I want to** define multiple views for a table,
**so that** users can switch between different filtered and sorted perspectives of the data.

### Configuration

```yaml
tables:
  - id: 1
    name: tasks
    fields:
      - id: 1
        name: title
        type: single-line-text
      - id: 2
        name: status
        type: single-select
        options: [todo, in_progress, done]
      - id: 3
        name: priority
        type: number
      - id: 4
        name: created_at
        type: datetime
    views:
      - id: 1
        name: All Tasks
        isDefault: true
      - id: 2
        name: Active Tasks
        filter:
          field: status
          operator: in
          value: [todo, in_progress]
      - id: 3
        name: High Priority
        filter:
          field: priority
          operator: gte
          value: 3
        sort:
          - field: priority
            direction: desc
```

### Acceptance Criteria

| ID     | Criterion                                                    | E2E Spec                      | Status |
| ------ | ------------------------------------------------------------ | ----------------------------- | ------ |
| AC-001 | View filter is applied when querying records                 | `APP-TABLES-VIEWS-001`        | ✅     |
| AC-002 | Multiple filter conditions are combined with AND operator    | `APP-TABLES-VIEWS-002`        | ✅     |
| AC-003 | View sort configuration is applied to query                  | `APP-TABLES-VIEWS-003`        | ✅     |
| AC-004 | View groupBy configuration aggregates records by field       | `APP-TABLES-VIEWS-004`        | ✅     |
| AC-005 | View field visibility configuration limits returned columns  | `APP-TABLES-VIEWS-005`        | ✅     |
| AC-006 | Default view configuration is applied when no view specified | `APP-TABLES-VIEWS-006`        | ✅     |
| AC-007 | Only one default view is allowed per table                   | `APP-TABLES-VIEWS-007`        | ✅     |
| AC-008 | View with empty name is rejected                             | `APP-TABLES-VIEWS-008`        | ✅     |
| AC-009 | User can complete full views workflow (regression)           | `APP-TABLES-VIEWS-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/table/view.ts`
- **E2E Spec**: `specs/app/tables/views/views.spec.ts`

---

## US-TABLES-VIEWS-009: View Schema Validation

**As a** developer,
**I want to** ensure view configurations are validated against the schema,
**so that** invalid view definitions are rejected at configuration time.

### Acceptance Criteria

| ID     | Criterion                                                | E2E Spec                     | Status |
| ------ | -------------------------------------------------------- | ---------------------------- | ------ |
| AC-001 | View schema is valid when all properties are valid       | `APP-TABLES-VIEW-001`        | ✅     |
| AC-002 | View schema fails with pattern mismatch for name         | `APP-TABLES-VIEW-002`        | ✅     |
| AC-003 | View schema is applied automatically on table creation   | `APP-TABLES-VIEW-003`        | ✅     |
| AC-004 | View schema rejects duplicate view IDs                   | `APP-TABLES-VIEW-004`        | ✅     |
| AC-005 | User can complete full view schema workflow (regression) | `APP-TABLES-VIEW-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/table/view.ts`
- **E2E Spec**: `specs/app/tables/views/view.spec.ts`

---

## US-TABLES-VIEWS-010: View Filter Conditions

**As a** developer,
**I want to** configure individual filter conditions for views,
**so that** records are filtered based on specific field criteria.

### Acceptance Criteria

| ID     | Criterion                                                   | E2E Spec                               | Status |
| ------ | ----------------------------------------------------------- | -------------------------------------- | ------ |
| AC-001 | Condition passes only matching records (eq operator)        | `APP-TABLES-VIEW-CONDITION-001`        | ✅     |
| AC-002 | Condition passes records in value list (in operator)        | `APP-TABLES-VIEW-CONDITION-002`        | ✅     |
| AC-003 | Condition passes only greater than values (gt operator)     | `APP-TABLES-VIEW-CONDITION-003`        | ✅     |
| AC-004 | Condition passes only containing substring (contains op)    | `APP-TABLES-VIEW-CONDITION-004`        | ✅     |
| AC-005 | Condition passes records not equal to value (neq operator)  | `APP-TABLES-VIEW-CONDITION-005`        | ✅     |
| AC-006 | User can complete full view condition workflow (regression) | `APP-TABLES-VIEW-CONDITION-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/table/view-condition.ts`
- **E2E Spec**: `specs/app/tables/views/view-condition.spec.ts`

---

## US-TABLES-VIEWS-002: View Filters

**As a** developer,
**I want to** configure complex filter conditions for views,
**so that** users can see only relevant records based on multiple criteria.

### Configuration

```yaml
tables:
  - id: 1
    name: orders
    views:
      - id: 1
        name: Pending Orders
        filter:
          operator: and
          conditions:
            - field: status
              operator: eq
              value: pending
            - field: created_at
              operator: gte
              value: '2024-01-01'
      - id: 2
        name: Large Orders
        filter:
          operator: or
          conditions:
            - field: total
              operator: gte
              value: 1000
            - field: priority
              operator: eq
              value: high
```

### Acceptance Criteria

| ID     | Criterion                                                 | E2E Spec                             | Status |
| ------ | --------------------------------------------------------- | ------------------------------------ | ------ |
| AC-001 | Single filter condition is applied correctly              | `APP-TABLES-VIEW-FILTERS-001`        | ✅     |
| AC-002 | Multiple AND conditions are all required to match         | `APP-TABLES-VIEW-FILTERS-002`        | ✅     |
| AC-003 | Multiple OR conditions match if any condition is true     | `APP-TABLES-VIEW-FILTERS-003`        | ✅     |
| AC-004 | Nested filter groups are supported (AND within OR)        | `APP-TABLES-VIEW-FILTERS-004`        | ✅     |
| AC-005 | Filter operators: eq, neq, gt, gte, lt, lte, in, contains | `APP-TABLES-VIEW-FILTERS-005`        | ✅     |
| AC-006 | Invalid filter configuration returns validation error     | `APP-TABLES-VIEW-FILTERS-006`        | ✅     |
| AC-007 | User can complete full view filters workflow (regression) | `APP-TABLES-VIEW-FILTERS-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/table/view-filter.ts`
- **E2E Spec**: `specs/app/tables/views/view-filters.spec.ts`

---

## US-TABLES-VIEWS-003: View Sorting

**As a** developer,
**I want to** configure sort order for views,
**so that** users see records in a meaningful order.

### Configuration

```yaml
tables:
  - id: 1
    name: products
    views:
      - id: 1
        name: By Price (Low to High)
        sort:
          - field: price
            direction: asc
      - id: 2
        name: Newest First
        sort:
          - field: created_at
            direction: desc
          - field: name
            direction: asc # Secondary sort
```

### Acceptance Criteria

| ID     | Criterion                                                | E2E Spec                           | Status |
| ------ | -------------------------------------------------------- | ---------------------------------- | ------ |
| AC-001 | Single sort field orders records correctly               | `APP-TABLES-VIEW-SORTS-001`        | ✅     |
| AC-002 | Multiple sort fields apply in order (primary, secondary) | `APP-TABLES-VIEW-SORTS-002`        | ✅     |
| AC-003 | Ascending and descending directions work correctly       | `APP-TABLES-VIEW-SORTS-003`        | ✅     |
| AC-004 | Invalid sort field returns validation error              | `APP-TABLES-VIEW-SORTS-004`        | ✅     |
| AC-005 | User can complete full view sorts workflow (regression)  | `APP-TABLES-VIEW-SORTS-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/table/view-sort.ts`
- **E2E Spec**: `specs/app/tables/views/view-sorts.spec.ts`

---

## US-TABLES-VIEWS-004: View Field Configuration

**As a** developer,
**I want to** configure which fields are visible and their order in views,
**so that** users can focus on relevant columns.

### Configuration

```yaml
tables:
  - id: 1
    name: employees
    fields:
      - id: 1
        name: name
        type: single-line-text
      - id: 2
        name: department
        type: single-select
      - id: 3
        name: salary
        type: currency
      - id: 4
        name: hire_date
        type: date
    views:
      - id: 1
        name: Public Directory
        fields:
          visible: [name, department] # Only show name and department
          order: [name, department]
      - id: 2
        name: HR View
        fields:
          visible: [name, department, salary, hire_date]
          order: [name, salary, department, hire_date]
```

### Acceptance Criteria

| ID     | Criterion                                                | E2E Spec                            | Status |
| ------ | -------------------------------------------------------- | ----------------------------------- | ------ |
| AC-001 | Only visible fields are returned in API response         | `APP-TABLES-VIEW-FIELDS-001`        | ✅     |
| AC-002 | Fields are returned in specified order                   | `APP-TABLES-VIEW-FIELDS-002`        | ✅     |
| AC-003 | Default view includes all fields in schema order         | `APP-TABLES-VIEW-FIELDS-003`        | ✅     |
| AC-004 | Invalid field names in visibility config return error    | `APP-TABLES-VIEW-FIELDS-004`        | ✅     |
| AC-005 | User can complete full view fields workflow (regression) | `APP-TABLES-VIEW-FIELDS-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/table/view-fields.ts`
- **E2E Spec**: `specs/app/tables/views/view-fields.spec.ts`

---

## US-TABLES-VIEWS-005: View Grouping

**As a** developer,
**I want to** configure grouping for views,
**so that** users can see records organized by categories.

### Configuration

```yaml
tables:
  - id: 1
    name: tasks
    views:
      - id: 1
        name: By Status
        groupBy:
          field: status
          order: [todo, in_progress, done] # Custom group order
          hideEmpty: true
      - id: 2
        name: By Assignee
        groupBy:
          field: assignee_id
          sort: asc # Alphabetical by group value
```

### Acceptance Criteria

| ID     | Criterion                                                 | E2E Spec                              | Status |
| ------ | --------------------------------------------------------- | ------------------------------------- | ------ |
| AC-001 | Records are grouped by specified field                    | `APP-TABLES-VIEW-GROUP-BY-001`        | ✅     |
| AC-002 | Custom group order is respected                           | `APP-TABLES-VIEW-GROUP-BY-002`        | ✅     |
| AC-003 | Empty groups are hidden when hideEmpty is true            | `APP-TABLES-VIEW-GROUP-BY-003`        | ✅     |
| AC-004 | Group sorting (asc/desc) works for auto-ordered groups    | `APP-TABLES-VIEW-GROUP-BY-004`        | ✅     |
| AC-005 | User can complete full view groupBy workflow (regression) | `APP-TABLES-VIEW-GROUP-BY-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/table/view-group-by.ts`
- **E2E Spec**: `specs/app/tables/views/view-group-by.spec.ts`

---

## US-TABLES-VIEWS-006: List Views via API

**As a** developer,
**I want to** retrieve a list of available views for a table via API,
**so that** my application can display view options to users.

### API Request

```
GET /api/tables/1/views
```

### Acceptance Criteria

| ID     | Criterion                                             | E2E Spec                           | Status |
| ------ | ----------------------------------------------------- | ---------------------------------- | ------ |
| AC-001 | Returns 200 OK with array of views                    | `API-TABLES-VIEWS-LIST-001`        | ✅     |
| AC-002 | Returns 200 OK with empty array when no views         | `API-TABLES-VIEWS-LIST-002`        | ✅     |
| AC-003 | Returns 404 Not Found for non-existent table          | `API-TABLES-VIEWS-LIST-003`        | ✅     |
| AC-004 | Returns 401 when not authenticated                    | `API-TABLES-VIEWS-LIST-004`        | ✅     |
| AC-005 | Each view includes id, name, and isDefault properties | `API-TABLES-VIEWS-LIST-005`        | ✅     |
| AC-006 | User can list views with all features (regression)    | `API-TABLES-VIEWS-LIST-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/presentation/api/routes/views.ts`
- **E2E Spec**: `specs/api/tables/{tableId}/views/get.spec.ts`

---

## US-TABLES-VIEWS-007: Get View Details via API

**As a** developer,
**I want to** retrieve the full configuration of a specific view via API,
**so that** my application can apply view settings.

### API Request

```
GET /api/tables/1/views/2
```

### Acceptance Criteria

| ID     | Criterion                                                | E2E Spec                          | Status |
| ------ | -------------------------------------------------------- | --------------------------------- | ------ |
| AC-001 | Returns 200 OK with full view configuration              | `API-TABLES-VIEWS-GET-001`        | ✅     |
| AC-002 | Returns 404 Not Found for non-existent view              | `API-TABLES-VIEWS-GET-002`        | ✅     |
| AC-003 | Returns 404 Not Found for non-existent table             | `API-TABLES-VIEWS-GET-003`        | ✅     |
| AC-004 | Returns 401 when not authenticated                       | `API-TABLES-VIEWS-GET-004`        | ✅     |
| AC-005 | Response includes filter configuration                   | `API-TABLES-VIEWS-GET-005`        | ✅     |
| AC-006 | Response includes sort configuration                     | `API-TABLES-VIEWS-GET-006`        | ✅     |
| AC-007 | Response includes fields visibility configuration        | `API-TABLES-VIEWS-GET-007`        | ✅     |
| AC-008 | Response includes groupBy configuration                  | `API-TABLES-VIEWS-GET-008`        | ✅     |
| AC-009 | User can get view details with all features (regression) | `API-TABLES-VIEWS-GET-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/presentation/api/routes/views.ts`
- **E2E Spec**: `specs/api/tables/{tableId}/views/{viewId}/get.spec.ts`

---

## US-TABLES-VIEWS-008: Get Records via View API

**As a** developer,
**I want to** retrieve records through a view endpoint,
**so that** I can apply view filters and sorts without manually constructing query parameters.

### API Request

```
GET /api/tables/1/views/2/records
GET /api/tables/1/views/2/records?limit=20&offset=0
```

### Acceptance Criteria

| ID     | Criterion                                               | E2E Spec                             | Status |
| ------ | ------------------------------------------------------- | ------------------------------------ | ------ |
| AC-001 | Returns records with view filter applied                | `API-TABLES-VIEW-RECORDS-001`        | ✅     |
| AC-002 | Returns records with view sort applied                  | `API-TABLES-VIEW-RECORDS-002`        | ✅     |
| AC-003 | Returns only fields specified in view visibility config | `API-TABLES-VIEW-RECORDS-003`        | ✅     |
| AC-004 | Combines view config with additional query parameters   | `API-TABLES-VIEW-RECORDS-004`        | ✅     |
| AC-005 | Returns 403 when user lacks permission to access view   | `API-TABLES-VIEW-RECORDS-005`        | ✅     |
| AC-006 | Returns 404 Not Found for non-existent view             | `API-TABLES-VIEW-RECORDS-006`        | ✅     |
| AC-007 | Returns 404 Not Found for non-existent table            | `API-TABLES-VIEW-RECORDS-007`        | ✅     |
| AC-008 | User retrieves records via view (regression)            | `API-TABLES-VIEW-RECORDS-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/presentation/api/routes/views.ts`
- **E2E Spec**: `specs/api/tables/{tableId}/views/{viewId}/records/get.spec.ts`

---

## Regression Tests

| Spec ID                                | Workflow                                          | Status |
| -------------------------------------- | ------------------------------------------------- | ------ |
| `APP-TABLES-VIEW-REGRESSION`           | Developer validates view schema configuration     | ✅     |
| `APP-TABLES-VIEW-CONDITION-REGRESSION` | Developer configures view filter conditions       | ✅     |
| `APP-TABLES-VIEW-FILTERS-REGRESSION`   | Developer configures complex view filters         | ✅     |
| `APP-TABLES-VIEW-SORTS-REGRESSION`     | Developer configures view sorting                 | ✅     |
| `APP-TABLES-VIEW-FIELDS-REGRESSION`    | Developer configures view field visibility        | ✅     |
| `APP-TABLES-VIEW-GROUP-BY-REGRESSION`  | Developer configures view grouping                | ✅     |
| `APP-TABLES-VIEWS-REGRESSION`          | Developer configures views with filters and sorts | ✅     |
| `API-TABLES-VIEWS-LIST-REGRESSION`     | User lists views with all features                | ✅     |
| `API-TABLES-VIEWS-GET-REGRESSION`      | User retrieves view details with all features     | ✅     |
| `API-TABLES-VIEW-RECORDS-REGRESSION`   | User retrieves records via view endpoint          | ✅     |

---

## Coverage Summary

| User Story          | Title                    | Spec Count             | Status   |
| ------------------- | ------------------------ | ---------------------- | -------- |
| US-TABLES-VIEWS-001 | Define Table Views       | 9                      | Complete |
| US-TABLES-VIEWS-009 | View Schema Validation   | 5                      | Complete |
| US-TABLES-VIEWS-010 | View Filter Conditions   | 6                      | Complete |
| US-TABLES-VIEWS-002 | View Filters             | 7                      | Complete |
| US-TABLES-VIEWS-003 | View Sorting             | 5                      | Complete |
| US-TABLES-VIEWS-004 | View Field Configuration | 5                      | Complete |
| US-TABLES-VIEWS-005 | View Grouping            | 5                      | Complete |
| US-TABLES-VIEWS-006 | List Views via API       | 6                      | Complete |
| US-TABLES-VIEWS-007 | Get View Details via API | 9                      | Complete |
| US-TABLES-VIEWS-008 | Get Records via View API | 8                      | Complete |
| **Total**           |                          | **65 + 10 regression** |          |
