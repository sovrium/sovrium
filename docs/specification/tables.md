# Tables Specification

> Data modeling with fields, views, permissions, and relationships

## Overview

Tables define the data structure for Sovrium applications. They support 40+ field types, configurable views, granular permissions, and relationships between tables.

**Vision Alignment**: Tables enable Sovrium's Airtable-like data modeling through configuration, allowing complex data structures without custom database code.

## Schema Structure

**Location**: `src/domain/models/app/table/`

```
table/
├── id.ts                    # Table identifier
├── primary-key.ts           # Primary key configuration
├── field-name.ts            # Field naming validation
├── field-types/             # 40+ field type schemas
│   ├── single-line-text-field.ts
│   ├── long-text-field.ts
│   ├── ...
├── permissions/             # Access control
│   ├── permission.ts
│   ├── public.ts
│   ├── authenticated.ts
│   ├── owner.ts
│   └── field-permission.ts
└── views/                   # View configuration
    ├── index.ts
    ├── fields.ts
    ├── filters.ts
    ├── sorts.ts
    └── group-by.ts
```

---

## Field Types (40+)

### Text Fields

| Type               | Description              | Schema File                 |
| ------------------ | ------------------------ | --------------------------- |
| `single-line-text` | Short text input         | `single-line-text-field.ts` |
| `long-text`        | Multi-line text/textarea | `long-text-field.ts`        |
| `rich-text`        | HTML/Markdown editor     | `rich-text-field.ts`        |
| `email`            | Email address validation | `email-field.ts`            |
| `url`              | URL validation           | `url-field.ts`              |
| `phone-number`     | Phone number             | `phone-number-field.ts`     |

### Number Fields

| Type         | Description            | Schema File           |
| ------------ | ---------------------- | --------------------- |
| `integer`    | Whole numbers          | `integer-field.ts`    |
| `decimal`    | Floating-point numbers | `decimal-field.ts`    |
| `currency`   | Money with formatting  | `currency-field.ts`   |
| `percentage` | Percentage values      | `percentage-field.ts` |
| `rating`     | Star/number rating     | `rating-field.ts`     |
| `progress`   | Progress bar (0-100)   | `progress-field.ts`   |
| `duration`   | Time duration          | `duration-field.ts`   |

### Date/Time Fields

| Type         | Description             | Schema File           |
| ------------ | ----------------------- | --------------------- |
| `date`       | Date only               | `date-field.ts`       |
| `datetime`   | Date + time             | `datetime-field.ts`   |
| `time`       | Time only               | `time-field.ts`       |
| `created-at` | Auto timestamp (create) | `created-at-field.ts` |
| `updated-at` | Auto timestamp (update) | `updated-at-field.ts` |
| `deleted-at` | Soft delete timestamp   | `deleted-at-field.ts` |

### Selection Fields

| Type            | Description             | Schema File              |
| --------------- | ----------------------- | ------------------------ |
| `single-select` | Dropdown (one option)   | `single-select-field.ts` |
| `multi-select`  | Tags (multiple options) | `multi-select-field.ts`  |
| `checkbox`      | Boolean toggle          | `checkbox-field.ts`      |
| `status`        | Workflow status         | `status-field.ts`        |

### Relationship Fields

| Type           | Description               | Schema File             |
| -------------- | ------------------------- | ----------------------- |
| `relationship` | Foreign key               | `relationship-field.ts` |
| `lookup`       | Lookup from related table | `lookup-field.ts`       |
| `rollup`       | Aggregate from related    | `rollup-field.ts`       |
| `count`        | Count related records     | `count-field.ts`        |

### User Fields

| Type         | Description         | Schema File           |
| ------------ | ------------------- | --------------------- |
| `user`       | User reference      | `user-field.ts`       |
| `created-by` | Auto-assign creator | `created-by-field.ts` |
| `updated-by` | Auto-assign updater | `updated-by-field.ts` |
| `deleted-by` | Auto-assign deleter | `deleted-by-field.ts` |

### Media Fields

| Type                   | Description    | Schema File                     |
| ---------------------- | -------------- | ------------------------------- |
| `single-attachment`    | One file       | `single-attachment-field.ts`    |
| `multiple-attachments` | Multiple files | `multiple-attachments-field.ts` |

### Special Fields

