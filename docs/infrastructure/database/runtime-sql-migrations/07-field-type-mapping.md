# Runtime SQL Migrations - Field Type Mapping

← [Previous: Checksum Optimization](06-checksum-optimization.md) | [Back to Navigation](01-start.md) | [Next: Effect Integration](08-effect-integration.md) →

---

## Purpose

This document is a **complete reference** for mapping all 30+ Sovrium field types to PostgreSQL column types, constraints, and indexes.

**Use this when**:

- Implementing SQL generator for a new field type
- Debugging unexpected PostgreSQL column types
- Understanding which fields create indexes
- Determining which fields are virtual (no column)

---

## Field Type Categories

Sovrium field types are organized into 8 categories:

1. **Text Fields** (5 types) - Single-line, long-text, email, URL, phone
2. **Numeric Fields** (5 types) - Integer, decimal, currency, percentage, rating
3. **Date/Time Fields** (4 types) - Date, datetime, created-time, modified-time
4. **Boolean Fields** (1 type) - Checkbox
5. **Selection Fields** (3 types) - Single-select, multi-select, color
6. **Relationship Fields** (5 types) - Linked-record, created-by, modified-by, many-to-many, lookup
7. **Rich Content Fields** (3 types) - Attachment, JSON, barcode
8. **Virtual Fields** (4 types) - Formula, rollup, button, AI-generated

---

## Complete Mapping Table

