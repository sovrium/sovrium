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

| ID     | Criterion                                    | E2E Spec                                |
| ------ | -------------------------------------------- | --------------------------------------- |
| AC-001 | Creates PostgreSQL VARCHAR(255) column       | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-001` |
| AC-002 | Enforces maximum length constraint           | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-002` |
| AC-003 | Stores and retrieves text correctly          | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-003` |
| AC-004 | Supports NOT NULL constraint when required   | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-004` |
| AC-005 | Supports UNIQUE constraint                   | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-005` |
| AC-006 | Supports DEFAULT value                       | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-006` |
| AC-007 | Supports btree index for performance         | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-007` |
| AC-008 | Trims whitespace on input                    | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-008` |
| AC-009 | Validates custom minLength constraint        | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-009` |
| AC-010 | Validates custom maxLength constraint        | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-010` |
| AC-011 | Supports pattern validation (regex)          | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-011` |
| AC-012 | Returns validation error for invalid pattern | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-012` |
| AC-013 | Supports case-insensitive search             | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-013` |
| AC-014 | Supports contains search                     | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-014` |
| AC-015 | Supports starts-with search                  | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-015` |
| AC-016 | Supports ends-with search                    | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-016` |
| AC-017 | Handles empty string correctly               | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-017` |
| AC-018 | Handles NULL correctly when optional         | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-018` |
| AC-019 | Supports sorting alphabetically              | `APP-TABLES-FIELD-SINGLE-LINE-TEXT-019` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/single-line-text.ts`
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

| ID     | Criterion                                  | E2E Spec                         |
| ------ | ------------------------------------------ | -------------------------------- |
| AC-001 | Creates PostgreSQL TEXT column             | `APP-TABLES-FIELD-LONG-TEXT-001` |
| AC-002 | Stores unlimited length text               | `APP-TABLES-FIELD-LONG-TEXT-002` |
| AC-003 | Supports NOT NULL constraint when required | `APP-TABLES-FIELD-LONG-TEXT-003` |
| AC-004 | Supports DEFAULT value                     | `APP-TABLES-FIELD-LONG-TEXT-004` |
| AC-005 | Supports btree index for performance       | `APP-TABLES-FIELD-LONG-TEXT-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/long-text.ts`
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

| ID     | Criterion                                  | E2E Spec                         |
| ------ | ------------------------------------------ | -------------------------------- |
| AC-001 | Creates PostgreSQL TEXT column             | `APP-TABLES-FIELD-RICH-TEXT-001` |
| AC-002 | Stores HTML/Markdown content               | `APP-TABLES-FIELD-RICH-TEXT-002` |
| AC-003 | Sanitizes HTML to prevent XSS              | `APP-TABLES-FIELD-RICH-TEXT-003` |
| AC-004 | Supports NOT NULL constraint when required | `APP-TABLES-FIELD-RICH-TEXT-004` |
| AC-005 | Supports DEFAULT value                     | `APP-TABLES-FIELD-RICH-TEXT-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/rich-text.ts`
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

| ID     | Criterion                                  | E2E Spec                             |
| ------ | ------------------------------------------ | ------------------------------------ |
| AC-001 | Creates PostgreSQL INTEGER column          | `APP-TABLES-FIELD-TYPES-INTEGER-001` |
| AC-002 | Enforces CHECK constraint for min value    | `APP-TABLES-FIELD-TYPES-INTEGER-002` |
| AC-003 | Enforces CHECK constraint for max value    | `APP-TABLES-FIELD-TYPES-INTEGER-003` |
| AC-004 | Supports NOT NULL constraint when required | `APP-TABLES-FIELD-TYPES-INTEGER-004` |
| AC-005 | Supports DEFAULT value                     | `APP-TABLES-FIELD-TYPES-INTEGER-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/integer.ts`
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
        precision: 10
        scale: 2
        min: 0
```

### Acceptance Criteria

| ID     | Criterion                                  | E2E Spec                             |
| ------ | ------------------------------------------ | ------------------------------------ |
| AC-001 | Creates PostgreSQL DECIMAL/NUMERIC column  | `APP-TABLES-FIELD-TYPES-DECIMAL-001` |
| AC-002 | Enforces CHECK constraint for min value    | `APP-TABLES-FIELD-TYPES-DECIMAL-002` |
| AC-003 | Enforces CHECK constraint for max value    | `APP-TABLES-FIELD-TYPES-DECIMAL-003` |
| AC-004 | Supports NOT NULL constraint when required | `APP-TABLES-FIELD-TYPES-DECIMAL-004` |
| AC-005 | Supports UNIQUE, DEFAULT, and btree index  | `APP-TABLES-FIELD-TYPES-DECIMAL-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/decimal.ts`
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

