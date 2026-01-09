/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for JSON Field
 *
 * Source: src/domain/models/app/table/field-types/json-field.ts
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('JSON Field', () => {
  test(
    'APP-TABLES-FIELD-TYPES-JSON-001: should create PostgreSQL JSONB column for structured JSON data',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'products',
            fields: [{ id: 1, name: 'metadata', type: 'json' }],
          },
        ],
      })

      // WHEN: querying the database
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='products' AND column_name='metadata'"
      )
      // THEN: assertion
      expect(columnInfo.column_name).toBe('metadata')
      // THEN: assertion
      expect(columnInfo.data_type).toBe('jsonb')

      // WHEN: querying the database
      const jsonObject = await executeQuery(
        'INSERT INTO products (metadata) VALUES (\'{"color": "red", "size": "large"}\') RETURNING metadata'
      )
      // THEN: assertion
      expect(jsonObject.metadata).toEqual({ color: 'red', size: 'large' })

      // WHEN: querying the database
      const jsonArray = await executeQuery(
        "INSERT INTO products (metadata) VALUES ('[1, 2, 3]') RETURNING metadata"
      )
      // THEN: assertion
      expect(jsonArray.metadata).toEqual([1, 2, 3])
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-JSON-002: should support -> and ->> operators for field extraction',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'settings',
            fields: [{ id: 1, name: 'config', type: 'json' }],
          },
        ],
      })

      // WHEN: querying the database
      await executeQuery(
        'INSERT INTO settings (config) VALUES (\'{"theme": "dark", "notifications": {"email": true, "sms": false}}\')'
      )

      // WHEN: using -> operator (returns JSONB, driver parses to JS value)
      const jsonExtract = await executeQuery(
        "SELECT config -> 'theme' as theme FROM settings WHERE id = 1"
      )
      // THEN: JSON string scalar is parsed to JS string
      expect(jsonExtract.theme).toBe('dark')

      // WHEN: using ->> operator (returns TEXT)
      const textExtract = await executeQuery(
        "SELECT config ->> 'theme' as theme FROM settings WHERE id = 1"
      )
      // THEN: text extraction returns plain string
      expect(textExtract.theme).toBe('dark')

      // WHEN: using -> to get JSONB object (demonstrates actual -> vs ->> difference)
      const jsonObject = await executeQuery(
        "SELECT config -> 'notifications' as notifications FROM settings WHERE id = 1"
      )
      // THEN: -> preserves JSONB type, parsed to JS object
      expect(jsonObject.notifications).toEqual({ email: true, sms: false })

      // WHEN: using chained operators (-> then ->>)
      const nestedExtract = await executeQuery(
        "SELECT config -> 'notifications' ->> 'email' as email_enabled FROM settings WHERE id = 1"
      )
      // THEN: final ->> extracts as text
      expect(nestedExtract.email_enabled).toBe('true')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-JSON-003: should support containment and existence operators',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'users',
            fields: [{ id: 1, name: 'preferences', type: 'json' }],
          },
        ],
      })

      // WHEN: querying the database
      await executeQuery(
        'INSERT INTO users (preferences) VALUES (\'{"language": "en", "timezone": "UTC"}\'), (\'{"language": "fr", "timezone": "Europe/Paris"}\')'
      )

      // WHEN: filtering by JSON field value using ->> operator
      const languageFilter = await executeQuery(
        "SELECT COUNT(*) as count FROM users WHERE preferences ->> 'language' = 'en'"
      )
      // THEN: one user matches (COUNT returns bigint, coerce to number)
      expect(Number(languageFilter.count)).toBe(1)

      // WHEN: checking key existence using ? operator
      const keyExists = await executeQuery(
        "SELECT COUNT(*) as count FROM users WHERE preferences ? 'timezone'"
      )
      // THEN: both users have timezone key
      expect(Number(keyExists.count)).toBe(2)

      // WHEN: using @> containment operator
      const containsOperator = await executeQuery(
        'SELECT COUNT(*) as count FROM users WHERE preferences @> \'{"language": "fr"}\''
      )
      // THEN: one user matches containment
      expect(Number(containsOperator.count)).toBe(1)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-JSON-004: should create GIN index for efficient JSON queries',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'documents',
            fields: [{ id: 1, name: 'data', type: 'json', indexed: true }],
          },
        ],
      })

      // WHEN: querying the database
      const indexInfo = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_documents_data'"
      )
      // THEN: assertion
      expect(indexInfo.indexname).toBe('idx_documents_data')
      // THEN: assertion
      expect(indexInfo.tablename).toBe('documents')

      // WHEN: querying the database
      const indexDef = await executeQuery(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_documents_data'"
      )
      // THEN: assertion
      expect(indexDef.indexdef).toBe(
        'CREATE INDEX idx_documents_data ON public.documents USING gin (data)'
      )
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-JSON-005: should support in-place JSON field updates',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'events',
            fields: [{ id: 1, name: 'payload', type: 'json' }],
          },
        ],
      })

      // WHEN: executing query
      await executeQuery('INSERT INTO events (payload) VALUES (\'{"type": "click", "count": 1}\')')

      // WHEN: querying the database
      const initialValue = await executeQuery('SELECT payload FROM events WHERE id = 1')
      // THEN: assertion
      expect(initialValue.payload).toEqual({ type: 'click', count: 1 })

      // WHEN: querying the database
      const updateCount = await executeQuery(
        "UPDATE events SET payload = jsonb_set(payload, '{count}', '5') WHERE id = 1 RETURNING payload"
      )
      // THEN: assertion
      expect(updateCount.payload).toEqual({ type: 'click', count: 5 })

      // WHEN: querying the database
      const addField = await executeQuery(
        "UPDATE events SET payload = jsonb_set(payload, '{user_id}', '\"user123\"') WHERE id = 1 RETURNING payload"
      )
      // THEN: assertion
      expect(addField.payload).toEqual({ type: 'click', count: 5, user_id: 'user123' })
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-JSON-REGRESSION: user can complete full json-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // Setup: Start server with json fields demonstrating all configurations
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'data',
            fields: [
              { id: 1, name: 'metadata', type: 'json' },
              { id: 2, name: 'config', type: 'json' },
              { id: 3, name: 'preferences', type: 'json' },
              { id: 4, name: 'indexed_data', type: 'json', indexed: true },
              { id: 5, name: 'payload', type: 'json' },
            ],
          },
        ],
      })

      await test.step('APP-TABLES-FIELD-TYPES-JSON-001: Creates PostgreSQL JSONB column', async () => {
        // WHEN: querying column info for json field
        const columnInfo = await executeQuery(
          "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='data' AND column_name='metadata'"
        )
        // THEN: JSONB column is created
        expect(columnInfo.column_name).toBe('metadata')
        expect(columnInfo.data_type).toBe('jsonb')

        // WHEN: inserting JSON object
        const jsonObject = await executeQuery(
          'INSERT INTO data (metadata) VALUES (\'{"color": "red", "size": "large"}\') RETURNING metadata'
        )
        // THEN: JSON object is stored correctly
        expect(jsonObject.metadata).toEqual({ color: 'red', size: 'large' })

        // WHEN: inserting JSON array
        const jsonArray = await executeQuery(
          "INSERT INTO data (metadata) VALUES ('[1, 2, 3]') RETURNING metadata"
        )
        // THEN: JSON array is stored correctly
        expect(jsonArray.metadata).toEqual([1, 2, 3])
      })

      await test.step('APP-TABLES-FIELD-TYPES-JSON-002: Supports -> and ->> operators for field extraction', async () => {
        // WHEN: inserting config with nested JSON
        await executeQuery(
          'INSERT INTO data (config) VALUES (\'{"theme": "dark", "notifications": {"email": true, "sms": false}}\')'
        )

        // WHEN: using -> operator (returns JSONB)
        const jsonExtract = await executeQuery(
          "SELECT config -> 'theme' as theme FROM data WHERE config IS NOT NULL LIMIT 1"
        )
        // THEN: JSON string scalar is parsed to JS string
        expect(jsonExtract.theme).toBe('dark')

        // WHEN: using ->> operator (returns TEXT)
        const textExtract = await executeQuery(
          "SELECT config ->> 'theme' as theme FROM data WHERE config IS NOT NULL LIMIT 1"
        )
        // THEN: text extraction returns plain string
        expect(textExtract.theme).toBe('dark')

        // WHEN: using -> to get JSONB object
        const jsonObject = await executeQuery(
          "SELECT config -> 'notifications' as notifications FROM data WHERE config IS NOT NULL LIMIT 1"
        )
        // THEN: -> preserves JSONB type, parsed to JS object
        expect(jsonObject.notifications).toEqual({ email: true, sms: false })
      })

      await test.step('APP-TABLES-FIELD-TYPES-JSON-003: Supports containment and existence operators', async () => {
        // WHEN: inserting preferences with different values
        await executeQuery(
          'INSERT INTO data (preferences) VALUES (\'{"language": "en", "timezone": "UTC"}\'), (\'{"language": "fr", "timezone": "Europe/Paris"}\')'
        )

        // WHEN: filtering by JSON field value using ->> operator
        const languageFilter = await executeQuery(
          "SELECT COUNT(*) as count FROM data WHERE preferences ->> 'language' = 'en'"
        )
        // THEN: one row matches
        expect(Number(languageFilter.count)).toBe(1)

        // WHEN: checking key existence using ? operator
        const keyExists = await executeQuery(
          "SELECT COUNT(*) as count FROM data WHERE preferences ? 'timezone'"
        )
        // THEN: two rows have timezone key
        expect(Number(keyExists.count)).toBe(2)

        // WHEN: using @> containment operator
        const containsOperator = await executeQuery(
          'SELECT COUNT(*) as count FROM data WHERE preferences @> \'{"language": "fr"}\''
        )
        // THEN: one row matches containment
        expect(Number(containsOperator.count)).toBe(1)
      })

      await test.step('APP-TABLES-FIELD-TYPES-JSON-004: Creates GIN index for efficient JSON queries', async () => {
        // WHEN: checking for GIN index on indexed json field
        const indexInfo = await executeQuery(
          "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_data_indexed_data'"
        )
        // THEN: GIN index exists
        expect(indexInfo.indexname).toBe('idx_data_indexed_data')
        expect(indexInfo.tablename).toBe('data')

        // WHEN: querying index definition
        const indexDef = await executeQuery(
          "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_data_indexed_data'"
        )
        // THEN: index uses GIN
        expect(indexDef.indexdef).toBe(
          'CREATE INDEX idx_data_indexed_data ON public.data USING gin (indexed_data)'
        )
      })

      await test.step('APP-TABLES-FIELD-TYPES-JSON-005: Supports in-place JSON field updates', async () => {
        // WHEN: inserting initial payload
        await executeQuery('INSERT INTO data (payload) VALUES (\'{"type": "click", "count": 1}\')')

        // WHEN: querying initial value
        const initialValue = await executeQuery(
          'SELECT payload FROM data WHERE payload IS NOT NULL LIMIT 1'
        )
        // THEN: initial value is stored correctly
        expect(initialValue.payload).toEqual({ type: 'click', count: 1 })

        // WHEN: updating count using jsonb_set
        const updateCount = await executeQuery(
          "UPDATE data SET payload = jsonb_set(payload, '{count}', '5') WHERE payload IS NOT NULL RETURNING payload"
        )
        // THEN: count is updated
        expect(updateCount.payload).toEqual({ type: 'click', count: 5 })

        // WHEN: adding new field using jsonb_set
        const addField = await executeQuery(
          "UPDATE data SET payload = jsonb_set(payload, '{user_id}', '\"user123\"') WHERE payload ->> 'type' = 'click' RETURNING payload"
        )
        // THEN: new field is added
        expect(addField.payload).toEqual({ type: 'click', count: 5, user_id: 'user123' })
      })
    }
  )
})
