# Runtime SQL Migrations - SQL Generator

← [Previous: Overview](02-overview.md) | [Back to Navigation](01-start.md) | [Next: Migration Executor](04-migration-executor.md) →

---

## Purpose

The SQL Generator converts JSON table and field definitions into PostgreSQL `CREATE TABLE` DDL statements. It handles:

- Mapping 30+ Sovrium field types to PostgreSQL column types
- Generating constraints (UNIQUE, CHECK, NOT NULL, DEFAULT)
- Creating indexes automatically for performance
- Skipping virtual fields (formula, rollup, lookup)
- Handling relationships (foreign keys, junction tables)

**Location**: `src/infrastructure/database/sql-generator/`

---

## Core Function

```typescript
export const generateCreateTableSQL = (table: Table): Effect.Effect<string, SqlGeneratorError> =>
  Effect.gen(function* () {
    // 1. Generate column definitions
    const columns = table.fields
      .filter((field) => !isVirtualField(field.type)) // Skip formula, rollup, lookup
      .map((field) => generateColumnDefinition(field))
      .join(',\n  ')

    // 2. Build CREATE TABLE statement
    const sql = `
CREATE TABLE IF NOT EXISTS "${table.name}" (
  id SERIAL PRIMARY KEY,
  ${columns},
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
    `.trim()

    // 3. Generate auto-indexes for performance
    const indexes = generateAutoIndexes(table)

    return [sql, ...indexes].join('\n\n')
  })
```

---

## Column Definition Generation

### Basic Pattern

```typescript
function generateColumnDefinition(field: Field): string {
  const postgresType = mapFieldTypeToPostgresType(field.type)
  const nullable = field.required ? 'NOT NULL' : 'NULL'
  const unique = field.unique ? 'UNIQUE' : ''
  const defaultValue = field.default ? `DEFAULT ${formatDefault(field.default, field.type)}` : ''

  return `"${field.name}" ${postgresType} ${nullable} ${unique} ${defaultValue}`.trim()
}
```

### Examples

**Simple text field**:

```typescript
// Input
{ id: 1, name: 'name', type: 'single-line-text', required: true }

// Output
"name" TEXT NOT NULL
```

**Email field with unique constraint**:

```typescript
// Input
{ id: 2, name: 'email', type: 'email', required: true, unique: true }

// Output
"email" TEXT NOT NULL UNIQUE
```

**Boolean with default**:

```typescript
// Input
{ id: 3, name: 'active', type: 'checkbox', required: true, default: true }

// Output
"active" BOOLEAN NOT NULL DEFAULT true
```

**Single-select with CHECK constraint**:

```typescript
// Input
{ id: 4, name: 'status', type: 'single-select', options: ['active', 'done', 'archived'] }

// Output
"status" TEXT CHECK ("status" IN ('active', 'done', 'archived'))
```

---

## Field Type Mapping

### Text Fields

```typescript
function mapFieldTypeToPostgresType(fieldType: string): string {
  switch (fieldType) {
    case 'single-line-text':
    case 'long-text':
    case 'email':
    case 'url':
    case 'phone-number':
      return 'TEXT'

    // ... more mappings
  }
}
```

**Output Examples**:

| Sovrium Type       | PostgreSQL Type | Constraints                       |
| ------------------ | --------------- | --------------------------------- |
| `single-line-text` | TEXT            | None                              |
| `long-text`        | TEXT            | None                              |
| `email`            | TEXT            | Usually UNIQUE                    |
| `url`              | TEXT            | None                              |
| `phone-number`     | TEXT            | None (international formats vary) |

### Numeric Fields

```typescript
case 'integer':
  return 'INTEGER'
case 'decimal':
  return 'NUMERIC(19, 4)' // Precision: 19 digits, 4 after decimal
case 'currency':
  return 'NUMERIC(19, 4)' // Same as decimal (stores cents precisely)
case 'percentage':
  return 'NUMERIC(5, 2)' // Max 100.99%
case 'rating':
  return 'INTEGER' // Additional CHECK constraint added separately
```

**Output Examples**:

| Sovrium Type | PostgreSQL Type | Example SQL                                       |
| ------------ | --------------- | ------------------------------------------------- |
| `integer`    | INTEGER         | `age INTEGER`                                     |
| `decimal`    | NUMERIC(19,4)   | `price NUMERIC(19,4)`                             |
| `currency`   | NUMERIC(19,4)   | `amount NUMERIC(19,4)`                            |
| `percentage` | NUMERIC(5,2)    | `discount NUMERIC(5,2)`                           |
| `rating`     | INTEGER         | `stars INTEGER CHECK (stars >= 1 AND stars <= 5)` |

### Date/Time Fields

```typescript
case 'date':
case 'datetime':
case 'created-time':
case 'modified-time':
  return 'TIMESTAMP WITH TIME ZONE'
```

**Output Examples**:

| Sovrium Type    | PostgreSQL Type          | Example SQL                                         |
| --------------- | ------------------------ | --------------------------------------------------- |
| `date`          | TIMESTAMP WITH TIME ZONE | `deadline TIMESTAMP WITH TIME ZONE`                 |
| `datetime`      | TIMESTAMP WITH TIME ZONE | `scheduled_at TIMESTAMP WITH TIME ZONE`             |
| `created-time`  | TIMESTAMP WITH TIME ZONE | `created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()` |
| `modified-time` | TIMESTAMP WITH TIME ZONE | `updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()` |

### Boolean Fields

```typescript
case 'checkbox':
  return 'BOOLEAN'
```

**Output**: `active BOOLEAN NOT NULL DEFAULT true`

### Array Fields

```typescript
case 'multi-select':
case 'attachment':
  return 'TEXT[]' // PostgreSQL array type
```

**Output Examples**:

| Sovrium Type   | PostgreSQL Type | Example SQL                  |
| -------------- | --------------- | ---------------------------- |
| `multi-select` | TEXT[]          | `tags TEXT[]`                |
| `attachment`   | TEXT[]          | `files TEXT[]` (stores URLs) |

### JSON Fields

```typescript
case 'json':
  return 'JSONB' // Binary JSON for better performance
```

**Output**: `metadata JSONB`

### Relationship Fields

```typescript
case 'linked-record':
  // Foreign key to another table
  return 'INTEGER' // Actual FK constraint added separately

case 'created-by':
case 'modified-by':
  // Foreign key to users table
  return 'INTEGER'
```

**Output Examples**:

```sql
-- linked-record
author_id INTEGER REFERENCES users(id)

-- created-by / modified-by
created_by_id INTEGER REFERENCES users(id)
updated_by_id INTEGER REFERENCES users(id)
```

---

## Virtual Fields (No Columns)

### Fields That Skip Column Creation

```typescript
function isVirtualField(fieldType: string): boolean {
  return ['formula', 'rollup', 'lookup', 'button'].includes(fieldType)
}
```

**Why Virtual?**

- **formula**: Computed from other fields (e.g., `price * quantity`)
- **rollup**: Aggregation over related records (e.g., `COUNT(tasks)`)
- **lookup**: Value from related record (e.g., `project.name`)
- **button**: UI action, no data storage needed

**Implementation**: These fields are stored in metadata but don't create database columns. Application layer computes values at query time.

---

## Constraint Generation

### CHECK Constraints

**Single-select**:

```typescript
function generateCheckConstraint(field: Field): string | null {
  if (field.type === 'single-select' && field.options) {
    const values = field.options.map((opt) => `'${opt}'`).join(', ')
    return `CHECK ("${field.name}" IN (${values}))`
  }
  return null
}
```

**Output**:

```sql
"status" TEXT CHECK ("status" IN ('active', 'done', 'archived'))
```

**Rating**:

```typescript
if (field.type === 'rating') {
  const min = field.min || 1
  const max = field.max || 5
  return `CHECK ("${field.name}" >= ${min} AND "${field.name}" <= ${max})`
}
```

**Output**:

```sql
"stars" INTEGER CHECK ("stars" >= 1 AND "stars" <= 5)
```

### UNIQUE Constraints

Applied automatically for:

- `email` fields (usually unique)
- Fields with `unique: true` option

```typescript
const unique = field.unique || field.type === 'email' ? 'UNIQUE' : ''
```

### NOT NULL Constraints

```typescript
const nullable = field.required ? 'NOT NULL' : 'NULL'
```

### DEFAULT Values

```typescript
function formatDefault(value: unknown, fieldType: string): string {
  if (fieldType === 'checkbox') {
    return value ? 'true' : 'false'
  }
  if (typeof value === 'string') {
    return `'${value.replace(/'/g, "''")}'` // Escape single quotes
  }
  if (typeof value === 'number') {
    return String(value)
  }
  return 'NULL'
}
```

**Examples**:

```sql
-- Boolean default
active BOOLEAN DEFAULT true