| Type          | Description          | Schema File            |
| ------------- | -------------------- | ---------------------- |
| `autonumber`  | Auto-incrementing ID | `autonumber-field.ts`  |
| `formula`     | Calculated field     | `formula-field.ts`     |
| `button`      | Action button        | `button-field.ts`      |
| `barcode`     | Barcode/QR code      | `barcode-field.ts`     |
| `json`        | JSON data            | `json-field.ts`        |
| `color`       | Color picker         | `color-field.ts`       |
| `geolocation` | Lat/lng coordinates  | `geolocation-field.ts` |
| `array`       | Array of values      | `array-field.ts`       |

---

## Common Field Properties

Every field type shares these base properties:

| Property      | Type      | Required | Description           |
| ------------- | --------- | -------- | --------------------- |
| `type`        | `string`  | Yes      | Field type identifier |
| `name`        | `string`  | Yes      | Display name          |
| `required`    | `boolean` | No       | Validation constraint |
| `indexed`     | `boolean` | No       | Database index        |
| `unique`      | `boolean` | No       | Uniqueness constraint |
| `default`     | `any`     | No       | Default value         |
| `description` | `string`  | No       | Help text             |

---

## Views

**Location**: `src/domain/models/app/table/views/`

Views provide saved configurations for displaying table data.

### View Configuration

| Property  | Type       | Description                    |
| --------- | ---------- | ------------------------------ |
| `name`    | `string`   | View name                      |
| `fields`  | `string[]` | Visible fields (order matters) |
| `filters` | `Filter[]` | Filter conditions              |
| `sorts`   | `Sort[]`   | Sort order                     |
| `groupBy` | `string`   | Field to group by              |

### Filter Conditions

```yaml
views:
  - name: 'Active Tasks'
    filters:
      - field: 'status'
        operator: 'equals'
        value: 'active'
      - field: 'due-date'
        operator: 'is-before'
        value: 'today'
```

### Sort Configuration

```yaml
views:
  - name: 'Recent First'
    sorts:
      - field: 'created-at'
        direction: 'desc'
      - field: 'priority'
        direction: 'asc'
```

---

## Permissions

**Location**: `src/domain/models/app/table/permissions/`

### Permission Levels

| Level           | Schema             | Description                |
| --------------- | ------------------ | -------------------------- |
| `public`        | `public.ts`        | Anyone (no auth required)  |
| `authenticated` | `authenticated.ts` | Any logged-in user         |
| `owner`         | `owner.ts`         | Record creator only        |
| `role`          | `permission.ts`    | Role-based (admin, member) |

### CRUD Permissions

```yaml
tables:
  - name: 'tasks'
    permissions:
      public:
        read: true
        create: false
        update: false
        delete: false
      authenticated:
        read: true
        create: true
        update: true
        delete: false
      owner:
        delete: true
```

### Field-Level Permissions

**Location**: `src/domain/models/app/table/permissions/field-permission.ts`

```yaml
tables:
  - name: 'employees'
    fields:
      - name: 'salary'
        type: 'currency'
        permissions:
          read: ['admin', 'hr']
          write: ['admin']
```

---

## E2E Test Coverage

### Core Table Tests

| Spec File                                     | Tests | Status  | Description           |
| --------------------------------------------- | ----- | ------- | --------------------- |
| `specs/app/tables/tables.spec.ts`             | ~10   | 🟢 100% | Table definition      |
| `specs/app/tables/id.spec.ts`                 | ~5    | 🟢 100% | Table ID validation   |
| `specs/app/tables/name.spec.ts`               | ~5    | 🟢 100% | Table name validation |
| `specs/app/tables/fields.spec.ts`             | ~10   | 🟢 100% | Fields array          |
| `specs/app/tables/primary-key.spec.ts`        | ~5    | 🟢 100% | Primary key config    |
| `specs/app/tables/indexes.spec.ts`            | ~5    | 🟢 100% | Index definitions     |
| `specs/app/tables/unique-constraints.spec.ts` | ~5    | 🟢 100% | Unique constraints    |

### Field Type Tests (48 files)

