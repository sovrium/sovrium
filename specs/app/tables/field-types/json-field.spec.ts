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
      await startServerWithSchema({
        name: 'test-app',
        tables: [{ id: 1, name: 'products', fields: [{ id: 1, name: 'metadata', type: 'json' }] }],
      })

      const columnInfo = await executeQuery(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='products' AND column_name='metadata'"
      )
      expect(columnInfo.column_name).toBe('metadata')
      expect(columnInfo.data_type).toBe('jsonb')

      const jsonObject = await executeQuery(
        'INSERT INTO products (metadata) VALUES (\'{"color": "red", "size": "large"}\') RETURNING metadata'
      )
      expect(jsonObject.metadata).toEqual({ color: 'red', size: 'large' })

      const jsonArray = await executeQuery(
        "INSERT INTO products (metadata) VALUES ('[1, 2, 3]') RETURNING metadata"
      )
      expect(jsonArray.metadata).toEqual([1, 2, 3])
    }
  )

  test.fixme(
    'APP-JSON-FIELD-002: should support -> and ->> operators for field extraction',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [{ id: 2, name: 'settings', fields: [{ id: 1, name: 'config', type: 'json' }] }],
      })

      await executeQuery(
        'INSERT INTO settings (config) VALUES (\'{"theme": "dark", "notifications": {"email": true, "sms": false}}\')'
      )

      const jsonExtract = await executeQuery(
        "SELECT config -> 'theme' as theme FROM settings WHERE id = 1"
      )
      expect(jsonExtract.theme).toBe('"dark"')

      const textExtract = await executeQuery(
        "SELECT config ->> 'theme' as theme FROM settings WHERE id = 1"
      )
      expect(textExtract.theme).toBe('dark')

      const nestedExtract = await executeQuery(
        "SELECT config -> 'notifications' ->> 'email' as email_enabled FROM settings WHERE id = 1"
      )
      expect(nestedExtract.email_enabled).toBe('true')
    }
  )

  test.fixme(
    'APP-JSON-FIELD-003: should support containment and existence operators',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [{ id: 3, name: 'users', fields: [{ id: 1, name: 'preferences', type: 'json' }] }],
      })

      await executeQuery(
        'INSERT INTO users (preferences) VALUES (\'{"language": "en", "timezone": "UTC"}\'), (\'{"language": "fr", "timezone": "Europe/Paris"}\')'
      )

      const languageFilter = await executeQuery(
        "SELECT COUNT(*) as count FROM users WHERE preferences ->> 'language' = 'en'"
      )
      expect(languageFilter.count).toBe(1)

      const keyExists = await executeQuery(
        "SELECT COUNT(*) as count FROM users WHERE preferences ? 'timezone'"
      )
      expect(keyExists.count).toBe(2)

      const containsOperator = await executeQuery(
        'SELECT COUNT(*) as count FROM users WHERE preferences @> \'{"language": "fr"}\''
      )
      expect(containsOperator.count).toBe(1)
    }
  )

  test.fixme(
    'APP-JSON-FIELD-004: should create GIN index for efficient JSON queries',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
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

      const indexInfo = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_documents_data'"
      )
      expect(indexInfo.indexname).toBe('idx_documents_data')
      expect(indexInfo.tablename).toBe('documents')

      const indexDef = await executeQuery(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_documents_data'"
      )
      expect(indexDef.indexdef).toBe(
        'CREATE INDEX idx_documents_data ON public.documents USING gin (data)'
      )
    }
  )

  test.fixme(
    'APP-JSON-FIELD-005: should support in-place JSON field updates',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [{ id: 5, name: 'events', fields: [{ id: 1, name: 'payload', type: 'json' }] }],
      })

      await executeQuery('INSERT INTO events (payload) VALUES (\'{"type": "click", "count": 1}\')')

      const initialValue = await executeQuery('SELECT payload FROM events WHERE id = 1')
      expect(initialValue.payload).toEqual({ type: 'click', count: 1 })

      const updateCount = await executeQuery(
        "UPDATE events SET payload = jsonb_set(payload, '{count}', '5') WHERE id = 1 RETURNING payload"
      )
      expect(updateCount.payload).toEqual({ type: 'click', count: 5 })

      const addField = await executeQuery(
        "UPDATE events SET payload = jsonb_set(payload, '{user_id}', '\"user123\"') WHERE id = 1 RETURNING payload"
      )
      expect(addField.payload).toEqual({ type: 'click', count: 5, user_id: 'user123' })
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-JSON-REGRESSION-001: user can complete full json-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
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

      await executeQuery(
        'INSERT INTO data (properties) VALUES (\'{"key1": "value1", "nested": {"key2": 42}}\')'
      )
      const stored = await executeQuery('SELECT properties FROM data WHERE id = 1')
      expect(stored.properties).toEqual({ key1: 'value1', nested: { key2: 42 } })

      const extracted = await executeQuery(
        "SELECT properties -> 'nested' ->> 'key2' as key2 FROM data WHERE id = 1"
      )
      expect(extracted.key2).toBe('42')

      const filtered = await executeQuery(
        'SELECT COUNT(*) as count FROM data WHERE properties @> \'{"key1": "value1"}\''
      )
      expect(filtered.count).toBe(1)
    }
  )
})