| ID     | Criterion                                  | E2E Spec                                |
| ------ | ------------------------------------------ | --------------------------------------- |
| AC-001 | Creates PostgreSQL DECIMAL column          | `APP-TABLES-FIELD-TYPES-PERCENTAGE-001` |
| AC-002 | Stores value as decimal (0-1 or 0-100)     | `APP-TABLES-FIELD-TYPES-PERCENTAGE-002` |
| AC-003 | Enforces CHECK constraint for range        | `APP-TABLES-FIELD-TYPES-PERCENTAGE-003` |
| AC-004 | Supports NOT NULL constraint when required | `APP-TABLES-FIELD-TYPES-PERCENTAGE-004` |
| AC-005 | Supports DEFAULT value                     | `APP-TABLES-FIELD-TYPES-PERCENTAGE-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/percentage.ts`
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
        precision: 10
        scale: 2
```

### Acceptance Criteria

| ID     | Criterion                                  | E2E Spec                              |
| ------ | ------------------------------------------ | ------------------------------------- |
| AC-001 | Creates PostgreSQL DECIMAL column          | `APP-TABLES-FIELD-TYPES-CURRENCY-001` |
| AC-002 | Stores currency code alongside value       | `APP-TABLES-FIELD-TYPES-CURRENCY-002` |
| AC-003 | Formats value according to currency locale | `APP-TABLES-FIELD-TYPES-CURRENCY-003` |
| AC-004 | Supports NOT NULL constraint when required | `APP-TABLES-FIELD-TYPES-CURRENCY-004` |
| AC-005 | Supports DEFAULT value                     | `APP-TABLES-FIELD-TYPES-CURRENCY-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/currency.ts`
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

| ID     | Criterion                                  | E2E Spec                              |
| ------ | ------------------------------------------ | ------------------------------------- |
| AC-001 | Creates PostgreSQL TIMESTAMPTZ column      | `APP-TABLES-FIELD-TYPES-DATETIME-001` |
| AC-002 | Stores timezone-aware timestamps           | `APP-TABLES-FIELD-TYPES-DATETIME-002` |
| AC-003 | Returns ISO 8601 format in API responses   | `APP-TABLES-FIELD-TYPES-DATETIME-003` |
| AC-004 | Supports NOT NULL constraint when required | `APP-TABLES-FIELD-TYPES-DATETIME-004` |
| AC-005 | Supports DEFAULT value and btree index     | `APP-TABLES-FIELD-TYPES-DATETIME-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/datetime.ts`
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

| ID     | Criterion                                  | E2E Spec                          |
| ------ | ------------------------------------------ | --------------------------------- |
| AC-001 | Creates PostgreSQL DATE column             | `APP-TABLES-FIELD-TYPES-DATE-001` |
| AC-002 | Stores date without time component         | `APP-TABLES-FIELD-TYPES-DATE-002` |
| AC-003 | Returns YYYY-MM-DD format in API responses | `APP-TABLES-FIELD-TYPES-DATE-003` |
| AC-004 | Supports NOT NULL constraint when required | `APP-TABLES-FIELD-TYPES-DATE-004` |
| AC-005 | Supports DEFAULT value and btree index     | `APP-TABLES-FIELD-TYPES-DATE-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/date.ts`
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

| ID     | Criterion                                  | E2E Spec                          |
| ------ | ------------------------------------------ | --------------------------------- |
| AC-001 | Creates PostgreSQL TIME column             | `APP-TABLES-FIELD-TYPES-TIME-001` |
| AC-002 | Stores time without date component         | `APP-TABLES-FIELD-TYPES-TIME-002` |
| AC-003 | Returns HH:MM:SS format in API responses   | `APP-TABLES-FIELD-TYPES-TIME-003` |
| AC-004 | Supports NOT NULL constraint when required | `APP-TABLES-FIELD-TYPES-TIME-004` |
| AC-005 | Supports DEFAULT value                     | `APP-TABLES-FIELD-TYPES-TIME-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/time.ts`
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

| ID     | Criterion                                  | E2E Spec                              |
| ------ | ------------------------------------------ | ------------------------------------- |
| AC-001 | Creates PostgreSQL INTERVAL column         | `APP-TABLES-FIELD-TYPES-DURATION-001` |
| AC-002 | Stores duration in specified format        | `APP-TABLES-FIELD-TYPES-DURATION-002` |
| AC-003 | Returns ISO 8601 duration format           | `APP-TABLES-FIELD-TYPES-DURATION-003` |
| AC-004 | Supports NOT NULL constraint when required | `APP-TABLES-FIELD-TYPES-DURATION-004` |
| AC-005 | Supports DEFAULT value                     | `APP-TABLES-FIELD-TYPES-DURATION-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/duration.ts`
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
          - { value: low, label: Low, color: '#10B981' }
          - { value: medium, label: Medium, color: '#F59E0B' }
          - { value: high, label: High, color: '#EF4444' }
        default: medium
```

