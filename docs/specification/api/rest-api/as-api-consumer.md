# API > REST API > As API Consumer

> **Domain**: api
> **Feature Area**: rest-api
> **Role**: API Consumer
> **Schema Path**: `src/domain/models/api/rest/`
> **Spec Path**: `specs/api/rest/`

---

## User Stories

### US-API-REST-CONSUMER-001: List Records with Pagination

**Story**: As an API consumer, I want to list records with pagination so that I can handle large datasets.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                                 | Spec Test               | Schema     | Status |
| ------ | ----------------------------------------- | ----------------------- | ---------- | ------ |
| AC-001 | GET returns paginated results             | `APP-API-REST-PAGE-001` | `api.rest` | `[x]`  |
| AC-002 | `limit` and `offset` parameters supported | `APP-API-REST-PAGE-002` | `api.rest` | `[x]`  |
| AC-003 | Response includes total count             | `APP-API-REST-PAGE-003` | `api.rest` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/api/rest/index.ts` `[x] Exists`
- **E2E Spec**: Pagination tested via large dataset queries
- **Implementation**: SQL LIMIT/OFFSET with count queries

---

### US-API-REST-CONSUMER-002: Filter Records by Field Values

**Story**: As an API consumer, I want to filter records by field values so that I can query specific data.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                                     | Spec Test                 | Schema     | Status |
| ------ | --------------------------------------------- | ------------------------- | ---------- | ------ |
| AC-001 | Query parameters filter by field              | `APP-API-REST-FILTER-001` | `api.rest` | `[x]`  |
| AC-002 | Multiple filters combined with AND            | `APP-API-REST-FILTER-002` | `api.rest` | `[x]`  |
| AC-003 | Filter operators supported (eq, gt, lt, etc.) | `APP-API-REST-FILTER-003` | `api.rest` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/api/rest/index.ts` `[x] Exists`
- **E2E Spec**: Filtering tested via query parameters
- **Implementation**: Dynamic WHERE clause construction

---

### US-API-REST-CONSUMER-003: Sort Records by Any Field

**Story**: As an API consumer, I want to sort records by any field so that I can order results.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                             | Spec Test               | Schema     | Status |
| ------ | ------------------------------------- | ----------------------- | ---------- | ------ |
| AC-001 | `sort` parameter specifies sort field | `APP-API-REST-SORT-001` | `api.rest` | `[x]`  |
| AC-002 | Ascending and descending supported    | `APP-API-REST-SORT-002` | `api.rest` | `[x]`  |
| AC-003 | Multiple sort fields supported        | `APP-API-REST-SORT-003` | `api.rest` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/api/rest/index.ts` `[x] Exists`
- **E2E Spec**: Sorting tested via order parameter
- **Implementation**: Dynamic ORDER BY clause

---

### US-API-REST-CONSUMER-004: Get Single Record by ID

**Story**: As an API consumer, I want to get a single record by ID so that I can fetch specific items.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                       | Spec Test                 | Schema     | Status |
| ------ | ------------------------------- | ------------------------- | ---------- | ------ |
| AC-001 | GET /:id returns single record  | `APP-API-REST-SINGLE-001` | `api.rest` | `[x]`  |
| AC-002 | Returns 404 if not found        | `APP-API-REST-SINGLE-002` | `api.rest` | `[x]`  |
| AC-003 | Includes all fields in response | `APP-API-REST-SINGLE-003` | `api.rest` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/api/rest/index.ts` `[x] Exists`
- **E2E Spec**: Single record retrieval tested via ID
- **Implementation**: Drizzle findUnique query

---

### US-API-REST-CONSUMER-005: Create Records

**Story**: As an API consumer, I want to create records by POSTing JSON so that I can add data.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                      | Spec Test                 | Schema     | Status |
| ------ | ------------------------------ | ------------------------- | ---------- | ------ |
| AC-001 | POST creates new record        | `APP-API-REST-CREATE-001` | `api.rest` | `[x]`  |
| AC-002 | Returns created record with ID | `APP-API-REST-CREATE-002` | `api.rest` | `[x]`  |
| AC-003 | Returns 201 status on success  | `APP-API-REST-CREATE-003` | `api.rest` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/api/rest/index.ts` `[x] Exists`
- **E2E Spec**: Record creation tested via POST
- **Implementation**: Drizzle insert with returning

---

### US-API-REST-CONSUMER-006: Update Records

**Story**: As an API consumer, I want to update records by PUT/PATCH so that I can modify data.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                       | Spec Test                 | Schema     | Status |
| ------ | ------------------------------- | ------------------------- | ---------- | ------ |
| AC-001 | PUT replaces entire record      | `APP-API-REST-UPDATE-001` | `api.rest` | `[x]`  |
| AC-002 | PATCH updates partial fields    | `APP-API-REST-UPDATE-002` | `api.rest` | `[x]`  |
| AC-003 | Returns 404 if record not found | `APP-API-REST-UPDATE-003` | `api.rest` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/api/rest/index.ts` `[x] Exists`
- **E2E Spec**: Record updates tested via PUT/PATCH
- **Implementation**: Drizzle update with returning

---

### US-API-REST-CONSUMER-007: Delete Records

**Story**: As an API consumer, I want to delete records so that I can remove data.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                       | Spec Test                 | Schema     | Status |
| ------ | ------------------------------- | ------------------------- | ---------- | ------ |
| AC-001 | DELETE removes record           | `APP-API-REST-DELETE-001` | `api.rest` | `[x]`  |
| AC-002 | Returns 204 on success          | `APP-API-REST-DELETE-002` | `api.rest` | `[x]`  |
| AC-003 | Returns 404 if record not found | `APP-API-REST-DELETE-003` | `api.rest` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/api/rest/index.ts` `[x] Exists`
- **E2E Spec**: Record deletion tested via DELETE
- **Implementation**: Drizzle delete with soft-delete support

---

## Coverage Summary

| Story ID                 | Title                | Status         | Criteria Met |
| ------------------------ | -------------------- | -------------- | ------------ |
| US-API-REST-CONSUMER-001 | List with Pagination | `[x]` Complete | 3/3          |
| US-API-REST-CONSUMER-002 | Filter Records       | `[x]` Complete | 3/3          |
| US-API-REST-CONSUMER-003 | Sort Records         | `[x]` Complete | 3/3          |
| US-API-REST-CONSUMER-004 | Get Single Record    | `[x]` Complete | 3/3          |
| US-API-REST-CONSUMER-005 | Create Records       | `[x]` Complete | 3/3          |
| US-API-REST-CONSUMER-006 | Update Records       | `[x]` Complete | 3/3          |
| US-API-REST-CONSUMER-007 | Delete Records       | `[x]` Complete | 3/3          |

**Total**: 7 complete, 0 partial, 0 not started (100% complete)

---

> **Navigation**: [← Back to API Domain](../README.md) | [← REST API as Developer](./as-developer.md)
