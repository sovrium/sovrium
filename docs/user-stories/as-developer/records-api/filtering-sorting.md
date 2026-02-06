# Filtering, Sorting & Pagination

> **Feature Area**: Records API - Query Features
> **Schema**: `src/domain/models/app/table/`
> **API Routes**: `GET /api/tables/:tableId/records`
> **E2E Specs**: `specs/api/tables/{tableId}/records/`

---

## Overview

Sovrium provides comprehensive query capabilities for records including filtering, sorting, pagination, field selection, grouping, and aggregations. All query features respect field-level permissions and can be combined with views.

---

## US-RECORDS-QUERY-001: Basic Pagination

**As a** developer,
**I want to** paginate records with limit and offset,
**so that** I can efficiently load large datasets in chunks.

### API Request

```
GET /api/tables/1/records?limit=10&offset=0
```

### Configuration

```yaml
tables:
  - id: 1
    name: products
    pagination:
      defaultLimit: 20
      maxLimit: 100
```

### Acceptance Criteria

| ID     | Criterion                                             | E2E Spec                      | Status |
| ------ | ----------------------------------------------------- | ----------------------------- | ------ |
| AC-001 | Returns 200 OK with paginated records array           | `API-TABLES-RECORDS-LIST-001` | ✅     |
| AC-002 | Returns 200 OK with empty array when no records exist | `API-TABLES-RECORDS-LIST-002` | ✅     |
| AC-003 | Returns 401 when not authenticated                    | `API-TABLES-RECORDS-LIST-003` | ✅     |
| AC-004 | Returns 404 Not Found for non-existent table          | `API-TABLES-RECORDS-LIST-004` | ✅     |
| AC-005 | Returns 403 when user lacks read permission           | `API-TABLES-RECORDS-LIST-005` | ✅     |
| AC-006 | Respects limit query parameter                        | `API-TABLES-RECORDS-LIST-006` | ✅     |
| AC-007 | Respects offset query parameter                       | `API-TABLES-RECORDS-LIST-007` | ✅     |
| AC-008 | Returns total count in response metadata              | `API-TABLES-RECORDS-LIST-008` | ✅     |

### Implementation References

- **Schema**: `src/presentation/api/routes/records.ts`
- **E2E Spec**: `specs/api/tables/{tableId}/records/get.spec.ts`

---

## US-RECORDS-QUERY-002: Sorting Records

**As a** developer,
**I want to** sort records by one or more fields,
**so that** I can display data in meaningful order.

### API Request

```
GET /api/tables/1/records?sort=created_at:desc
GET /api/tables/1/records?sort=priority:desc,name:asc
```

### Acceptance Criteria

| ID     | Criterion                                          | E2E Spec                      | Status |
| ------ | -------------------------------------------------- | ----------------------------- | ------ |
| AC-001 | Sorts by single field ascending                    | `API-TABLES-RECORDS-LIST-009` | ✅     |
| AC-002 | Sorts by single field descending                   | `API-TABLES-RECORDS-LIST-010` | ✅     |
| AC-003 | Supports multiple sort fields (primary, secondary) | `API-TABLES-RECORDS-LIST-011` | ✅     |
| AC-004 | Returns 400 for invalid sort field name            | `API-TABLES-RECORDS-LIST-012` | ✅     |

### Implementation References

- **Schema**: `src/presentation/api/routes/records.ts`
- **E2E Spec**: `specs/api/tables/{tableId}/records/get.spec.ts`

---

## US-RECORDS-QUERY-003: Field Selection

**As a** developer,
**I want to** select specific fields to return,
**so that** I can reduce response payload size.

### API Request

```
GET /api/tables/1/records?fields=id,name,status
```

### Acceptance Criteria

| ID     | Criterion                                        | E2E Spec                      | Status |
| ------ | ------------------------------------------------ | ----------------------------- | ------ |
| AC-001 | Returns only specified fields in response        | `API-TABLES-RECORDS-LIST-013` | ✅     |
| AC-002 | Always includes id field regardless of selection | `API-TABLES-RECORDS-LIST-014` | ✅     |
| AC-003 | Returns 400 for invalid field name               | `API-TABLES-RECORDS-LIST-015` | ✅     |
| AC-004 | Excludes fields user lacks read permission for   | `API-TABLES-RECORDS-LIST-016` | ✅     |

### Implementation References

- **Schema**: `src/presentation/api/routes/records.ts`
- **E2E Spec**: `specs/api/tables/{tableId}/records/get.spec.ts`

---

## US-RECORDS-QUERY-004: View-Based Filtering

**As a** developer,
**I want to** apply view filters to record queries,
**so that** I can reuse saved filter configurations.

