# Field Types

> **Feature Area**: Tables - Field Types
> **Schema**: `src/domain/models/app/table/`
> **E2E Specs**: `specs/app/tables/field-types/`

---

## Overview

Sovrium supports 45+ field types for building data-rich applications. Each field type maps to appropriate PostgreSQL column types with validation, constraints, and indexing support.

---

## US-FIELDS-TEXT-001: Single-Line Text Fields

**As a** developer,
**I want to** define single-line text fields for short text data,
**so that** I can store names, titles, and short descriptions.

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
        maxLength: 255
      - id: 2
        name: sku
        type: single-line-text
        unique: true
        indexed: true
```

### Acceptance Criteria

| ID     | Criterion                                                     | E2E Spec                                       | Status |
| ------ | ------------------------------------------------------------- | ---------------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL VARCHAR(255) column                        | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-001`        | ✅     |
| AC-002 | Enforces maximum length constraint                            | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-002`        | ✅     |
| AC-003 | Stores and retrieves text correctly                           | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-003`        | ✅     |
| AC-004 | Supports NOT NULL constraint when required                    | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-004`        | ✅     |
| AC-005 | Supports UNIQUE constraint                                    | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-005`        | ✅     |
| AC-006 | Supports DEFAULT value                                        | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-006`        | ✅     |
| AC-007 | Supports btree index for performance                          | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-007`        | ✅     |
| AC-008 | Trims whitespace on input                                     | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-008`        | ✅     |
| AC-009 | Validates custom minLength constraint                         | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-009`        | ✅     |
| AC-010 | Validates custom maxLength constraint                         | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-010`        | ✅     |
| AC-011 | Supports pattern validation (regex)                           | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-011`        | ✅     |
| AC-012 | Returns validation error for invalid pattern                  | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-012`        | ✅     |
| AC-013 | Supports case-insensitive search                              | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-013`        | ✅     |
| AC-014 | Supports contains search                                      | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-014`        | ✅     |
| AC-015 | Supports starts-with search                                   | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-015`        | ✅     |
| AC-016 | Supports ends-with search                                     | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-016`        | ✅     |
| AC-017 | Handles empty string correctly                                | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-017`        | ✅     |
| AC-018 | Handles NULL correctly when optional                          | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-018`        | ✅     |
| AC-019 | Supports sorting alphabetically                               | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-019`        | ✅     |
| AC-020 | User can complete full single-line text workflow (regression) | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/single-line-text-field.spec.ts`

---

## US-FIELDS-TEXT-002: Long Text Fields

**As a** developer,
**I want to** define long text fields for unlimited text content,
**so that** I can store descriptions, notes, and multi-paragraph content.

### Configuration

```yaml
tables:
  - id: 1
    name: posts
    fields:
      - id: 1
        name: content
        type: long-text
        required: true
      - id: 2
        name: summary
        type: long-text
        indexed: true
```

### Acceptance Criteria

| ID     | Criterion                                              | E2E Spec                                | Status |
| ------ | ------------------------------------------------------ | --------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL TEXT column                         | `APP-TABLES-FIELD-LONG-TEXT-001`        | ✅     |
| AC-002 | Stores unlimited length text                           | `APP-TABLES-FIELD-LONG-TEXT-002`        | ✅     |
| AC-003 | Supports NOT NULL constraint when required             | `APP-TABLES-FIELD-LONG-TEXT-003`        | ✅     |
| AC-004 | Supports DEFAULT value                                 | `APP-TABLES-FIELD-LONG-TEXT-004`        | ✅     |
| AC-005 | Supports btree index for performance                   | `APP-TABLES-FIELD-LONG-TEXT-005`        | ✅     |
| AC-006 | User can complete full long text workflow (regression) | `APP-TABLES-FIELD-LONG-TEXT-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/long-text-field.spec.ts`

---

## US-FIELDS-TEXT-003: Rich Text Fields

**As a** developer,
**I want to** define rich text fields for formatted content,
**so that** I can store HTML or Markdown content with formatting.

### Configuration

```yaml
tables:
  - id: 1
    name: articles
    fields:
      - id: 1
        name: body
        type: rich-text
        format: html # or 'markdown'
        required: true
```

### Acceptance Criteria

| ID     | Criterion                                              | E2E Spec                                      | Status |
| ------ | ------------------------------------------------------ | --------------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL TEXT column                         | `APP-TABLES-FIELD-TYPES-RICH-TEXT-001`        | ✅     |
| AC-002 | Stores HTML/Markdown content                           | `APP-TABLES-FIELD-TYPES-RICH-TEXT-002`        | ✅     |
| AC-003 | Sanitizes HTML to prevent XSS                          | `APP-TABLES-FIELD-TYPES-RICH-TEXT-003`        | ✅     |
| AC-004 | Supports NOT NULL constraint when required             | `APP-TABLES-FIELD-TYPES-RICH-TEXT-004`        | ✅     |
| AC-005 | Supports DEFAULT value                                 | `APP-TABLES-FIELD-TYPES-RICH-TEXT-005`        | ✅     |
| AC-006 | User can complete full rich text workflow (regression) | `APP-TABLES-FIELD-TYPES-RICH-TEXT-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/rich-text-field.spec.ts`

---

## US-FIELDS-NUMBER-001: Integer Fields

**As a** developer,
**I want to** define integer fields for whole numbers,
**so that** I can store counts, quantities, and IDs.

### Configuration

```yaml
tables:
  - id: 1
    name: inventory
    fields:
      - id: 1
        name: quantity
        type: integer
        required: true
        min: 0
      - id: 2
        name: priority
        type: integer
        default: 0
        min: 1
        max: 10
```

### Acceptance Criteria

| ID     | Criterion                                            | E2E Spec                                    | Status |
| ------ | ---------------------------------------------------- | ------------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL INTEGER column                    | `APP-TABLES-FIELD-TYPES-INTEGER-001`        | ✅     |
| AC-002 | Enforces CHECK constraint for min value              | `APP-TABLES-FIELD-TYPES-INTEGER-002`        | ✅     |
| AC-003 | Enforces CHECK constraint for max value              | `APP-TABLES-FIELD-TYPES-INTEGER-003`        | ✅     |
| AC-004 | Supports NOT NULL constraint when required           | `APP-TABLES-FIELD-TYPES-INTEGER-004`        | ✅     |
| AC-005 | Supports DEFAULT value                               | `APP-TABLES-FIELD-TYPES-INTEGER-005`        | ✅     |
| AC-006 | User can complete full integer workflow (regression) | `APP-TABLES-FIELD-TYPES-INTEGER-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/integer-field.spec.ts`

---

## US-FIELDS-NUMBER-002: Decimal Fields

**As a** developer,
**I want to** define decimal fields for precise numeric values,
**so that** I can store prices, measurements, and calculations without floating-point errors.

### Configuration

```yaml
tables:
  - id: 1
    name: products
    fields:
      - id: 1
        name: price
        type: decimal
        required: true
        precision: 2
        min: 0
```

### Acceptance Criteria

| ID     | Criterion                                            | E2E Spec                                    | Status |
| ------ | ---------------------------------------------------- | ------------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL DECIMAL/NUMERIC column            | `APP-TABLES-FIELD-TYPES-DECIMAL-001`        | ✅     |
| AC-002 | Enforces CHECK constraint for min value              | `APP-TABLES-FIELD-TYPES-DECIMAL-002`        | ✅     |
| AC-003 | Enforces CHECK constraint for max value              | `APP-TABLES-FIELD-TYPES-DECIMAL-003`        | ✅     |
| AC-004 | Supports NOT NULL constraint when required           | `APP-TABLES-FIELD-TYPES-DECIMAL-004`        | ✅     |
| AC-005 | Supports UNIQUE, DEFAULT, and btree index            | `APP-TABLES-FIELD-TYPES-DECIMAL-005`        | ✅     |
| AC-006 | User can complete full decimal workflow (regression) | `APP-TABLES-FIELD-TYPES-DECIMAL-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/decimal-field.spec.ts`

---

## US-FIELDS-NUMBER-003: Percentage Fields

**As a** developer,
**I want to** define percentage fields for ratio values,
**so that** I can store completion rates, discounts, and ratios.

### Configuration

```yaml
tables:
  - id: 1
    name: tasks
    fields:
      - id: 1
        name: completion
        type: percentage
        default: 0
        min: 0
        max: 100
```

### Acceptance Criteria

| ID     | Criterion                                               | E2E Spec                                       | Status |
| ------ | ------------------------------------------------------- | ---------------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL DECIMAL column                       | `APP-TABLES-FIELD-TYPES-PERCENTAGE-001`        | ✅     |
| AC-002 | Stores value as decimal (0-1 or 0-100)                  | `APP-TABLES-FIELD-TYPES-PERCENTAGE-002`        | ✅     |
| AC-003 | Enforces CHECK constraint for range                     | `APP-TABLES-FIELD-TYPES-PERCENTAGE-003`        | ✅     |
| AC-004 | Supports NOT NULL constraint when required              | `APP-TABLES-FIELD-TYPES-PERCENTAGE-004`        | ✅     |
| AC-005 | Supports DEFAULT value                                  | `APP-TABLES-FIELD-TYPES-PERCENTAGE-005`        | ✅     |
| AC-006 | User can complete full percentage workflow (regression) | `APP-TABLES-FIELD-TYPES-PERCENTAGE-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/percentage-field.spec.ts`

---

## US-FIELDS-NUMBER-004: Currency Fields

**As a** developer,
**I want to** define currency fields for monetary values,
**so that** I can store prices with currency codes.

### Configuration

```yaml
tables:
  - id: 1
    name: transactions
    fields:
      - id: 1
        name: amount
        type: currency
        required: true
        currency: USD
        precision: 2
```

### Acceptance Criteria

| ID     | Criterion                                             | E2E Spec                                     | Status |
| ------ | ----------------------------------------------------- | -------------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL DECIMAL column                     | `APP-TABLES-FIELD-TYPES-CURRENCY-001`        | ✅     |
| AC-002 | Stores currency code alongside value                  | `APP-TABLES-FIELD-TYPES-CURRENCY-002`        | ✅     |
| AC-003 | Formats value according to currency locale            | `APP-TABLES-FIELD-TYPES-CURRENCY-003`        | ✅     |
| AC-004 | Supports NOT NULL constraint when required            | `APP-TABLES-FIELD-TYPES-CURRENCY-004`        | ✅     |
| AC-005 | Supports DEFAULT value                                | `APP-TABLES-FIELD-TYPES-CURRENCY-005`        | ✅     |
| AC-006 | User can complete full currency workflow (regression) | `APP-TABLES-FIELD-TYPES-CURRENCY-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/currency-field.spec.ts`

---

## US-FIELDS-DATETIME-001: DateTime Fields

**As a** developer,
**I want to** define datetime fields for timestamps,
**so that** I can store event times, deadlines, and appointments.

### Configuration

```yaml
tables:
  - id: 1
    name: events
    fields:
      - id: 1
        name: starts_at
        type: datetime
        required: true
        indexed: true
      - id: 2
        name: ends_at
        type: datetime
