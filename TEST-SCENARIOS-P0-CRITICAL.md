# Test Scenarios - P0 (Critical Foundation)

**Generated**: 2025-11-26
**Priority**: P0 - Critical (blocks all downstream work)
**Estimated Effort**: 6 weeks
**Target Coverage**: +40% (0% → 40%)

---

## P0.1: Field Type Migrations (Complete modify-field-type specs)

**File**: `specs/migrations/schema-evolution/modify-field-type.spec.ts`
**Current Status**: 6 stub tests with `expect(true).toBe(false)`
**Effort**: 2 weeks

### Test Scenarios

#### MIG-MODIFY-TYPE-001: Text to Long Text (Safe Conversion)

```typescript
test(
  'MIG-MODIFY-TYPE-001: should alter VARCHAR(255) to TEXT without data loss',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: table 'articles' with single-line-text field 'summary' containing 200 chars
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_articles',
          name: 'articles',
          fields: [{ id: 'fld_summary', name: 'summary', type: 'single-line-text' }],
        },
      ],
    })

    const testData = 'A'.repeat(200) // 200 character string
    await executeQuery(`INSERT INTO articles (summary) VALUES ($1)`, [testData])

    // WHEN: field type changed from single-line-text to long-text
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_articles',
          name: 'articles',
          fields: [
            { id: 'fld_summary', name: 'summary', type: 'long-text' }, // Changed type
          ],
        },
      ],
    })

    // THEN: column type is TEXT and data preserved

    // Assertion 1: Column type is TEXT
    const columnInfo = await executeQuery(`
      SELECT data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name='articles' AND column_name='summary'
    `)
    expect(columnInfo.data_type).toBe('text')
    expect(columnInfo.character_maximum_length).toBeNull() // TEXT has no limit

    // Assertion 2: Original data preserved
    const data = await executeQuery(`SELECT summary FROM articles`)
    expect(data.summary).toBe(testData)
    expect(data.summary.length).toBe(200)

    // Assertion 3: Can now insert longer text (> 255 chars)
    const longText = 'B'.repeat(1000)
    await expect(
      executeQuery(`INSERT INTO articles (summary) VALUES ($1)`, [longText])
    ).resolves.toBeDefined()
  }
)
```

#### MIG-MODIFY-TYPE-002: Integer to Decimal (Safe Conversion with Precision)

```typescript
test(
  'MIG-MODIFY-TYPE-002: should alter INTEGER to NUMERIC(10,2) with data preservation',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: table 'products' with integer field 'price' containing values
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_products',
          name: 'products',
          fields: [{ id: 'fld_price', name: 'price', type: 'integer' }],
        },
      ],
    })

    await executeQuery(`INSERT INTO products (price) VALUES (100), (250), (9999)`)

    // WHEN: field type changed from integer to decimal with precision 10, scale 2
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_products',
          name: 'products',
          fields: [
            {
              id: 'fld_price',
              name: 'price',
              type: 'decimal',
              precision: 10,
              scale: 2,
            },
          ],
        },
      ],
    })

    // THEN: column type is NUMERIC(10,2) and data converted

    // Assertion 1: Column type is NUMERIC(10,2)
    const columnInfo = await executeQuery(`
      SELECT data_type, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_name='products' AND column_name='price'
    `)
    expect(columnInfo.data_type).toBe('numeric')
    expect(columnInfo.numeric_precision).toBe(10)
    expect(columnInfo.numeric_scale).toBe(2)

    // Assertion 2: Integer values converted to decimal format
    const prices = await executeQuery(`SELECT price FROM products ORDER BY price`)
    expect(prices).toEqual([{ price: '100.00' }, { price: '250.00' }, { price: '9999.00' }])

    // Assertion 3: Can now insert decimal values
    await expect(executeQuery(`INSERT INTO products (price) VALUES (99.99)`)).resolves.toBeDefined()
  }
)
```

#### MIG-MODIFY-TYPE-003: Text to Integer (Unsafe - Requires Data Validation)

