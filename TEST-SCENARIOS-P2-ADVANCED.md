# Test Scenarios - P2 (Advanced Features)

**Generated**: 2025-11-26
**Priority**: P2 - Medium (feature parity + optimization)
**Estimated Effort**: 9 weeks
**Target Coverage**: +20% (75% → 95%)

---

## P2.1: Internationalization (i18n)

**File**: `specs/app/tables/i18n/locale-formatting.spec.ts` (NEW)
**Current Status**: Missing
**Effort**: 2 weeks

### Test Scenarios

#### APP-I18N-001: Locale-Specific Currency Formatting

```typescript
test(
  'APP-I18N-001: should format currency field based on user locale',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, request }) => {
    // GIVEN: table with currency field
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_transactions',
          name: 'transactions',
          fields: [
            {
              id: 'fld_amount',
              name: 'amount',
              type: 'currency',
              config: {
                currency: 'USD',
                precision: 2,
              },
            },
          ],
        },
      ],
    })

    await executeQuery(`INSERT INTO transactions (amount) VALUES (1234.56)`)

    // WHEN: requesting with different locale headers

    // US locale
    const responseUS = await request.get('/api/tables/tbl_transactions/records', {
      headers: {
        Authorization: 'Bearer valid_token',
        'Accept-Language': 'en-US',
      },
    })
    const bodyUS = await responseUS.json()

    // French locale
    const responseFR = await request.get('/api/tables/tbl_transactions/records', {
      headers: {
        Authorization: 'Bearer valid_token',
        'Accept-Language': 'fr-FR',
      },
    })
    const bodyFR = await responseFR.json()

    // THEN: currency formatted per locale

    // US: $1,234.56
    expect(bodyUS.records[0].fields.amount_formatted).toBe('$1,234.56')

    // French: 1 234,56 $
    expect(bodyFR.records[0].fields.amount_formatted).toBe('1 234,56 $US')
  }
)
```

#### APP-I18N-002: Timezone-Aware DateTime Fields

```typescript
test(
  'APP-I18N-002: should return datetime in user timezone',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, request }) => {
    // GIVEN: table with datetime field (stored in UTC)
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_events',
          name: 'events',
          fields: [
            {
              id: 'fld_start_time',
              name: 'start_time',
              type: 'datetime',
              config: {
                storageTimezone: 'UTC',
              },
            },
          ],
        },
      ],
    })

    // Insert event at 2025-01-15 14:00:00 UTC
    await executeQuery(`
      INSERT INTO events (start_time) VALUES ('2025-01-15 14:00:00+00')
    `)

    // WHEN: requesting with different timezone headers

    // UTC
    const responseUTC = await request.get('/api/tables/tbl_events/records', {
      headers: {
        Authorization: 'Bearer valid_token',
        'X-Timezone': 'UTC',
      },
    })
    const bodyUTC = await responseUTC.json()

    // New York (UTC-5)
    const responseNY = await request.get('/api/tables/tbl_events/records', {
      headers: {
        Authorization: 'Bearer valid_token',
        'X-Timezone': 'America/New_York',
      },
    })
    const bodyNY = await responseNY.json()

    // Tokyo (UTC+9)
    const responseTokyo = await request.get('/api/tables/tbl_events/records', {
      headers: {
        Authorization: 'Bearer valid_token',
        'X-Timezone': 'Asia/Tokyo',
      },
    })
    const bodyTokyo = await responseTokyo.json()

    // THEN: datetime converted to user timezone

    expect(bodyUTC.records[0].fields.start_time).toBe('2025-01-15T14:00:00Z')
    expect(bodyNY.records[0].fields.start_time).toBe('2025-01-15T09:00:00-05:00') // 9 AM
    expect(bodyTokyo.records[0].fields.start_time).toBe('2025-01-15T23:00:00+09:00') // 11 PM
  }
)
```

#### APP-I18N-003: Collation for Text Sorting