```

### Acceptance Criteria

| ID     | Criterion                                             | E2E Spec                                     | Status |
| ------ | ----------------------------------------------------- | -------------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL TIMESTAMPTZ column                 | `APP-TABLES-FIELD-TYPES-DATETIME-001`        | ✅     |
| AC-002 | Stores timezone-aware timestamps                      | `APP-TABLES-FIELD-TYPES-DATETIME-002`        | ✅     |
| AC-003 | Returns ISO 8601 format in API responses              | `APP-TABLES-FIELD-TYPES-DATETIME-003`        | ✅     |
| AC-004 | Supports NOT NULL constraint when required            | `APP-TABLES-FIELD-TYPES-DATETIME-004`        | ✅     |
| AC-005 | Supports DEFAULT value and btree index                | `APP-TABLES-FIELD-TYPES-DATETIME-005`        | ✅     |
| AC-006 | User can complete full datetime workflow (regression) | `APP-TABLES-FIELD-TYPES-DATETIME-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/datetime-field.spec.ts`

---

## US-FIELDS-DATETIME-002: Date Fields

**As a** developer,
**I want to** define date-only fields,
**so that** I can store birthdays, due dates, and calendar dates.

### Configuration

```yaml
tables:
  - id: 1
    name: employees
    fields:
      - id: 1
        name: birth_date
        type: date
      - id: 2
        name: hire_date
        type: date
        required: true
```

### Acceptance Criteria

| ID     | Criterion                                         | E2E Spec                                 | Status |
| ------ | ------------------------------------------------- | ---------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL DATE column                    | `APP-TABLES-FIELD-TYPES-DATE-001`        | ✅     |
| AC-002 | Stores date without time component                | `APP-TABLES-FIELD-TYPES-DATE-002`        | ✅     |
| AC-003 | Returns YYYY-MM-DD format in API responses        | `APP-TABLES-FIELD-TYPES-DATE-003`        | ✅     |
| AC-004 | Supports NOT NULL constraint when required        | `APP-TABLES-FIELD-TYPES-DATE-004`        | ✅     |
| AC-005 | Supports DEFAULT value and btree index            | `APP-TABLES-FIELD-TYPES-DATE-005`        | ✅     |
| AC-006 | User can complete full date workflow (regression) | `APP-TABLES-FIELD-TYPES-DATE-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/date-field.spec.ts`

---

## US-FIELDS-DATETIME-003: Time Fields

**As a** developer,
**I want to** define time-only fields,
**so that** I can store opening hours, schedules, and time slots.

### Configuration

```yaml
tables:
  - id: 1
    name: schedules
    fields:
      - id: 1
        name: start_time
        type: time
        required: true
      - id: 2
        name: end_time
        type: time
        required: true
```

### Acceptance Criteria

| ID     | Criterion                                         | E2E Spec                                 | Status |
| ------ | ------------------------------------------------- | ---------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL TIME column                    | `APP-TABLES-FIELD-TYPES-TIME-001`        | ✅     |
| AC-002 | Stores time without date component                | `APP-TABLES-FIELD-TYPES-TIME-002`        | ✅     |
| AC-003 | Returns HH:MM:SS format in API responses          | `APP-TABLES-FIELD-TYPES-TIME-003`        | ✅     |
| AC-004 | Supports NOT NULL constraint when required        | `APP-TABLES-FIELD-TYPES-TIME-004`        | ✅     |
| AC-005 | Supports DEFAULT value                            | `APP-TABLES-FIELD-TYPES-TIME-005`        | ✅     |
| AC-006 | User can complete full time workflow (regression) | `APP-TABLES-FIELD-TYPES-TIME-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/time-field.spec.ts`

---

## US-FIELDS-DATETIME-004: Duration Fields

**As a** developer,
**I want to** define duration fields for time intervals,
**so that** I can store task durations and time spans.

### Configuration

```yaml
tables:
  - id: 1
    name: tasks
    fields:
      - id: 1
        name: estimated_duration
        type: duration
        format: minutes # or 'seconds', 'hours'
```

### Acceptance Criteria

| ID     | Criterion                                             | E2E Spec                                     | Status |
| ------ | ----------------------------------------------------- | -------------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL INTERVAL column                    | `APP-TABLES-FIELD-TYPES-DURATION-001`        | ✅     |
| AC-002 | Stores duration in specified format                   | `APP-TABLES-FIELD-TYPES-DURATION-002`        | ✅     |
| AC-003 | Returns ISO 8601 duration format                      | `APP-TABLES-FIELD-TYPES-DURATION-003`        | ✅     |
| AC-004 | Supports NOT NULL constraint when required            | `APP-TABLES-FIELD-TYPES-DURATION-004`        | ✅     |
| AC-005 | Supports DEFAULT value                                | `APP-TABLES-FIELD-TYPES-DURATION-005`        | ✅     |
| AC-006 | User can complete full duration workflow (regression) | `APP-TABLES-FIELD-TYPES-DURATION-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/duration-field.spec.ts`

---

## US-FIELDS-SELECT-001: Single-Select Fields

**As a** developer,
**I want to** define single-select fields with predefined options,
**so that** users can choose one value from a list.

### Configuration

```yaml
tables:
  - id: 1
    name: tasks
    fields:
      - id: 1
        name: priority
        type: single-select
        required: true
        options:
          - low
          - medium
          - high
        default: medium
```

### Acceptance Criteria

| ID     | Criterion                                                  | E2E Spec                                          | Status |
| ------ | ---------------------------------------------------------- | ------------------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL VARCHAR column                          | `APP-TABLES-FIELD-TYPES-SINGLE-SELECT-001`        | ✅     |
| AC-002 | Enforces CHECK constraint for valid options                | `APP-TABLES-FIELD-TYPES-SINGLE-SELECT-002`        | ✅     |
| AC-003 | Returns option with label and color in API                 | `APP-TABLES-FIELD-TYPES-SINGLE-SELECT-003`        | ✅     |
| AC-004 | Supports NOT NULL constraint when required                 | `APP-TABLES-FIELD-TYPES-SINGLE-SELECT-004`        | ✅     |
| AC-005 | Supports DEFAULT value                                     | `APP-TABLES-FIELD-TYPES-SINGLE-SELECT-005`        | ✅     |
| AC-006 | Supports filtering by selected option                      | `APP-TABLES-FIELD-TYPES-SINGLE-SELECT-006`        | ✅     |
| AC-007 | Supports changing selection                                | `APP-TABLES-FIELD-TYPES-SINGLE-SELECT-007`        | ✅     |
| AC-008 | User can complete full single-select workflow (regression) | `APP-TABLES-FIELD-TYPES-SINGLE-SELECT-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/single-select-field.spec.ts`

---

## US-FIELDS-SELECT-002: Multi-Select Fields

**As a** developer,
**I want to** define multi-select fields for multiple choices,
**so that** users can select multiple values from a list.

### Configuration

```yaml
tables:
  - id: 1
    name: articles
    fields:
      - id: 1
        name: tags
        type: multi-select
        options:
          - tech
          - news
          - tutorial
```

### Acceptance Criteria

| ID     | Criterion                                                 | E2E Spec                                         | Status |
| ------ | --------------------------------------------------------- | ------------------------------------------------ | ------ |
| AC-001 | Creates PostgreSQL JSONB array column                     | `APP-TABLES-FIELD-TYPES-MULTI-SELECT-001`        | ✅     |
| AC-002 | Validates all values against options                      | `APP-TABLES-FIELD-TYPES-MULTI-SELECT-002`        | ✅     |
| AC-003 | Returns array of options in API responses                 | `APP-TABLES-FIELD-TYPES-MULTI-SELECT-003`        | ✅     |
| AC-004 | Supports filtering by any selected value                  | `APP-TABLES-FIELD-TYPES-MULTI-SELECT-004`        | ✅     |
| AC-005 | Supports DEFAULT value (array)                            | `APP-TABLES-FIELD-TYPES-MULTI-SELECT-005`        | ✅     |
| AC-006 | Supports adding new options dynamically                   | `APP-TABLES-FIELD-TYPES-MULTI-SELECT-006`        | ✅     |
| AC-007 | Supports removing options from selection                  | `APP-TABLES-FIELD-TYPES-MULTI-SELECT-007`        | ✅     |
| AC-008 | Supports clearing all selected values                     | `APP-TABLES-FIELD-TYPES-MULTI-SELECT-008`        | ✅     |
| AC-009 | User can complete full multi-select workflow (regression) | `APP-TABLES-FIELD-TYPES-MULTI-SELECT-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/multi-select-field.spec.ts`

---

## US-FIELDS-SELECT-003: Checkbox Fields

**As a** developer,
**I want to** define checkbox fields for boolean values,
**so that** I can store yes/no, active/inactive states.

### Configuration

```yaml
tables:
  - id: 1
    name: tasks
    fields:
      - id: 1
        name: is_completed
        type: checkbox
        default: false
      - id: 2
        name: is_urgent
        type: checkbox
        default: false
```

### Acceptance Criteria

| ID     | Criterion                                             | E2E Spec                                     | Status |
| ------ | ----------------------------------------------------- | -------------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL BOOLEAN column                     | `APP-TABLES-FIELD-TYPES-CHECKBOX-001`        | ✅     |
| AC-002 | Stores true/false values                              | `APP-TABLES-FIELD-TYPES-CHECKBOX-002`        | ✅     |
| AC-003 | Supports NOT NULL constraint (always required)        | `APP-TABLES-FIELD-TYPES-CHECKBOX-003`        | ✅     |
| AC-004 | Supports DEFAULT value                                | `APP-TABLES-FIELD-TYPES-CHECKBOX-004`        | ✅     |
| AC-005 | Supports filtering by boolean value                   | `APP-TABLES-FIELD-TYPES-CHECKBOX-005`        | ✅     |
| AC-006 | User can complete full checkbox workflow (regression) | `APP-TABLES-FIELD-TYPES-CHECKBOX-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/checkbox-field.spec.ts`

---

## US-FIELDS-SELECT-004: Status Fields

**As a** developer,
**I want to** define status fields for workflow states,
**so that** I can track record lifecycle stages.

### Configuration

```yaml
tables:
  - id: 1
    name: orders
    fields:
      - id: 1
        name: status
        type: status
        required: true
        options:
          - pending
          - processing
          - shipped
          - delivered
          - cancelled
        default: pending
```

### Acceptance Criteria

| ID     | Criterion                                           | E2E Spec                                   | Status |
| ------ | --------------------------------------------------- | ------------------------------------------ | ------ |
| AC-001 | Creates PostgreSQL VARCHAR column                   | `APP-TABLES-FIELD-TYPES-STATUS-001`        | ✅     |
| AC-002 | Enforces CHECK constraint for valid statuses        | `APP-TABLES-FIELD-TYPES-STATUS-002`        | ✅     |
| AC-003 | Returns status with label and color                 | `APP-TABLES-FIELD-TYPES-STATUS-003`        | ✅     |
| AC-004 | Supports status transition rules (optional)         | `APP-TABLES-FIELD-TYPES-STATUS-004`        | ✅     |
| AC-005 | Supports DEFAULT value                              | `APP-TABLES-FIELD-TYPES-STATUS-005`        | ✅     |
| AC-006 | Rejects invalid status values                       | `APP-TABLES-FIELD-TYPES-STATUS-006`        | ✅     |
| AC-007 | Rejects status not in allowed transitions           | `APP-TABLES-FIELD-TYPES-STATUS-007`        | ✅     |
| AC-008 | Rejects empty status when required                  | `APP-TABLES-FIELD-TYPES-STATUS-008`        | ✅     |
| AC-009 | User can complete full status workflow (regression) | `APP-TABLES-FIELD-TYPES-STATUS-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/status-field.spec.ts`

---

## US-FIELDS-SPECIAL-001: Email Fields

**As a** developer,
**I want to** define email fields with validation,
**so that** I can store valid email addresses.

### Configuration

```yaml
tables:
  - id: 1
    name: contacts
    fields:
      - id: 1
        name: email
        type: email
        required: true
        unique: true
        indexed: true