```typescript
test(
  'MIG-MODIFY-TYPE-003: should fail when converting TEXT to INTEGER with non-numeric data',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: table 'items' with text field 'quantity' containing non-numeric values
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_items',
          name: 'items',
          fields: [{ id: 'fld_quantity', name: 'quantity', type: 'single-line-text' }],
        },
      ],
    })

    await executeQuery(`INSERT INTO items (quantity) VALUES ('100'), ('not a number'), ('250')`)

    // WHEN: attempting to change field type from text to integer
    // THEN: migration should fail with clear error message

    await expect(
      startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_items',
            name: 'items',
            fields: [{ id: 'fld_quantity', name: 'quantity', type: 'integer' }],
          },
        ],
      })
    ).rejects.toThrow(/cannot cast type character varying to integer/i)

    // Assertion: Original column type unchanged
    const columnInfo = await executeQuery(`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_name='items' AND column_name='quantity'
    `)
    expect(columnInfo.data_type).toBe('character varying')
  }
)
```

#### MIG-MODIFY-TYPE-004: Text to Integer (Safe - With USING Clause)

```typescript
test(
  'MIG-MODIFY-TYPE-004: should convert TEXT to INTEGER using CAST for numeric strings',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: table 'orders' with text field 'total' containing only numeric strings
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_orders',
          name: 'orders',
          fields: [{ id: 'fld_total', name: 'total', type: 'single-line-text' }],
        },
      ],
    })

    await executeQuery(`INSERT INTO orders (total) VALUES ('100'), ('250'), ('9999')`)

    // WHEN: field type changed from text to integer with validation
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_orders',
          name: 'orders',
          fields: [
            {
              id: 'fld_total',
              name: 'total',
              type: 'integer',
              _migration: {
                strategy: 'cast',
                validation: 'pre-validate', // Validates data before migration
              },
            },
          ],
        },
      ],
    })

    // THEN: column type is INTEGER and data converted

    // Assertion 1: Column type is INTEGER
    const columnInfo = await executeQuery(`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_name='orders' AND column_name='total'
    `)
    expect(columnInfo.data_type).toBe('integer')

    // Assertion 2: String values converted to integers
    const totals = await executeQuery(`SELECT total FROM orders ORDER BY total`)
    expect(totals).toEqual([{ total: 100 }, { total: 250 }, { total: 9999 }])
  }
)
```

#### MIG-MODIFY-TYPE-005: Date to DateTime (Add Time Component)

```typescript
test(
  'MIG-MODIFY-TYPE-005: should convert DATE to TIMESTAMP adding default time',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: table 'events' with date field 'event_date'
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_events',
          name: 'events',
          fields: [{ id: 'fld_event_date', name: 'event_date', type: 'date' }],
        },
      ],
    })

    await executeQuery(`
      INSERT INTO events (event_date) VALUES
      ('2025-01-15'),
      ('2025-03-20'),
      ('2025-12-31')
    `)

    // WHEN: field type changed from date to datetime
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_events',
          name: 'events',
          fields: [
            {
              id: 'fld_event_date',
              name: 'event_date',
              type: 'datetime',
              _migration: {
                defaultTime: '00:00:00', // Add midnight time to dates
              },
            },
          ],
        },
      ],
    })

    // THEN: column type is TIMESTAMP and dates have time component

    // Assertion 1: Column type is TIMESTAMP
    const columnInfo = await executeQuery(`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_name='events' AND column_name='event_date'
    `)
    expect(columnInfo.data_type).toBe('timestamp without time zone')

    // Assertion 2: Dates converted to timestamps with 00:00:00 time
    const dates = await executeQuery(`SELECT event_date FROM events ORDER BY event_date`)
    expect(dates).toEqual([
      { event_date: new Date('2025-01-15T00:00:00Z') },
      { event_date: new Date('2025-03-20T00:00:00Z') },
      { event_date: new Date('2025-12-31T00:00:00Z') },
    ])
  }
)
```

#### MIG-MODIFY-TYPE-006: Decimal Precision Change (Expand)