```typescript
test(
  'APP-I18N-003: should sort text fields using locale-specific collation',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: table with text field and locale-specific collation
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_names',
          name: 'names',
          fields: [
            {
              id: 'fld_name',
              name: 'name',
              type: 'single-line-text',
              config: {
                collation: 'sv_SE', // Swedish collation (å, ä, ö at end)
              },
            },
          ],
        },
      ],
    })

    // Insert Swedish names
    await executeQuery(`
      INSERT INTO names (name) VALUES
      ('Ärligt'),
      ('Anders'),
      ('Öberg'),
      ('Åsa')
    `)

    // WHEN: sorting names
    const results = await executeQuery(`
      SELECT name FROM names ORDER BY name COLLATE "sv_SE"
    `)

    // THEN: sorted per Swedish collation (A, Ä, Å, Ö)
    const names = results.map((r) => r.name)
    expect(names).toEqual(['Anders', 'Ärligt', 'Åsa', 'Öberg'])
  }
)
```

#### APP-I18N-004: Date Format Preferences

```typescript
test(
  'APP-I18N-004: should format date field based on locale preferences',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, request }) => {
    // GIVEN: table with date field
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_appointments',
          name: 'appointments',
          fields: [
            {
              id: 'fld_date',
              name: 'date',
              type: 'date',
            },
          ],
        },
      ],
    })

    await executeQuery(`INSERT INTO appointments (date) VALUES ('2025-03-15')`)

    // WHEN: requesting with different locales

    // US locale (MM/DD/YYYY)
    const responseUS = await request.get('/api/tables/tbl_appointments/records', {
      headers: {
        Authorization: 'Bearer valid_token',
        'Accept-Language': 'en-US',
      },
    })
    const bodyUS = await responseUS.json()

    // UK locale (DD/MM/YYYY)
    const responseUK = await request.get('/api/tables/tbl_appointments/records', {
      headers: {
        Authorization: 'Bearer valid_token',
        'Accept-Language': 'en-GB',
      },
    })
    const bodyUK = await responseUK.json()

    // ISO format (YYYY-MM-DD)
    const responseISO = await request.get('/api/tables/tbl_appointments/records', {
      headers: {
        Authorization: 'Bearer valid_token',
        'Accept-Language': 'en-ISO',
      },
    })
    const bodyISO = await responseISO.json()

    // THEN: date formatted per locale

    expect(bodyUS.records[0].fields.date_formatted).toBe('03/15/2025')
    expect(bodyUK.records[0].fields.date_formatted).toBe('15/03/2025')
    expect(bodyISO.records[0].fields.date_formatted).toBe('2025-03-15')
  }
)
```

---

## P2.2: Data Import/Export

**File**: `specs/api/import-export/csv-import.spec.ts` (NEW)
**Current Status**: Missing
**Effort**: 2 weeks

### Test Scenarios

#### API-IMPORT-CSV-001: CSV Import with Validation

```typescript
test(
  'API-IMPORT-CSV-001: should import CSV file with field validation',
  { tag: '@spec' },
  async ({ startServerWithSchema, request }) => {
    // GIVEN: table with various field types
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_contacts',
          name: 'contacts',
          fields: [
            { id: 'fld_name', name: 'name', type: 'single-line-text', required: true },
            { id: 'fld_email', name: 'email', type: 'email', required: true, unique: true },
            { id: 'fld_age', name: 'age', type: 'integer' },
          ],
        },
      ],
    })

    // WHEN: uploading CSV file
    const csvContent = `name,email,age
John Doe,john@example.com,30
Jane Smith,jane@example.com,25
Bob Wilson,invalid-email,35`

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const formData = new FormData()
    formData.append('file', blob, 'contacts.csv')

    const response = await request.post('/api/tables/tbl_contacts/import', {
      headers: { Authorization: 'Bearer valid_token' },
      data: formData,
    })

    // THEN: 207 Multi-Status with import results

    expect(response.status()).toBe(207)
    const body = await response.json()

    expect(body.imported).toBe(2) // John and Jane
    expect(body.failed).toBe(1) // Bob
    expect(body.errors).toHaveLength(1)
    expect(body.errors[0]).toMatchObject({
      row: 3,
      field: 'email',
      error: 'invalid_format',
      value: 'invalid-email',
    })
  }
)
```