```

### Acceptance Criteria

| ID     | Criterion                                          | E2E Spec                            | Status |
| ------ | -------------------------------------------------- | ----------------------------------- | ------ |
| AC-001 | Creates PostgreSQL VARCHAR(255) column             | `APP-TABLES-FIELD-EMAIL-001`        | ✅     |
| AC-002 | Normalizes email to lowercase                      | `APP-TABLES-FIELD-EMAIL-002`        | ✅     |
| AC-003 | Supports UNIQUE constraint                         | `APP-TABLES-FIELD-EMAIL-003`        | ✅     |
| AC-004 | Supports NOT NULL constraint when required         | `APP-TABLES-FIELD-EMAIL-004`        | ✅     |
| AC-005 | Supports btree index for performance               | `APP-TABLES-FIELD-EMAIL-005`        | ✅     |
| AC-006 | User can complete full email workflow (regression) | `APP-TABLES-FIELD-EMAIL-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/email-field.spec.ts`

---

## US-FIELDS-SPECIAL-002: URL Fields

**As a** developer,
**I want to** define URL fields with validation,
**so that** I can store valid web addresses.

### Configuration

```yaml
tables:
  - id: 1
    name: resources
    fields:
      - id: 1
        name: website
        type: url
      - id: 2
        name: documentation_link
        type: url
```

### Acceptance Criteria

| ID     | Criterion                                        | E2E Spec                          | Status |
| ------ | ------------------------------------------------ | --------------------------------- | ------ |
| AC-001 | Creates PostgreSQL TEXT column                   | `APP-TABLES-FIELD-URL-001`        | ✅     |
| AC-002 | Validates URL format                             | `APP-TABLES-FIELD-URL-002`        | ✅     |
| AC-003 | Supports UNIQUE constraint                       | `APP-TABLES-FIELD-URL-003`        | ✅     |
| AC-004 | Supports NOT NULL constraint when required       | `APP-TABLES-FIELD-URL-004`        | ✅     |
| AC-005 | Supports btree index for performance             | `APP-TABLES-FIELD-URL-005`        | ✅     |
| AC-006 | User can complete full URL workflow (regression) | `APP-TABLES-FIELD-URL-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/url-field.spec.ts`

---

## US-FIELDS-SPECIAL-003: Phone Number Fields

**As a** developer,
**I want to** define phone number fields,
**so that** I can store contact phone numbers.

### Configuration

```yaml
tables:
  - id: 1
    name: contacts
    fields:
      - id: 1
        name: phone
        type: phone-number
        format: e164 # or 'national', 'international'
```

### Acceptance Criteria

| ID     | Criterion                                                 | E2E Spec                                   | Status |
| ------ | --------------------------------------------------------- | ------------------------------------------ | ------ |
| AC-001 | Creates PostgreSQL VARCHAR column                         | `APP-TABLES-FIELD-PHONE-NUMBER-001`        | ✅     |
| AC-002 | Normalizes to E.164 format when configured                | `APP-TABLES-FIELD-PHONE-NUMBER-002`        | ✅     |
| AC-003 | Validates phone number format                             | `APP-TABLES-FIELD-PHONE-NUMBER-003`        | ✅     |
| AC-004 | Supports NOT NULL constraint when required                | `APP-TABLES-FIELD-PHONE-NUMBER-004`        | ✅     |
| AC-005 | Supports UNIQUE constraint                                | `APP-TABLES-FIELD-PHONE-NUMBER-005`        | ✅     |
| AC-006 | User can complete full phone number workflow (regression) | `APP-TABLES-FIELD-PHONE-NUMBER-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/phone-number-field.spec.ts`

---

## US-FIELDS-SPECIAL-004: Rating Fields

**As a** developer,
**I want to** define rating fields for star ratings,
**so that** I can store review scores and ratings.

### Configuration

```yaml
tables:
  - id: 1
    name: reviews
    fields:
      - id: 1
        name: rating
        type: rating
        max: 5
        required: true
```

### Acceptance Criteria

| ID     | Criterion                                           | E2E Spec                                   | Status |
| ------ | --------------------------------------------------- | ------------------------------------------ | ------ |
| AC-001 | Creates PostgreSQL INTEGER column                   | `APP-TABLES-FIELD-TYPES-RATING-001`        | ✅     |
| AC-002 | Enforces CHECK constraint for 1-max range           | `APP-TABLES-FIELD-TYPES-RATING-002`        | ✅     |
| AC-003 | Supports NOT NULL constraint when required          | `APP-TABLES-FIELD-TYPES-RATING-003`        | ✅     |
| AC-004 | Supports DEFAULT value                              | `APP-TABLES-FIELD-TYPES-RATING-004`        | ✅     |
| AC-005 | Supports average calculation in views               | `APP-TABLES-FIELD-TYPES-RATING-005`        | ✅     |
| AC-006 | User can complete full rating workflow (regression) | `APP-TABLES-FIELD-TYPES-RATING-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/rating-field.spec.ts`

---

## US-FIELDS-SPECIAL-005: Progress Fields

**As a** developer,
**I want to** define progress fields for completion tracking,
**so that** I can visualize task or project progress.

### Configuration

```yaml
tables:
  - id: 1
    name: projects
    fields:
      - id: 1
        name: completion
        type: progress
        default: 0
```

### Acceptance Criteria

| ID     | Criterion                                             | E2E Spec                                     | Status |
| ------ | ----------------------------------------------------- | -------------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL INTEGER column                     | `APP-TABLES-FIELD-TYPES-PROGRESS-001`        | ✅     |
| AC-002 | Enforces CHECK constraint for 0-100 range             | `APP-TABLES-FIELD-TYPES-PROGRESS-002`        | ✅     |
| AC-003 | Supports NOT NULL constraint (default 0)              | `APP-TABLES-FIELD-TYPES-PROGRESS-003`        | ✅     |
| AC-004 | Supports DEFAULT value                                | `APP-TABLES-FIELD-TYPES-PROGRESS-004`        | ✅     |
| AC-005 | Returns as percentage in API responses                | `APP-TABLES-FIELD-TYPES-PROGRESS-005`        | ✅     |
| AC-006 | User can complete full progress workflow (regression) | `APP-TABLES-FIELD-TYPES-PROGRESS-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/progress-field.spec.ts`

---

## US-FIELDS-SPECIAL-006: Color Fields

**As a** developer,
**I want to** define color fields for hex color values,
**so that** I can store color preferences and themes.

### Configuration

```yaml
tables:
  - id: 1
    name: categories
    fields:
      - id: 1
        name: color
        type: color
        default: '#3B82F6'
```

### Acceptance Criteria

| ID     | Criterion                                          | E2E Spec                                  | Status |
| ------ | -------------------------------------------------- | ----------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL VARCHAR(7) column               | `APP-TABLES-FIELD-TYPES-COLOR-001`        | ✅     |
| AC-002 | Validates hex color format (#RRGGBB)               | `APP-TABLES-FIELD-TYPES-COLOR-002`        | ✅     |
| AC-003 | Normalizes to uppercase hex                        | `APP-TABLES-FIELD-TYPES-COLOR-003`        | ✅     |
| AC-004 | Supports NOT NULL constraint when required         | `APP-TABLES-FIELD-TYPES-COLOR-004`        | ✅     |
| AC-005 | Supports DEFAULT value                             | `APP-TABLES-FIELD-TYPES-COLOR-005`        | ✅     |
| AC-006 | User can complete full color workflow (regression) | `APP-TABLES-FIELD-TYPES-COLOR-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/color-field.spec.ts`

---

## US-FIELDS-SPECIAL-007: Barcode Fields

**As a** developer,
**I want to** define barcode fields for product codes,
**so that** I can store UPC, EAN, and other barcode formats.

### Configuration

```yaml
tables:
  - id: 1
    name: products
    fields:
      - id: 1
        name: upc
        type: barcode
        format: upc-a # or 'ean-13', 'code-128', etc.
        unique: true
```

### Acceptance Criteria

| ID     | Criterion                                            | E2E Spec                                    | Status |
| ------ | ---------------------------------------------------- | ------------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL VARCHAR column                    | `APP-TABLES-FIELD-TYPES-BARCODE-001`        | ✅     |
| AC-002 | Validates barcode format (checksum)                  | `APP-TABLES-FIELD-TYPES-BARCODE-002`        | ✅     |
| AC-003 | Supports UNIQUE constraint                           | `APP-TABLES-FIELD-TYPES-BARCODE-003`        | ✅     |
| AC-004 | Supports NOT NULL constraint when required           | `APP-TABLES-FIELD-TYPES-BARCODE-004`        | ✅     |
| AC-005 | Supports btree index for performance                 | `APP-TABLES-FIELD-TYPES-BARCODE-005`        | ✅     |
| AC-006 | User can complete full barcode workflow (regression) | `APP-TABLES-FIELD-TYPES-BARCODE-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/barcode-field.spec.ts`

---

## US-FIELDS-SYSTEM-001: Created At Fields

**As a** developer,
**I want to** automatic created_at timestamps,
**so that** I can track when records were created.

### Configuration

```yaml
tables:
  - id: 1
    name: posts
    fields:
      # created_at is automatically added to all tables
      # Can be configured with custom name:
      - id: 99
        name: published_at
        type: created-at