-- String default
status TEXT DEFAULT 'pending'

-- Number default
priority INTEGER DEFAULT 0
```

---

## Auto-Index Generation

### When to Create Indexes

Automatically create B-tree indexes for:

1. **Email fields** (frequently queried)
2. **Foreign key columns** (join performance)
3. **Single-select fields** (filtering performance)
4. **Fields marked `indexed: true`**

```typescript
function generateAutoIndexes(table: Table): string[] {
  const indexes: string[] = []

  for (const field of table.fields) {
    if (shouldCreateIndex(field)) {
      const indexName = `idx_${table.name}_${field.name}`
      indexes.push(`CREATE INDEX IF NOT EXISTS ${indexName} ON "${table.name}"("${field.name}");`)
    }
  }

  return indexes
}

function shouldCreateIndex(field: Field): boolean {
  return (
    field.type === 'email' ||
    field.type === 'linked-record' ||
    field.type === 'single-select' ||
    field.indexed === true
  )
}
```

**Output Examples**:

```sql
CREATE INDEX IF NOT EXISTS idx_users_email ON "users"("email");
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON "posts"("author_id");
CREATE INDEX IF NOT EXISTS idx_tasks_status ON "tasks"("status");
```

---

## Foreign Key Generation

### Linked-Record Fields

```typescript
function generateForeignKeyConstraint(field: Field): string | null {
  if (field.type === 'linked-record' && field.linkedTable) {
    return `REFERENCES ${field.linkedTable}(id)`
  }
  return null
}
```

**Usage**:

```typescript
// Input
{ name: 'author', type: 'linked-record', linkedTable: 'users' }