#### API-IMPORT-CSV-002: CSV Import with Field Mapping

```typescript
test(
  'API-IMPORT-CSV-002: should map CSV columns to table fields',
  { tag: '@spec' },
  async ({ startServerWithSchema, request }) => {
    // GIVEN: table with different field names than CSV
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_users',
          name: 'users',
          fields: [
            { id: 'fld_full_name', name: 'full_name', type: 'single-line-text' },
            { id: 'fld_email_address', name: 'email_address', type: 'email' },
          ],
        },
      ],
    })

    // WHEN: uploading CSV with mapping
    const csvContent = `Name,Email
Alice Johnson,alice@example.com
Bob Smith,bob@example.com`

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const formData = new FormData()
    formData.append('file', blob, 'users.csv')
    formData.append(
      'mapping',
      JSON.stringify({
        Name: 'full_name',
        Email: 'email_address',
      })
    )

    const response = await request.post('/api/tables/tbl_users/import', {
      headers: { Authorization: 'Bearer valid_token' },
      data: formData,
    })

    // THEN: records imported with mapped fields

    expect(response.status()).toBe(201)
    const body = await response.json()
    expect(body.imported).toBe(2)

    // Verify data
    const records = await request.get('/api/tables/tbl_users/records', {
      headers: { Authorization: 'Bearer valid_token' },
    })
    const recordsBody = await records.json()

    expect(recordsBody.records[0].fields).toMatchObject({
      full_name: 'Alice Johnson',
      email_address: 'alice@example.com',
    })
  }
)
```

#### API-EXPORT-CSV-001: CSV Export with Filters