```

### Acceptance Criteria

| ID     | Criterion                                               | E2E Spec                                       | Status |
| ------ | ------------------------------------------------------- | ---------------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL TIMESTAMPTZ column                   | `APP-TABLES-FIELD-TYPES-CREATED-AT-001`        | ✅     |
| AC-002 | Auto-populates on record creation                       | `APP-TABLES-FIELD-TYPES-CREATED-AT-002`        | ✅     |
| AC-003 | Cannot be updated after creation                        | `APP-TABLES-FIELD-TYPES-CREATED-AT-003`        | ✅     |
| AC-004 | Indexed by default for sorting                          | `APP-TABLES-FIELD-TYPES-CREATED-AT-004`        | ✅     |
| AC-005 | Returns ISO 8601 format in API responses                | `APP-TABLES-FIELD-TYPES-CREATED-AT-005`        | ✅     |
| AC-006 | User can complete full created-at workflow (regression) | `APP-TABLES-FIELD-TYPES-CREATED-AT-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/created-at-field.spec.ts`

---

## US-FIELDS-SYSTEM-002: Updated At Fields

**As a** developer,
**I want to** automatic updated_at timestamps,
**so that** I can track when records were last modified.

### Acceptance Criteria

| ID     | Criterion                                               | E2E Spec                                       | Status |
| ------ | ------------------------------------------------------- | ---------------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL TIMESTAMPTZ column                   | `APP-TABLES-FIELD-TYPES-UPDATED-AT-001`        | ✅     |
| AC-002 | Auto-updates on every record modification               | `APP-TABLES-FIELD-TYPES-UPDATED-AT-002`        | ✅     |
| AC-003 | Set to same value as created_at on creation             | `APP-TABLES-FIELD-TYPES-UPDATED-AT-003`        | ✅     |
| AC-004 | Indexed by default for sorting                          | `APP-TABLES-FIELD-TYPES-UPDATED-AT-004`        | ✅     |
| AC-005 | Returns ISO 8601 format in API responses                | `APP-TABLES-FIELD-TYPES-UPDATED-AT-005`        | ✅     |
| AC-006 | User can complete full updated-at workflow (regression) | `APP-TABLES-FIELD-TYPES-UPDATED-AT-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/updated-at-field.spec.ts`

---

## US-FIELDS-SYSTEM-003: Deleted At Fields

**As a** developer,
**I want to** automatic deleted_at timestamps for soft delete,
**so that** I can implement trash and restore functionality.

### Acceptance Criteria

| ID     | Criterion                                               | E2E Spec                                       | Status |
| ------ | ------------------------------------------------------- | ---------------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL TIMESTAMPTZ column                   | `APP-TABLES-FIELD-TYPES-DELETED-AT-001`        | ✅     |
| AC-002 | NULL by default (not deleted)                           | `APP-TABLES-FIELD-TYPES-DELETED-AT-002`        | ✅     |
| AC-003 | Set to current time on soft delete                      | `APP-TABLES-FIELD-TYPES-DELETED-AT-003`        | ✅     |
| AC-004 | Cleared on restore                                      | `APP-TABLES-FIELD-TYPES-DELETED-AT-004`        | ✅     |
| AC-005 | Records with deleted_at excluded by default             | `APP-TABLES-FIELD-TYPES-DELETED-AT-005`        | ✅     |
| AC-006 | User can complete full deleted-at workflow (regression) | `APP-TABLES-FIELD-TYPES-DELETED-AT-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/deleted-at-field.spec.ts`

---

## US-FIELDS-SYSTEM-004: Created By Fields

**As a** developer,
**I want to** track which user created each record,
**so that** I can implement audit trails and ownership.

### Acceptance Criteria

| ID     | Criterion                                               | E2E Spec                                       | Status |
| ------ | ------------------------------------------------------- | ---------------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL INTEGER/UUID column                  | `APP-TABLES-FIELD-TYPES-CREATED-BY-001`        | ✅     |
| AC-002 | Auto-populates with current user ID                     | `APP-TABLES-FIELD-TYPES-CREATED-BY-002`        | ✅     |
| AC-003 | Cannot be updated after creation                        | `APP-TABLES-FIELD-TYPES-CREATED-BY-003`        | ✅     |
| AC-004 | References users table                                  | `APP-TABLES-FIELD-TYPES-CREATED-BY-004`        | ✅     |
| AC-005 | Returns user object when expanded                       | `APP-TABLES-FIELD-TYPES-CREATED-BY-005`        | ✅     |
| AC-006 | User can complete full created-by workflow (regression) | `APP-TABLES-FIELD-TYPES-CREATED-BY-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/created-by-field.spec.ts`

---

## US-FIELDS-SYSTEM-005: Updated By Fields

**As a** developer,
**I want to** track which user last modified each record,
**so that** I can implement audit trails.

### Acceptance Criteria

| ID     | Criterion                                               | E2E Spec                                       | Status |
| ------ | ------------------------------------------------------- | ---------------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL INTEGER/UUID column                  | `APP-TABLES-FIELD-TYPES-UPDATED-BY-001`        | ✅     |
| AC-002 | Auto-updates with current user ID on changes            | `APP-TABLES-FIELD-TYPES-UPDATED-BY-002`        | ✅     |
| AC-003 | Set to same value as created_by on creation             | `APP-TABLES-FIELD-TYPES-UPDATED-BY-003`        | ✅     |
| AC-004 | References users table                                  | `APP-TABLES-FIELD-TYPES-UPDATED-BY-004`        | ✅     |
| AC-005 | Returns user object when expanded                       | `APP-TABLES-FIELD-TYPES-UPDATED-BY-005`        | ✅     |
| AC-006 | User can complete full updated-by workflow (regression) | `APP-TABLES-FIELD-TYPES-UPDATED-BY-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/updated-by-field.spec.ts`

---

## US-FIELDS-SYSTEM-006: Deleted By Fields

**As a** developer,
**I want to** track which user deleted each record,
**so that** I can implement audit trails for deletions.

### Acceptance Criteria

| ID     | Criterion                                               | E2E Spec                                       | Status |
| ------ | ------------------------------------------------------- | ---------------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL INTEGER/UUID column                  | `APP-TABLES-FIELD-TYPES-DELETED-BY-001`        | ✅     |
| AC-002 | NULL by default (not deleted)                           | `APP-TABLES-FIELD-TYPES-DELETED-BY-002`        | ✅     |
| AC-003 | Set to deleting user ID on soft delete                  | `APP-TABLES-FIELD-TYPES-DELETED-BY-003`        | ✅     |
| AC-004 | Cleared on restore                                      | `APP-TABLES-FIELD-TYPES-DELETED-BY-004`        | ✅     |
| AC-005 | References users table                                  | `APP-TABLES-FIELD-TYPES-DELETED-BY-005`        | ✅     |
| AC-006 | User can complete full deleted-by workflow (regression) | `APP-TABLES-FIELD-TYPES-DELETED-BY-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/deleted-by-field.spec.ts`

---

## US-FIELDS-SYSTEM-007: Autonumber Fields

**As a** developer,
**I want to** define auto-incrementing number fields,
**so that** I can generate sequential IDs or reference numbers.

### Configuration

```yaml
tables:
  - id: 1
    name: invoices
    fields:
      - id: 1
        name: invoice_number
        type: autonumber
        prefix: 'INV-'
        startFrom: 1000
```

### Acceptance Criteria

| ID     | Criterion                                               | E2E Spec                                       | Status |
| ------ | ------------------------------------------------------- | ---------------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL SERIAL/BIGSERIAL column              | `APP-TABLES-FIELD-TYPES-AUTONUMBER-001`        | ✅     |
| AC-002 | Auto-increments on each new record                      | `APP-TABLES-FIELD-TYPES-AUTONUMBER-002`        | ✅     |
| AC-003 | Cannot be manually set or updated                       | `APP-TABLES-FIELD-TYPES-AUTONUMBER-003`        | ✅     |
| AC-004 | Supports prefix and suffix formatting                   | `APP-TABLES-FIELD-TYPES-AUTONUMBER-004`        | ✅     |
| AC-005 | Supports custom start value                             | `APP-TABLES-FIELD-TYPES-AUTONUMBER-005`        | ✅     |
| AC-006 | User can complete full autonumber workflow (regression) | `APP-TABLES-FIELD-TYPES-AUTONUMBER-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/autonumber-field.spec.ts`

---

## US-FIELDS-SYSTEM-008: Special Fields in Formulas

**As a** developer,
**I want to** reference automatic system fields (id, created_at, updated_at, deleted_at) in formula expressions,
**so that** I can create computed columns based on system-managed values.

### Configuration

```yaml
tables:
  - id: 1
    name: orders
    fields:
      - id: 1
        name: order_age_days
        type: formula
        formula: 'EXTRACT(DAY FROM NOW() - created_at)'
        resultType: integer
      - id: 2
        name: last_modified_date
        type: formula
        formula: 'DATE(updated_at)'
        resultType: date
      - id: 3
        name: is_deleted
        type: formula
        formula: 'deleted_at IS NOT NULL'
        resultType: boolean
```

### Acceptance Criteria

| ID     | Criterion                                                                | E2E Spec                               | Status |
| ------ | ------------------------------------------------------------------------ | -------------------------------------- | ------ |
| AC-001 | Allows formula to reference id without explicit field definition         | `APP-TABLES-SPECIAL-FIELDS-001`        | ✅     |
| AC-002 | Allows formula to reference created_at without explicit field definition | `APP-TABLES-SPECIAL-FIELDS-002`        | ✅     |
| AC-003 | Allows formula to reference updated_at without explicit field definition | `APP-TABLES-SPECIAL-FIELDS-003`        | ✅     |
| AC-004 | Allows formula to reference deleted_at without explicit field definition | `APP-TABLES-SPECIAL-FIELDS-004`        | ✅     |
| AC-005 | Automatically creates deleted_at column on all tables                    | `APP-TABLES-SPECIAL-FIELDS-005`        | ✅     |
| AC-006 | Automatically creates index on deleted_at column                         | `APP-TABLES-SPECIAL-FIELDS-006`        | ✅     |
| AC-007 | User can complete full special fields workflow (regression)              | `APP-TABLES-SPECIAL-FIELDS-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/table/index.ts`
- **E2E Spec**: `specs/app/tables/field-types/special-fields-in-formulas.spec.ts`

---

## US-FIELDS-ADVANCED-001: Formula Fields

**As a** developer,
**I want to** define formula fields for computed values,
**so that** I can calculate values based on other fields.

### Configuration

```yaml
tables:
  - id: 1
    name: order_items
    fields:
      - id: 1
        name: quantity
        type: integer
        required: true
      - id: 2
        name: unit_price
        type: decimal
        required: true
      - id: 3
        name: total
        type: formula
        formula: 'quantity * unit_price'
        resultType: decimal
