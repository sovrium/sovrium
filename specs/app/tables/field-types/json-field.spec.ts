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
 * Source: specs/app/tables/field-types/json-field/json-field.schema.json
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('JSON Field', () => {
  test.fixme(
    'APP-JSON-FIELD-001: should create PostgreSQL JSONB column for structured JSON data',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [{ id: 1, name: 'products', fields: [{ id: 1, name: 'metadata', type: 'json' }] }],
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

  test.fixme(
    'APP-JSON-FIELD-002: should support -> and ->> operators for field extraction',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [{ id: 2, name: 'settings', fields: [{ id: 1, name: 'config', type: 'json' }] }],
      })

      // WHEN: querying the database
      await executeQuery(
        'INSERT INTO settings (config) VALUES (\'{"theme": "dark", "notifications": {"email": true, "sms": false}}\')'
      )

      // WHEN: querying the database
      const jsonExtract = await executeQuery(
        "SELECT config -> 'theme' as theme FROM settings WHERE id = 1"
      )
      // THEN: assertion
      expect(jsonExtract.theme).toBe('"dark"')

      // WHEN: querying the database
      const textExtract = await executeQuery(
        "SELECT config ->> 'theme' as theme FROM settings WHERE id = 1"
      )
      // THEN: assertion
      expect(textExtract.theme).toBe('dark')

      // WHEN: querying the database
      const nestedExtract = await executeQuery(
        "SELECT config -> 'notifications' ->> 'email' as email_enabled FROM settings WHERE id = 1"
      )
      // THEN: assertion
      expect(nestedExtract.email_enabled).toBe('true')
    }
  )

  test.fixme(
    'APP-JSON-FIELD-003: should support containment and existence operators',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [{ id: 3, name: 'users', fields: [{ id: 1, name: 'preferences', type: 'json' }] }],
      })

      // WHEN: querying the database
      await executeQuery(
        'INSERT INTO users (preferences) VALUES (\'{"language": "en", "timezone": "UTC"}\'), (\'{"language": "fr", "timezone": "Europe/Paris"}\')'
      )

      // WHEN: querying the database
      const languageFilter = await executeQuery(
        "SELECT COUNT(*) as count FROM users WHERE preferences ->> 'language' = 'en'"
      )
      // THEN: assertion
      expect(languageFilter.count).toBe(1)

      // WHEN: querying the database
      const keyExists = await executeQuery(
        "SELECT COUNT(*) as count FROM users WHERE preferences ? 'timezone'"
      )
      // THEN: assertion
      expect(keyExists.count).toBe(2)

      // WHEN: querying the database
      const containsOperator = await executeQuery(
        'SELECT COUNT(*) as count FROM users WHERE preferences @> \'{"language": "fr"}\''
      )
      // THEN: assertion
      expect(containsOperator.count).toBe(1)
    }
  )

  test.fixme(
    'APP-JSON-FIELD-004: should create GIN index for efficient JSON queries',
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

  test.fixme(
    'APP-JSON-FIELD-005: should support in-place JSON field updates',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [{ id: 5, name: 'events', fields: [{ id: 1, name: 'payload', type: 'json' }] }],
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

  test.fixme(
    'APP-JSON-FIELD-006: user can complete full json-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 6,
            name: 'data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'properties', type: 'json' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      await executeQuery(
        'INSERT INTO data (properties) VALUES (\'{"key1": "value1", "nested": {"key2": 42}}\')'
      )
      // WHEN: querying the database
      const stored = await executeQuery('SELECT properties FROM data WHERE id = 1')
      // THEN: assertion
      expect(stored.properties).toEqual({ key1: 'value1', nested: { key2: 42 } })

      const extracted = await executeQuery(
        "SELECT properties -> 'nested' ->> 'key2' as key2 FROM data WHERE id = 1"
      )
      // THEN: assertion
      expect(extracted.key2).toBe('42')

      const filtered = await executeQuery(
        'SELECT COUNT(*) as count FROM data WHERE properties @> \'{"key1": "value1"}\''
      )
      // THEN: assertion
      expect(filtered.count).toBe(1)
    }
  )
})
