# Record Formatting

> **Feature Area**: Records API - Display Formatting
> **Schema**: `src/domain/models/app/table/`
> **API Routes**: `GET /api/tables/:tableId/records`
> **E2E Specs**: `specs/api/tables/{tableId}/records/format.spec.ts`

---

## Overview

Sovrium provides flexible record formatting options for API responses. Records can be formatted based on field display settings, locale preferences, timezone configurations, and custom format strings. Formatting is applied at the API level to ensure consistent data presentation across clients.

---

## US-RECORDS-FORMAT-001: Currency Formatting

**As a** developer,
**I want to** format currency fields with proper symbols and decimal places,
**so that** monetary values are displayed correctly for users.

### Configuration

> **Note**: Currency formatting is determined by the field type configuration. The `currency` field type handles display formatting (symbol, decimal places, locale) at the API level based on field properties.

```yaml
tables:
  - id: 1
    name: products
    fields:
      - id: 1
        name: price
        type: currency
```

### Acceptance Criteria

| ID     | Criterion                                             | E2E Spec                        | Status |
| ------ | ----------------------------------------------------- | ------------------------------- | ------ |
| AC-001 | Formats currency with USD symbol                      | `API-TABLES-RECORDS-FORMAT-001` | ✅     |
| AC-002 | Formats currency with EUR symbol                      | `API-TABLES-RECORDS-FORMAT-002` | ✅     |
| AC-003 | Formats currency with custom decimal places           | `API-TABLES-RECORDS-FORMAT-003` | ✅     |
| AC-004 | Formats negative currency values                      | `API-TABLES-RECORDS-FORMAT-004` | ✅     |
| AC-005 | Formats currency with thousand separators (US locale) | `API-TABLES-RECORDS-FORMAT-005` | ✅     |
| AC-006 | Formats currency with thousand separators (EU locale) | `API-TABLES-RECORDS-FORMAT-006` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/format.spec.ts`

---

## US-RECORDS-FORMAT-002: Date and Time Formatting

**As a** developer,
**I want to** format date and time fields according to locale preferences,
**so that** temporal values are displayed in user-friendly formats.

### Configuration

> **Note**: Date and time formatting is determined by the `datetime` field type. Format and timezone handling are applied at the API level based on request locale and timezone parameters.

```yaml
tables:
  - id: 1
    name: events
    fields:
      - id: 1
        name: start_date
        type: datetime
```

### Acceptance Criteria

| ID     | Criterion                               | E2E Spec                        | Status |
| ------ | --------------------------------------- | ------------------------------- | ------ |
| AC-001 | Formats date in ISO format              | `API-TABLES-RECORDS-FORMAT-007` | ✅     |
| AC-002 | Formats date in US locale (MM/DD/YYYY)  | `API-TABLES-RECORDS-FORMAT-008` | ✅     |
| AC-003 | Formats date in EU locale (DD/MM/YYYY)  | `API-TABLES-RECORDS-FORMAT-009` | ✅     |
| AC-004 | Includes timezone offset in response    | `API-TABLES-RECORDS-FORMAT-010` | ✅     |
| AC-005 | Converts datetime to specified timezone | `API-TABLES-RECORDS-FORMAT-011` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/format.spec.ts`

---

## US-RECORDS-FORMAT-003: Duration Formatting

**As a** developer,
**I want to** format duration fields in human-readable formats,
**so that** time periods are easy to understand.

### Configuration

> **Note**: Duration formatting is determined by the `duration` field type. Display format (hours, minutes, days, human-readable) is applied at the API level based on request parameters.

```yaml
tables:
  - id: 1
    name: tasks
    fields:
      - id: 1
        name: time_spent
        type: duration
```

### Acceptance Criteria

| ID     | Criterion                                             | E2E Spec                        | Status |
| ------ | ----------------------------------------------------- | ------------------------------- | ------ |
| AC-001 | Displays time value in specified display format       | `API-TABLES-RECORDS-FORMAT-012` | ✅     |
| AC-002 | Displays time value in human-readable format (2h 30m) | `API-TABLES-RECORDS-FORMAT-013` | ✅     |
| AC-003 | Displays duration in days format                      | `API-TABLES-RECORDS-FORMAT-014` | ✅     |
| AC-004 | Uses localized duration labels                        | `API-TABLES-RECORDS-FORMAT-015` | ✅     |
| AC-005 | Formats duration with hours and minutes               | `API-TABLES-RECORDS-FORMAT-016` | ✅     |
| AC-006 | Formats duration with days and hours                  | `API-TABLES-RECORDS-FORMAT-017` | ✅     |
| AC-007 | Formats duration in compact notation                  | `API-TABLES-RECORDS-FORMAT-018` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/format.spec.ts`

---

## US-RECORDS-FORMAT-004: Attachment Formatting

**As a** developer,
**I want to** format attachment fields with metadata and URLs,
**so that** file information is properly structured in API responses.

### Acceptance Criteria

| ID     | Criterion                                   | E2E Spec                        | Status |
| ------ | ------------------------------------------- | ------------------------------- | ------ |
| AC-001 | Returns attachment with URL and metadata    | `API-TABLES-RECORDS-FORMAT-019` | ✅     |
| AC-002 | Returns attachment array for multiple files | `API-TABLES-RECORDS-FORMAT-020` | ✅     |
| AC-003 | Overrides attachment filename in response   | `API-TABLES-RECORDS-FORMAT-021` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/format.spec.ts`

---

## US-RECORDS-FORMAT-005: Data Serialization

**As a** developer,
**I want to** control how complex data types are serialized,
**so that** API responses are consistent and properly formatted.

### Acceptance Criteria

| ID     | Criterion                                               | E2E Spec                               | Status |
| ------ | ------------------------------------------------------- | -------------------------------------- | ------ |
| AC-001 | Serializes JSON fields as nested objects                | `API-TABLES-RECORDS-FORMAT-022`        | ✅     |
| AC-002 | Rejects invalid format parameter value                  | `API-TABLES-RECORDS-FORMAT-023`        | ✅     |
| AC-003 | Applies query parameter format to response              | `API-TABLES-RECORDS-FORMAT-024`        | ✅     |
| AC-004 | Record display formatting works end-to-end (regression) | `API-TABLES-RECORDS-FORMAT-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/format.spec.ts`

---

## Regression Tests

| Spec ID                                | Workflow                           | Status |
| -------------------------------------- | ---------------------------------- | ------ |
| `API-TABLES-RECORDS-FORMAT-REGRESSION` | Record display formatting workflow | `[x]`  |

---

## Coverage Summary

| User Story            | Title                 | Spec Count            | Status   |
| --------------------- | --------------------- | --------------------- | -------- |
| US-RECORDS-FORMAT-001 | Currency Formatting   | 6                     | Complete |
| US-RECORDS-FORMAT-002 | Date/Time Formatting  | 5                     | Complete |
| US-RECORDS-FORMAT-003 | Duration Formatting   | 7                     | Complete |
| US-RECORDS-FORMAT-004 | Attachment Formatting | 3                     | Complete |
| US-RECORDS-FORMAT-005 | Data Serialization    | 4                     | Complete |
| **Total**             |                       | **25 + 1 regression** |          |