```

### Acceptance Criteria - Core Functionality

| ID     | Criterion                                                 | E2E Spec                             | Status |
| ------ | --------------------------------------------------------- | ------------------------------------ | ------ |
| AC-001 | Creates GENERATED ALWAYS AS column for arithmetic formula | `APP-TABLES-FIELD-TYPES-FORMULA-001` | ✅     |
| AC-002 | Performs text concatenation with GENERATED column         | `APP-TABLES-FIELD-TYPES-FORMULA-002` | ✅     |
| AC-003 | Supports conditional expressions with CASE WHEN           | `APP-TABLES-FIELD-TYPES-FORMULA-003` | ✅     |
| AC-004 | Applies mathematical functions like ROUND                 | `APP-TABLES-FIELD-TYPES-FORMULA-004` | ✅     |
| AC-005 | Evaluates boolean date logic for overdue detection        | `APP-TABLES-FIELD-TYPES-FORMULA-005` | ✅     |

### Acceptance Criteria - Mathematical Functions

| ID     | Criterion                                       | E2E Spec                             | Status |
| ------ | ----------------------------------------------- | ------------------------------------ | ------ |
| AC-006 | Computes absolute value with ABS function       | `APP-TABLES-FIELD-TYPES-FORMULA-006` | ✅     |
| AC-007 | Computes average with inline calculation        | `APP-TABLES-FIELD-TYPES-FORMULA-007` | ✅     |
| AC-008 | Rounds up with CEIL function                    | `APP-TABLES-FIELD-TYPES-FORMULA-008` | ✅     |
| AC-009 | Rounds to nearest even number with EVEN formula | `APP-TABLES-FIELD-TYPES-FORMULA-009` | ✅     |
| AC-010 | Computes exponential with EXP function          | `APP-TABLES-FIELD-TYPES-FORMULA-010` | ✅     |
| AC-011 | Rounds down with FLOOR function                 | `APP-TABLES-FIELD-TYPES-FORMULA-011` | ✅     |
| AC-012 | Truncates to integer with TRUNC function        | `APP-TABLES-FIELD-TYPES-FORMULA-012` | ✅     |
| AC-013 | Computes logarithm with LOG function            | `APP-TABLES-FIELD-TYPES-FORMULA-013` | ✅     |
| AC-014 | Computes natural logarithm with LN function     | `APP-TABLES-FIELD-TYPES-FORMULA-014` | ✅     |
| AC-015 | Finds maximum with GREATEST function            | `APP-TABLES-FIELD-TYPES-FORMULA-015` | ✅     |
| AC-016 | Finds minimum with LEAST function               | `APP-TABLES-FIELD-TYPES-FORMULA-016` | ✅     |
| AC-017 | Computes modulo with MOD function               | `APP-TABLES-FIELD-TYPES-FORMULA-017` | ✅     |
| AC-018 | Rounds to nearest odd number with ODD formula   | `APP-TABLES-FIELD-TYPES-FORMULA-018` | ✅     |
| AC-019 | Computes power with POWER function              | `APP-TABLES-FIELD-TYPES-FORMULA-019` | ✅     |
| AC-020 | Rounds down with TRUNC for precision            | `APP-TABLES-FIELD-TYPES-FORMULA-020` | ✅     |
| AC-021 | Rounds up with precision calculation            | `APP-TABLES-FIELD-TYPES-FORMULA-021` | ✅     |
| AC-022 | Computes square root with SQRT function         | `APP-TABLES-FIELD-TYPES-FORMULA-022` | ✅     |
| AC-023 | Computes sum of multiple fields                 | `APP-TABLES-FIELD-TYPES-FORMULA-023` | ✅     |
| AC-024 | Converts text to number with CAST               | `APP-TABLES-FIELD-TYPES-FORMULA-024` | ✅     |
| AC-025 | Counts non-null values with CASE expression     | `APP-TABLES-FIELD-TYPES-FORMULA-025` | ✅     |
| AC-026 | Returns first non-null value with COALESCE      | `APP-TABLES-FIELD-TYPES-FORMULA-026` | ✅     |

### Acceptance Criteria - String Functions

| ID     | Criterion                                         | E2E Spec                             | Status |
| ------ | ------------------------------------------------- | ------------------------------------ | ------ |
| AC-027 | Concatenates text with double-pipe operator       | `APP-TABLES-FIELD-TYPES-FORMULA-027` | ✅     |
| AC-028 | Extracts left characters with LEFT function       | `APP-TABLES-FIELD-TYPES-FORMULA-028` | ✅     |
| AC-029 | Extracts right characters with RIGHT function     | `APP-TABLES-FIELD-TYPES-FORMULA-029` | ✅     |
| AC-030 | Extracts substring with SUBSTR function           | `APP-TABLES-FIELD-TYPES-FORMULA-030` | ✅     |
| AC-031 | Computes string length with LENGTH function       | `APP-TABLES-FIELD-TYPES-FORMULA-031` | ✅     |
| AC-032 | Converts to lowercase with LOWER function         | `APP-TABLES-FIELD-TYPES-FORMULA-032` | ✅     |
| AC-033 | Converts to uppercase with UPPER function         | `APP-TABLES-FIELD-TYPES-FORMULA-033` | ✅     |
| AC-034 | Removes whitespace with TRIM function             | `APP-TABLES-FIELD-TYPES-FORMULA-034` | ✅     |
| AC-035 | Finds substring position with STRPOS function     | `APP-TABLES-FIELD-TYPES-FORMULA-035` | ✅     |
| AC-036 | Returns null for not found with NULLIF pattern    | `APP-TABLES-FIELD-TYPES-FORMULA-036` | ✅     |
| AC-037 | Replaces substring with OVERLAY function          | `APP-TABLES-FIELD-TYPES-FORMULA-037` | ✅     |
| AC-038 | Substitutes all occurrences with REPLACE function | `APP-TABLES-FIELD-TYPES-FORMULA-038` | ✅     |
| AC-039 | Repeats text with REPEAT function                 | `APP-TABLES-FIELD-TYPES-FORMULA-039` | ✅     |
| AC-040 | Converts to text with CASE expression for T       | `APP-TABLES-FIELD-TYPES-FORMULA-040` | ✅     |
| AC-041 | Splits text into array with STRING_TO_ARRAY       | `APP-TABLES-FIELD-TYPES-FORMULA-041` | ✅     |
| AC-042 | Converts ASCII code to character with CHR         | `APP-TABLES-FIELD-TYPES-FORMULA-042` | ✅     |
| AC-043 | Converts character to ASCII code with ASCII       | `APP-TABLES-FIELD-TYPES-FORMULA-043` | ✅     |
| AC-044 | Encodes to base64 with ENCODE function            | `APP-TABLES-FIELD-TYPES-FORMULA-044` | ✅     |
| AC-045 | Decodes from base64 with DECODE function          | `APP-TABLES-FIELD-TYPES-FORMULA-045` | ✅     |
| AC-046 | URL encodes with custom expression                | `APP-TABLES-FIELD-TYPES-FORMULA-046` | ✅     |

### Acceptance Criteria - Logical Functions

| ID     | Criterion                              | E2E Spec                             | Status |
| ------ | -------------------------------------- | ------------------------------------ | ------ |
| AC-047 | Evaluates IF with CASE WHEN expression | `APP-TABLES-FIELD-TYPES-FORMULA-047` | ✅     |
| AC-048 | Evaluates OR logical operator          | `APP-TABLES-FIELD-TYPES-FORMULA-048` | ✅     |
| AC-049 | Evaluates XOR logical operator         | `APP-TABLES-FIELD-TYPES-FORMULA-049` | ✅     |
| AC-050 | Evaluates SWITCH with CASE expression  | `APP-TABLES-FIELD-TYPES-FORMULA-050` | ✅     |
| AC-051 | Returns TRUE boolean constant          | `APP-TABLES-FIELD-TYPES-FORMULA-051` | ✅     |
| AC-052 | Returns FALSE boolean constant         | `APP-TABLES-FIELD-TYPES-FORMULA-052` | ✅     |
| AC-053 | Returns NULL with BLANK expression     | `APP-TABLES-FIELD-TYPES-FORMULA-053` | ✅     |
| AC-054 | Handles error with custom expression   | `APP-TABLES-FIELD-TYPES-FORMULA-054` | ✅     |
| AC-055 | Detects errors with guarded expression | `APP-TABLES-FIELD-TYPES-FORMULA-055` | ✅     |
| AC-056 | Checks for blank with IS NULL          | `APP-TABLES-FIELD-TYPES-FORMULA-056` | ✅     |
| AC-057 | Uses COALESCE for default values       | `APP-TABLES-FIELD-TYPES-FORMULA-057` | ✅     |

### Acceptance Criteria - Date & Time Functions

| ID     | Criterion                          | E2E Spec                             | Status |
| ------ | ---------------------------------- | ------------------------------------ | ------ |
| AC-058 | Compares date with CURRENT_DATE    | `APP-TABLES-FIELD-TYPES-FORMULA-058` | ✅     |
| AC-059 | Adds interval to date              | `APP-TABLES-FIELD-TYPES-FORMULA-059` | ✅     |
| AC-060 | Computes date difference           | `APP-TABLES-FIELD-TYPES-FORMULA-060` | ✅     |
| AC-061 | Formats date with TO_CHAR          | `APP-TABLES-FIELD-TYPES-FORMULA-061` | ✅     |
| AC-062 | Parses date from text              | `APP-TABLES-FIELD-TYPES-FORMULA-062` | ✅     |
| AC-063 | Extracts year from date            | `APP-TABLES-FIELD-TYPES-FORMULA-063` | ✅     |
| AC-064 | Extracts month from date           | `APP-TABLES-FIELD-TYPES-FORMULA-064` | ✅     |
| AC-065 | Extracts day from date             | `APP-TABLES-FIELD-TYPES-FORMULA-065` | ✅     |
| AC-066 | Extracts hour from timestamp       | `APP-TABLES-FIELD-TYPES-FORMULA-066` | ✅     |
| AC-067 | Extracts minute from timestamp     | `APP-TABLES-FIELD-TYPES-FORMULA-067` | ✅     |
| AC-068 | Extracts second from timestamp     | `APP-TABLES-FIELD-TYPES-FORMULA-068` | ✅     |
| AC-069 | Gets day of week                   | `APP-TABLES-FIELD-TYPES-FORMULA-069` | ✅     |
| AC-070 | Gets week number                   | `APP-TABLES-FIELD-TYPES-FORMULA-070` | ✅     |
| AC-071 | Checks if date is weekday          | `APP-TABLES-FIELD-TYPES-FORMULA-071` | ✅     |
| AC-072 | Counts calendar days between dates | `APP-TABLES-FIELD-TYPES-FORMULA-072` | ✅     |
| AC-073 | Compares dates at same precision   | `APP-TABLES-FIELD-TYPES-FORMULA-073` | ✅     |
| AC-074 | Checks if date is after another    | `APP-TABLES-FIELD-TYPES-FORMULA-074` | ✅     |
| AC-075 | Checks if date is before another   | `APP-TABLES-FIELD-TYPES-FORMULA-075` | ✅     |

### Acceptance Criteria - Array Functions

| ID     | Criterion                                 | E2E Spec                             | Status |
| ------ | ----------------------------------------- | ------------------------------------ | ------ |
| AC-076 | Joins array elements with ARRAY_TO_STRING | `APP-TABLES-FIELD-TYPES-FORMULA-076` | ✅     |
| AC-077 | Gets unique array elements                | `APP-TABLES-FIELD-TYPES-FORMULA-077` | ✅     |
| AC-078 | Removes empty elements from array         | `APP-TABLES-FIELD-TYPES-FORMULA-078` | ✅     |
| AC-079 | Flattens nested arrays                    | `APP-TABLES-FIELD-TYPES-FORMULA-079` | ✅     |
| AC-080 | Slices array elements                     | `APP-TABLES-FIELD-TYPES-FORMULA-080` | ✅     |
| AC-081 | Counts array elements                     | `APP-TABLES-FIELD-TYPES-FORMULA-081` | ✅     |

### Acceptance Criteria - Record Metadata

| ID     | Criterion                       | E2E Spec                             | Status |
| ------ | ------------------------------- | ------------------------------------ | ------ |
| AC-082 | Returns record ID               | `APP-TABLES-FIELD-TYPES-FORMULA-082` | ✅     |
| AC-083 | Returns created timestamp       | `APP-TABLES-FIELD-TYPES-FORMULA-083` | ✅     |
| AC-084 | Returns last modified timestamp | `APP-TABLES-FIELD-TYPES-FORMULA-084` | ✅     |

### Acceptance Criteria - Regex Functions

| ID     | Criterion             | E2E Spec                             | Status |
| ------ | --------------------- | ------------------------------------ | ------ |
| AC-085 | Matches regex pattern | `APP-TABLES-FIELD-TYPES-FORMULA-085` | ✅     |
| AC-086 | Extracts regex match  | `APP-TABLES-FIELD-TYPES-FORMULA-086` | ✅     |
| AC-087 | Replaces with regex   | `APP-TABLES-FIELD-TYPES-FORMULA-087` | ✅     |

### Acceptance Criteria - Operators & Edge Cases

| ID     | Criterion                               | E2E Spec                             | Status |
| ------ | --------------------------------------- | ------------------------------------ | ------ |
| AC-088 | Computes modulo with % operator         | `APP-TABLES-FIELD-TYPES-FORMULA-088` | ✅     |
| AC-089 | Handles NULL in arithmetic              | `APP-TABLES-FIELD-TYPES-FORMULA-089` | ✅     |
| AC-090 | Handles division by zero                | `APP-TABLES-FIELD-TYPES-FORMULA-090` | ✅     |
| AC-091 | Coerces number to text                  | `APP-TABLES-FIELD-TYPES-FORMULA-091` | ✅     |
| AC-092 | Coerces text to number                  | `APP-TABLES-FIELD-TYPES-FORMULA-092` | ✅     |
| AC-093 | Handles nested function calls           | `APP-TABLES-FIELD-TYPES-FORMULA-093` | ✅     |
| AC-094 | Concatenates with & operator equivalent | `APP-TABLES-FIELD-TYPES-FORMULA-094` | ✅     |
| AC-095 | Compares with = operator                | `APP-TABLES-FIELD-TYPES-FORMULA-095` | ✅     |
| AC-096 | Compares with != operator               | `APP-TABLES-FIELD-TYPES-FORMULA-096` | ✅     |
| AC-097 | Compares with < operator                | `APP-TABLES-FIELD-TYPES-FORMULA-097` | ✅     |
| AC-098 | Compares with > operator                | `APP-TABLES-FIELD-TYPES-FORMULA-098` | ✅     |
| AC-099 | Compares with <= operator               | `APP-TABLES-FIELD-TYPES-FORMULA-099` | ✅     |
| AC-100 | Compares with >= operator               | `APP-TABLES-FIELD-TYPES-FORMULA-100` | ✅     |
| AC-101 | Applies unary minus operator            | `APP-TABLES-FIELD-TYPES-FORMULA-101` | ✅     |
| AC-102 | Respects parentheses grouping           | `APP-TABLES-FIELD-TYPES-FORMULA-102` | ✅     |
| AC-103 | Mixes arithmetic and text               | `APP-TABLES-FIELD-TYPES-FORMULA-103` | ✅     |
| AC-104 | Coerces boolean to text                 | `APP-TABLES-FIELD-TYPES-FORMULA-104` | ✅     |
| AC-105 | Coerces date to text                    | `APP-TABLES-FIELD-TYPES-FORMULA-105` | ✅     |
| AC-106 | Handles empty string                    | `APP-TABLES-FIELD-TYPES-FORMULA-106` | ✅     |
| AC-107 | Handles whitespace in formulas          | `APP-TABLES-FIELD-TYPES-FORMULA-107` | ✅     |
| AC-108 | Handles case sensitivity in field names | `APP-TABLES-FIELD-TYPES-FORMULA-108` | ✅     |
| AC-109 | Handles reserved word escaping          | `APP-TABLES-FIELD-TYPES-FORMULA-109` | ✅     |
| AC-110 | Handles long formula expressions        | `APP-TABLES-FIELD-TYPES-FORMULA-110` | ✅     |
| AC-111 | Handles deeply nested expressions       | `APP-TABLES-FIELD-TYPES-FORMULA-111` | ✅     |
| AC-112 | Supports multiple formula fields        | `APP-TABLES-FIELD-TYPES-FORMULA-112` | ✅     |
| AC-113 | References another formula field        | `APP-TABLES-FIELD-TYPES-FORMULA-113` | ✅     |
| AC-114 | Handles all NULL inputs                 | `APP-TABLES-FIELD-TYPES-FORMULA-114` | ✅     |
| AC-115 | Handles complex nested expression       | `APP-TABLES-FIELD-TYPES-FORMULA-115` | ✅     |

### Acceptance Criteria - Real-World Use Cases

| ID     | Criterion                      | E2E Spec                             | Status |
| ------ | ------------------------------ | ------------------------------------ | ------ |
| AC-116 | Calculates invoice total       | `APP-TABLES-FIELD-TYPES-FORMULA-116` | ✅     |
| AC-117 | Calculates discount pricing    | `APP-TABLES-FIELD-TYPES-FORMULA-117` | ✅     |
| AC-118 | Calculates age from birthdate  | `APP-TABLES-FIELD-TYPES-FORMULA-118` | ✅     |
| AC-119 | Derives status from conditions | `APP-TABLES-FIELD-TYPES-FORMULA-119` | ✅     |
| AC-120 | Formats full name              | `APP-TABLES-FIELD-TYPES-FORMULA-120` | ✅     |
| AC-121 | Generates URL slug             | `APP-TABLES-FIELD-TYPES-FORMULA-121` | ✅     |
| AC-122 | Tracks deadline status         | `APP-TABLES-FIELD-TYPES-FORMULA-122` | ✅     |

### Acceptance Criteria - Error Handling

| ID     | Criterion                                            | E2E Spec                                    | Status |
| ------ | ---------------------------------------------------- | ------------------------------------------- | ------ |
| AC-123 | Rejects formula when referenced field does not exist | `APP-TABLES-FIELD-TYPES-FORMULA-123`        | ✅     |
| AC-124 | Rejects circular formula dependencies                | `APP-TABLES-FIELD-TYPES-FORMULA-124`        | ✅     |
| AC-125 | Rejects formula with invalid syntax                  | `APP-TABLES-FIELD-TYPES-FORMULA-125`        | ✅     |
| AC-126 | User can complete full formula workflow (regression) | `APP-TABLES-FIELD-TYPES-FORMULA-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/formula-field.spec.ts`

---

## US-FIELDS-ADVANCED-002: JSON Fields

**As a** developer,
**I want to** define JSON fields for flexible structured data,
**so that** I can store arbitrary JSON objects.

### Configuration

```yaml
tables:
  - id: 1
    name: settings
    fields:
      - id: 1
        name: preferences
        type: json
        default: {}