// Output
author_id INTEGER REFERENCES users(id)
```

### Created-By / Modified-By

```typescript
if (field.type === 'created-by' || field.type === 'modified-by') {
  const colName = field.type === 'created-by' ? 'created_by_id' : 'updated_by_id'
  return `${colName} INTEGER REFERENCES users(id)`
}
```

**Output**:

```sql
created_by_id INTEGER REFERENCES users(id)
updated_by_id INTEGER REFERENCES users(id)
```

---

## Complete Example

### Input JSON

```json
{
  "id": 1,
  "name": "tasks",
  "fields": [
    { "id": 1, "name": "title", "type": "single-line-text", "required": true },
    { "id": 2, "name": "description", "type": "long-text" },
    { "id": 3, "name": "status", "type": "single-select", "options": ["todo", "doing", "done"] },
    { "id": 4, "name": "priority", "type": "rating", "min": 1, "max": 5 },
    { "id": 5, "name": "assignee", "type": "linked-record", "linkedTable": "users" },
    { "id": 6, "name": "completed", "type": "checkbox", "default": false },
    { "id": 7, "name": "total", "type": "formula", "formula": "price * quantity" }
  ]
}
```

### Generated SQL

```sql
CREATE TABLE IF NOT EXISTS "tasks" (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK ("status" IN ('todo', 'doing', 'done')),
  priority INTEGER CHECK ("priority" >= 1 AND "priority" <= 5),
  assignee_id INTEGER REFERENCES users(id),
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON "tasks"("status");
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON "tasks"("assignee_id");
```

**Note**: `total` field (formula type) was skipped — no column created.

---

## Error Handling

### Invalid Field Type

```typescript
function mapFieldTypeToPostgresType(fieldType: string): string {
  const typeMap: Record<string, string> = {
    /* ... all 30+ types ... */
  }

  const postgresType = typeMap[fieldType]

  if (!postgresType) {
    throw new SqlGeneratorError({
      message: `Unknown field type: ${fieldType}`,
      field: field.name,
    })
  }

  return postgresType
}
```

### Invalid Field Name

```typescript
function validateFieldName(name: string): void {
  // PostgreSQL reserved keywords
  const reserved = ['user', 'group', 'order', 'table', 'select', 'from']

  if (reserved.includes(name.toLowerCase())) {
    throw new SqlGeneratorError({
      message: `Field name "${name}" is a PostgreSQL reserved keyword`,
      suggestion: `Use "${name}_value" instead`,
    })
  }

  // Must start with letter or underscore
  if (!/^[a-zA-Z_]/.test(name)) {
    throw new SqlGeneratorError({
      message: `Field name must start with letter or underscore: ${name}`,
    })
  }
}
```

---

## Unit Testing Strategy

```typescript
import { describe, test, expect } from 'bun:test'

describe('generateColumnDefinition', () => {
  test('single-line-text field → TEXT NOT NULL', () => {
    const field = { name: 'title', type: 'single-line-text', required: true }
    const sql = generateColumnDefinition(field)
    expect(sql).toBe('"title" TEXT NOT NULL')
  })

  test('email field → TEXT NOT NULL UNIQUE', () => {
    const field = { name: 'email', type: 'email', required: true, unique: true }
    const sql = generateColumnDefinition(field)
    expect(sql).toBe('"email" TEXT NOT NULL UNIQUE')
  })

  test('checkbox with default → BOOLEAN DEFAULT true', () => {
    const field = { name: 'active', type: 'checkbox', required: true, default: true }
    const sql = generateColumnDefinition(field)
    expect(sql).toBe('"active" BOOLEAN NOT NULL DEFAULT true')
  })

  test('formula field → skipped (no column)', () => {
    const field = { name: 'total', type: 'formula', formula: 'price * quantity' }
    expect(isVirtualField(field.type)).toBe(true)
  })
})
```

---

## Next Steps

- [Migration Executor](04-migration-executor.md) - How generated SQL is executed
- [Field Type Mapping](07-field-type-mapping.md) - Complete reference for all 30+ types
- [Best Practices](09-best-practices.md) - SQL generation guidelines

---

**Key Takeaway**: The SQL Generator is pure transformation logic (JSON → SQL strings). It doesn't touch the database — that's the Migration Executor's job.