### API Request

```
GET /api/tables/1/records?view=2
```

### Configuration

```yaml
tables:
  - id: 1
    name: tasks
    views:
      - id: 2
        name: Active Tasks
        filter:
          field: status
          operator: in
          value: [todo, in_progress]
        sort:
          - field: priority
            direction: desc
```

### Acceptance Criteria

| ID     | Criterion                                          | E2E Spec                      | Status |
| ------ | -------------------------------------------------- | ----------------------------- | ------ |
| AC-001 | Applies view filter to query                       | `API-TABLES-RECORDS-LIST-017` | ✅     |
| AC-002 | Applies view sort configuration                    | `API-TABLES-RECORDS-LIST-018` | ✅     |
| AC-003 | Returns 404 for non-existent view                  | `API-TABLES-RECORDS-LIST-019` | ✅     |
| AC-004 | Combines view filter with additional query filters | `API-TABLES-RECORDS-LIST-020` | ✅     |

### Implementation References

- **Schema**: `src/presentation/api/routes/records.ts`
- **E2E Spec**: `specs/api/tables/{tableId}/records/get.spec.ts`

---

## US-RECORDS-QUERY-005: Grouping Records

**As a** developer,
**I want to** group records by a field,
**so that** I can organize data by categories.

### API Request

```
GET /api/tables/1/records?groupBy=status
```

### Acceptance Criteria

| ID     | Criterion                                  | E2E Spec                      | Status |
| ------ | ------------------------------------------ | ----------------------------- | ------ |
| AC-001 | Returns records grouped by specified field | `API-TABLES-RECORDS-LIST-021` | ✅     |
| AC-002 | Includes group metadata (name, count)      | `API-TABLES-RECORDS-LIST-022` | ✅     |
| AC-003 | Returns 400 for invalid groupBy field      | `API-TABLES-RECORDS-LIST-023` | ✅     |

### Implementation References

- **Schema**: `src/presentation/api/routes/records.ts`
- **E2E Spec**: `specs/api/tables/{tableId}/records/get.spec.ts`

---

## US-RECORDS-QUERY-006: Aggregations

**As a** developer,
**I want to** perform aggregations on records,
**so that** I can calculate summaries like totals and averages.

### API Request

```
GET /api/tables/1/records?aggregate=sum:amount,count:id,avg:quantity
```

### Acceptance Criteria

| ID     | Criterion                                               | E2E Spec                      | Status |
| ------ | ------------------------------------------------------- | ----------------------------- | ------ |
| AC-001 | Returns aggregation results (sum, count, avg, min, max) | `API-TABLES-RECORDS-LIST-024` | ✅     |
| AC-002 | Combines aggregations with groupBy                      | `API-TABLES-RECORDS-LIST-025` | ✅     |

### Implementation References

- **Schema**: `src/presentation/api/routes/records.ts`
- **E2E Spec**: `specs/api/tables/{tableId}/records/get.spec.ts`

---

## Query Parameter Reference

| Parameter   | Description                    | Example                          |
| ----------- | ------------------------------ | -------------------------------- |
| `limit`     | Maximum records to return      | `?limit=20`                      |
| `offset`    | Number of records to skip      | `?offset=40`                     |
| `sort`      | Sort field(s) and direction    | `?sort=name:asc,created_at:desc` |
| `fields`    | Fields to include in response  | `?fields=id,name,status`         |
| `view`      | Apply saved view configuration | `?view=2`                        |
| `groupBy`   | Group records by field         | `?groupBy=status`                |
| `aggregate` | Aggregation functions          | `?aggregate=sum:amount`          |
| `filter`    | Filter conditions (JSON)       | `?filter={"status":"active"}`    |

---

## Regression Tests

| Spec ID                              | Workflow                                      | Status |
| ------------------------------------ | --------------------------------------------- | ------ |
| `API-TABLES-RECORDS-LIST-REGRESSION` | User queries records with filters and sorting | `[x]`  |

---

## Coverage Summary

| User Story           | Title                | Spec Count            | Status   |
| -------------------- | -------------------- | --------------------- | -------- |
| US-RECORDS-QUERY-001 | Basic Pagination     | 8                     | Complete |
| US-RECORDS-QUERY-002 | Sorting Records      | 4                     | Complete |
| US-RECORDS-QUERY-003 | Field Selection      | 4                     | Complete |
| US-RECORDS-QUERY-004 | View-Based Filtering | 4                     | Complete |
| US-RECORDS-QUERY-005 | Grouping Records     | 3                     | Complete |
| US-RECORDS-QUERY-006 | Aggregations         | 2                     | Complete |
| **Total**            |                      | **25 + 1 regression** |          |