```

### Acceptance Criteria

| ID     | Criterion                                         | E2E Spec                                 | Status |
| ------ | ------------------------------------------------- | ---------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL JSONB column                   | `APP-TABLES-FIELD-TYPES-JSON-001`        | ✅     |
| AC-002 | Validates JSON structure                          | `APP-TABLES-FIELD-TYPES-JSON-002`        | ✅     |
| AC-003 | Supports JSON path queries                        | `APP-TABLES-FIELD-TYPES-JSON-003`        | ✅     |
| AC-004 | Supports GIN index for performance                | `APP-TABLES-FIELD-TYPES-JSON-004`        | ✅     |
| AC-005 | Supports DEFAULT value (JSON object/array)        | `APP-TABLES-FIELD-TYPES-JSON-005`        | ✅     |
| AC-006 | User can complete full JSON workflow (regression) | `APP-TABLES-FIELD-TYPES-JSON-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/json-field.spec.ts`

---

## US-FIELDS-ADVANCED-003: Array Fields

**As a** developer,
**I want to** define array fields for lists of values,
**so that** I can store multiple values of the same type.

### Configuration

```yaml
tables:
  - id: 1
    name: users
    fields:
      - id: 1
        name: skills
        type: array
        itemType: text
        default: []
```

### Acceptance Criteria

| ID     | Criterion                                          | E2E Spec                                  | Status |
| ------ | -------------------------------------------------- | ----------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL array column                    | `APP-TABLES-FIELD-TYPES-ARRAY-001`        | ✅     |
| AC-002 | Validates array item types                         | `APP-TABLES-FIELD-TYPES-ARRAY-002`        | ✅     |
| AC-003 | Supports array contains queries                    | `APP-TABLES-FIELD-TYPES-ARRAY-003`        | ✅     |
| AC-004 | Supports GIN index for performance                 | `APP-TABLES-FIELD-TYPES-ARRAY-004`        | ✅     |
| AC-005 | Supports DEFAULT value (empty array)               | `APP-TABLES-FIELD-TYPES-ARRAY-005`        | ✅     |
| AC-006 | User can complete full array workflow (regression) | `APP-TABLES-FIELD-TYPES-ARRAY-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/array-field.spec.ts`

---

## US-FIELDS-ADVANCED-004: Geolocation Fields

**As a** developer,
**I want to** define geolocation fields for coordinates,
**so that** I can store and query geographic locations.

### Configuration

```yaml
tables:
  - id: 1
    name: locations
    fields:
      - id: 1
        name: coordinates
        type: geolocation
        required: true
```

### Acceptance Criteria

| ID     | Criterion                                                | E2E Spec                                        | Status |
| ------ | -------------------------------------------------------- | ----------------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL POINT or geography column             | `APP-TABLES-FIELD-TYPES-GEOLOCATION-001`        | ✅     |
| AC-002 | Stores latitude and longitude                            | `APP-TABLES-FIELD-TYPES-GEOLOCATION-002`        | ✅     |
| AC-003 | Validates coordinate ranges                              | `APP-TABLES-FIELD-TYPES-GEOLOCATION-003`        | ✅     |
| AC-004 | Supports distance queries (within radius)                | `APP-TABLES-FIELD-TYPES-GEOLOCATION-004`        | ✅     |
| AC-005 | Supports spatial index for performance                   | `APP-TABLES-FIELD-TYPES-GEOLOCATION-005`        | ✅     |
| AC-006 | User can complete full geolocation workflow (regression) | `APP-TABLES-FIELD-TYPES-GEOLOCATION-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/geolocation-field.spec.ts`

---

## US-FIELDS-ADVANCED-005: User Fields

**As a** developer,
**I want to** define user reference fields,
**so that** I can assign records to users.

### Configuration

```yaml
tables:
  - id: 1
    name: tasks
    fields:
      - id: 1
        name: assignee
        type: user
        allowMultiple: false
      - id: 2
        name: watchers
        type: user
        allowMultiple: true
```

### Acceptance Criteria

| ID     | Criterion                                               | E2E Spec                                 | Status |
| ------ | ------------------------------------------------------- | ---------------------------------------- | ------ |
| AC-001 | References users table automatically                    | `APP-TABLES-FIELD-TYPES-USER-001`        | ✅     |
| AC-002 | Validates user exists                                   | `APP-TABLES-FIELD-TYPES-USER-002`        | ✅     |
| AC-003 | Returns user object when expanded                       | `APP-TABLES-FIELD-TYPES-USER-003`        | ✅     |
| AC-004 | Supports multiple users when allowMultiple=true         | `APP-TABLES-FIELD-TYPES-USER-004`        | ✅     |
| AC-005 | Supports filtering by current user                      | `APP-TABLES-FIELD-TYPES-USER-005`        | ✅     |
| AC-006 | User can complete full user field workflow (regression) | `APP-TABLES-FIELD-TYPES-USER-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/user-field.spec.ts`

---

## US-FIELDS-ADVANCED-006: Button Fields

**As a** developer,
**I want to** define button fields for triggering actions,
**so that** I can add interactive controls to records.

### Configuration

```yaml
tables:
  - id: 1
    name: orders
    fields:
      - id: 1
        name: mark_shipped
        type: button
        label: 'Mark as Shipped'
        action: automation
        automation: update_order_status