### Acceptance Criteria

| ID     | Criterion                                   | E2E Spec                                   |
| ------ | ------------------------------------------- | ------------------------------------------ |
| AC-001 | Creates PostgreSQL VARCHAR column           | `APP-TABLES-FIELD-TYPES-SINGLE-SELECT-001` |
| AC-002 | Enforces CHECK constraint for valid options | `APP-TABLES-FIELD-TYPES-SINGLE-SELECT-002` |
| AC-003 | Returns option with label and color in API  | `APP-TABLES-FIELD-TYPES-SINGLE-SELECT-003` |
| AC-004 | Supports NOT NULL constraint when required  | `APP-TABLES-FIELD-TYPES-SINGLE-SELECT-004` |
| AC-005 | Supports DEFAULT value                      | `APP-TABLES-FIELD-TYPES-SINGLE-SELECT-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/single-select.ts`
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
          - { value: tech, label: Technology }
          - { value: news, label: News }
          - { value: tutorial, label: Tutorial }
```

### Acceptance Criteria

| ID     | Criterion                                 | E2E Spec                                  |
| ------ | ----------------------------------------- | ----------------------------------------- |
| AC-001 | Creates PostgreSQL JSONB array column     | `APP-TABLES-FIELD-TYPES-MULTI-SELECT-001` |
| AC-002 | Validates all values against options      | `APP-TABLES-FIELD-TYPES-MULTI-SELECT-002` |
| AC-003 | Returns array of options in API responses | `APP-TABLES-FIELD-TYPES-MULTI-SELECT-003` |
| AC-004 | Supports filtering by any selected value  | `APP-TABLES-FIELD-TYPES-MULTI-SELECT-004` |
| AC-005 | Supports DEFAULT value (array)            | `APP-TABLES-FIELD-TYPES-MULTI-SELECT-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/multi-select.ts`
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

| ID     | Criterion                                      | E2E Spec                              |
| ------ | ---------------------------------------------- | ------------------------------------- |
| AC-001 | Creates PostgreSQL BOOLEAN column              | `APP-TABLES-FIELD-TYPES-CHECKBOX-001` |
| AC-002 | Stores true/false values                       | `APP-TABLES-FIELD-TYPES-CHECKBOX-002` |
| AC-003 | Supports NOT NULL constraint (always required) | `APP-TABLES-FIELD-TYPES-CHECKBOX-003` |
| AC-004 | Supports DEFAULT value                         | `APP-TABLES-FIELD-TYPES-CHECKBOX-004` |
| AC-005 | Supports filtering by boolean value            | `APP-TABLES-FIELD-TYPES-CHECKBOX-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/checkbox.ts`
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
          - { value: pending, label: Pending, color: '#F59E0B' }
          - { value: processing, label: Processing, color: '#3B82F6' }
          - { value: shipped, label: Shipped, color: '#8B5CF6' }
          - { value: delivered, label: Delivered, color: '#10B981' }
          - { value: cancelled, label: Cancelled, color: '#EF4444' }
        default: pending
```

### Acceptance Criteria

| ID     | Criterion                                    | E2E Spec                            |
| ------ | -------------------------------------------- | ----------------------------------- |
| AC-001 | Creates PostgreSQL VARCHAR column            | `APP-TABLES-FIELD-TYPES-STATUS-001` |
| AC-002 | Enforces CHECK constraint for valid statuses | `APP-TABLES-FIELD-TYPES-STATUS-002` |
| AC-003 | Returns status with label and color          | `APP-TABLES-FIELD-TYPES-STATUS-003` |
| AC-004 | Supports status transition rules (optional)  | `APP-TABLES-FIELD-TYPES-STATUS-004` |
| AC-005 | Supports DEFAULT value                       | `APP-TABLES-FIELD-TYPES-STATUS-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/status.ts`
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

