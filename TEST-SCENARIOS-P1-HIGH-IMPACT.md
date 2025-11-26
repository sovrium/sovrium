# Test Scenarios - P1 (High-Impact Features)

**Generated**: 2025-11-26
**Priority**: P1 - High Impact (complete core features)
**Estimated Effort**: 9 weeks
**Target Coverage**: +35% (40% → 75%)

---

## P1.1: Computed Field Validation (Formula, Rollup, Lookup)

**Files**:

- `specs/app/tables/field-types/formula-field/advanced-formulas.spec.ts` (NEW)
- `specs/app/tables/field-types/rollup-field/aggregations.spec.ts` (NEW)
- `specs/app/tables/field-types/lookup-field/traversal.spec.ts` (NEW)

**Current Status**: Basic specs exist, need advanced validation
**Effort**: 2 weeks

### Formula Field Scenarios

#### APP-FORMULA-ADV-001: Complex Expression Evaluation

```typescript
test(
  'APP-FORMULA-ADV-001: should evaluate nested formula with multiple functions',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: table 'invoices' with formula calculating total with tax
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_invoices',
          name: 'invoices',
          fields: [
            { id: 'fld_subtotal', name: 'subtotal', type: 'decimal', precision: 10, scale: 2 },
            { id: 'fld_tax_rate', name: 'tax_rate', type: 'percentage' },
            { id: 'fld_discount', name: 'discount', type: 'decimal', precision: 10, scale: 2 },
            {
              id: 'fld_total',
              name: 'total',
              type: 'formula',
              config: {
                formula: 'ROUND((subtotal - discount) * (1 + tax_rate), 2)',
                returnType: 'decimal',
              },
            },
          ],
        },
      ],
    })

    // Insert test data
    await executeQuery(`
      INSERT INTO invoices (subtotal, tax_rate, discount) VALUES
      (100.00, 0.20, 10.00),
      (250.50, 0.15, 25.00),
      (1000.00, 0.10, 0.00)
    `)

    // WHEN: formula evaluated
    const results = await executeQuery(
      `SELECT subtotal, tax_rate, discount, total FROM invoices ORDER BY subtotal`
    )

    // THEN: formula calculates correctly

    // Assertion 1: First invoice = (100 - 10) * 1.20 = 108.00
    expect(results[0].total).toBe('108.00')

    // Assertion 2: Second invoice = (250.50 - 25) * 1.15 = 259.33
    expect(results[1].total).toBe('259.33')

    // Assertion 3: Third invoice = (1000 - 0) * 1.10 = 1100.00
    expect(results[2].total).toBe('1100.00')
  }
)
```

#### APP-FORMULA-ADV-002: Circular Dependency Detection

```typescript
test(
  'APP-FORMULA-ADV-002: should detect circular dependencies in formulas',
  { tag: '@spec' },
  async ({ startServerWithSchema }) => {
    // GIVEN: two formula fields referencing each other

    // WHEN: creating schema with circular formulas
    // THEN: validation error thrown

    await expect(
      startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_data',
            name: 'data',
            fields: [
              {
                id: 'fld_a',
                name: 'field_a',
                type: 'formula',
                config: {
                  formula: 'field_b + 10', // References field_b
                  returnType: 'integer',
                },
              },
              {
                id: 'fld_b',
                name: 'field_b',
                type: 'formula',
                config: {
                  formula: 'field_a * 2', // References field_a (circular!)
                  returnType: 'integer',
                },
              },
            ],
          },
        ],
      })
    ).rejects.toThrow(/circular dependency detected/i)
  }
)
```

#### APP-FORMULA-ADV-003: Formula Syntax Validation

```typescript
test(
  'APP-FORMULA-ADV-003: should validate formula syntax before applying',
  { tag: '@spec' },
  async ({ startServerWithSchema }) => {
    // GIVEN: invalid formula syntax

    // WHEN: creating field with invalid formula
    // THEN: validation error with syntax details

    await expect(
      startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_products',
            name: 'products',
            fields: [
              { id: 'fld_price', name: 'price', type: 'decimal' },
              {
                id: 'fld_markup',
                name: 'markup',
                type: 'formula',
                config: {
                  formula: 'price * (1 +', // Missing closing parenthesis
                  returnType: 'decimal',
                },
              },
            ],
          },
        ],
      })
    ).rejects.toThrow(/formula syntax error.*unclosed parenthesis/i)
  }
)
```

#### APP-FORMULA-ADV-004: Cross-Table Formula (Lookup + Formula)