```

### Acceptance Criteria

| ID     | Criterion                                           | E2E Spec                                   | Status |
| ------ | --------------------------------------------------- | ------------------------------------------ | ------ |
| AC-001 | Does not create a database column                   | `APP-TABLES-FIELD-TYPES-BUTTON-001`        | ✅     |
| AC-002 | Returns button configuration in API                 | `APP-TABLES-FIELD-TYPES-BUTTON-002`        | ✅     |
| AC-003 | Triggers configured action when clicked             | `APP-TABLES-FIELD-TYPES-BUTTON-003`        | ✅     |
| AC-004 | Respects user permissions for action                | `APP-TABLES-FIELD-TYPES-BUTTON-004`        | ✅     |
| AC-005 | Supports conditional visibility                     | `APP-TABLES-FIELD-TYPES-BUTTON-005`        | ✅     |
| AC-006 | Supports custom button styling                      | `APP-TABLES-FIELD-TYPES-BUTTON-006`        | ✅     |
| AC-007 | Supports button confirmation dialog                 | `APP-TABLES-FIELD-TYPES-BUTTON-007`        | ✅     |
| AC-008 | User can complete full button workflow (regression) | `APP-TABLES-FIELD-TYPES-BUTTON-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/button-field.spec.ts`

---

## US-FIELDS-ADVANCED-007: Relationship Fields

**As a** developer,
**I want to** define relationship fields to link records between tables,
**so that** I can model relational data structures.

### Configuration

```yaml
tables:
  - id: 1
    name: orders
    fields:
      - id: 1
        name: customer
        type: relationship
        relatedTable: customers
        relationType: many-to-one
      - id: 2
        name: items
        type: relationship
        relatedTable: order_items
        relationType: one-to-many
```

### Acceptance Criteria

| ID     | Criterion                                                 | E2E Spec                                         | Status |
| ------ | --------------------------------------------------------- | ------------------------------------------------ | ------ |
| AC-001 | Creates foreign key for many-to-one                       | `APP-TABLES-FIELD-TYPES-RELATIONSHIP-001`        | ✅     |
| AC-002 | Creates junction table for many-to-many                   | `APP-TABLES-FIELD-TYPES-RELATIONSHIP-002`        | ✅     |
| AC-003 | Returns related records when expanded                     | `APP-TABLES-FIELD-TYPES-RELATIONSHIP-003`        | ✅     |
| AC-004 | Supports cascading delete                                 | `APP-TABLES-FIELD-TYPES-RELATIONSHIP-004`        | ✅     |
| AC-005 | Validates related record exists                           | `APP-TABLES-FIELD-TYPES-RELATIONSHIP-005`        | ✅     |
| AC-006 | User can complete full relationship workflow (regression) | `APP-TABLES-FIELD-TYPES-RELATIONSHIP-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/relationship-field.spec.ts`

---

## US-FIELDS-ADVANCED-008: Count Fields

**As a** developer,
**I want to** define count fields that aggregate related records,
**so that** I can display counts of linked records.

### Configuration

```yaml
tables:
  - id: 1
    name: customers
    fields:
      - id: 1
        name: order_count
        type: count
        relationshipField: orders
```

### Acceptance Criteria

| ID     | Criterion                                          | E2E Spec                                  | Status |
| ------ | -------------------------------------------------- | ----------------------------------------- | ------ |
| AC-001 | Computes count of related records                  | `APP-TABLES-FIELD-TYPES-COUNT-001`        | ✅     |
| AC-002 | Updates automatically when related records change  | `APP-TABLES-FIELD-TYPES-COUNT-002`        | ✅     |
| AC-003 | Supports filtering counted records                 | `APP-TABLES-FIELD-TYPES-COUNT-003`        | ✅     |
| AC-004 | Returns 0 when no related records                  | `APP-TABLES-FIELD-TYPES-COUNT-004`        | ✅     |
| AC-005 | Supports conditional count                         | `APP-TABLES-FIELD-TYPES-COUNT-005`        | ✅     |
| AC-006 | Rejects invalid source table reference             | `APP-TABLES-FIELD-TYPES-COUNT-006`        | ✅     |
| AC-007 | Rejects invalid source field reference             | `APP-TABLES-FIELD-TYPES-COUNT-007`        | ✅     |
| AC-008 | User can complete full count workflow (regression) | `APP-TABLES-FIELD-TYPES-COUNT-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/count-field.spec.ts`

---

## US-FIELDS-ADVANCED-009: Lookup Fields

**As a** developer,
**I want to** define lookup fields that reference values from related tables,
**so that** I can display data from linked records.

### Configuration

```yaml
tables:
  - id: 1
    name: orders
    fields:
      - id: 1
        name: customer_email
        type: lookup
        relationshipField: customer
        relatedField: email
```

### Acceptance Criteria

| ID     | Criterion                                           | E2E Spec                                   | Status |
| ------ | --------------------------------------------------- | ------------------------------------------ | ------ |
| AC-001 | Returns value from related record                   | `APP-TABLES-FIELD-TYPES-LOOKUP-001`        | ✅     |
| AC-002 | Updates automatically when source changes           | `APP-TABLES-FIELD-TYPES-LOOKUP-002`        | ✅     |
| AC-003 | Returns null when no related record                 | `APP-TABLES-FIELD-TYPES-LOOKUP-003`        | ✅     |
| AC-004 | Supports nested lookups (relationship chain)        | `APP-TABLES-FIELD-TYPES-LOOKUP-004`        | ✅     |
| AC-005 | Respects field permissions on source                | `APP-TABLES-FIELD-TYPES-LOOKUP-005`        | ✅     |
| AC-006 | Supports concatenating multiple field values        | `APP-TABLES-FIELD-TYPES-LOOKUP-006`        | ✅     |
| AC-007 | Supports applying formatting to lookup result       | `APP-TABLES-FIELD-TYPES-LOOKUP-007`        | ✅     |
| AC-008 | Supports looking up from many-to-many               | `APP-TABLES-FIELD-TYPES-LOOKUP-008`        | ✅     |
| AC-009 | Rejects invalid relationship reference              | `APP-TABLES-FIELD-TYPES-LOOKUP-009`        | ✅     |
| AC-010 | Rejects invalid field reference                     | `APP-TABLES-FIELD-TYPES-LOOKUP-010`        | ✅     |
| AC-011 | Rejects lookup on non-relationship field            | `APP-TABLES-FIELD-TYPES-LOOKUP-011`        | ✅     |
| AC-012 | User can complete full lookup workflow (regression) | `APP-TABLES-FIELD-TYPES-LOOKUP-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/lookup-field.spec.ts`

---

## US-FIELDS-ADVANCED-010: Rollup Fields

**As a** developer,
**I want to** define rollup fields that aggregate values from related records,
**so that** I can compute summaries like SUM, AVG, MIN, MAX, COUNT.

### Configuration

```yaml
tables:
  - id: 1
    name: customers
    fields:
      - id: 1
        name: total_spent
        type: rollup
        relationshipField: orders
        relatedField: total
        aggregation: SUM
```

### Acceptance Criteria

| ID     | Criterion                                           | E2E Spec                                   | Status |
| ------ | --------------------------------------------------- | ------------------------------------------ | ------ |
| AC-001 | Computes SUM of related numeric values              | `APP-TABLES-FIELD-TYPES-ROLLUP-001`        | ✅     |
| AC-002 | Computes AVG of related numeric values              | `APP-TABLES-FIELD-TYPES-ROLLUP-002`        | ✅     |
| AC-003 | Computes MIN of related values                      | `APP-TABLES-FIELD-TYPES-ROLLUP-003`        | ✅     |
| AC-004 | Computes MAX of related values                      | `APP-TABLES-FIELD-TYPES-ROLLUP-004`        | ✅     |
| AC-005 | Computes COUNT of related records                   | `APP-TABLES-FIELD-TYPES-ROLLUP-005`        | ✅     |
| AC-006 | Supports filtering aggregated records               | `APP-TABLES-FIELD-TYPES-ROLLUP-006`        | ✅     |
| AC-007 | Updates automatically when related records change   | `APP-TABLES-FIELD-TYPES-ROLLUP-007`        | ✅     |
| AC-008 | Supports CONCAT_DISTINCT aggregation                | `APP-TABLES-FIELD-TYPES-ROLLUP-008`        | ✅     |
| AC-009 | Supports formatting rollup result                   | `APP-TABLES-FIELD-TYPES-ROLLUP-009`        | ✅     |
| AC-010 | Returns null when no related records                | `APP-TABLES-FIELD-TYPES-ROLLUP-010`        | ✅     |
| AC-011 | Rejects invalid aggregation type                    | `APP-TABLES-FIELD-TYPES-ROLLUP-011`        | ✅     |
| AC-012 | Rejects invalid relationship reference              | `APP-TABLES-FIELD-TYPES-ROLLUP-012`        | ✅     |
| AC-013 | Rejects invalid source field reference              | `APP-TABLES-FIELD-TYPES-ROLLUP-013`        | ✅     |
| AC-014 | User can complete full rollup workflow (regression) | `APP-TABLES-FIELD-TYPES-ROLLUP-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/rollup-field.spec.ts`

---

## US-FIELDS-ATTACHMENT-001: Single Attachment Fields

**As a** developer,
**I want to** define single attachment fields,
**so that** users can upload one file per record.

### Configuration

```yaml
tables:
  - id: 1
    name: documents
    fields:
      - id: 1
        name: file
        type: single-attachment
        allowedFileTypes: ['application/pdf', 'application/msword']
        maxFileSize: 10485760 # 10MB
```

### Acceptance Criteria

| ID     | Criterion                                                      | E2E Spec                                              | Status |
| ------ | -------------------------------------------------------------- | ----------------------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL JSONB column for metadata                   | `APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-001`        | ✅     |
| AC-002 | Validates file type against allowedTypes                       | `APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-002`        | ✅     |
| AC-003 | Validates file size against maxSize                            | `APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-003`        | ✅     |
| AC-004 | Returns file URL and metadata in API                           | `APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-004`        | ✅     |
| AC-005 | Deletes file when record is deleted                            | `APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-005`        | ✅     |
| AC-006 | Supports replacing existing attachment                         | `APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-006`        | ✅     |
| AC-007 | Supports removing attachment without delete                    | `APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-007`        | ✅     |
| AC-008 | User can complete full single-attachment workflow (regression) | `APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/single-attachment-field.spec.ts`

---

## US-FIELDS-ATTACHMENT-002: Multiple Attachments Fields

**As a** developer,
**I want to** define multiple attachment fields,
**so that** users can upload multiple files per record.

### Configuration

```yaml
tables:
  - id: 1
    name: posts
    fields:
      - id: 1
        name: images
        type: multiple-attachments
        allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        maxFileSize: 5242880 # 5MB per file
        maxFiles: 10