| ID     | Criterion                                  | E2E Spec                     |
| ------ | ------------------------------------------ | ---------------------------- |
| AC-001 | Creates PostgreSQL VARCHAR(255) column     | `APP-TABLES-FIELD-EMAIL-001` |
| AC-002 | Normalizes email to lowercase              | `APP-TABLES-FIELD-EMAIL-002` |
| AC-003 | Supports UNIQUE constraint                 | `APP-TABLES-FIELD-EMAIL-003` |
| AC-004 | Supports NOT NULL constraint when required | `APP-TABLES-FIELD-EMAIL-004` |
| AC-005 | Supports btree index for performance       | `APP-TABLES-FIELD-EMAIL-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/email.ts`
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

| ID     | Criterion                                  | E2E Spec                   |
| ------ | ------------------------------------------ | -------------------------- |
| AC-001 | Creates PostgreSQL TEXT column             | `APP-TABLES-FIELD-URL-001` |
| AC-002 | Validates URL format                       | `APP-TABLES-FIELD-URL-002` |
| AC-003 | Supports UNIQUE constraint                 | `APP-TABLES-FIELD-URL-003` |
| AC-004 | Supports NOT NULL constraint when required | `APP-TABLES-FIELD-URL-004` |
| AC-005 | Supports btree index for performance       | `APP-TABLES-FIELD-URL-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/url.ts`
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

| ID     | Criterion                                  | E2E Spec                            |
| ------ | ------------------------------------------ | ----------------------------------- |
| AC-001 | Creates PostgreSQL VARCHAR column          | `APP-TABLES-FIELD-PHONE-NUMBER-001` |
| AC-002 | Normalizes to E.164 format when configured | `APP-TABLES-FIELD-PHONE-NUMBER-002` |
| AC-003 | Validates phone number format              | `APP-TABLES-FIELD-PHONE-NUMBER-003` |
| AC-004 | Supports NOT NULL constraint when required | `APP-TABLES-FIELD-PHONE-NUMBER-004` |
| AC-005 | Supports UNIQUE constraint                 | `APP-TABLES-FIELD-PHONE-NUMBER-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/phone-number.ts`
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

| ID     | Criterion                                  | E2E Spec                            |
| ------ | ------------------------------------------ | ----------------------------------- |
| AC-001 | Creates PostgreSQL INTEGER column          | `APP-TABLES-FIELD-TYPES-RATING-001` |
| AC-002 | Enforces CHECK constraint for 1-max range  | `APP-TABLES-FIELD-TYPES-RATING-002` |
| AC-003 | Supports NOT NULL constraint when required | `APP-TABLES-FIELD-TYPES-RATING-003` |
| AC-004 | Supports DEFAULT value                     | `APP-TABLES-FIELD-TYPES-RATING-004` |
| AC-005 | Supports average calculation in views      | `APP-TABLES-FIELD-TYPES-RATING-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/rating.ts`
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

| ID     | Criterion                                 | E2E Spec                              |
| ------ | ----------------------------------------- | ------------------------------------- |
| AC-001 | Creates PostgreSQL INTEGER column         | `APP-TABLES-FIELD-TYPES-PROGRESS-001` |
| AC-002 | Enforces CHECK constraint for 0-100 range | `APP-TABLES-FIELD-TYPES-PROGRESS-002` |
| AC-003 | Supports NOT NULL constraint (default 0)  | `APP-TABLES-FIELD-TYPES-PROGRESS-003` |
| AC-004 | Supports DEFAULT value                    | `APP-TABLES-FIELD-TYPES-PROGRESS-004` |
| AC-005 | Returns as percentage in API responses    | `APP-TABLES-FIELD-TYPES-PROGRESS-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/progress.ts`
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