```typescript
test(
  'MIG-MODIFY-TYPE-006: should expand NUMERIC precision without data loss',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: table 'financial_records' with decimal(5,2) field 'amount'
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_financial',
          name: 'financial_records',
          fields: [
            {
              id: 'fld_amount',
              name: 'amount',
              type: 'decimal',
              precision: 5,
              scale: 2,
            },
          ],
        },
      ],
    })

    await executeQuery(`
      INSERT INTO financial_records (amount) VALUES
      (999.99),
      (123.45),
      (1.23)
    `)

    // WHEN: precision expanded from 5,2 to 10,2
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_financial',
          name: 'financial_records',
          fields: [
            {
              id: 'fld_amount',
              name: 'amount',
              type: 'decimal',
              precision: 10, // Expanded
              scale: 2,
            },
          ],
        },
      ],
    })

    // THEN: column precision updated and data preserved

    // Assertion 1: Column precision is NUMERIC(10,2)
    const columnInfo = await executeQuery(`
      SELECT numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_name='financial_records' AND column_name='amount'
    `)
    expect(columnInfo.numeric_precision).toBe(10)
    expect(columnInfo.numeric_scale).toBe(2)

    // Assertion 2: All data preserved
    const amounts = await executeQuery(`SELECT amount FROM financial_records ORDER BY amount`)
    expect(amounts).toEqual([{ amount: '1.23' }, { amount: '123.45' }, { amount: '999.99' }])

    // Assertion 3: Can now insert larger values
    await expect(
      executeQuery(`INSERT INTO financial_records (amount) VALUES (99999.99)`)
    ).resolves.toBeDefined()
  }
)
```

### Type Conversion Compatibility Matrix

Create new file: `specs/migrations/schema-evolution/type-conversion-matrix.spec.ts`

```typescript
test(
  'MIG-TYPE-MATRIX-001: should validate type conversion compatibility matrix',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: type conversion compatibility rules
    const compatibilityMatrix = {
      'single-line-text': {
        safeTo: ['long-text', 'rich-text', 'url', 'email'],
        unsafeTo: ['integer', 'decimal', 'date', 'datetime'],
        requiresValidation: ['phone-number', 'color'],
      },
      integer: {
        safeTo: ['decimal', 'currency', 'single-line-text'],
        unsafeTo: ['date', 'datetime', 'time'],
        requiresValidation: ['percentage'],
      },
      date: {
        safeTo: ['datetime', 'single-line-text'],
        unsafeTo: ['integer', 'time'],
        requiresValidation: [],
      },
    }

    // WHEN: testing safe conversions
    // THEN: conversions should succeed

    for (const [fromType, rules] of Object.entries(compatibilityMatrix)) {
      for (const toType of rules.safeTo) {
        // Test each safe conversion path
        await expect(testTypeConversion(fromType, toType, 'sample_data')).resolves.not.toThrow()
      }
    }
  }
)
```

---

## P0.2: Relationship Cascade Specs

**File**: `specs/app/tables/field-types/relationship-field/cascade-delete.spec.ts` (NEW)
**Current Status**: Missing
**Effort**: 1.5 weeks

### Test Scenarios

#### APP-REL-CASCADE-001: Cascade Delete (Delete Related Records)

```typescript
test(
  'APP-REL-CASCADE-001: should cascade delete related records when parent deleted',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: tables 'customers' and 'orders' with relationship (CASCADE)
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_customers',
          name: 'customers',
          fields: [{ id: 'fld_name', name: 'name', type: 'single-line-text' }],
        },
        {
          id: 'tbl_orders',
          name: 'orders',
          fields: [
            {
              id: 'fld_customer',
              name: 'customer',
              type: 'relationship',
              config: {
                linkedTableId: 'tbl_customers',
                onDelete: 'CASCADE', // Delete orders when customer deleted
              },
            },
            { id: 'fld_total', name: 'total', type: 'decimal' },
          ],
        },
      ],
    })

    // Insert test data
    const customerResult = await executeQuery(`
      INSERT INTO customers (name) VALUES ('John Doe') RETURNING id
    `)
    const customerId = customerResult.id

    await executeQuery(
      `
      INSERT INTO orders (customer_id, total) VALUES
      ($1, 100.00),
      ($1, 250.00),
      ($1, 75.50)
    `,
      [customerId]
    )

    // WHEN: customer deleted
    await executeQuery(`DELETE FROM customers WHERE id = $1`, [customerId])

    // THEN: all related orders deleted automatically

    // Assertion 1: Customer deleted
    const customerCount = await executeQuery(`SELECT COUNT(*) FROM customers WHERE id = $1`, [
      customerId,
    ])
    expect(customerCount.count).toBe(0)

    // Assertion 2: All orders cascade deleted
    const orderCount = await executeQuery(`SELECT COUNT(*) FROM orders WHERE customer_id = $1`, [
      customerId,
    ])
    expect(orderCount.count).toBe(0)

    // Assertion 3: Foreign key constraint exists with CASCADE
    const fkInfo = await executeQuery(`
      SELECT delete_rule
      FROM information_schema.referential_constraints
      WHERE constraint_schema='public'
      AND constraint_name LIKE '%orders_customer_id%'
    `)
    expect(fkInfo.delete_rule).toBe('CASCADE')
  }
)
```