```typescript
test(
  'APP-FORMULA-ADV-004: should evaluate formula using lookup field from related table',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: 'orders' table with lookup to 'customers' and formula using lookup
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_customers',
          name: 'customers',
          fields: [
            { id: 'fld_name', name: 'name', type: 'single-line-text' },
            { id: 'fld_discount_rate', name: 'discount_rate', type: 'percentage' },
          ],
        },
        {
          id: 'tbl_orders',
          name: 'orders',
          fields: [
            {
              id: 'fld_customer',
              name: 'customer',
              type: 'relationship',
              config: { linkedTableId: 'tbl_customers' },
            },
            { id: 'fld_amount', name: 'amount', type: 'decimal' },
            {
              id: 'fld_customer_discount',
              name: 'customer_discount',
              type: 'lookup',
              config: {
                relationshipField: 'fld_customer',
                lookupField: 'fld_discount_rate',
              },
            },
            {
              id: 'fld_final_amount',
              name: 'final_amount',
              type: 'formula',
              config: {
                formula: 'amount * (1 - customer_discount)',
                returnType: 'decimal',
              },
            },
          ],
        },
      ],
    })

    // Insert test data
    const customerResult = await executeQuery(`
      INSERT INTO customers (name, discount_rate) VALUES ('VIP Customer', 0.15) RETURNING id
    `)
    const customerId = customerResult.id

    await executeQuery(
      `
      INSERT INTO orders (customer_id, amount) VALUES ($1, 200.00)
    `,
      [customerId]
    )

    // WHEN: formula evaluated with lookup value
    const order = await executeQuery(`SELECT final_amount FROM orders`)

    // THEN: formula uses customer discount rate (15%)
    // final_amount = 200 * (1 - 0.15) = 170.00
    expect(order.final_amount).toBe('170.00')
  }
)
```

#### APP-FORMULA-ADV-005: Performance with Large Datasets

```typescript
test(
  'APP-FORMULA-ADV-005: should compute formula for 10k records in < 2 seconds',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: table with formula field and 10k records
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_calculations',
          name: 'calculations',
          fields: [
            { id: 'fld_value', name: 'value', type: 'integer' },
            {
              id: 'fld_squared',
              name: 'squared',
              type: 'formula',
              config: {
                formula: 'value * value',
                returnType: 'integer',
              },
            },
          ],
        },
      ],
    })

    // Insert 10k records
    const values = Array.from({ length: 10000 }, (_, i) => i + 1)
    const batchSize = 1000

    for (let i = 0; i < values.length; i += batchSize) {
      const batch = values.slice(i, i + batchSize)
      const placeholders = batch.map((_, idx) => `($${idx + 1})`).join(',')
      await executeQuery(`INSERT INTO calculations (value) VALUES ${placeholders}`, batch)
    }

    // WHEN: querying all computed values
    const startTime = performance.now()
    const results = await executeQuery(
      `SELECT value, squared FROM calculations ORDER BY value LIMIT 100`
    )
    const endTime = performance.now()

    // THEN: computation completes in < 2 seconds

    // Assertion 1: Execution time
    expect(endTime - startTime).toBeLessThan(2000)

    // Assertion 2: Formulas computed correctly
    expect(results[0]).toEqual({ value: 1, squared: 1 })
    expect(results[99]).toEqual({ value: 100, squared: 10000 })
  }
)
```

### Rollup Field Scenarios

#### APP-ROLLUP-AGG-001: Sum Aggregation