| ID     | Criterion                                  | E2E Spec                           |
| ------ | ------------------------------------------ | ---------------------------------- |
| AC-001 | Creates PostgreSQL VARCHAR(7) column       | `APP-TABLES-FIELD-TYPES-COLOR-001` |
| AC-002 | Validates hex color format (#RRGGBB)       | `APP-TABLES-FIELD-TYPES-COLOR-002` |
| AC-003 | Normalizes to uppercase hex                | `APP-TABLES-FIELD-TYPES-COLOR-003` |
| AC-004 | Supports NOT NULL constraint when required | `APP-TABLES-FIELD-TYPES-COLOR-004` |
| AC-005 | Supports DEFAULT value                     | `APP-TABLES-FIELD-TYPES-COLOR-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/color.ts`
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

| ID     | Criterion                                  | E2E Spec                             |
| ------ | ------------------------------------------ | ------------------------------------ |
| AC-001 | Creates PostgreSQL VARCHAR column          | `APP-TABLES-FIELD-TYPES-BARCODE-001` |
| AC-002 | Validates barcode format (checksum)        | `APP-TABLES-FIELD-TYPES-BARCODE-002` |
| AC-003 | Supports UNIQUE constraint                 | `APP-TABLES-FIELD-TYPES-BARCODE-003` |
| AC-004 | Supports NOT NULL constraint when required | `APP-TABLES-FIELD-TYPES-BARCODE-004` |
| AC-005 | Supports btree index for performance       | `APP-TABLES-FIELD-TYPES-BARCODE-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/barcode.ts`
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

| ID     | Criterion                                | E2E Spec                                |
| ------ | ---------------------------------------- | --------------------------------------- |
| AC-001 | Creates PostgreSQL TIMESTAMPTZ column    | `APP-TABLES-FIELD-TYPES-CREATED-AT-001` |
| AC-002 | Auto-populates on record creation        | `APP-TABLES-FIELD-TYPES-CREATED-AT-002` |
| AC-003 | Cannot be updated after creation         | `APP-TABLES-FIELD-TYPES-CREATED-AT-003` |
| AC-004 | Indexed by default for sorting           | `APP-TABLES-FIELD-TYPES-CREATED-AT-004` |
| AC-005 | Returns ISO 8601 format in API responses | `APP-TABLES-FIELD-TYPES-CREATED-AT-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/created-at.ts`
- **E2E Spec**: `specs/app/tables/field-types/created-at-field.spec.ts`

---

## US-FIELDS-SYSTEM-002: Updated At Fields

**As a** developer,
**I want to** automatic updated_at timestamps,
**so that** I can track when records were last modified.

### Acceptance Criteria

| ID     | Criterion                                   | E2E Spec                                |
| ------ | ------------------------------------------- | --------------------------------------- |
| AC-001 | Creates PostgreSQL TIMESTAMPTZ column       | `APP-TABLES-FIELD-TYPES-UPDATED-AT-001` |
| AC-002 | Auto-updates on every record modification   | `APP-TABLES-FIELD-TYPES-UPDATED-AT-002` |
| AC-003 | Set to same value as created_at on creation | `APP-TABLES-FIELD-TYPES-UPDATED-AT-003` |
| AC-004 | Indexed by default for sorting              | `APP-TABLES-FIELD-TYPES-UPDATED-AT-004` |
| AC-005 | Returns ISO 8601 format in API responses    | `APP-TABLES-FIELD-TYPES-UPDATED-AT-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/updated-at.ts`
- **E2E Spec**: `specs/app/tables/field-types/updated-at-field.spec.ts`

---

## US-FIELDS-SYSTEM-003: Deleted At Fields

**As a** developer,
**I want to** automatic deleted_at timestamps for soft delete,
**so that** I can implement trash and restore functionality.

### Acceptance Criteria

| ID     | Criterion                                   | E2E Spec                                |
| ------ | ------------------------------------------- | --------------------------------------- |
| AC-001 | Creates PostgreSQL TIMESTAMPTZ column       | `APP-TABLES-FIELD-TYPES-DELETED-AT-001` |
| AC-002 | NULL by default (not deleted)               | `APP-TABLES-FIELD-TYPES-DELETED-AT-002` |
| AC-003 | Set to current time on soft delete          | `APP-TABLES-FIELD-TYPES-DELETED-AT-003` |
| AC-004 | Cleared on restore                          | `APP-TABLES-FIELD-TYPES-DELETED-AT-004` |
| AC-005 | Records with deleted_at excluded by default | `APP-TABLES-FIELD-TYPES-DELETED-AT-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/deleted-at.ts`
- **E2E Spec**: `specs/app/tables/field-types/deleted-at-field.spec.ts`

---

## US-FIELDS-SYSTEM-004: Created By Fields

**As a** developer,
**I want to** track which user created each record,
**so that** I can implement audit trails and ownership.

### Acceptance Criteria

| ID     | Criterion                              | E2E Spec                                |
| ------ | -------------------------------------- | --------------------------------------- |
| AC-001 | Creates PostgreSQL INTEGER/UUID column | `APP-TABLES-FIELD-TYPES-CREATED-BY-001` |
| AC-002 | Auto-populates with current user ID    | `APP-TABLES-FIELD-TYPES-CREATED-BY-002` |
| AC-003 | Cannot be updated after creation       | `APP-TABLES-FIELD-TYPES-CREATED-BY-003` |
| AC-004 | References users table                 | `APP-TABLES-FIELD-TYPES-CREATED-BY-004` |
| AC-005 | Returns user object when expanded      | `APP-TABLES-FIELD-TYPES-CREATED-BY-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/created-by.ts`
- **E2E Spec**: `specs/app/tables/field-types/created-by-field.spec.ts`

---

## US-FIELDS-SYSTEM-005: Updated By Fields

**As a** developer,
**I want to** track which user last modified each record,
**so that** I can implement audit trails.

### Acceptance Criteria

| ID     | Criterion                                    | E2E Spec                                |
| ------ | -------------------------------------------- | --------------------------------------- |
| AC-001 | Creates PostgreSQL INTEGER/UUID column       | `APP-TABLES-FIELD-TYPES-UPDATED-BY-001` |
| AC-002 | Auto-updates with current user ID on changes | `APP-TABLES-FIELD-TYPES-UPDATED-BY-002` |
| AC-003 | Set to same value as created_by on creation  | `APP-TABLES-FIELD-TYPES-UPDATED-BY-003` |
| AC-004 | References users table                       | `APP-TABLES-FIELD-TYPES-UPDATED-BY-004` |
| AC-005 | Returns user object when expanded            | `APP-TABLES-FIELD-TYPES-UPDATED-BY-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/updated-by.ts`
- **E2E Spec**: `specs/app/tables/field-types/updated-by-field.spec.ts`

---

## US-FIELDS-SYSTEM-006: Deleted By Fields

**As a** developer,
**I want to** track which user deleted each record,
**so that** I can implement audit trails for deletions.

### Acceptance Criteria

| ID     | Criterion                              | E2E Spec                                |
| ------ | -------------------------------------- | --------------------------------------- |
| AC-001 | Creates PostgreSQL INTEGER/UUID column | `APP-TABLES-FIELD-TYPES-DELETED-BY-001` |
| AC-002 | NULL by default (not deleted)          | `APP-TABLES-FIELD-TYPES-DELETED-BY-002` |
| AC-003 | Set to deleting user ID on soft delete | `APP-TABLES-FIELD-TYPES-DELETED-BY-003` |
| AC-004 | Cleared on restore                     | `APP-TABLES-FIELD-TYPES-DELETED-BY-004` |
| AC-005 | References users table                 | `APP-TABLES-FIELD-TYPES-DELETED-BY-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/deleted-by.ts`
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
        startAt: 1000
```

### Acceptance Criteria

| ID     | Criterion                                  | E2E Spec                                |
| ------ | ------------------------------------------ | --------------------------------------- |
| AC-001 | Creates PostgreSQL SERIAL/BIGSERIAL column | `APP-TABLES-FIELD-TYPES-AUTONUMBER-001` |
| AC-002 | Auto-increments on each new record         | `APP-TABLES-FIELD-TYPES-AUTONUMBER-002` |
| AC-003 | Cannot be manually set or updated          | `APP-TABLES-FIELD-TYPES-AUTONUMBER-003` |
| AC-004 | Supports prefix and suffix formatting      | `APP-TABLES-FIELD-TYPES-AUTONUMBER-004` |
| AC-005 | Supports custom start value                | `APP-TABLES-FIELD-TYPES-AUTONUMBER-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/autonumber.ts`
- **E2E Spec**: `specs/app/tables/field-types/autonumber-field.spec.ts`

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

### Acceptance Criteria

| ID     | Criterion                                           | E2E Spec                             |
| ------ | --------------------------------------------------- | ------------------------------------ |
| AC-001 | Computes value based on formula expression          | `APP-TABLES-FIELD-TYPES-FORMULA-001` |
| AC-002 | Updates automatically when referenced fields change | `APP-TABLES-FIELD-TYPES-FORMULA-002` |
| AC-003 | Supports arithmetic operators (+, -, \*, /)         | `APP-TABLES-FIELD-TYPES-FORMULA-003` |
| AC-004 | Supports built-in functions (SUM, AVG, etc.)        | `APP-TABLES-FIELD-TYPES-FORMULA-004` |
| AC-005 | Cannot be manually set                              | `APP-TABLES-FIELD-TYPES-FORMULA-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/formula.ts`
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

| ID     | Criterion                                  | E2E Spec                          |
| ------ | ------------------------------------------ | --------------------------------- |
| AC-001 | Creates PostgreSQL JSONB column            | `APP-TABLES-FIELD-TYPES-JSON-001` |
| AC-002 | Validates JSON structure                   | `APP-TABLES-FIELD-TYPES-JSON-002` |
| AC-003 | Supports JSON path queries                 | `APP-TABLES-FIELD-TYPES-JSON-003` |
| AC-004 | Supports GIN index for performance         | `APP-TABLES-FIELD-TYPES-JSON-004` |
| AC-005 | Supports DEFAULT value (JSON object/array) | `APP-TABLES-FIELD-TYPES-JSON-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/json.ts`
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

| ID     | Criterion                            | E2E Spec                           |
| ------ | ------------------------------------ | ---------------------------------- |
| AC-001 | Creates PostgreSQL array column      | `APP-TABLES-FIELD-TYPES-ARRAY-001` |
| AC-002 | Validates array item types           | `APP-TABLES-FIELD-TYPES-ARRAY-002` |
| AC-003 | Supports array contains queries      | `APP-TABLES-FIELD-TYPES-ARRAY-003` |
| AC-004 | Supports GIN index for performance   | `APP-TABLES-FIELD-TYPES-ARRAY-004` |
| AC-005 | Supports DEFAULT value (empty array) | `APP-TABLES-FIELD-TYPES-ARRAY-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/array.ts`
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

| ID     | Criterion                                    | E2E Spec                                 |
| ------ | -------------------------------------------- | ---------------------------------------- |
| AC-001 | Creates PostgreSQL POINT or geography column | `APP-TABLES-FIELD-TYPES-GEOLOCATION-001` |
| AC-002 | Stores latitude and longitude                | `APP-TABLES-FIELD-TYPES-GEOLOCATION-002` |
| AC-003 | Validates coordinate ranges                  | `APP-TABLES-FIELD-TYPES-GEOLOCATION-003` |
| AC-004 | Supports distance queries (within radius)    | `APP-TABLES-FIELD-TYPES-GEOLOCATION-004` |
| AC-005 | Supports spatial index for performance       | `APP-TABLES-FIELD-TYPES-GEOLOCATION-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/geolocation.ts`
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

| ID     | Criterion                                       | E2E Spec                          |
| ------ | ----------------------------------------------- | --------------------------------- |
| AC-001 | References users table automatically            | `APP-TABLES-FIELD-TYPES-USER-001` |
| AC-002 | Validates user exists                           | `APP-TABLES-FIELD-TYPES-USER-002` |
| AC-003 | Returns user object when expanded               | `APP-TABLES-FIELD-TYPES-USER-003` |
| AC-004 | Supports multiple users when allowMultiple=true | `APP-TABLES-FIELD-TYPES-USER-004` |
| AC-005 | Supports filtering by current user              | `APP-TABLES-FIELD-TYPES-USER-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/user.ts`
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
        action: updateStatus
        actionParams:
          status: shipped
```

### Acceptance Criteria

| ID     | Criterion                               | E2E Spec                            |
| ------ | --------------------------------------- | ----------------------------------- |
| AC-001 | Does not create a database column       | `APP-TABLES-FIELD-TYPES-BUTTON-001` |
| AC-002 | Returns button configuration in API     | `APP-TABLES-FIELD-TYPES-BUTTON-002` |
| AC-003 | Triggers configured action when clicked | `APP-TABLES-FIELD-TYPES-BUTTON-003` |
| AC-004 | Respects user permissions for action    | `APP-TABLES-FIELD-TYPES-BUTTON-004` |
| AC-005 | Supports conditional visibility         | `APP-TABLES-FIELD-TYPES-BUTTON-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/button.ts`
- **E2E Spec**: `specs/app/tables/field-types/button-field.spec.ts`

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
        allowedTypes: ['pdf', 'doc', 'docx']
        maxSize: 10485760 # 10MB
```

### Acceptance Criteria

| ID     | Criterion                                    | E2E Spec                                       |
| ------ | -------------------------------------------- | ---------------------------------------------- |
| AC-001 | Creates PostgreSQL JSONB column for metadata | `APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-001` |
| AC-002 | Validates file type against allowedTypes     | `APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-002` |
| AC-003 | Validates file size against maxSize          | `APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-003` |
| AC-004 | Returns file URL and metadata in API         | `APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-004` |
| AC-005 | Deletes file when record is deleted          | `APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/single-attachment.ts`
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
        allowedTypes: ['jpg', 'png', 'gif', 'webp']
        maxSize: 5242880 # 5MB per file
        maxCount: 10
```

### Acceptance Criteria

| ID     | Criterion                                     | E2E Spec                                          |
| ------ | --------------------------------------------- | ------------------------------------------------- |
| AC-001 | Creates PostgreSQL JSONB array column         | `APP-TABLES-FIELD-TYPES-MULTIPLE-ATTACHMENTS-001` |
| AC-002 | Validates each file type against allowedTypes | `APP-TABLES-FIELD-TYPES-MULTIPLE-ATTACHMENTS-002` |
| AC-003 | Validates file count against maxCount         | `APP-TABLES-FIELD-TYPES-MULTIPLE-ATTACHMENTS-003` |
| AC-004 | Returns array of file URLs and metadata       | `APP-TABLES-FIELD-TYPES-MULTIPLE-ATTACHMENTS-004` |
| AC-005 | Supports reordering attachments               | `APP-TABLES-FIELD-TYPES-MULTIPLE-ATTACHMENTS-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/multiple-attachments.ts`
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

| ID     | Criterion                                  | E2E Spec                        |
| ------ | ------------------------------------------ | ------------------------------- |
| AC-001 | Creates PostgreSQL NOT NULL constraint     | `APP-TABLES-FIELD-REQUIRED-001` |
| AC-002 | Returns 400 when required field is missing | `APP-TABLES-FIELD-REQUIRED-002` |
| AC-003 | Returns 400 when required field is null    | `APP-TABLES-FIELD-REQUIRED-003` |
| AC-004 | Allows NULL for optional fields            | `APP-TABLES-FIELD-REQUIRED-004` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/common/required.ts`
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

| ID     | Criterion                                          | E2E Spec                       |
| ------ | -------------------------------------------------- | ------------------------------ |
| AC-001 | Creates PostgreSQL btree index                     | `APP-TABLES-FIELD-INDEXED-001` |
| AC-002 | Index name follows convention: idx*{table}*{field} | `APP-TABLES-FIELD-INDEXED-002` |
| AC-003 | Improves query performance for WHERE clauses       | `APP-TABLES-FIELD-INDEXED-003` |
| AC-004 | Improves query performance for JOIN operations     | `APP-TABLES-FIELD-INDEXED-004` |
| AC-005 | Improves query performance for ORDER BY            | `APP-TABLES-FIELD-INDEXED-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/common/indexed.ts`
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

| ID     | Criterion                                  | E2E Spec                      |
| ------ | ------------------------------------------ | ----------------------------- |
| AC-001 | Creates PostgreSQL UNIQUE constraint       | `APP-TABLES-FIELD-UNIQUE-001` |
| AC-002 | Automatically creates index                | `APP-TABLES-FIELD-UNIQUE-002` |
| AC-003 | Returns 400 on duplicate value             | `APP-TABLES-FIELD-UNIQUE-003` |
| AC-004 | Allows multiple NULL values (SQL standard) | `APP-TABLES-FIELD-UNIQUE-004` |
| AC-005 | Constraint name follows convention         | `APP-TABLES-FIELD-UNIQUE-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/common/unique.ts`
- **E2E Spec**: `specs/app/tables/field-types/common/unique.spec.ts`

---

## US-FIELDS-TIMEZONE-001: Timezone Handling

**As a** developer,
**I want to** handle timezones correctly for datetime fields,
**so that** users see times in their local timezone.

### Acceptance Criteria

| ID     | Criterion                                | E2E Spec                                 |
| ------ | ---------------------------------------- | ---------------------------------------- |
| AC-001 | Stores all times in UTC                  | `APP-TABLES-FIELD-TIMEZONE-HANDLING-001` |
| AC-002 | Accepts timezone-aware input (ISO 8601)  | `APP-TABLES-FIELD-TIMEZONE-HANDLING-002` |
| AC-003 | Converts to UTC on storage               | `APP-TABLES-FIELD-TIMEZONE-HANDLING-003` |
| AC-004 | Returns UTC times in API responses       | `APP-TABLES-FIELD-TIMEZONE-HANDLING-004` |
| AC-005 | Supports client-side timezone conversion | `APP-TABLES-FIELD-TIMEZONE-HANDLING-005` |

### Implementation References

- **Schema**: `src/domain/models/app/table/field-types/datetime.ts`
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
| US-FIELDS-ADVANCED-001   | Formula Fields           | 5                       | Complete |
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
| US-FIELDS-TIMEZONE-001   | Timezone Handling        | 5                       | Complete |
| **Total**                |                          | **~210 + 3 regression** |          |
