# Tables > Data Manager > As App Administrator

> **Domain**: tables
> **Feature Area**: data-manager
> **Role**: App Administrator
> **Schema Path**: `src/domain/models/app/tables/`
> **Spec Path**: `specs/api/tables/`

---

## User Stories

### US-TABLE-DATA-001: Browse Table Data with Pagination

**Story**: As an app administrator, I want to browse table data with pagination so that I can view large datasets.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                             | Spec Test            | Schema   | Status |
| ------ | ------------------------------------- | -------------------- | -------- | ------ |
| AC-001 | Returns paginated list of records     | `API-TABLE-LIST-001` | `tables` | `[x]`  |
| AC-002 | Supports limit and offset parameters  | `API-TABLE-LIST-002` | `tables` | `[x]`  |
| AC-003 | Returns total count for pagination UI | `API-TABLE-LIST-003` | `tables` | `[x]`  |
| AC-004 | Returns 401 without authentication    | `API-TABLE-LIST-004` | `tables` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/tables/` `[x] Exists`
- **E2E Spec**: `specs/api/tables/records/list/get.spec.ts` `[x] Exists`
- **API Route**: `/api/tables/:slug/records` `[x] Implemented`

---

### US-TABLE-DATA-002: Filter Records by Field Values

**Story**: As an app administrator, I want to filter records by field values so that I can find specific data.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                             | Spec Test              | Schema   | Status |
| ------ | ------------------------------------- | ---------------------- | -------- | ------ |
| AC-001 | Supports filtering by any field       | `API-TABLE-FILTER-001` | `tables` | `[x]`  |
| AC-002 | Supports multiple conditions with AND | `API-TABLE-FILTER-002` | `tables` | `[x]`  |
| AC-003 | Supports multiple conditions with OR  | `API-TABLE-FILTER-003` | `tables` | `[x]`  |
| AC-004 | Returns 401 without authentication    | `API-TABLE-FILTER-004` | `tables` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/tables/` `[x] Exists`
- **E2E Spec**: `specs/api/tables/records/filter/get.spec.ts` `[x] Exists`
- **API Route**: `/api/tables/:slug/records?filter=...` `[x] Implemented`

---

### US-TABLE-DATA-003: Sort Records by Any Column

**Story**: As an app administrator, I want to sort records by any column so that I can organize data views.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                               | Spec Test            | Schema   | Status |
| ------ | --------------------------------------- | -------------------- | -------- | ------ |
| AC-001 | Supports sorting by any field           | `API-TABLE-SORT-001` | `tables` | `[x]`  |
| AC-002 | Supports ascending and descending order | `API-TABLE-SORT-002` | `tables` | `[x]`  |
| AC-003 | Supports multi-column sorting           | `API-TABLE-SORT-003` | `tables` | `[x]`  |
| AC-004 | Returns 401 without authentication      | `API-TABLE-SORT-004` | `tables` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/tables/` `[x] Exists`
- **E2E Spec**: `specs/api/tables/records/sort/get.spec.ts` `[x] Exists`
- **API Route**: `/api/tables/:slug/records?sort=...` `[x] Implemented`

---

### US-TABLE-DATA-004: Full-Text Search Across Records

**Story**: As an app administrator, I want full-text search across records so that I can quickly find information.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                           | Spec Test              | Schema   | Status |
| ------ | ----------------------------------- | ---------------------- | -------- | ------ |
| AC-001 | Searches across all text fields     | `API-TABLE-SEARCH-001` | `tables` | `[ ]`  |
| AC-002 | Search indexes relevant text fields | `API-TABLE-SEARCH-002` | `tables` | `[ ]`  |
| AC-003 | Returns ranked results by relevance | `API-TABLE-SEARCH-003` | `tables` | `[ ]`  |
| AC-004 | Returns 401 without authentication  | `API-TABLE-SEARCH-004` | `tables` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/tables/` `[x] Exists`
- **E2E Spec**: `specs/api/tables/records/search/get.spec.ts` `[ ] Needs Creation`
- **API Route**: `/api/tables/:slug/records/search` `[ ] Not Implemented`

---

### US-TABLE-DATA-005: Create New Records with Form