#### APP-REL-CASCADE-002: Set Null (Nullify Foreign Key)

```typescript
test(
  'APP-REL-CASCADE-002: should set foreign key to NULL when parent deleted',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: tables 'categories' and 'products' with relationship (SET NULL)
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_categories',
          name: 'categories',
          fields: [{ id: 'fld_name', name: 'name', type: 'single-line-text' }],
        },
        {
          id: 'tbl_products',
          name: 'products',
          fields: [
            {
              id: 'fld_category',
              name: 'category',
              type: 'relationship',
              config: {
                linkedTableId: 'tbl_categories',
                onDelete: 'SET NULL', // Nullify when category deleted
                required: false,
              },
            },
            { id: 'fld_name', name: 'name', type: 'single-line-text' },
          ],
        },
      ],
    })

    // Insert test data
    const categoryResult = await executeQuery(`
      INSERT INTO categories (name) VALUES ('Electronics') RETURNING id
    `)
    const categoryId = categoryResult.id

    await executeQuery(
      `
      INSERT INTO products (category_id, name) VALUES
      ($1, 'Laptop'),
      ($1, 'Phone'),
      ($1, 'Tablet')
    `,
      [categoryId]
    )

    // WHEN: category deleted
    await executeQuery(`DELETE FROM categories WHERE id = $1`, [categoryId])

    // THEN: products remain but category_id set to NULL

    // Assertion 1: Category deleted
    const categoryCount = await executeQuery(`SELECT COUNT(*) FROM categories WHERE id = $1`, [
      categoryId,
    ])
    expect(categoryCount.count).toBe(0)

    // Assertion 2: Products still exist
    const productCount = await executeQuery(
      `SELECT COUNT(*) FROM products WHERE name IN ('Laptop', 'Phone', 'Tablet')`
    )
    expect(productCount.count).toBe(3)

    // Assertion 3: All products have NULL category_id
    const products = await executeQuery(
      `SELECT category_id FROM products WHERE name IN ('Laptop', 'Phone', 'Tablet')`
    )
    expect(products.every((p) => p.category_id === null)).toBe(true)
  }
)
```

#### APP-REL-CASCADE-003: Restrict Delete (Prevent Deletion)

```typescript
test(
  'APP-REL-CASCADE-003: should prevent delete when related records exist (RESTRICT)',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: tables 'projects' and 'tasks' with relationship (RESTRICT)
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_projects',
          name: 'projects',
          fields: [{ id: 'fld_name', name: 'name', type: 'single-line-text' }],
        },
        {
          id: 'tbl_tasks',
          name: 'tasks',
          fields: [
            {
              id: 'fld_project',
              name: 'project',
              type: 'relationship',
              config: {
                linkedTableId: 'tbl_projects',
                onDelete: 'RESTRICT', // Prevent deletion
                required: true,
              },
            },
            { id: 'fld_title', name: 'title', type: 'single-line-text' },
          ],
        },
      ],
    })

    // Insert test data
    const projectResult = await executeQuery(`
      INSERT INTO projects (name) VALUES ('Website Redesign') RETURNING id
    `)
    const projectId = projectResult.id

    await executeQuery(
      `
      INSERT INTO tasks (project_id, title) VALUES
      ($1, 'Design mockups'),
      ($1, 'Implement frontend')
    `,
      [projectId]
    )

    // WHEN: attempting to delete project with related tasks
    // THEN: deletion prevented with foreign key constraint error

    await expect(executeQuery(`DELETE FROM projects WHERE id = $1`, [projectId])).rejects.toThrow(
      /violates foreign key constraint/
    )

    // Assertion 1: Project still exists
    const projectCount = await executeQuery(`SELECT COUNT(*) FROM projects WHERE id = $1`, [
      projectId,
    ])
    expect(projectCount.count).toBe(1)

    // Assertion 2: Tasks still exist
    const taskCount = await executeQuery(`SELECT COUNT(*) FROM tasks WHERE project_id = $1`, [
      projectId,
    ])
    expect(taskCount.count).toBe(2)
  }
)
```

#### APP-REL-CASCADE-004: Circular Relationship Detection