```typescript
test(
  'API-EXPORT-CSV-001: should export table records to CSV with filters',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, request }) => {
    // GIVEN: table with multiple records
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
      ('Laptop', 1200.00, 'Electronics'),
      ('Desk', 300.00, 'Furniture'),
      ('Mouse', 25.00, 'Electronics')
    `)

    // WHEN: exporting with filter (category=Electronics)
    const response = await request.get(
      '/api/tables/tbl_products/export?format=csv&filter=category=Electronics',
      {
        headers: { Authorization: 'Bearer valid_token' },
      }
    )

    // THEN: CSV file with filtered records

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toBe('text/csv')
    expect(response.headers()['content-disposition']).toMatch(
      /attachment; filename="products-.*\.csv"/
    )

    const csvContent = await response.text()
    const lines = csvContent.split('\n')

    expect(lines[0]).toBe('name,price,category')
    expect(lines[1]).toBe('Laptop,1200.00,Electronics')
    expect(lines[2]).toBe('Mouse,25.00,Electronics')
    expect(lines.length).toBe(4) // Header + 2 records + empty line
  }
)
```

#### API-EXPORT-JSON-001: JSON Export

```typescript
test(
  'API-EXPORT-JSON-001: should export table records to JSON format',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, request }) => {
    // GIVEN: table with records
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_tasks',
          name: 'tasks',
          fields: [
            { id: 'fld_title', name: 'title', type: 'single-line-text' },
            { id: 'fld_completed', name: 'completed', type: 'checkbox' },
          ],
        },
      ],
    })

    await executeQuery(`
      INSERT INTO tasks (title, completed) VALUES
      ('Task 1', true),
      ('Task 2', false)
    `)

    // WHEN: exporting as JSON
    const response = await request.get('/api/tables/tbl_tasks/export?format=json', {
      headers: { Authorization: 'Bearer valid_token' },
    })

    // THEN: JSON file with records

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toBe('application/json')

    const jsonContent = await response.json()
    expect(jsonContent.records).toHaveLength(2)
    expect(jsonContent.records[0]).toMatchObject({
      fields: {
        title: 'Task 1',
        completed: true,
      },
    })
  }
)
```

---

## P2.3: API Versioning + Caching

**File**: `specs/api/versioning/api-versions.spec.ts` (NEW)
**Current Status**: Missing
**Effort**: 1.5 weeks

### Test Scenarios

#### API-VERSION-001: Version Negotiation via Accept Header

```typescript
test(
  'API-VERSION-001: should route request to API version based on Accept header',
  { tag: '@spec' },
  async ({ startServerWithSchema, request }) => {
    // GIVEN: API with multiple versions (v1, v2)
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_users',
          name: 'users',
          fields: [{ id: 'fld_name', name: 'name', type: 'single-line-text' }],
        },
      ],
    })

    // WHEN: requesting v1 API
    const responseV1 = await request.get('/api/tables/tbl_users/records', {
      headers: {
        Authorization: 'Bearer valid_token',
        Accept: 'application/vnd.sovrium.v1+json',
      },
    })

    // WHEN: requesting v2 API
    const responseV2 = await request.get('/api/tables/tbl_users/records', {
      headers: {
        Authorization: 'Bearer valid_token',
        Accept: 'application/vnd.sovrium.v2+json',
      },
    })

    // THEN: responses differ by version

    expect(responseV1.status()).toBe(200)
    expect(responseV1.headers()['x-api-version']).toBe('1.0')

    expect(responseV2.status()).toBe(200)
    expect(responseV2.headers()['x-api-version']).toBe('2.0')

    const bodyV1 = await responseV1.json()
    const bodyV2 = await responseV2.json()

    // V1 structure
    expect(bodyV1).toHaveProperty('data') // Legacy structure

    // V2 structure
    expect(bodyV2).toHaveProperty('records') // New structure
  }
)
```

#### API-VERSION-002: Deprecation Warnings

```typescript
test(
  'API-VERSION-002: should return deprecation warning for old API versions',
  { tag: '@spec' },
  async ({ startServerWithSchema, request }) => {
    // GIVEN: API v1 marked as deprecated
    await startServerWithSchema({
      name: 'test-app',
      apiVersions: {
        v1: {
          deprecated: true,
          sunsetDate: '2026-01-01',
        },
        v2: {
          current: true,
        },
      },
      tables: [
        {
          id: 'tbl_data',
          name: 'data',
          fields: [{ id: 'fld_value', name: 'value', type: 'single-line-text' }],
        },
      ],
    })

    // WHEN: using deprecated v1 API
    const response = await request.get('/api/v1/tables/tbl_data/records', {
      headers: { Authorization: 'Bearer valid_token' },
    })

    // THEN: deprecation warning in headers

    expect(response.status()).toBe(200)
    expect(response.headers()['deprecation']).toBe('true')
    expect(response.headers()['sunset']).toBe('Sat, 01 Jan 2026 00:00:00 GMT')
    expect(response.headers()['link']).toMatch(/<.*\/api\/v2\/.*>; rel="alternate"/)
  }
)
```

#### API-CACHE-ETAG-001: ETag Support for Conditional Requests

```typescript
test(
  'API-CACHE-ETAG-001: should return 304 Not Modified when ETag matches',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, request }) => {
    // GIVEN: table with records
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_products',
          name: 'products',
          fields: [{ id: 'fld_name', name: 'name', type: 'single-line-text' }],
        },
      ],
    })

    await executeQuery(`INSERT INTO products (name) VALUES ('Product A')`)

    // WHEN: first request
    const response1 = await request.get('/api/tables/tbl_products/records', {
      headers: { Authorization: 'Bearer valid_token' },
    })

    const etag = response1.headers()['etag']
    expect(etag).toBeDefined()

    // WHEN: second request with If-None-Match header
    const response2 = await request.get('/api/tables/tbl_products/records', {
      headers: {
        Authorization: 'Bearer valid_token',
        'If-None-Match': etag,
      },
    })

    // THEN: 304 Not Modified (no body)

    expect(response2.status()).toBe(304)
    expect(await response2.text()).toBe('')

    // WHEN: data changes
    await executeQuery(`UPDATE products SET name='Product B' WHERE name='Product A'`)

    // WHEN: third request with old ETag
    const response3 = await request.get('/api/tables/tbl_products/records', {
      headers: {
        Authorization: 'Bearer valid_token',
        'If-None-Match': etag,
      },
    })

    // THEN: 200 OK with new data (ETag mismatch)

    expect(response3.status()).toBe(200)
    const newEtag = response3.headers()['etag']
    expect(newEtag).not.toBe(etag)
  }
)
```

#### API-CACHE-CONTROL-001: Cache-Control Headers

```typescript
test(
  'API-CACHE-CONTROL-001: should set appropriate Cache-Control headers',
  { tag: '@spec' },
  async ({ startServerWithSchema, request }) => {
    // GIVEN: table with caching configuration
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_static',
          name: 'static_data',
          fields: [{ id: 'fld_value', name: 'value', type: 'single-line-text' }],
          caching: {
            maxAge: 3600, // 1 hour
            staleWhileRevalidate: 86400, // 24 hours
          },
        },
      ],
    })

    // WHEN: GET request
    const response = await request.get('/api/tables/tbl_static/records', {
      headers: { Authorization: 'Bearer valid_token' },
    })

    // THEN: Cache-Control headers set

    expect(response.status()).toBe(200)
    expect(response.headers()['cache-control']).toMatch(/max-age=3600/)
    expect(response.headers()['cache-control']).toMatch(/stale-while-revalidate=86400/)
  }
)
```

---

## P2.4: Full-Text Search

**File**: `specs/api/search/full-text-search.spec.ts` (NEW)
**Current Status**: Missing
**Effort**: 1.5 weeks

### Test Scenarios

#### API-SEARCH-FTS-001: Basic Full-Text Search

```typescript
test(
  'API-SEARCH-FTS-001: should search records using full-text query',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, request }) => {
    // GIVEN: table with searchable text fields
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_articles',
          name: 'articles',
          fields: [
            { id: 'fld_title', name: 'title', type: 'single-line-text' },
            { id: 'fld_content', name: 'content', type: 'long-text' },
          ],
          search: {
            enabled: true,
            fields: ['fld_title', 'fld_content'],
          },
        },
      ],
    })

    await executeQuery(`
      INSERT INTO articles (title, content) VALUES
      ('Introduction to PostgreSQL', 'PostgreSQL is a powerful open-source database system'),
      ('Getting Started with TypeScript', 'TypeScript adds static typing to JavaScript'),
      ('Building APIs with Hono', 'Hono is a fast web framework for building APIs')
    `)

    // WHEN: searching for 'PostgreSQL'
    const response = await request.get('/api/tables/tbl_articles/search?q=PostgreSQL', {
      headers: { Authorization: 'Bearer valid_token' },
    })

    // THEN: matching article returned

    expect(response.status()).toBe(200)
    const body = await response.json()

    expect(body.results).toHaveLength(1)
    expect(body.results[0].fields.title).toBe('Introduction to PostgreSQL')
  }
)
```

#### API-SEARCH-FTS-002: Search with Ranking

```typescript
test(
  'API-SEARCH-FTS-002: should rank search results by relevance',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, request }) => {
    // GIVEN: table with weighted search fields
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_posts',
          name: 'posts',
          fields: [
            { id: 'fld_title', name: 'title', type: 'single-line-text' },
            { id: 'fld_body', name: 'body', type: 'long-text' },
          ],
          search: {
            enabled: true,
            fields: [
              { field: 'fld_title', weight: 'A' }, // Highest weight
              { field: 'fld_body', weight: 'B' }, // Lower weight
            ],
          },
        },
      ],
    })

    await executeQuery(`
      INSERT INTO posts (title, body) VALUES
      ('TypeScript Guide', 'Learn JavaScript basics first'),
      ('JavaScript Tips', 'TypeScript adds types to JavaScript'),
      ('TypeScript Best Practices', 'TypeScript improves code quality')
    `)

    // WHEN: searching for 'TypeScript'
    const response = await request.get('/api/tables/tbl_posts/search?q=TypeScript', {
      headers: { Authorization: 'Bearer valid_token' },
    })

    // THEN: results ranked by relevance (title matches rank higher)

    expect(response.status()).toBe(200)
    const body = await response.json()

    expect(body.results).toHaveLength(3)

    // Title matches first
    expect(body.results[0].fields.title).toBe('TypeScript Best Practices')
    expect(body.results[0]._score).toBeGreaterThan(body.results[2]._score)

    // Body match last
    expect(body.results[2].fields.title).toBe('JavaScript Tips')
  }
)
```

#### API-SEARCH-FTS-003: Field-Specific Search

```typescript
test(
  'API-SEARCH-FTS-003: should search within specific field only',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, request }) => {
    // GIVEN: table with multiple text fields
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_books',
          name: 'books',
          fields: [
            { id: 'fld_title', name: 'title', type: 'single-line-text' },
            { id: 'fld_author', name: 'author', type: 'single-line-text' },
            { id: 'fld_description', name: 'description', type: 'long-text' },
          ],
          search: {
            enabled: true,
            fields: ['fld_title', 'fld_author', 'fld_description'],
          },
        },
      ],
    })

    await executeQuery(`
      INSERT INTO books (title, author, description) VALUES
      ('Clean Code', 'Robert Martin', 'A book about software craftsmanship'),
      ('The Pragmatic Programmer', 'Andy Hunt', 'Written by Robert Smith'),
      ('Design Patterns', 'Gang of Four', 'Classic book on software design')
    `)

    // WHEN: searching for 'Robert' in author field only
    const response = await request.get('/api/tables/tbl_books/search?q=Robert&fields=author', {
      headers: { Authorization: 'Bearer valid_token' },
    })

    // THEN: only book with 'Robert' in author field returned

    expect(response.status()).toBe(200)
    const body = await response.json()

    expect(body.results).toHaveLength(1)
    expect(body.results[0].fields.title).toBe('Clean Code')
    expect(body.results[0].fields.author).toBe('Robert Martin')
  }
)
```

#### API-SEARCH-FTS-004: Search Performance (Large Dataset)

```typescript
test(
  'API-SEARCH-FTS-004: should search 100k records in < 100ms',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, request }) => {
    // GIVEN: table with 100k records and GIN index
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_documents',
          name: 'documents',
          fields: [{ id: 'fld_content', name: 'content', type: 'long-text' }],
          search: {
            enabled: true,
            fields: ['fld_content'],
            indexType: 'GIN', // Generalized Inverted Index
          },
        },
      ],
    })

    // Insert 100k records (batch)
    const batchSize = 1000
    for (let i = 0; i < 100; i++) {
      const values = Array.from(
        { length: batchSize },
        (_, j) => `('Document ${i * batchSize + j} with searchable content about database systems')`
      ).join(',')
      await executeQuery(`INSERT INTO documents (content) VALUES ${values}`)
    }

    // Insert target record
    await executeQuery(`
      INSERT INTO documents (content) VALUES ('Special unique searchable term postgresql')
    `)

    // WHEN: searching with performance measurement
    const startTime = performance.now()
    const response = await request.get('/api/tables/tbl_documents/search?q=postgresql', {
      headers: { Authorization: 'Bearer valid_token' },
    })
    const endTime = performance.now()

    // THEN: search completes in < 100ms

    expect(response.status()).toBe(200)
    expect(endTime - startTime).toBeLessThan(100)

    const body = await response.json()
    expect(body.results).toHaveLength(1)
  }
)
```

---

## P2.5: Webhooks & Real-Time Updates

**File**: `specs/api/webhooks/webhooks.spec.ts` (NEW)
**Current Status**: Missing
**Effort**: 2 weeks

### Test Scenarios

#### API-WEBHOOK-001: Register Webhook for Record Created

```typescript
test(
  'API-WEBHOOK-001: should trigger webhook when record created',
  { tag: '@spec' },
  async ({ startServerWithSchema, request, mockWebhookServer }) => {
    // GIVEN: webhook registered for record.created event
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

    // Register webhook
    const webhookResponse = await request.post('/api/webhooks', {
      headers: { Authorization: 'Bearer valid_token' },
      data: {
        url: mockWebhookServer.url,
        events: ['record.created'],
        tableId: 'tbl_orders',
      },
    })
    expect(webhookResponse.status()).toBe(201)

    // WHEN: creating new record
    const createResponse = await request.post('/api/tables/tbl_orders/records', {
      headers: { Authorization: 'Bearer valid_token' },
      data: {
        fields: { total: 150.0 },
      },
    })
    expect(createResponse.status()).toBe(201)

    // THEN: webhook called with record data

    await mockWebhookServer.waitForRequest()
    const webhookPayload = mockWebhookServer.lastRequest.body

    expect(webhookPayload).toMatchObject({
      event: 'record.created',
      tableId: 'tbl_orders',
      record: {
        fields: {
          total: '150.00',
        },
      },
    })
  }
)
```

#### API-WEBHOOK-002: Webhook Retry on Failure

```typescript
test(
  'API-WEBHOOK-002: should retry webhook delivery on failure with exponential backoff',
  { tag: '@spec' },
  async ({ startServerWithSchema, request, mockWebhookServer }) => {
    // GIVEN: webhook registered, server initially fails
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_events',
          name: 'events',
          fields: [{ id: 'fld_name', name: 'name', type: 'single-line-text' }],
        },
      ],
    })

    mockWebhookServer.failNextRequests(2) // Fail first 2 attempts

    await request.post('/api/webhooks', {
      headers: { Authorization: 'Bearer valid_token' },
      data: {
        url: mockWebhookServer.url,
        events: ['record.created'],
        tableId: 'tbl_events',
        retryConfig: {
          maxRetries: 3,
          backoffMultiplier: 2,
          initialDelay: 100, // ms
        },
      },
    })

    // WHEN: creating record
    await request.post('/api/tables/tbl_events/records', {
      headers: { Authorization: 'Bearer valid_token' },
      data: { fields: { name: 'Event 1' } },
    })

    // THEN: webhook retried with exponential backoff

    await mockWebhookServer.waitForRequests(3)

    const attempts = mockWebhookServer.requests
    expect(attempts).toHaveLength(3)

    // Verify exponential backoff timing
    const delay1 = attempts[1].timestamp - attempts[0].timestamp
    const delay2 = attempts[2].timestamp - attempts[1].timestamp

    expect(delay1).toBeGreaterThanOrEqual(100) // 100ms
    expect(delay2).toBeGreaterThanOrEqual(200) // 200ms (2x)
    expect(delay2 / delay1).toBeCloseTo(2, 0.5) // Exponential growth
  }
)
```

#### API-REALTIME-WS-001: WebSocket Connection for Live Updates

```typescript
test(
  'API-REALTIME-WS-001: should receive real-time updates via WebSocket',
  { tag: '@spec' },
  async ({ startServerWithSchema, request, connectWebSocket, executeQuery }) => {
    // GIVEN: table with real-time enabled
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_chat',
          name: 'chat_messages',
          fields: [{ id: 'fld_message', name: 'message', type: 'long-text' }],
          realtime: {
            enabled: true,
          },
        },
      ],
    })

    // WHEN: connecting WebSocket and subscribing
    const ws = await connectWebSocket('/api/realtime', {
      headers: { Authorization: 'Bearer valid_token' },
    })

    await ws.send(
      JSON.stringify({
        action: 'subscribe',
        tableId: 'tbl_chat',
      })
    )

    // WHEN: another client creates record
    await request.post('/api/tables/tbl_chat/records', {
      headers: { Authorization: 'Bearer other_user_token' },
      data: { fields: { message: 'Hello World' } },
    })

    // THEN: WebSocket receives real-time update

    const message = await ws.waitForMessage()
    const payload = JSON.parse(message)

    expect(payload).toMatchObject({
      event: 'record.created',
      tableId: 'tbl_chat',
      record: {
        fields: {
          message: 'Hello World',
        },
      },
    })
  }
)
```

#### API-REALTIME-WS-002: Real-Time Filtering (Per-User Updates)

```typescript
test(
  'API-REALTIME-WS-002: should receive only updates matching subscription filter',
  { tag: '@spec' },
  async ({ startServerWithSchema, request, connectWebSocket }) => {
    // GIVEN: table with real-time filtering
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_notifications',
          name: 'notifications',
          fields: [
            { id: 'fld_user_id', name: 'user_id', type: 'integer' },
            { id: 'fld_message', name: 'message', type: 'single-line-text' },
          ],
          realtime: {
            enabled: true,
            filterBy: 'user_id', // Per-user filtering
          },
        },
      ],
    })

    // WHEN: user connects with filter (user_id=123)
    const ws = await connectWebSocket('/api/realtime', {
      headers: { Authorization: 'Bearer user_123_token' },
    })

    await ws.send(
      JSON.stringify({
        action: 'subscribe',
        tableId: 'tbl_notifications',
        filter: { user_id: 123 },
      })
    )

    // WHEN: creating notification for user 123
    await request.post('/api/tables/tbl_notifications/records', {
      headers: { Authorization: 'Bearer admin_token' },
      data: { fields: { user_id: 123, message: 'For User 123' } },
    })

    // WHEN: creating notification for user 456
    await request.post('/api/tables/tbl_notifications/records', {
      headers: { Authorization: 'Bearer admin_token' },
      data: { fields: { user_id: 456, message: 'For User 456' } },
    })

    // THEN: only user 123 notification received

    const message = await ws.waitForMessage(1000)
    const payload = JSON.parse(message)

    expect(payload.record.fields.user_id).toBe(123)
    expect(payload.record.fields.message).toBe('For User 123')

    // Verify no second message received
    await expect(ws.waitForMessage(500)).rejects.toThrow(/timeout/)
  }
)
```

---

## Summary: P2 Test Coverage

| Gap                          | New Tests    | Effort      | Dependencies             |
| ---------------------------- | ------------ | ----------- | ------------------------ |
| **Internationalization**     | 4 tests      | 2 weeks     | Field system, API        |
| **Data Import/Export**       | 4 tests      | 2 weeks     | Record APIs              |
| **API Versioning + Caching** | 4 tests      | 1.5 weeks   | API framework            |
| **Full-Text Search**         | 4 tests      | 1.5 weeks   | Record APIs, PostgreSQL  |
| **Webhooks & Real-Time**     | 4 tests      | 2 weeks     | API framework, WebSocket |
| **TOTAL**                    | **20 tests** | **9 weeks** | -                        |

**Expected Coverage Increase**: 75% → 95% (619/651 tests passing after P2 complete)

---

## Remaining P3 Gaps (5% coverage)

**P3 gaps (Nice-to-Have)** account for the final 5% coverage:

- Formula field editor specs (syntax, autocomplete)
- Automation/workflow specs (triggers, actions)
- Custom validation rule specs
- Conditional formatting specs
- Migration versioning + dependency graph specs

These can be addressed in **Phase 4** (7 weeks) after P0-P2 are complete.

---

## Implementation Priority Summary

**Quarter 1** (12 weeks):

- **P0 Complete** (6 weeks) → 40% coverage
- **60% of P1** (6 weeks) → 60% coverage
- **Milestone**: Core CRUD + Permissions + Field Types working

**Quarter 2** (12 weeks):

- **Remaining P1** (3 weeks) → 75% coverage
- **P2 Complete** (9 weeks) → 95% coverage
- **Milestone**: Feature parity with Airtable/Baserow

**Quarter 3** (7 weeks):

- **P3 Complete** (7 weeks) → 100% coverage
- **Milestone**: Advanced admin features + DX polish

---

**Next Steps**: Begin P0 implementation using TEST-SCENARIOS-P0-CRITICAL.md as your guide.