```

### Acceptance Criteria

| ID     | Criterion                                                         | E2E Spec                                                 | Status |
| ------ | ----------------------------------------------------------------- | -------------------------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL JSONB array column                             | `APP-TABLES-FIELD-TYPES-MULTIPLE-ATTACHMENTS-001`        | ✅     |
| AC-002 | Validates each file type against allowedTypes                     | `APP-TABLES-FIELD-TYPES-MULTIPLE-ATTACHMENTS-002`        | ✅     |
| AC-003 | Validates file count against maxCount                             | `APP-TABLES-FIELD-TYPES-MULTIPLE-ATTACHMENTS-003`        | ✅     |
| AC-004 | Returns array of file URLs and metadata                           | `APP-TABLES-FIELD-TYPES-MULTIPLE-ATTACHMENTS-004`        | ✅     |
| AC-005 | Supports reordering attachments                                   | `APP-TABLES-FIELD-TYPES-MULTIPLE-ATTACHMENTS-005`        | ✅     |
| AC-006 | Supports bulk attachment upload                                   | `APP-TABLES-FIELD-TYPES-MULTIPLE-ATTACHMENTS-006`        | ✅     |
| AC-007 | Supports removing individual attachments                          | `APP-TABLES-FIELD-TYPES-MULTIPLE-ATTACHMENTS-007`        | ✅     |
| AC-008 | User can complete full multiple attachments workflow (regression) | `APP-TABLES-FIELD-TYPES-MULTIPLE-ATTACHMENTS-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/multiple-attachments-field.spec.ts`

---

## US-FIELDS-COMMON-001: Required Field Property

**As a** developer,
**I want to** make fields required,
**so that** I can enforce data completeness.

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
        name: bio
        type: long-text
        required: false # default
```

### Acceptance Criteria

| ID     | Criterion                                                   | E2E Spec                               | Status |
| ------ | ----------------------------------------------------------- | -------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL NOT NULL constraint                      | `APP-TABLES-FIELD-REQUIRED-001`        | ✅     |
| AC-002 | Returns 400 when required field is missing                  | `APP-TABLES-FIELD-REQUIRED-002`        | ✅     |
| AC-003 | Returns 400 when required field is null                     | `APP-TABLES-FIELD-REQUIRED-003`        | ✅     |
| AC-004 | Allows NULL for optional fields                             | `APP-TABLES-FIELD-REQUIRED-004`        | ✅     |
| AC-005 | User can complete full required field workflow (regression) | `APP-TABLES-FIELD-REQUIRED-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/common/required.spec.ts`

---

## US-FIELDS-COMMON-002: Indexed Field Property

**As a** developer,
**I want to** add indexes to fields,
**so that** I can improve query performance.

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

| ID     | Criterion                                                  | E2E Spec                              | Status |
| ------ | ---------------------------------------------------------- | ------------------------------------- | ------ |
| AC-001 | Creates PostgreSQL btree index                             | `APP-TABLES-FIELD-INDEXED-001`        | ✅     |
| AC-002 | Index name follows convention: idx*{table}*{field}         | `APP-TABLES-FIELD-INDEXED-002`        | ✅     |
| AC-003 | Improves query performance for WHERE clauses               | `APP-TABLES-FIELD-INDEXED-003`        | ✅     |
| AC-004 | Improves query performance for JOIN operations             | `APP-TABLES-FIELD-INDEXED-004`        | ✅     |
| AC-005 | Improves query performance for ORDER BY                    | `APP-TABLES-FIELD-INDEXED-005`        | ✅     |
| AC-006 | User can complete full indexed field workflow (regression) | `APP-TABLES-FIELD-INDEXED-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/common/indexed.spec.ts`

---

## US-FIELDS-COMMON-003: Unique Field Property

**As a** developer,
**I want to** enforce unique values,
**so that** I can prevent duplicate data.

### Configuration

```yaml
tables:
  - id: 1
    name: users
    fields:
      - id: 1
        name: email
        type: email
        unique: true
      - id: 2
        name: username
        type: single-line-text
        unique: true
```

### Acceptance Criteria

| ID     | Criterion                                           | E2E Spec                             | Status |
| ------ | --------------------------------------------------- | ------------------------------------ | ------ |
| AC-001 | Creates PostgreSQL UNIQUE constraint                | `APP-TABLES-FIELD-UNIQUE-001`        | ✅     |
| AC-002 | Automatically creates index                         | `APP-TABLES-FIELD-UNIQUE-002`        | ✅     |
| AC-003 | Returns 400 on duplicate value                      | `APP-TABLES-FIELD-UNIQUE-003`        | ✅     |
| AC-004 | Allows multiple NULL values (SQL standard)          | `APP-TABLES-FIELD-UNIQUE-004`        | ✅     |
| AC-005 | Constraint name follows convention                  | `APP-TABLES-FIELD-UNIQUE-005`        | ✅     |
| AC-006 | User can complete full unique workflow (regression) | `APP-TABLES-FIELD-UNIQUE-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/common/unique.spec.ts`

---

## US-FIELDS-TIMEZONE-001: Timezone Handling

**As a** developer,
**I want to** handle timezones correctly for datetime fields,
**so that** users see times in their local timezone.

### Acceptance Criteria

| ID     | Criterion                                                   | E2E Spec                         | Status |
| ------ | ----------------------------------------------------------- | -------------------------------- | ------ |
| AC-001 | Stores created_at/updated_at in UTC with TIMESTAMP WITH TZ  | `APP-TABLES-TIMEZONE-001`        | ✅     |
| AC-002 | Uses TIMESTAMP WITH TIME ZONE for datetime fields           | `APP-TABLES-TIMEZONE-002`        | ✅     |
| AC-003 | Preserves UTC offset when storing timezone-aware input      | `APP-TABLES-TIMEZONE-003`        | ✅     |
| AC-004 | Does NOT convert TIMESTAMP WITHOUT TIME ZONE to UTC         | `APP-TABLES-TIMEZONE-004`        | ✅     |
| AC-005 | Converts TIMESTAMP WITH TIME ZONE to specified timezone     | `APP-TABLES-TIMEZONE-005`        | ✅     |
| AC-006 | Handles daylight saving time transitions correctly          | `APP-TABLES-TIMEZONE-006`        | ✅     |
| AC-007 | Handles ambiguous times during DST fallback                 | `APP-TABLES-TIMEZONE-007`        | ✅     |
| AC-008 | Compares timestamps across timezones correctly              | `APP-TABLES-TIMEZONE-008`        | ✅     |
| AC-009 | Validates Effect DateTime integration for timezone handling | `APP-TABLES-TIMEZONE-009`        | ✅     |
| AC-010 | User can complete full timezone workflow (regression)       | `APP-TABLES-TIMEZONE-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/tables/field-types/timezone-handling.spec.ts`

---

## Regression Tests

| Spec ID                                   | Workflow                                                  | Status |
| ----------------------------------------- | --------------------------------------------------------- | ------ |
| `APP-TABLES-FIELD-TYPES-REGRESSION`       | Developer creates table with all field types              | `[x]`  |
| `APP-TABLES-FIELD-CONSTRAINTS-REGRESSION` | Developer applies constraints (required, unique, indexed) | `[x]`  |
| `APP-TABLES-FIELD-SYSTEM-REGRESSION`      | System fields auto-populate on CRUD operations            | `[x]`  |

---

## Coverage Summary

| User Story               | Title                    | Spec Count              | Status   |
| ------------------------ | ------------------------ | ----------------------- | -------- |
| US-FIELDS-TEXT-001       | Single-Line Text Fields  | 19                      | Complete |
| US-FIELDS-TEXT-002       | Long Text Fields         | 5                       | Complete |
| US-FIELDS-TEXT-003       | Rich Text Fields         | 5                       | Complete |
| US-FIELDS-NUMBER-001     | Integer Fields           | 5                       | Complete |
| US-FIELDS-NUMBER-002     | Decimal Fields           | 5                       | Complete |
| US-FIELDS-NUMBER-003     | Percentage Fields        | 5                       | Complete |
| US-FIELDS-NUMBER-004     | Currency Fields          | 5                       | Complete |
| US-FIELDS-DATETIME-001   | DateTime Fields          | 5                       | Complete |
| US-FIELDS-DATETIME-002   | Date Fields              | 5                       | Complete |
| US-FIELDS-DATETIME-003   | Time Fields              | 5                       | Complete |
| US-FIELDS-DATETIME-004   | Duration Fields          | 5                       | Complete |
| US-FIELDS-SELECT-001     | Single-Select Fields     | 5                       | Complete |
| US-FIELDS-SELECT-002     | Multi-Select Fields      | 5                       | Complete |
| US-FIELDS-SELECT-003     | Checkbox Fields          | 5                       | Complete |
| US-FIELDS-SELECT-004     | Status Fields            | 5                       | Complete |
| US-FIELDS-SPECIAL-001    | Email Fields             | 5                       | Complete |
| US-FIELDS-SPECIAL-002    | URL Fields               | 5                       | Complete |
| US-FIELDS-SPECIAL-003    | Phone Number Fields      | 5                       | Complete |
| US-FIELDS-SPECIAL-004    | Rating Fields            | 5                       | Complete |
| US-FIELDS-SPECIAL-005    | Progress Fields          | 5                       | Complete |
| US-FIELDS-SPECIAL-006    | Color Fields             | 5                       | Complete |
| US-FIELDS-SPECIAL-007    | Barcode Fields           | 5                       | Complete |
| US-FIELDS-SYSTEM-001     | Created At Fields        | 5                       | Complete |
| US-FIELDS-SYSTEM-002     | Updated At Fields        | 5                       | Complete |
| US-FIELDS-SYSTEM-003     | Deleted At Fields        | 5                       | Complete |
| US-FIELDS-SYSTEM-004     | Created By Fields        | 5                       | Complete |
| US-FIELDS-SYSTEM-005     | Updated By Fields        | 5                       | Complete |
| US-FIELDS-SYSTEM-006     | Deleted By Fields        | 5                       | Complete |
| US-FIELDS-SYSTEM-007     | Autonumber Fields        | 5                       | Complete |
| US-FIELDS-ADVANCED-001   | Formula Fields           | 125                     | Complete |
| US-FIELDS-ADVANCED-002   | JSON Fields              | 5                       | Complete |
| US-FIELDS-ADVANCED-003   | Array Fields             | 5                       | Complete |
| US-FIELDS-ADVANCED-004   | Geolocation Fields       | 5                       | Complete |
| US-FIELDS-ADVANCED-005   | User Fields              | 5                       | Complete |
| US-FIELDS-ADVANCED-006   | Button Fields            | 5                       | Complete |
| US-FIELDS-ATTACHMENT-001 | Single Attachment Fields | 5                       | Complete |
| US-FIELDS-ATTACHMENT-002 | Multiple Attachments     | 5                       | Complete |
| US-FIELDS-COMMON-001     | Required Property        | 4                       | Complete |
| US-FIELDS-COMMON-002     | Indexed Property         | 5                       | Complete |
| US-FIELDS-COMMON-003     | Unique Property          | 5                       | Complete |
| US-FIELDS-TIMEZONE-001   | Timezone Handling        | 10                      | Complete |
| **Total**                |                          | **~330 + 3 regression** |          |