```typescript
test(
  'APP-ROLLUP-AGG-001: should calculate SUM rollup across related records',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: 'projects' with rollup summing 'tasks' hours
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_projects',
          name: 'projects',
          fields: [
            { id: 'fld_name', name: 'name', type: 'single-line-text' },
            {
              id: 'fld_total_hours',
              name: 'total_hours',
              type: 'rollup',
              config: {
                relationshipField: 'fld_tasks', // Reverse relationship
                rollupField: 'fld_hours',
                aggregation: 'SUM',
              },
            },
          ],
        },
        {
          id: 'tbl_tasks',
          name: 'tasks',
          fields: [
            {
              id: 'fld_project',
              name: 'project',
              type: 'relationship',
              config: { linkedTableId: 'tbl_projects' },
            },
            { id: 'fld_hours', name: 'hours', type: 'decimal' },
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
      INSERT INTO tasks (project_id, hours) VALUES
      ($1, 8.5),
      ($1, 6.0),
      ($1, 12.25)
    `,
      [projectId]
    )

    // WHEN: rollup computed
    const project = await executeQuery(`SELECT total_hours FROM projects WHERE id = $1`, [
      projectId,
    ])

    // THEN: total_hours = 8.5 + 6.0 + 12.25 = 26.75
    expect(project.total_hours).toBe('26.75')
  }
)
```

#### APP-ROLLUP-AGG-002: Count Aggregation with Filter

```typescript
test(
  'APP-ROLLUP-AGG-002: should calculate COUNT rollup with filter condition',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: 'customers' with rollup counting completed orders
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_customers',
          name: 'customers',
          fields: [
            { id: 'fld_name', name: 'name', type: 'single-line-text' },
            {
              id: 'fld_completed_orders',
              name: 'completed_orders',
              type: 'rollup',
              config: {
                relationshipField: 'fld_orders',
                rollupField: 'fld_id', // Count IDs
                aggregation: 'COUNT',
                filter: {
                  field: 'fld_status',
                  operator: 'is',
                  value: 'completed',
                },
              },
            },
          ],
        },
        {
          id: 'tbl_orders',
          name: 'orders',
          fields: [
            {
              id: 'fld_customer',
              name: 'customer',
              type: 'relationship',
              config: { linkedTableId: 'tbl_customers' },
            },
            {
              id: 'fld_status',
              name: 'status',
              type: 'single-select',
              config: {
                options: ['pending', 'completed', 'cancelled'],
              },
            },
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
      INSERT INTO orders (customer_id, status) VALUES
      ($1, 'completed'),
      ($1, 'pending'),
      ($1, 'completed'),
      ($1, 'cancelled')
    `,
      [customerId]
    )

    // WHEN: rollup computed with filter
    const customer = await executeQuery(`SELECT completed_orders FROM customers WHERE id = $1`, [
      customerId,
    ])

    // THEN: only 2 completed orders counted
    expect(customer.completed_orders).toBe(2)
  }
)
```

#### APP-ROLLUP-AGG-003: Average Aggregation

```typescript
test(
  'APP-ROLLUP-AGG-003: should calculate AVG rollup with decimal precision',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: 'courses' with rollup averaging student grades
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_courses',
          name: 'courses',
          fields: [
            { id: 'fld_name', name: 'name', type: 'single-line-text' },
            {
              id: 'fld_avg_grade',
              name: 'average_grade',
              type: 'rollup',
              config: {
                relationshipField: 'fld_enrollments',
                rollupField: 'fld_grade',
                aggregation: 'AVG',
                precision: 2, // Round to 2 decimal places
              },
            },
          ],
        },
        {
          id: 'tbl_enrollments',
          name: 'enrollments',
          fields: [
            {
              id: 'fld_course',
              name: 'course',
              type: 'relationship',
              config: { linkedTableId: 'tbl_courses' },
            },
            { id: 'fld_grade', name: 'grade', type: 'decimal' },
          ],
        },
      ],
    })

    // Insert test data
    const courseResult = await executeQuery(`
      INSERT INTO courses (name) VALUES ('Mathematics 101') RETURNING id
    `)
    const courseId = courseResult.id

    await executeQuery(
      `
      INSERT INTO enrollments (course_id, grade) VALUES
      ($1, 85.5),
      ($1, 92.0),
      ($1, 78.25)
    `,
      [courseId]
    )

    // WHEN: rollup computed
    const course = await executeQuery(`SELECT average_grade FROM courses WHERE id = $1`, [courseId])

    // THEN: average = (85.5 + 92.0 + 78.25) / 3 = 85.25
    expect(course.average_grade).toBe('85.25')
  }
)
```

### Lookup Field Scenarios

#### APP-LOOKUP-TRAV-001: Single-Level Lookup

```typescript
test(
  'APP-LOOKUP-TRAV-001: should lookup value from directly related table',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: 'orders' looking up 'customer_email' from 'customers'
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_customers',
          name: 'customers',
          fields: [
            { id: 'fld_name', name: 'name', type: 'single-line-text' },
            { id: 'fld_email', name: 'email', type: 'email' },
          ],
        },
        {
          id: 'tbl_orders',
          name: 'orders',
          fields: [
            {
              id: 'fld_customer',
              name: 'customer',
              type: 'relationship',
              config: { linkedTableId: 'tbl_customers' },
            },
            { id: 'fld_amount', name: 'amount', type: 'decimal' },
            {
              id: 'fld_customer_email',
              name: 'customer_email',
              type: 'lookup',
              config: {
                relationshipField: 'fld_customer',
                lookupField: 'fld_email',
              },
            },
          ],
        },
      ],
    })

    // Insert test data
    const customerResult = await executeQuery(`
      INSERT INTO customers (name, email) VALUES ('Jane Smith', 'jane@example.com') RETURNING id
    `)
    const customerId = customerResult.id

    await executeQuery(
      `
      INSERT INTO orders (customer_id, amount) VALUES ($1, 150.00)
    `,
      [customerId]
    )

    // WHEN: lookup field queried
    const order = await executeQuery(`SELECT customer_email FROM orders`)

    // THEN: email from customers table returned
    expect(order.customer_email).toBe('jane@example.com')
  }
)
```

#### APP-LOOKUP-TRAV-002: Multi-Level Lookup (Chained)

```typescript
test(
  'APP-LOOKUP-TRAV-002: should lookup value through multiple relationship hops',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: 'line_items' → 'orders' → 'customers' → customer email
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_customers',
          name: 'customers',
          fields: [{ id: 'fld_email', name: 'email', type: 'email' }],
        },
        {
          id: 'tbl_orders',
          name: 'orders',
          fields: [
            {
              id: 'fld_customer',
              name: 'customer',
              type: 'relationship',
              config: { linkedTableId: 'tbl_customers' },
            },
            {
              id: 'fld_customer_email',
              name: 'customer_email',
              type: 'lookup',
              config: {
                relationshipField: 'fld_customer',
                lookupField: 'fld_email',
              },
            },
          ],
        },
        {
          id: 'tbl_line_items',
          name: 'line_items',
          fields: [
            {
              id: 'fld_order',
              name: 'order',
              type: 'relationship',
              config: { linkedTableId: 'tbl_orders' },
            },
            { id: 'fld_product', name: 'product', type: 'single-line-text' },
            {
              id: 'fld_buyer_email',
              name: 'buyer_email',
              type: 'lookup',
              config: {
                relationshipField: 'fld_order',
                lookupField: 'fld_customer_email', // Chained lookup!
              },
            },
          ],
        },
      ],
    })

    // Insert test data
    const customerResult = await executeQuery(`
      INSERT INTO customers (email) VALUES ('buyer@example.com') RETURNING id
    `)
    const customerId = customerResult.id

    const orderResult = await executeQuery(
      `
      INSERT INTO orders (customer_id) VALUES ($1) RETURNING id
    `,
      [customerId]
    )
    const orderId = orderResult.id

    await executeQuery(
      `
      INSERT INTO line_items (order_id, product) VALUES ($1, 'Widget')
    `,
      [orderId]
    )

    // WHEN: chained lookup queried
    const lineItem = await executeQuery(`SELECT buyer_email FROM line_items`)

    // THEN: email traversed through orders → customers
    expect(lineItem.buyer_email).toBe('buyer@example.com')
  }
)
```

---

## P1.2: API Pagination, Sorting, Filtering

**File**: `specs/api/paths/tables/{tableId}/records/query-params.spec.ts` (NEW)
**Current Status**: Missing
**Effort**: 1.5 weeks

### Test Scenarios

#### API-QUERY-PAGE-001: Cursor-Based Pagination

```typescript
test(
  'API-QUERY-PAGE-001: should paginate records using cursor (after)',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, request }) => {
    // GIVEN: table with 100 records
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_items',
          name: 'items',
          fields: [{ id: 'fld_name', name: 'name', type: 'single-line-text' }],
        },
      ],
    })

    // Insert 100 records
    for (let i = 1; i <= 100; i++) {
      await executeQuery(`INSERT INTO items (name) VALUES ($1)`, [`Item ${i}`])
    }

    // WHEN: GET /api/tables/tbl_items/records?limit=20
    const page1 = await request.get('/api/tables/tbl_items/records?limit=20', {
      headers: { Authorization: 'Bearer valid_token' },
    })
    const page1Body = await page1.json()

    // THEN: first 20 records returned with cursor

    expect(page1Body.records).toHaveLength(20)
    expect(page1Body.pagination.hasMore).toBe(true)
    expect(page1Body.pagination.next).toBeDefined()

    // WHEN: fetching next page using cursor
    const page2 = await request.get(
      `/api/tables/tbl_items/records?limit=20&after=${page1Body.pagination.next}`,
      {
        headers: { Authorization: 'Bearer valid_token' },
      }
    )
    const page2Body = await page2.json()

    // THEN: next 20 records returned

    expect(page2Body.records).toHaveLength(20)
    expect(page2Body.records[0].id).not.toBe(page1Body.records[0].id) // Different records
  }
)
```

#### API-QUERY-SORT-001: Multi-Field Sorting

```typescript
test(
  'API-QUERY-SORT-001: should sort records by multiple fields',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, request }) => {
    // GIVEN: table 'employees' with name and salary
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_employees',
          name: 'employees',
          fields: [
            { id: 'fld_name', name: 'name', type: 'single-line-text' },
            { id: 'fld_department', name: 'department', type: 'single-line-text' },
            { id: 'fld_salary', name: 'salary', type: 'decimal' },
          ],
        },
      ],
    })

    await executeQuery(`
      INSERT INTO employees (name, department, salary) VALUES
      ('Alice', 'Engineering', 90000),
      ('Bob', 'Engineering', 85000),
      ('Charlie', 'Sales', 75000),
      ('Diana', 'Sales', 80000)
    `)

    // WHEN: GET /api/tables/tbl_employees/records?sort=department,-salary
    const response = await request.get(
      '/api/tables/tbl_employees/records?sort=department,-salary',
      {
        headers: { Authorization: 'Bearer valid_token' },
      }
    )

    // THEN: sorted by department ASC, then salary DESC

    expect(response.status()).toBe(200)
    const body = await response.json()

    const names = body.records.map((r) => r.fields.name)
    expect(names).toEqual(['Alice', 'Bob', 'Diana', 'Charlie'])
    // Engineering dept sorted by salary DESC: Alice (90k) > Bob (85k)
    // Sales dept sorted by salary DESC: Diana (80k) > Charlie (75k)
  }
)
```

#### API-QUERY-FILTER-001: Complex Filter (AND/OR)

```typescript
test(
  'API-QUERY-FILTER-001: should filter records with complex AND/OR conditions',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, request }) => {
    // GIVEN: table 'products' with price and category
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_products',
          name: 'products',
          fields: [
            { id: 'fld_name', name: 'name', type: 'single-line-text' },
            { id: 'fld_price', name: 'price', type: 'decimal' },
            { id: 'fld_category', name: 'category', type: 'single-select' },
          ],
        },
      ],
    })

    await executeQuery(`
      INSERT INTO products (name, price, category) VALUES
      ('Laptop', 1200, 'Electronics'),
      ('Phone', 800, 'Electronics'),
      ('Desk', 300, 'Furniture'),
      ('Chair', 150, 'Furniture')
    `)

    // WHEN: GET /api/tables/tbl_products/records?filter=(category=Electronics AND price>1000) OR (category=Furniture AND price<200)
    const filterQuery = encodeURIComponent(
      '(category=Electronics AND price>1000) OR (category=Furniture AND price<200)'
    )
    const response = await request.get(`/api/tables/tbl_products/records?filter=${filterQuery}`, {
      headers: { Authorization: 'Bearer valid_token' },
    })

    // THEN: Laptop (Electronics, 1200) and Chair (Furniture, 150) returned

    expect(response.status()).toBe(200)
    const body = await response.json()

    expect(body.records).toHaveLength(2)
    const names = body.records.map((r) => r.fields.name).sort()
    expect(names).toEqual(['Chair', 'Laptop'])
  }
)
```

---

## P1.3: Permission Inheritance

**File**: `specs/app/tables/permissions/inheritance.spec.ts` (NEW)
**Current Status**: Missing
**Effort**: 1 week

### Test Scenarios

#### APP-PERM-INHERIT-001: Table Permission Inheritance

```typescript
test(
  'APP-PERM-INHERIT-001: should inherit table permissions from organization',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, request }) => {
    // GIVEN: organization with default member permissions (read, create)
    await startServerWithSchema({
      name: 'test-app',
      organizations: [
        {
          id: 'org_acme',
          name: 'ACME Corp',
          defaultPermissions: {
            member: ['read', 'create'], // No update, no delete
          },
        },
      ],
      tables: [
        {
          id: 'tbl_tasks',
          name: 'tasks',
          fields: [{ id: 'fld_title', name: 'title', type: 'single-line-text' }],
          permissions: {
            inherit: true, // Inherit from organization
          },
        },
      ],
    })

    // WHEN: member user attempts to update record
    const response = await request.patch('/api/tables/tbl_tasks/records/rec_123', {
      headers: { Authorization: 'Bearer member_token' },
      data: { fields: { title: 'Updated Title' } },
    })

    // THEN: 403 Forbidden (no update permission)

    expect(response.status()).toBe(403)
    const body = await response.json()
    expect(body.message).toMatch(/insufficient permissions.*update/i)
  }
)
```

#### APP-PERM-INHERIT-002: Override Inherited Permissions

```typescript
test(
  'APP-PERM-INHERIT-002: should allow table to override inherited permissions',
  { tag: '@spec' },
  async ({ startServerWithSchema, request }) => {
    // GIVEN: organization with restrictive permissions, table with override
    await startServerWithSchema({
      name: 'test-app',
      organizations: [
        {
          id: 'org_acme',
          name: 'ACME Corp',
          defaultPermissions: {
            member: ['read'], // Read-only at org level
          },
        },
      ],
      tables: [
        {
          id: 'tbl_comments',
          name: 'comments',
          fields: [{ id: 'fld_text', name: 'text', type: 'long-text' }],
          permissions: {
            inherit: false, // Don't inherit
            member: ['read', 'create', 'update', 'delete'], // Full access override
          },
        },
      ],
    })

    // WHEN: member user creates record
    const response = await request.post('/api/tables/tbl_comments/records', {
      headers: { Authorization: 'Bearer member_token' },
      data: { fields: { text: 'New comment' } },
    })

    // THEN: 201 Created (table overrides org permissions)

    expect(response.status()).toBe(201)
  }
)
```

---

## P1.4: File Upload Validation

**File**: `specs/app/tables/field-types/single-attachment-field/upload-validation.spec.ts` (NEW)
**Current Status**: Missing
**Effort**: 1.5 weeks

### Test Scenarios

#### APP-ATTACH-VALID-001: File Size Validation

```typescript
test(
  'APP-ATTACH-VALID-001: should reject file exceeding size limit',
  { tag: '@spec' },
  async ({ startServerWithSchema, request }) => {
    // GIVEN: attachment field with 5MB size limit
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_documents',
          name: 'documents',
          fields: [
            {
              id: 'fld_file',
              name: 'file',
              type: 'single-attachment',
              config: {
                maxSizeBytes: 5 * 1024 * 1024, // 5MB
              },
            },
          ],
        },
      ],
    })

    // WHEN: uploading 10MB file
    const largeFile = new Blob([new ArrayBuffer(10 * 1024 * 1024)]) // 10MB
    const formData = new FormData()
    formData.append('file', largeFile, 'large-file.pdf')

    const response = await request.post('/api/tables/tbl_documents/records', {
      headers: { Authorization: 'Bearer valid_token' },
      data: formData,
    })

    // THEN: 400 Bad Request (file too large)

    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('ValidationError')
    expect(body.message).toMatch(/file size exceeds limit.*5MB/i)
  }
)
```

#### APP-ATTACH-VALID-002: File Type (MIME) Validation

```typescript
test(
  'APP-ATTACH-VALID-002: should reject file with disallowed MIME type',
  { tag: '@spec' },
  async ({ startServerWithSchema, request }) => {
    // GIVEN: attachment field allowing only images
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_profiles',
          name: 'profiles',
          fields: [
            {
              id: 'fld_avatar',
              name: 'avatar',
              type: 'single-attachment',
              config: {
                allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
              },
            },
          ],
        },
      ],
    })

    // WHEN: uploading PDF file
    const pdfFile = new Blob(['%PDF-1.4'], { type: 'application/pdf' })
    const formData = new FormData()
    formData.append('file', pdfFile, 'document.pdf')

    const response = await request.post('/api/tables/tbl_profiles/records', {
      headers: { Authorization: 'Bearer valid_token' },
      data: formData,
    })

    // THEN: 400 Bad Request (invalid MIME type)

    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.message).toMatch(/file type not allowed.*image\/jpeg, image\/png, image\/webp/i)
  }
)
```

#### APP-ATTACH-VALID-003: Storage Quota Enforcement

```typescript
test(
  'APP-ATTACH-VALID-003: should enforce organization storage quota',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, request }) => {
    // GIVEN: organization with 100MB storage quota, 95MB used
    await startServerWithSchema({
      name: 'test-app',
      organizations: [
        {
          id: 'org_acme',
          name: 'ACME Corp',
          storageQuotaBytes: 100 * 1024 * 1024, // 100MB
          storageUsedBytes: 95 * 1024 * 1024, // 95MB used
        },
      ],
      tables: [
        {
          id: 'tbl_files',
          name: 'files',
          fields: [
            {
              id: 'fld_attachment',
              name: 'attachment',
              type: 'single-attachment',
            },
          ],
        },
      ],
    })

    // WHEN: uploading 10MB file (would exceed quota)
    const file = new Blob([new ArrayBuffer(10 * 1024 * 1024)])
    const formData = new FormData()
    formData.append('file', file, 'file.dat')

    const response = await request.post('/api/tables/tbl_files/records', {
      headers: { Authorization: 'Bearer valid_token' },
      data: formData,
    })

    // THEN: 413 Payload Too Large (quota exceeded)

    expect(response.status()).toBe(413)
    const body = await response.json()
    expect(body.message).toMatch(/storage quota exceeded.*95MB \/ 100MB/i)
  }
)
```

---

## P1.5: Constraint Migrations

**File**: `specs/migrations/schema-evolution/constraint-migrations.spec.ts` (NEW)
**Current Status**: Missing
**Effort**: 2 weeks

### Test Scenarios

#### MIG-CONSTRAINT-001: Add UNIQUE Constraint with Existing Data

```typescript
test(
  'MIG-CONSTRAINT-001: should fail adding UNIQUE constraint when duplicates exist',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: table with duplicate values in 'email' field
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_users',
          name: 'users',
          fields: [
            { id: 'fld_email', name: 'email', type: 'email' }, // No unique constraint yet
          ],
        },
      ],
    })

    await executeQuery(`
      INSERT INTO users (email) VALUES
      ('user@example.com'),
      ('user@example.com')  -- Duplicate
    `)

    // WHEN: adding unique constraint
    // THEN: migration fails with constraint violation

    await expect(
      startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_users',
            name: 'users',
            fields: [
              {
                id: 'fld_email',
                name: 'email',
                type: 'email',
                unique: true, // Add unique constraint
              },
            ],
          },
        ],
      })
    ).rejects.toThrow(/could not create unique index.*duplicate key/i)
  }
)
```

#### MIG-CONSTRAINT-002: Add NOT NULL Constraint with Backfill

```typescript
test(
  'MIG-CONSTRAINT-002: should backfill NULL values before adding NOT NULL constraint',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: table with NULL values in 'status' field
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
              required: false, // Nullable
            },
          ],
        },
      ],
    })

    await executeQuery(`
      INSERT INTO tasks (title, status) VALUES
      ('Task 1', 'active'),
      ('Task 2', NULL),
      ('Task 3', NULL)
    `)

    // WHEN: changing status to required with default value
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
              required: true, // Now required
              default: 'pending', // Backfill with this
              _migration: {
                backfillStrategy: 'default',
              },
            },
          ],
        },
      ],
    })

    // THEN: NULL values backfilled with 'pending'

    // Assertion 1: NOT NULL constraint added
    const columnInfo = await executeQuery(`
      SELECT is_nullable FROM information_schema.columns
      WHERE table_name='tasks' AND column_name='status'
    `)
    expect(columnInfo.is_nullable).toBe('NO')

    // Assertion 2: NULL values backfilled
    const tasks = await executeQuery(`SELECT status FROM tasks ORDER BY title`)
    expect(tasks).toEqual([
      { status: 'active' },
      { status: 'pending' }, // Backfilled
      { status: 'pending' }, // Backfilled
    ])
  }
)
```

#### MIG-CONSTRAINT-003: Add Foreign Key Constraint

```typescript
test(
  'MIG-CONSTRAINT-003: should add foreign key constraint validating existing data',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: tables without foreign key constraint
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
            { id: 'fld_title', name: 'title', type: 'single-line-text' },
            { id: 'fld_author_id', name: 'author_id', type: 'integer' }, // No FK yet
          ],
        },
      ],
    })

    const authorResult = await executeQuery(
      `INSERT INTO authors (name) VALUES ('Author') RETURNING id`
    )
    await executeQuery(`INSERT INTO books (title, author_id) VALUES ('Book 1', $1)`, [
      authorResult.id,
    ])
    await executeQuery(`INSERT INTO books (title, author_id) VALUES ('Book 2', 999)`) // Invalid author_id

    // WHEN: adding foreign key constraint
    // THEN: migration fails due to invalid reference

    await expect(
      startServerWithSchema({
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
              { id: 'fld_title', name: 'title', type: 'single-line-text' },
              {
                id: 'fld_author',
                name: 'author',
                type: 'relationship',
                config: { linkedTableId: 'tbl_authors' }, // Add FK
              },
            ],
          },
        ],
      })
    ).rejects.toThrow(/violates foreign key constraint/i)
  }
)
```

---

## P1.6: Bulk Validation Error Details

**File**: `specs/api/paths/tables/{tableId}/records/batch/error-details.spec.ts` (NEW)
**Current Status**: Missing
**Effort**: 1 week

### Test Scenarios

#### API-BATCH-ERR-001: Per-Record Error Details

```typescript
test(
  'API-BATCH-ERR-001: should return validation errors for each failed record',
  { tag: '@spec' },
  async ({ startServerWithSchema, request }) => {
    // GIVEN: table with required field 'email' and unique constraint
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_users',
          name: 'users',
          fields: [{ id: 'fld_email', name: 'email', type: 'email', required: true, unique: true }],
        },
      ],
    })

    // WHEN: batch create with mixed valid/invalid records
    const response = await request.post('/api/tables/tbl_users/records/batch', {
      headers: { Authorization: 'Bearer valid_token' },
      data: {
        records: [
          { fields: { email: 'user1@example.com' } }, // Valid
          { fields: { email: null } }, // Invalid (required)
          { fields: { email: 'invalid-email' } }, // Invalid (format)
          { fields: { email: 'user1@example.com' } }, // Invalid (duplicate)
        ],
      },
    })

    // THEN: 400 with per-record errors

    expect(response.status()).toBe(400)
    const body = await response.json()

    expect(body.error).toBe('BatchValidationError')
    expect(body.errors).toHaveLength(3) // 3 failed records

    // Assertion 1: Record index 1 error
    expect(body.errors[0]).toMatchObject({
      index: 1,
      field: 'email',
      error: 'required',
      message: 'Email is required',
    })

    // Assertion 2: Record index 2 error
    expect(body.errors[1]).toMatchObject({
      index: 2,
      field: 'email',
      error: 'invalid_format',
      message: 'Invalid email format',
    })

    // Assertion 3: Record index 3 error
    expect(body.errors[2]).toMatchObject({
      index: 3,
      field: 'email',
      error: 'unique_violation',
      message: 'Email must be unique',
    })
  }
)
```

#### API-BATCH-ERR-002: Partial Success Handling

```typescript
test(
  'API-BATCH-ERR-002: should allow partial success when allowPartial=true',
  { tag: '@spec' },
  async ({ startServerWithSchema, request }) => {
    // GIVEN: table with validation rules
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_contacts',
          name: 'contacts',
          fields: [
            { id: 'fld_name', name: 'name', type: 'single-line-text', required: true },
            { id: 'fld_email', name: 'email', type: 'email' },
          ],
        },
      ],
    })

    // WHEN: batch create with allowPartial=true
    const response = await request.post(
      '/api/tables/tbl_contacts/records/batch?allowPartial=true',
      {
        headers: { Authorization: 'Bearer valid_token' },
        data: {
          records: [
            { fields: { name: 'Alice', email: 'alice@example.com' } }, // Valid
            { fields: { email: 'bob@example.com' } }, // Invalid (missing name)
            { fields: { name: 'Charlie', email: 'charlie@example.com' } }, // Valid
          ],
        },
      }
    )

    // THEN: 207 Multi-Status with partial success

    expect(response.status()).toBe(207)
    const body = await response.json()

    expect(body.created).toHaveLength(2) // Alice and Charlie
    expect(body.failed).toHaveLength(1) // Bob

    expect(body.created[0].fields.name).toBe('Alice')
    expect(body.created[1].fields.name).toBe('Charlie')

    expect(body.failed[0]).toMatchObject({
      index: 1,
      error: 'required',
      field: 'name',
    })
  }
)
```

---

## Summary: P1 Test Coverage

| Gap                        | New Tests    | Effort      | Dependencies      |
| -------------------------- | ------------ | ----------- | ----------------- |
| **Computed Fields**        | 8 tests      | 2 weeks     | Field system      |
| **API Query Params**       | 3 tests      | 1.5 weeks   | Record APIs       |
| **Permission Inheritance** | 2 tests      | 1 week      | Permission system |
| **File Upload Validation** | 3 tests      | 1.5 weeks   | Attachment fields |
| **Constraint Migrations**  | 3 tests      | 2 weeks     | Migration system  |
| **Batch Error Details**    | 2 tests      | 1 week      | Batch APIs        |
| **TOTAL**                  | **21 tests** | **9 weeks** | -                 |

**Expected Coverage Increase**: 40% → 75% (488/651 tests passing after P1 complete)

---

## Next Steps

After P1 completion, proceed to **P2 test scenarios** (advanced features) for reaching 95% coverage.