| #   | Sovrium Type       | PostgreSQL Type            | Constraints            | Auto-Index | Virtual | Notes                                |
| --- | ------------------ | -------------------------- | ---------------------- | ---------- | ------- | ------------------------------------ |
| 1   | `single-line-text` | `TEXT`                     | -                      | ❌         | ❌      | No length limit                      |
| 2   | `long-text`        | `TEXT`                     | -                      | ❌         | ❌      | Same as single-line (no varchar)     |
| 3   | `email`            | `TEXT`                     | `UNIQUE`               | ✅         | ❌      | Auto-indexed for lookups             |
| 4   | `url`              | `TEXT`                     | -                      | ❌         | ❌      | No validation at DB level            |
| 5   | `phone-number`     | `TEXT`                     | -                      | ❌         | ❌      | International formats vary           |
| 6   | `integer`          | `INTEGER`                  | -                      | ❌         | ❌      | 32-bit signed (-2B to +2B)           |
| 7   | `decimal`          | `NUMERIC(19, 4)`           | -                      | ❌         | ❌      | 19 digits total, 4 after decimal     |
| 8   | `currency`         | `NUMERIC(19, 4)`           | -                      | ❌         | ❌      | Same as decimal                      |
| 9   | `percentage`       | `NUMERIC(5, 2)`            | -                      | ❌         | ❌      | Max 100.99%                          |
| 10  | `rating`           | `INTEGER`                  | `CHECK (1-5)`          | ❌         | ❌      | Configurable min/max                 |
| 11  | `date`             | `TIMESTAMP WITH TIME ZONE` | -                      | ❌         | ❌      | Stores time as 00:00:00              |
| 12  | `datetime`         | `TIMESTAMP WITH TIME ZONE` | -                      | ❌         | ❌      | Full timestamp                       |
| 13  | `created-time`     | `TIMESTAMP WITH TIME ZONE` | `DEFAULT NOW()`        | ❌         | ❌      | Auto-populated on INSERT             |
| 14  | `modified-time`    | `TIMESTAMP WITH TIME ZONE` | `DEFAULT NOW()`        | ❌         | ❌      | Requires trigger to auto-update      |
| 15  | `checkbox`         | `BOOLEAN`                  | `DEFAULT false`        | ❌         | ❌      | true/false                           |
| 16  | `single-select`    | `TEXT`                     | `CHECK (IN options)`   | ✅         | ❌      | Enum-like with CHECK constraint      |
| 17  | `multi-select`     | `TEXT[]`                   | -                      | ❌         | ❌      | PostgreSQL array                     |
| 18  | `color`            | `TEXT`                     | `CHECK (regex)`        | ❌         | ❌      | Hex color code (#RRGGBB)             |
| 19  | `linked-record`    | `INTEGER`                  | `REFERENCES table(id)` | ✅         | ❌      | Foreign key                          |
| 20  | `created-by`       | `INTEGER`                  | `REFERENCES users(id)` | ❌         | ❌      | Auto-populated by app                |
| 21  | `modified-by`      | `INTEGER`                  | `REFERENCES users(id)` | ❌         | ❌      | Auto-populated by app                |
| 22  | `many-to-many`     | N/A (junction table)       | -                      | ✅         | ❌      | Creates separate table               |
| 23  | `lookup`           | N/A                        | -                      | ❌         | ✅      | Virtual (queries related record)     |
| 24  | `attachment`       | `TEXT[]`                   | -                      | ❌         | ❌      | Array of file URLs                   |
| 25  | `json`             | `JSONB`                    | -                      | ❌         | ❌      | Binary JSON (faster than JSON)       |
| 26  | `barcode`          | `TEXT`                     | -                      | ❌         | ❌      | QR code, barcode data                |
| 27  | `formula`          | N/A                        | -                      | ❌         | ✅      | Virtual (computed from other fields) |
| 28  | `rollup`           | N/A                        | -                      | ❌         | ✅      | Virtual (aggregation over related)   |
| 29  | `button`           | N/A                        | -                      | ❌         | ✅      | Virtual (UI action only)             |
| 30  | `ai-generated`     | `TEXT`                     | -                      | ❌         | ❌      | Stored result of AI generation       |

---

## Category 1: Text Fields

### `single-line-text`

**PostgreSQL Type**: `TEXT`

**Constraints**: None

**Example**:

```typescript
// Input
{ id: 1, name: 'title', type: 'single-line-text', required: true }

// Output SQL
"title" TEXT NOT NULL
```

**Why TEXT not VARCHAR?**

- PostgreSQL treats TEXT and VARCHAR identically (no performance difference)
- TEXT has no length limit (simpler, more flexible)
- Prevents arbitrary length limits (e.g., VARCHAR(255))

---

### `long-text`

**PostgreSQL Type**: `TEXT`

**Constraints**: None

**Example**:

```typescript
// Input
{ id: 2, name: 'description', type: 'long-text' }

// Output SQL
"description" TEXT
```

**Note**: Identical to `single-line-text` at database level. Distinction is UI-only (textarea vs input).

---

### `email`

**PostgreSQL Type**: `TEXT`

**Constraints**: `UNIQUE` (usually)

**Auto-Index**: ✅ Yes (for lookups)

**Example**:

```typescript
// Input
{ id: 3, name: 'email', type: 'email', required: true, unique: true }

// Output SQL
"email" TEXT NOT NULL UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_email ON "users"("email");
```

**Validation**: Performed at application layer (Effect Schema), not database.

---

### `url`

**PostgreSQL Type**: `TEXT`

**Constraints**: None

**Example**:

```typescript
// Input
{ id: 4, name: 'website', type: 'url' }

// Output SQL
"website" TEXT
```

**Validation**: Performed at application layer (URL format check), not database.

---

### `phone-number`

**PostgreSQL Type**: `TEXT`

**Constraints**: None

**Example**:

```typescript
// Input
{ id: 5, name: 'phone', type: 'phone-number' }

// Output SQL
"phone" TEXT
```

**Why TEXT?**: Phone number formats vary internationally (+1-555-1234, (555) 123-4567, etc.). TEXT allows flexibility.

---

## Category 2: Numeric Fields

### `integer`

**PostgreSQL Type**: `INTEGER`

**Constraints**: None

**Example**:

```typescript
// Input
{ id: 6, name: 'age', type: 'integer', required: true }

// Output SQL
"age" INTEGER NOT NULL
```

**Range**: -2,147,483,648 to +2,147,483,647 (32-bit signed)

**For larger values**: Use `BIGINT` (64-bit) if needed.

---

### `decimal`

**PostgreSQL Type**: `NUMERIC(19, 4)`

**Constraints**: None

**Example**:

```typescript
// Input
{ id: 7, name: 'price', type: 'decimal' }

// Output SQL
"price" NUMERIC(19, 4)
```

**Precision**:

- 19 total digits
- 4 digits after decimal point
- Max value: 999,999,999,999,999.9999

**Why NUMERIC?**: Exact precision (no floating-point rounding errors).

---

### `currency`

**PostgreSQL Type**: `NUMERIC(19, 4)`

**Constraints**: None

**Example**:

```typescript
// Input
{ id: 8, name: 'total', type: 'currency', required: true }

// Output SQL
"total" NUMERIC(19, 4) NOT NULL
```

**Note**: Identical to `decimal` at database level. Currency symbol stored separately in metadata.

---

### `percentage`

**PostgreSQL Type**: `NUMERIC(5, 2)`

**Constraints**: None

**Example**:

```typescript
// Input
{ id: 9, name: 'discount', type: 'percentage' }

// Output SQL
"discount" NUMERIC(5, 2)
```

**Precision**:

- 5 total digits
- 2 digits after decimal point
- Max value: 100.99%

**Storage**: Stored as decimal (e.g., 25.5 for 25.5%), not fraction (0.255).

---

### `rating`

**PostgreSQL Type**: `INTEGER`

**Constraints**: `CHECK (value >= min AND value <= max)`

**Example**:

```typescript
// Input
{ id: 10, name: 'stars', type: 'rating', min: 1, max: 5 }

// Output SQL
"stars" INTEGER CHECK ("stars" >= 1 AND "stars" <= 5)
```

**Configurable Range**: Defaults to 1-5, but can be customized (e.g., 1-10).

---

## Category 3: Date/Time Fields

### `date`

**PostgreSQL Type**: `TIMESTAMP WITH TIME ZONE`

**Constraints**: None

**Example**:

```typescript
// Input
{ id: 11, name: 'deadline', type: 'date' }

// Output SQL
"deadline" TIMESTAMP WITH TIME ZONE
```

**Storage**: Stores time as `00:00:00` (midnight). Application layer ensures time component is zero.

**Why TIMESTAMP?**: PostgreSQL's `DATE` type doesn't store timezone. Using TIMESTAMP WITH TIME ZONE for consistency.

---

### `datetime`

**PostgreSQL Type**: `TIMESTAMP WITH TIME ZONE`

**Constraints**: None

**Example**:

```typescript
// Input
{ id: 12, name: 'scheduled_at', type: 'datetime' }

// Output SQL
"scheduled_at" TIMESTAMP WITH TIME ZONE
```

**Storage**: Full timestamp with timezone (e.g., `2025-01-25 14:30:00+00`).

---

### `created-time`

**PostgreSQL Type**: `TIMESTAMP WITH TIME ZONE`

**Constraints**: `DEFAULT NOW()`

**Example**:

```typescript
// Input
{ id: 13, name: 'created_at', type: 'created-time' }

// Output SQL
"created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
```

**Behavior**: Auto-populated by PostgreSQL on INSERT.

---

### `modified-time`

**PostgreSQL Type**: `TIMESTAMP WITH TIME ZONE`

**Constraints**: `DEFAULT NOW()`

**Example**:

```typescript
// Input
{ id: 14, name: 'updated_at', type: 'modified-time' }

// Output SQL
"updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL

-- Requires trigger to auto-update on modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Behavior**: Requires PostgreSQL trigger to auto-update on every UPDATE.

---

## Category 4: Boolean Fields

### `checkbox`

**PostgreSQL Type**: `BOOLEAN`

**Constraints**: `DEFAULT false` (optional)

**Example**:

```typescript
// Input
{ id: 15, name: 'active', type: 'checkbox', required: true, default: true }

// Output SQL
"active" BOOLEAN NOT NULL DEFAULT true
```

**Values**: `true`, `false`, `NULL` (if not required).

---

## Category 5: Selection Fields

### `single-select`

**PostgreSQL Type**: `TEXT`

**Constraints**: `CHECK (value IN (...))`

**Auto-Index**: ✅ Yes (for filtering)

**Example**:

```typescript
// Input
{ id: 16, name: 'status', type: 'single-select', options: ['active', 'done', 'archived'] }

// Output SQL
"status" TEXT CHECK ("status" IN ('active', 'done', 'archived'));
CREATE INDEX IF NOT EXISTS idx_tasks_status ON "tasks"("status");
```

**Why not ENUM?**:

- PostgreSQL ENUMs are difficult to modify (ALTER TYPE limitations)
- TEXT + CHECK constraint is more flexible
- Allows adding/removing options without migrations

---

### `multi-select`

**PostgreSQL Type**: `TEXT[]`

**Constraints**: None

**Example**:

```typescript
// Input
{ id: 17, name: 'tags', type: 'multi-select', options: ['urgent', 'bug', 'feature'] }

// Output SQL
"tags" TEXT[]
```

**Storage**: PostgreSQL native array (e.g., `{urgent, bug}`).

**Querying**:

```sql
-- Find records with specific tag
SELECT * FROM tasks WHERE 'urgent' = ANY(tags);

-- Find records with all tags
SELECT * FROM tasks WHERE tags @> ARRAY['urgent', 'bug'];
```

---

### `color`

**PostgreSQL Type**: `TEXT`

**Constraints**: `CHECK (value ~ '^#[0-9A-Fa-f]{6}$')`

**Example**:

```typescript
// Input
{ id: 18, name: 'brand_color', type: 'color' }

// Output SQL
"brand_color" TEXT CHECK ("brand_color" ~ '^#[0-9A-Fa-f]{6}$')
```

**Format**: Hex color code (e.g., `#FF5733`).

---

## Category 6: Relationship Fields

### `linked-record`

**PostgreSQL Type**: `INTEGER`

**Constraints**: `REFERENCES linked_table(id)`

**Auto-Index**: ✅ Yes (for joins)

**Example**:

```typescript
// Input
{ id: 19, name: 'author', type: 'linked-record', linkedTable: 'users' }

// Output SQL
"author_id" INTEGER REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON "posts"("author_id");
```

**Column Name**: Appends `_id` suffix (e.g., `author` → `author_id`).

---

### `created-by`

**PostgreSQL Type**: `INTEGER`

**Constraints**: `REFERENCES users(id)`

**Example**:

```typescript
// Input
{ id: 20, name: 'created_by', type: 'created-by' }

// Output SQL
"created_by_id" INTEGER REFERENCES users(id)
```

**Behavior**: Auto-populated by application layer (current user).

---

### `modified-by`

**PostgreSQL Type**: `INTEGER`

**Constraints**: `REFERENCES users(id)`

**Example**:

```typescript
// Input
{ id: 21, name: 'modified_by', type: 'modified-by' }

// Output SQL
"modified_by_id" INTEGER REFERENCES users(id)
```

**Behavior**: Auto-updated by application layer on every UPDATE.

---

### `many-to-many`

**PostgreSQL Type**: Junction table

**Constraints**: Foreign keys on both sides

**Example**:

```typescript
// Input
{
  name: 'tasks',
  fields: [
    { id: 1, name: 'assignees', type: 'many-to-many', linkedTable: 'users' }
  ]
}

// Output SQL
CREATE TABLE IF NOT EXISTS task_assignees (
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_assignees_task_id ON task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user_id ON task_assignees(user_id);
```

**Note**: Creates separate junction table, no column in main table.

---

### `lookup`

**PostgreSQL Type**: N/A (virtual)

**Constraints**: None

**Example**:

```typescript
// Input
{ id: 22, name: 'project_name', type: 'lookup', linkedRecordField: 'project', lookupField: 'name' }

// Output SQL
-- No column created
```

**Behavior**: Computed at query time by joining to related table.

```sql
-- Query to fetch lookup value
SELECT tasks.*, projects.name AS project_name
FROM tasks
LEFT JOIN projects ON tasks.project_id = projects.id
```

**Why virtual?**: Lookup values change when related record changes. Storing them would require constant updates.

---

## Category 7: Rich Content Fields

### `attachment`

**PostgreSQL Type**: `TEXT[]`

**Constraints**: None

**Example**:

```typescript
// Input
{ id: 23, name: 'files', type: 'attachment' }

// Output SQL
"files" TEXT[]
```

**Storage**: Array of file URLs (e.g., `{https://cdn.example.com/file1.pdf, https://cdn.example.com/file2.jpg}`).

**Note**: Actual files stored externally (S3, CDN). Database stores URLs only.

---

### `json`

**PostgreSQL Type**: `JSONB`

**Constraints**: None

**Example**:

```typescript
// Input
{ id: 24, name: 'metadata', type: 'json' }

// Output SQL
"metadata" JSONB
```

**Why JSONB?**:

- Binary format (faster than TEXT JSON)
- Supports indexing (GIN indexes)
- Better query performance

**Querying**:

```sql
-- Extract field
SELECT metadata->>'key' FROM records;

-- Filter by field value
SELECT * FROM records WHERE metadata->>'status' = 'active';
```

---

### `barcode`

**PostgreSQL Type**: `TEXT`

**Constraints**: None

**Example**:

```typescript
// Input
{ id: 25, name: 'qr_code', type: 'barcode' }

// Output SQL
"qr_code" TEXT
```

**Storage**: QR code or barcode data as string (e.g., `SKU-12345`).

---

## Category 8: Virtual Fields

### `formula`

**PostgreSQL Type**: N/A (virtual)

**Constraints**: None

**Example**:

```typescript
// Input
{ id: 26, name: 'total', type: 'formula', formula: 'price * quantity' }

// Output SQL
-- No column created
```

**Behavior**: Computed at query time from other fields.

```sql
-- Query to fetch formula value
SELECT *, price * quantity AS total FROM items;
```

**Why virtual?**: Formula results change when input fields change. Storing them would require triggers to keep in sync.

---

### `rollup`

**PostgreSQL Type**: N/A (virtual)

**Constraints**: None

**Example**:

```typescript
// Input
{ id: 27, name: 'total_tasks', type: 'rollup', linkedRecordField: 'tasks', rollupField: 'id', aggregation: 'count' }

// Output SQL
-- No column created
```

**Behavior**: Aggregation over related records.

```sql
-- Query to fetch rollup value
SELECT projects.*, COUNT(tasks.id) AS total_tasks
FROM projects
LEFT JOIN tasks ON tasks.project_id = projects.id
GROUP BY projects.id;
```

**Why virtual?**: Rollup values change when related records are added/removed. Storing them would require complex triggers.

---

### `button`

**PostgreSQL Type**: N/A (virtual)

**Constraints**: None

**Example**:

```typescript
// Input
{ id: 28, name: 'send_email', type: 'button', action: 'trigger_workflow' }

// Output SQL
-- No column created
```

**Behavior**: UI action only (e.g., trigger API endpoint, run workflow). No data storage.

---

### `ai-generated`

**PostgreSQL Type**: `TEXT`

**Constraints**: None

**Example**:

```typescript
// Input
{ id: 29, name: 'summary', type: 'ai-generated', prompt: 'Summarize this record' }

// Output SQL
"summary" TEXT
```

**Behavior**: Stores result of AI generation. Re-generated on demand via application layer.

---

## Implementation: Field Type Mapper

```typescript
export const mapFieldTypeToPostgresType = (fieldType: string): string => {
  const typeMap: Record<string, string> = {
    // Text
    'single-line-text': 'TEXT',
    'long-text': 'TEXT',
    email: 'TEXT',
    url: 'TEXT',
    'phone-number': 'TEXT',

    // Numeric
    integer: 'INTEGER',
    decimal: 'NUMERIC(19, 4)',
    currency: 'NUMERIC(19, 4)',
    percentage: 'NUMERIC(5, 2)',
    rating: 'INTEGER',

    // Date/Time
    date: 'TIMESTAMP WITH TIME ZONE',
    datetime: 'TIMESTAMP WITH TIME ZONE',
    'created-time': 'TIMESTAMP WITH TIME ZONE',
    'modified-time': 'TIMESTAMP WITH TIME ZONE',

    // Boolean
    checkbox: 'BOOLEAN',

    // Selection
    'single-select': 'TEXT',
    'multi-select': 'TEXT[]',
    color: 'TEXT',

    // Relationships
    'linked-record': 'INTEGER',
    'created-by': 'INTEGER',
    'modified-by': 'INTEGER',

    // Rich Content
    attachment: 'TEXT[]',
    json: 'JSONB',
    barcode: 'TEXT',

    // AI
    'ai-generated': 'TEXT',
  }

  const postgresType = typeMap[fieldType]

  if (!postgresType) {
    throw new SqlGeneratorError({
      message: `Unknown field type: ${fieldType}`,
      field: fieldType,
    })
  }

  return postgresType
}
```

---

## Next Steps

- [Effect Integration](08-effect-integration.md) - Service composition patterns
- [Best Practices](09-best-practices.md) - Production deployment guide
- [SQL Generator](03-sql-generator.md) - How to use field type mappings

---

**Key Takeaway**: This is the definitive mapping reference. All 30+ field types are documented here. If you're implementing a new field type, add it to this table first, then update the `mapFieldTypeToPostgresType` function.