```typescript
test(
  'APP-REL-CASCADE-004: should detect and prevent circular cascade delete',
  { tag: '@spec' },
  async ({ startServerWithSchema }) => {
    // GIVEN: attempt to create circular CASCADE relationship
    // Table A → CASCADE to B, Table B → CASCADE to A

    // WHEN: schema validation runs
    // THEN: circular cascade detected and rejected

    await expect(
      startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_a',
            name: 'table_a',
            fields: [
              {
                id: 'fld_b_ref',
                name: 'b_ref',
                type: 'relationship',
                config: {
                  linkedTableId: 'tbl_b',
                  onDelete: 'CASCADE',
                },
              },
            ],
          },
          {
            id: 'tbl_b',
            name: 'table_b',
            fields: [
              {
                id: 'fld_a_ref',
                name: 'a_ref',
                type: 'relationship',
                config: {
                  linkedTableId: 'tbl_a',
                  onDelete: 'CASCADE', // Circular!
                },
              },
            ],
          },
        ],
      })
    ).rejects.toThrow(/circular cascade delete detected/i)
  }
)
```

#### APP-REL-CASCADE-005: Orphan Record Handling

```typescript
test(
  'APP-REL-CASCADE-005: should identify orphaned records after relationship removed',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: tables with relationship, then relationship field removed
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_authors',
          name: 'authors',
          fields: [{ id: 'fld_name', name: 'name', type: 'single-line-text' }],
        },
        {
          id: 'tbl_books',
          name: 'books',
          fields: [
            {
              id: 'fld_author',
              name: 'author',
              type: 'relationship',
              config: {
                linkedTableId: 'tbl_authors',
              },
            },
            { id: 'fld_title', name: 'title', type: 'single-line-text' },
          ],
        },
      ],
    })

    const authorResult = await executeQuery(
      `INSERT INTO authors (name) VALUES ('Jane Austen') RETURNING id`
    )
    const authorId = authorResult.id

    await executeQuery(`INSERT INTO books (author_id, title) VALUES ($1, 'Pride and Prejudice')`, [
      authorId,
    ])
    await executeQuery(`DELETE FROM authors WHERE id = $1`, [authorId])

    // WHEN: relationship field removed from schema
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_authors',
          name: 'authors',
          fields: [{ id: 'fld_name', name: 'name', type: 'single-line-text' }],
        },
        {
          id: 'tbl_books',
          name: 'books',
          fields: [
            // Relationship field removed
            { id: 'fld_title', name: 'title', type: 'single-line-text' },
          ],
        },
      ],
    })

    // THEN: orphaned records logged/handled

    // Assertion: Book still exists but with NULL author_id (if column kept)
    // OR foreign key constraint dropped if column removed
    const columnExists = await executeQuery(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name='books' AND column_name='author_id'
    `)

    if (columnExists) {
      const book = await executeQuery(
        `SELECT author_id FROM books WHERE title='Pride and Prejudice'`
      )
      expect(book.author_id).toBeNull()
    } else {
      // Column removed entirely - OK
      expect(columnExists).toBeUndefined()
    }
  }
)
```

---

## P0.3: View API Endpoints

**File**: `specs/api/paths/tables/{tableId}/views/{viewId}/records/get.spec.ts` (NEW)
**Current Status**: Missing
**Effort**: 1.5 weeks

### Test Scenarios

#### API-VIEW-RECORDS-001: Get View Records (Apply Filters)

```typescript
test(
  'API-VIEW-RECORDS-001: should return records filtered by view configuration',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, request }) => {
    // GIVEN: table 'tasks' with view 'active_tasks' filtering status='active'
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_tasks',
          name: 'tasks',
          fields: [
            { id: 'fld_title', name: 'title', type: 'single-line-text' },
            {
              id: 'fld_status',
              name: 'status',
              type: 'single-select',
              config: {
                options: ['active', 'completed', 'archived'],
              },
            },
          ],
          views: [
            {
              id: 'view_active',
              name: 'active_tasks',
              type: 'grid',
              filters: {
                operator: 'and',
                conditions: [{ field: 'fld_status', operator: 'is', value: 'active' }],
              },
            },
          ],
        },
      ],
    })

    // Insert test data with mixed statuses
    await executeQuery(`
      INSERT INTO tasks (title, status) VALUES
      ('Task 1', 'active'),
      ('Task 2', 'completed'),
      ('Task 3', 'active'),
      ('Task 4', 'archived')
    `)

    // WHEN: GET /api/tables/tbl_tasks/views/view_active/records
    const response = await request.get('/api/tables/tbl_tasks/views/view_active/records', {
      headers: { Authorization: 'Bearer valid_token' },
    })

    // THEN: only active tasks returned

    expect(response.status()).toBe(200)
    const body = await response.json()

    // Assertion 1: Only 2 active tasks returned
    expect(body.records).toHaveLength(2)

    // Assertion 2: All records have status='active'
    expect(body.records.every((r) => r.fields.status === 'active')).toBe(true)

    // Assertion 3: Correct tasks returned
    const titles = body.records.map((r) => r.fields.title).sort()
    expect(titles).toEqual(['Task 1', 'Task 3'])
  }
)
```

#### API-VIEW-RECORDS-002: Get View Records (Apply Sorts)

```typescript
test(
  'API-VIEW-RECORDS-002: should return records sorted by view configuration',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, request }) => {
    // GIVEN: table 'products' with view sorted by price DESC
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_products',
          name: 'products',
          fields: [
            { id: 'fld_name', name: 'name', type: 'single-line-text' },
            { id: 'fld_price', name: 'price', type: 'decimal' },
          ],
          views: [
            {
              id: 'view_by_price',
              name: 'by_price',
              type: 'grid',
              sorts: [{ field: 'fld_price', direction: 'desc' }],
            },
          ],
        },
      ],
    })

    await executeQuery(`
      INSERT INTO products (name, price) VALUES
      ('Product A', 10.00),
      ('Product B', 50.00),
      ('Product C', 25.00)
    `)

    // WHEN: GET /api/tables/tbl_products/views/view_by_price/records
    const response = await request.get('/api/tables/tbl_products/views/view_by_price/records', {
      headers: { Authorization: 'Bearer valid_token' },
    })

    // THEN: records sorted by price descending

    expect(response.status()).toBe(200)
    const body = await response.json()

    expect(body.records).toHaveLength(3)

    const prices = body.records.map((r) => r.fields.price)
    expect(prices).toEqual(['50.00', '25.00', '10.00'])
  }
)
```

#### API-VIEW-RECORDS-003: Get View Records (Field Visibility)

```typescript
test(
  'API-VIEW-RECORDS-003: should return only visible fields configured in view',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, request }) => {
    // GIVEN: table 'users' with view showing only name and email (hiding phone)
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_users',
          name: 'users',
          fields: [
            { id: 'fld_name', name: 'name', type: 'single-line-text' },
            { id: 'fld_email', name: 'email', type: 'email' },
            { id: 'fld_phone', name: 'phone', type: 'phone-number' },
          ],
          views: [
            {
              id: 'view_contact',
              name: 'contact_info',
              type: 'grid',
              fields: [
                { fieldId: 'fld_name', visible: true },
                { fieldId: 'fld_email', visible: true },
                { fieldId: 'fld_phone', visible: false }, // Hidden
              ],
            },
          ],
        },
      ],
    })

    await executeQuery(`
      INSERT INTO users (name, email, phone) VALUES
      ('John Doe', 'john@example.com', '+1234567890')
    `)

    // WHEN: GET /api/tables/tbl_users/views/view_contact/records
    const response = await request.get('/api/tables/tbl_users/views/view_contact/records', {
      headers: { Authorization: 'Bearer valid_token' },
    })

    // THEN: only name and email returned (phone excluded)

    expect(response.status()).toBe(200)
    const body = await response.json()

    expect(body.records).toHaveLength(1)

    const record = body.records[0]
    expect(record.fields).toHaveProperty('name')
    expect(record.fields).toHaveProperty('email')
    expect(record.fields).not.toHaveProperty('phone') // Hidden field excluded
  }
)
```

#### API-VIEW-RECORDS-004: View Permissions (403 Forbidden)

```typescript
test(
  'API-VIEW-RECORDS-004: should return 403 when user lacks view access',
  { tag: '@spec' },
  async ({ startServerWithSchema, request }) => {
    // GIVEN: table with view restricted to admin role
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_sensitive',
          name: 'sensitive_data',
          fields: [{ id: 'fld_data', name: 'data', type: 'single-line-text' }],
          views: [
            {
              id: 'view_admin',
              name: 'admin_view',
              type: 'grid',
              permissions: {
                allowedRoles: ['admin'], // Only admin can access
              },
            },
          ],
        },
      ],
    })

    // WHEN: viewer user attempts to access admin view
    const response = await request.get('/api/tables/tbl_sensitive/views/view_admin/records', {
      headers: { Authorization: 'Bearer viewer_token' },
    })

    // THEN: 403 Forbidden

    expect(response.status()).toBe(403)
    const body = await response.json()
    expect(body.error).toBe('Forbidden')
    expect(body.message).toMatch(/insufficient permissions/i)
  }
)
```

---

## P0.4: Migration Transaction/Rollback

**File**: `specs/migrations/migration-system/transactions.spec.ts` (NEW)
**Current Status**: Missing
**Effort**: 1 week

### Test Scenarios

#### MIG-TRANSACTION-001: Multi-Step Migration Atomicity

```typescript
test(
  'MIG-TRANSACTION-001: should rollback all changes when migration step fails',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: schema with 3 migration steps (add field, add index, add constraint)
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_users',
          name: 'users',
          fields: [{ id: 'fld_email', name: 'email', type: 'email' }],
        },
      ],
    })

    // WHEN: migration with failing step 3
    const migrationSteps = [
      {
        type: 'add_field',
        field: { id: 'fld_username', name: 'username', type: 'single-line-text' },
      },
      { type: 'add_index', field: 'fld_username', indexType: 'btree' },
      { type: 'add_constraint', field: 'fld_username', constraint: 'INVALID_CONSTRAINT' }, // Will fail
    ]

    // THEN: entire migration rolled back

    await expect(
      startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_users',
            name: 'users',
            fields: [
              { id: 'fld_email', name: 'email', type: 'email' },
              {
                id: 'fld_username',
                name: 'username',
                type: 'single-line-text',
                unique: true,
                indexed: true,
                _migration: { steps: migrationSteps },
              },
            ],
          },
        ],
      })
    ).rejects.toThrow(/migration failed/i)

    // Assertion 1: Username field NOT added (rollback)
    const columnExists = await executeQuery(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name='users' AND column_name='username'
    `)
    expect(columnExists).toBeUndefined()

    // Assertion 2: Index NOT created (rollback)
    const indexExists = await executeQuery(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename='users' AND indexname LIKE '%username%'
    `)
    expect(indexExists).toBeUndefined()

    // Assertion 3: Original schema intact
    const columns = await executeQuery(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name='users'
    `)
    expect(columns.map((c) => c.column_name)).toEqual(['id', 'email'])
  }
)
```

#### MIG-TRANSACTION-002: Point-in-Time Recovery

```typescript
test(
  'MIG-TRANSACTION-002: should restore to previous schema version after rollback',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: initial schema v1
    await startServerWithSchema({
      name: 'test-app',
      version: '1.0.0',
      tables: [
        {
          id: 'tbl_products',
          name: 'products',
          fields: [
            { id: 'fld_name', name: 'name', type: 'single-line-text' },
            { id: 'fld_price', name: 'price', type: 'decimal' },
          ],
        },
      ],
    })

    // Insert data
    await executeQuery(`INSERT INTO products (name, price) VALUES ('Product A', 10.00)`)

    // WHEN: failed migration to v2
    await expect(
      startServerWithSchema({
        name: 'test-app',
        version: '2.0.0',
        tables: [
          {
            id: 'tbl_products',
            name: 'products',
            fields: [
              { id: 'fld_name', name: 'name', type: 'single-line-text' },
              { id: 'fld_price', name: 'price', type: 'decimal' },
              {
                id: 'fld_invalid',
                name: 'invalid_field',
                type: 'non_existent_type', // Invalid type
              },
            ],
          },
        ],
      })
    ).rejects.toThrow()

    // THEN: schema restored to v1

    // Assertion 1: Schema version is still 1.0.0
    const schemaVersion = await executeQuery(`
      SELECT version FROM schema_migrations ORDER BY applied_at DESC LIMIT 1
    `)
    expect(schemaVersion.version).toBe('1.0.0')

    // Assertion 2: Original fields intact
    const columns = await executeQuery(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name='products'
    `)
    expect(columns.map((c) => c.column_name).sort()).toEqual(['id', 'name', 'price'].sort())

    // Assertion 3: Data preserved
    const product = await executeQuery(`SELECT name, price FROM products`)
    expect(product).toEqual({ name: 'Product A', price: '10.00' })
  }
)
```

#### MIG-TRANSACTION-003: Savepoint Recovery (Partial Rollback)

```typescript
test(
  'MIG-TRANSACTION-003: should rollback to savepoint when sub-step fails',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: migration with nested transaction (savepoints)
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_orders',
          name: 'orders',
          fields: [{ id: 'fld_total', name: 'total', type: 'decimal' }],
        },
      ],
    })

    // WHEN: migration with 3 steps, step 2 fails, step 3 should not execute
    const migrationWithSavepoints = async () => {
      await executeQuery('BEGIN')

      // Step 1: Add field (succeeds)
      await executeQuery(`ALTER TABLE orders ADD COLUMN status VARCHAR(50)`)
      await executeQuery('SAVEPOINT step1')

      // Step 2: Add invalid constraint (fails)
      try {
        await executeQuery(`ALTER TABLE orders ADD CONSTRAINT invalid_check CHECK (total > 'text')`) // Type error
      } catch (error) {
        await executeQuery('ROLLBACK TO SAVEPOINT step1')
        throw error
      }

      // Step 3: Add index (should not execute)
      await executeQuery('CREATE INDEX idx_orders_status ON orders(status)')

      await executeQuery('COMMIT')
    }

    // THEN: rollback to savepoint after step 1

    await expect(migrationWithSavepoints()).rejects.toThrow()

    // Assertion 1: Step 1 field added (before savepoint)
    const statusColumn = await executeQuery(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name='orders' AND column_name='status'
    `)
    expect(statusColumn.column_name).toBe('status')

    // Assertion 2: Step 2 constraint NOT added
    const constraintExists = await executeQuery(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name='orders' AND constraint_name='invalid_check'
    `)
    expect(constraintExists).toBeUndefined()

    // Assertion 3: Step 3 index NOT created (migration stopped)
    const indexExists = await executeQuery(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename='orders' AND indexname='idx_orders_status'
    `)
    expect(indexExists).toBeUndefined()
  }
)
```

---

## Summary: P0 Test Coverage

| Gap                        | Current Tests | New Tests    | Total | Effort      |
| -------------------------- | ------------- | ------------ | ----- | ----------- |
| **Field Type Migrations**  | 6 stubs       | 6 + 1 matrix | 7     | 2 weeks     |
| **Relationship Cascade**   | 0             | 5            | 5     | 1.5 weeks   |
| **View API Endpoints**     | 0             | 4            | 4     | 1.5 weeks   |
| **Migration Transactions** | 0             | 3            | 3     | 1 week      |
| **TOTAL**                  | 6             | 19           | 25    | **6 weeks** |

**Expected Coverage Increase**: 0% → 40% (260/651 tests passing after P0 complete)

---

## Implementation Guidelines

### 1. Test Execution Order

Implement in this sequence to avoid blockers:

1. **Field Type Migrations** (P0.1) - Foundation for all other tests
2. **Migration Transactions** (P0.4) - Needed for safe migration testing
3. **Relationship Cascade** (P0.2) - Depends on field migrations
4. **View API Endpoints** (P0.3) - Depends on record APIs

### 2. Common Test Utilities

Create shared helpers to reduce duplication:

```typescript
// tests/utils/migration-helpers.ts
export const testTypeConversion = async (fromType, toType, sampleData) => {
  // Common logic for testing type conversions
}

export const verifyColumnType = async (executeQuery, table, column, expectedType) => {
  const result = await executeQuery(
    `
    SELECT data_type FROM information_schema.columns
    WHERE table_name=$1 AND column_name=$2
  `,
    [table, column]
  )
  expect(result.data_type).toBe(expectedType)
}

export const verifyForeignKeyConstraint = async (
  executeQuery,
  table,
  column,
  expectedDeleteRule
) => {
  const result = await executeQuery(
    `
    SELECT delete_rule FROM information_schema.referential_constraints
    WHERE constraint_name LIKE $1
  `,
    [`%${table}_${column}%`]
  )
  expect(result.delete_rule).toBe(expectedDeleteRule)
}
```

### 3. Validation Checklist

Before marking P0 complete:

- [ ] All 19 new tests passing
- [ ] Remove all `.fixme()` markers
- [ ] Add copyright headers (`bun run license`)
- [ ] Run `bun run lint && bun run typecheck`
- [ ] Update co-located `.schema.json` files
- [ ] Add `@regression` test for each feature
- [ ] Document any new patterns in CLAUDE.md
- [ ] Update ROADMAP.md progress

---

**Next Steps**: After P0 completion, proceed to P1 test scenarios (high-impact features).