**Story**: As an app administrator, I want to create new records with a form so that I can add data manually.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                          | Spec Test              | Schema   | Status |
| ------ | ---------------------------------- | ---------------------- | -------- | ------ |
| AC-001 | Creates record with valid data     | `API-TABLE-CREATE-001` | `tables` | `[x]`  |
| AC-002 | Validates all field rules          | `API-TABLE-CREATE-002` | `tables` | `[x]`  |
| AC-003 | Returns created record with ID     | `API-TABLE-CREATE-003` | `tables` | `[x]`  |
| AC-004 | Returns 401 without authentication | `API-TABLE-CREATE-004` | `tables` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/tables/` `[x] Exists`
- **E2E Spec**: `specs/api/tables/records/create/post.spec.ts` `[x] Exists`
- **API Route**: `/api/tables/:slug/records` POST `[x] Implemented`

---

### US-TABLE-DATA-006: Edit Existing Records

**Story**: As an app administrator, I want to edit existing records so that I can correct or update data.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                           | Spec Test              | Schema   | Status |
| ------ | ----------------------------------- | ---------------------- | -------- | ------ |
| AC-001 | Updates record with valid data      | `API-TABLE-UPDATE-001` | `tables` | `[x]`  |
| AC-002 | Validates all field rules           | `API-TABLE-UPDATE-002` | `tables` | `[x]`  |
| AC-003 | Returns updated record              | `API-TABLE-UPDATE-003` | `tables` | `[x]`  |
| AC-004 | Returns 404 for non-existent record | `API-TABLE-UPDATE-004` | `tables` | `[x]`  |
| AC-005 | Returns 401 without authentication  | `API-TABLE-UPDATE-005` | `tables` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/tables/` `[x] Exists`
- **E2E Spec**: `specs/api/tables/records/update/patch.spec.ts` `[x] Exists`
- **API Route**: `/api/tables/:slug/records/:id` PATCH `[x] Implemented`

---

### US-TABLE-DATA-007: Delete Records

**Story**: As an app administrator, I want to delete records so that I can remove unwanted data.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                              | Spec Test              | Schema   | Status |
| ------ | -------------------------------------- | ---------------------- | -------- | ------ |
| AC-001 | Deletes record successfully            | `API-TABLE-DELETE-001` | `tables` | `[x]`  |
| AC-002 | Returns 404 for non-existent record    | `API-TABLE-DELETE-002` | `tables` | `[x]`  |
| AC-003 | Handles cascading delete for relations | `API-TABLE-DELETE-003` | `tables` | `[x]`  |
| AC-004 | Returns 401 without authentication     | `API-TABLE-DELETE-004` | `tables` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/tables/` `[x] Exists`
- **E2E Spec**: `specs/api/tables/records/delete/delete.spec.ts` `[x] Exists`
- **API Route**: `/api/tables/:slug/records/:id` DELETE `[x] Implemented`

---

### US-TABLE-DATA-008: Real-Time Validation When Editing

**Story**: As an app administrator, I want real-time validation when editing so that I don't save invalid data.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                              | Spec Test                | Schema   | Status |
| ------ | -------------------------------------- | ------------------------ | -------- | ------ |
| AC-001 | Validates fields as user types         | `API-TABLE-VALIDATE-001` | `tables` | `[x]`  |
| AC-002 | Shows clear, actionable error messages | `API-TABLE-VALIDATE-002` | `tables` | `[x]`  |
| AC-003 | Prevents save with invalid data        | `API-TABLE-VALIDATE-003` | `tables` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/tables/validation.ts` `[x] Exists`
- **E2E Spec**: Validation tested via create/update specs
- **Implementation**: Effect Schema validation with detailed error messages

---

## Coverage Summary

| Story ID          | Title                  | Status            | Criteria Met |
| ----------------- | ---------------------- | ----------------- | ------------ |
| US-TABLE-DATA-001 | Browse with Pagination | `[x]` Complete    | 4/4          |
| US-TABLE-DATA-002 | Filter Records         | `[x]` Complete    | 4/4          |
| US-TABLE-DATA-003 | Sort Records           | `[x]` Complete    | 4/4          |
| US-TABLE-DATA-004 | Full-Text Search       | `[ ]` Not Started | 0/4          |
| US-TABLE-DATA-005 | Create New Records     | `[x]` Complete    | 4/4          |
| US-TABLE-DATA-006 | Edit Existing Records  | `[x]` Complete    | 5/5          |
| US-TABLE-DATA-007 | Delete Records         | `[x]` Complete    | 4/4          |
| US-TABLE-DATA-008 | Real-Time Validation   | `[x]` Complete    | 3/3          |

**Total**: 7 complete, 0 partial, 1 not started (88% complete)

---

> **Navigation**: [← Back to Tables Domain](../README.md)