| Category            | Files | Tests | Status  |
| ------------------- | ----- | ----- | ------- |
| Text fields         | 6     | ~40   | 🟢 100% |
| Number fields       | 7     | ~50   | 🟢 100% |
| Date/Time fields    | 7     | ~50   | 🟢 100% |
| Selection fields    | 4     | ~30   | 🟢 100% |
| Relationship fields | 4     | ~30   | 🟢 100% |
| User fields         | 4     | ~30   | 🟢 100% |
| Media fields        | 2     | ~15   | 🟢 100% |
| Special fields      | 11    | ~70   | 🟢 100% |
| Common properties   | 3     | ~20   | 🟢 100% |

### View Tests (6 files)

| Spec File                      | Tests | Status  |
| ------------------------------ | ----- | ------- |
| `views/views.spec.ts`          | ~10   | 🟢 100% |
| `views/view.spec.ts`           | ~5    | 🟢 100% |
| `views/view-fields.spec.ts`    | ~5    | 🟢 100% |
| `views/view-filters.spec.ts`   | ~10   | 🟢 100% |
| `views/view-group-by.spec.ts`  | ~5    | 🟢 100% |
| `views/view-condition.spec.ts` | ~5    | 🟢 100% |

### Permission Tests (5 files)

| Spec File                                | Tests | Status  |
| ---------------------------------------- | ----- | ------- |
| `permissions/permissions.spec.ts`        | ~10   | 🟢 100% |
| `permissions/table-permissions.spec.ts`  | ~10   | 🟢 100% |
| `permissions/record-permissions.spec.ts` | ~10   | 🟢 100% |
| `permissions/session-context.spec.ts`    | ~5    | 🟢 100% |
| `permissions/rls-enforcement.spec.ts`    | ~10   | 🟢 100% |

### Relationship Tests (1 file)

| Spec File                            | Tests | Status  |
| ------------------------------------ | ----- | ------- |
| `relationships/foreign-keys.spec.ts` | ~10   | 🟢 100% |

**Total**: 69 spec files, ~350 tests

---

## Implementation Status

**Overall**: 🟢 100%

| Category          | Status | Notes                          |
| ----------------- | ------ | ------------------------------ |
| Field types (40+) | ✅     | All types implemented          |
| Views             | ✅     | Full CRUD support              |
| Permissions       | ✅     | RBAC + RLS                     |
| Relationships     | ✅     | Foreign keys, lookups, rollups |
| Indexes           | ✅     | Single + composite             |
| Constraints       | ✅     | Unique, required, indexed      |

---

## Use Cases

### Example 1: Simple Task Table

```yaml
tables:
  - name: 'tasks'
    fields:
      - name: 'title'
        type: 'single-line-text'
        required: true
      - name: 'description'
        type: 'long-text'
      - name: 'status'
        type: 'single-select'
        options:
          - 'todo'
          - 'in-progress'
          - 'done'
      - name: 'due-date'
        type: 'date'
      - name: 'assignee'
        type: 'user'
      - name: 'created-at'
        type: 'created-at'
```

### Example 2: E-Commerce Products

```yaml
tables:
  - name: 'products'
    fields:
      - name: 'sku'
        type: 'single-line-text'
        required: true
        unique: true
        indexed: true
      - name: 'name'
        type: 'single-line-text'
        required: true
      - name: 'price'
        type: 'currency'
        options:
          currency: 'USD'
      - name: 'stock'
        type: 'integer'
        default: 0
      - name: 'images'
        type: 'multiple-attachments'
      - name: 'category'
        type: 'relationship'
        related-table: 'categories'
```

### Example 3: Table with Views and Permissions

```yaml
tables:
  - name: 'orders'
    permissions:
      authenticated:
        read: true
        create: true
      owner:
        update: true
        delete: true
    views:
      - name: 'My Orders'
        filters:
          - field: 'created-by'
            operator: 'is-current-user'
        sorts:
          - field: 'created-at'
            direction: 'desc'
      - name: 'Pending'
        filters:
          - field: 'status'
            operator: 'equals'
            value: 'pending'
```

---

## Related Features

- [API](./api.md) - REST endpoints for table CRUD
- [Migrations](./migrations.md) - Schema evolution for tables
- [Auth](./auth.md) - Authentication for permissions

## Related Documentation

- [Database Access Strategy](../architecture/patterns/database-access-strategy.md)
- [Drizzle ORM](../infrastructure/database/drizzle.md)
- [Authorization Patterns](../architecture/patterns/authorization-overview.md)
