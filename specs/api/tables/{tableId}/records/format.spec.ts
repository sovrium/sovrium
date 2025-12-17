/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Record Display Formatting
 *
 * Tests the API's ability to return formatted display values for various field types.
 * Uses `?format=display` query parameter to request formatted responses.
 *
 * Domain: api
 * Spec Count: 25
 *
 * Test Organization:
 * 1. @spec tests - Field-specific formatting tests
 * 2. @regression test - ONE optimized integration test
 *
 * Field Types Covered:
 * - Currency: symbol, position, precision, negative format, thousands separator
 * - Date: US, European, ISO formats, includeTime, timezone
 * - Datetime: 12-hour, 24-hour, timezone
 * - Duration: h:mm, h:mm:ss, decimal formats
 * - Timezone Override: query param ?timezone=..., ISO 8601 serialization, validation
 */

test.describe('Record Display Formatting', () => {
  // ============================================================================
  // Currency Formatting Tests
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-FORMAT-001: should format currency with EUR symbol',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, request }) => {
      // GIVEN: table with currency field configured with EUR currency
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'price', type: 'currency', currency: 'EUR' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })
      await executeQuery('INSERT INTO products (id, price) VALUES (1, 99.99)')

      // WHEN: requesting record with display formatting
      const response = await request.get('/api/tables/1/records?format=display')

      // THEN: currency is formatted with EUR symbol (€)
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.records[0].fields.price.value).toBe(99.99)
      expect(data.records[0].fields.price.displayValue).toBe('€99.99')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-FORMAT-002: should format currency with symbol after amount',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, request }) => {
      // GIVEN: table with currency field configured with symbol after amount
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'invoices',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'total', type: 'currency', currency: 'USD', symbolPosition: 'after' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })
      await executeQuery('INSERT INTO invoices (id, total) VALUES (1, 99.99)')

      // WHEN: requesting record with display formatting
      const response = await request.get('/api/tables/1/records?format=display')

      // THEN: currency is displayed with symbol after amount (99.99$)
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.records[0].fields.total.displayValue).toBe('99.99$')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-FORMAT-003: should format currency with specified decimal precision',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, request }) => {
      // GIVEN: table with currency field configured with 0 decimal places (JPY)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'sales',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'amount', type: 'currency', currency: 'JPY', precision: 0 },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })
      await executeQuery('INSERT INTO sales (id, amount) VALUES (1, 1000)')

      // WHEN: requesting record with display formatting
      const response = await request.get('/api/tables/1/records?format=display')

      // THEN: currency is displayed with no decimal places (¥1000)
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.records[0].fields.amount.displayValue).toBe('¥1000')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-FORMAT-004: should format negative currency in parentheses',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, request }) => {
      // GIVEN: table with currency field configured to use parentheses for negatives
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'transactions',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'balance',
                type: 'currency',
                currency: 'USD',
                negativeFormat: 'parentheses',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })
      await executeQuery('INSERT INTO transactions (id, balance) VALUES (1, -100.00)')

      // WHEN: requesting record with display formatting
      const response = await request.get('/api/tables/1/records?format=display')

      // THEN: negative amount is displayed in parentheses ($100.00)
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.records[0].fields.balance.displayValue).toBe('($100.00)')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-FORMAT-005: should format currency with space as thousands separator',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, request }) => {
      // GIVEN: table with currency field configured with space as thousands separator
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'assets',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'value',
                type: 'currency',
                currency: 'USD',
                thousandsSeparator: 'space',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })
      await executeQuery('INSERT INTO assets (id, value) VALUES (1, 1000000.00)')

      // WHEN: requesting record with display formatting
      const response = await request.get('/api/tables/1/records?format=display')

      // THEN: thousands separator is displayed as space ($1 000 000.00)
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.records[0].fields.value.displayValue).toBe('$1 000 000.00')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-FORMAT-006: should format currency with period as thousands separator',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, request }) => {
      // GIVEN: table with currency field configured with period as thousands separator
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'properties',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'value',
                type: 'currency',
                currency: 'EUR',
                thousandsSeparator: 'period',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })
      await executeQuery('INSERT INTO properties (id, value) VALUES (1, 1000000.00)')

      // WHEN: requesting record with display formatting
      const response = await request.get('/api/tables/1/records?format=display')

      // THEN: thousands separator is displayed as period (€1.000.000,00)
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.records[0].fields.value.displayValue).toBe('€1.000.000,00')
    }
  )

  // ============================================================================
  // Date Formatting Tests
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-FORMAT-007: should format date in US format (M/D/YYYY)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, request }) => {
      // GIVEN: table with date field configured with US format
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'events',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'event_date', type: 'date', dateFormat: 'US' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })
      await executeQuery("INSERT INTO events (id, event_date) VALUES (1, '2024-06-15')")

      // WHEN: requesting record with display formatting
      const response = await request.get('/api/tables/1/records?format=display')

      // THEN: date is formatted in US format (6/15/2024)
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.records[0].fields.event_date.displayValue).toBe('6/15/2024')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-FORMAT-008: should format date in European format (D/M/YYYY)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, request }) => {
      // GIVEN: table with date field configured with European format
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'events',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'event_date', type: 'date', dateFormat: 'European' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })
      await executeQuery("INSERT INTO events (id, event_date) VALUES (1, '2024-06-15')")

      // WHEN: requesting record with display formatting
      const response = await request.get('/api/tables/1/records?format=display')

      // THEN: date is formatted in European format (15/6/2024)
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.records[0].fields.event_date.displayValue).toBe('15/6/2024')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-FORMAT-009: should format date in ISO format (YYYY-MM-DD)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, request }) => {
      // GIVEN: table with date field configured with ISO format
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'events',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'event_date', type: 'date', dateFormat: 'ISO' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })
      await executeQuery("INSERT INTO events (id, event_date) VALUES (1, '2024-06-15')")

      // WHEN: requesting record with display formatting
      const response = await request.get('/api/tables/1/records?format=display')

      // THEN: date is formatted in ISO format (2024-06-15)
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.records[0].fields.event_date.displayValue).toBe('2024-06-15')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-FORMAT-010: should include time component when includeTime is true',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, request }) => {
      // GIVEN: table with date field configured to include time
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'appointments',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'scheduled_date', type: 'date', includeTime: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })
      await executeQuery("INSERT INTO appointments (id, scheduled_date) VALUES (1, '2024-06-15')")

      // WHEN: requesting record with display formatting
      const response = await request.get('/api/tables/1/records?format=display')

      // THEN: date is displayed with time component
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.records[0].fields.scheduled_date.displayValue).toMatch(/6\/15\/2024.*\d+:\d+/)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-FORMAT-011: should convert date to specified timezone',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, request }) => {
      // GIVEN: table with date field configured with specific timezone
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'events',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'event_date',
                type: 'date',
                includeTime: true,
                timeZone: 'America/New_York',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })
      await executeQuery("INSERT INTO events (id, event_date) VALUES (1, '2024-06-15')")

      // WHEN: requesting record with display formatting
      const response = await request.get('/api/tables/1/records?format=display')

      // THEN: date is converted to specified timezone
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.records[0].fields.event_date.displayValue).toBeTruthy()
    }
  )

  // ============================================================================
  // Datetime Formatting Tests
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-FORMAT-012: should display time in 12-hour format with AM/PM',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, request }) => {
      // GIVEN: table with datetime field configured with 12-hour time format
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'appointments',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'scheduled_time', type: 'datetime', timeFormat: '12-hour' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })
      await executeQuery(
        "INSERT INTO appointments (id, scheduled_time) VALUES (1, '2024-06-15 14:30:00+00')"
      )

      // WHEN: requesting record with display formatting
      const response = await request.get('/api/tables/1/records?format=display')

      // THEN: time is displayed in 12-hour format with AM/PM
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.records[0].fields.scheduled_time.displayValue).toMatch(/2:30\s*PM/)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-FORMAT-013: should display time in 24-hour format',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, request }) => {
      // GIVEN: table with datetime field configured with 24-hour time format
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'appointments',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'scheduled_time', type: 'datetime', timeFormat: '24-hour' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })
      await executeQuery(
        "INSERT INTO appointments (id, scheduled_time) VALUES (1, '2024-06-15 14:30:00+00')"
      )

      // WHEN: requesting record with display formatting
      const response = await request.get('/api/tables/1/records?format=display')

      // THEN: time is displayed in 24-hour format (14:30)
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.records[0].fields.scheduled_time.displayValue).toMatch(/14:30/)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-FORMAT-014: should display datetime in specified timezone',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, request }) => {
      // GIVEN: table with datetime field configured with specific timezone
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'events',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'event_time', type: 'datetime', timeZone: 'America/Los_Angeles' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })
      await executeQuery("INSERT INTO events (id, event_time) VALUES (1, '2024-06-15 14:30:00+00')")

      // WHEN: requesting record with display formatting
      const response = await request.get('/api/tables/1/records?format=display')

      // THEN: datetime is displayed in specified timezone (PST/PDT)
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.records[0].fields.event_time.displayValue).toBeTruthy()
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-FORMAT-015: should use local timezone when timeZone is set to local',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, request }) => {
      // GIVEN: table with datetime field configured to use local timezone
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'meetings',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'meeting_time', type: 'datetime', timeZone: 'local' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })
      await executeQuery(
        "INSERT INTO meetings (id, meeting_time) VALUES (1, '2024-06-15 14:30:00+00')"
      )

      // WHEN: requesting record with display formatting
      const response = await request.get('/api/tables/1/records?format=display')

      // THEN: datetime is returned with indication to use client's local timezone
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.records[0].fields.meeting_time.displayValue).toBeTruthy()
      expect(data.records[0].fields.meeting_time.timezone).toBe('local')
    }
  )

  // ============================================================================
  // Duration Formatting Tests
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-FORMAT-016: should format duration in h:mm format',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, request }) => {
      // GIVEN: table with duration field configured with h:mm format
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'time_spent', type: 'duration', displayFormat: 'h:mm' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })
      await executeQuery("INSERT INTO tasks (id, time_spent) VALUES (1, '1 hour 30 minutes')")

      // WHEN: requesting record with display formatting
      const response = await request.get('/api/tables/1/records?format=display')

      // THEN: duration is formatted in h:mm format (1:30)
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.records[0].fields.time_spent.displayValue).toBe('1:30')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-FORMAT-017: should format duration in h:mm:ss format',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, request }) => {
      // GIVEN: table with duration field configured with h:mm:ss format
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'videos',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'length', type: 'duration', displayFormat: 'h:mm:ss' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })
      await executeQuery("INSERT INTO videos (id, length) VALUES (1, '1:30:45')")

      // WHEN: requesting record with display formatting
      const response = await request.get('/api/tables/1/records?format=display')

      // THEN: duration is formatted in h:mm:ss format (1:30:45)
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.records[0].fields.length.displayValue).toBe('1:30:45')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-FORMAT-018: should format duration in decimal format',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, request }) => {
      // GIVEN: table with duration field configured with decimal format
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'timesheets',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'hours_worked', type: 'duration', displayFormat: 'decimal' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })
      await executeQuery(
        "INSERT INTO timesheets (id, hours_worked) VALUES (1, '1 hour 30 minutes')"
      )

      // WHEN: requesting record with display formatting
      const response = await request.get('/api/tables/1/records?format=display')

      // THEN: duration is formatted in decimal format (1.5)
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.records[0].fields.hours_worked.displayValue).toBe('1.5')
    }
  )

  // ============================================================================
  // Attachment Metadata Tests
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-FORMAT-019: should return attachment with MIME type restriction info',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, request }) => {
      // GIVEN: table with single-attachment field restricted to images only
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'profiles',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'avatar',
                type: 'single-attachment',
                allowedFileTypes: ['image/png', 'image/jpeg', 'image/gif'],
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })
      await executeQuery(
        "INSERT INTO profiles (id, avatar) VALUES (1, 'https://example.com/photo.jpg')"
      )

      // WHEN: requesting record with display formatting
      const response = await request.get('/api/tables/1/records?format=display')

      // THEN: response includes allowed file types for the field
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.records[0].fields.avatar.allowedFileTypes).toEqual([
        'image/png',
        'image/jpeg',
        'image/gif',
      ])
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-FORMAT-020: should return attachment with file size limit info',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, request }) => {
      // GIVEN: table with single-attachment field with 5MB max file size
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'documents',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'file',
                type: 'single-attachment',
                maxFileSize: 5_242_880,
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })
      await executeQuery(
        "INSERT INTO documents (id, file) VALUES (1, 'https://example.com/doc.pdf')"
      )

      // WHEN: requesting record with display formatting
      const response = await request.get('/api/tables/1/records?format=display')

      // THEN: response includes max file size info
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.records[0].fields.file.maxFileSize).toBe(5_242_880)
      expect(data.records[0].fields.file.maxFileSizeDisplay).toBe('5 MB')
    }
  )

  // ============================================================================
  // Timezone Override Tests (Query Parameter)
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-FORMAT-021: should override display timezone via query parameter',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, request }) => {
      // GIVEN: table with datetime field (stored in UTC)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'events',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'event_time', type: 'datetime' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })
      // Insert UTC timestamp (14:30 UTC)
      await executeQuery("INSERT INTO events (id, event_time) VALUES (1, '2024-06-15 14:30:00+00')")

      // WHEN: requesting record with timezone query parameter
      const response = await request.get(
        '/api/tables/1/records?format=display&timezone=America/New_York'
      )

      // THEN: datetime is displayed in requested timezone (14:30 UTC = 10:30 EDT)
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.records[0].fields.event_time.displayValue).toMatch(/10:30/)
      expect(data.records[0].fields.event_time.displayTimezone).toBe('America/New_York')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-FORMAT-022: should serialize raw datetime value in ISO 8601 with Z suffix',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, request }) => {
      // GIVEN: table with datetime field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'logs',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'timestamp', type: 'datetime' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })
      // Insert with explicit offset (will be converted to UTC)
      await executeQuery("INSERT INTO logs (id, timestamp) VALUES (1, '2024-06-15 10:30:00-04:00')")

      // WHEN: requesting record with display formatting
      const response = await request.get('/api/tables/1/records?format=display')

      // THEN: raw value is serialized in ISO 8601 with 'Z' suffix (UTC)
      expect(response.status()).toBe(200)
      const data = await response.json()
      // 10:30 EDT (-04:00) = 14:30 UTC
      expect(data.records[0].fields.timestamp.value).toBe('2024-06-15T14:30:00.000Z')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-FORMAT-023: should reject invalid timezone in query parameter',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, request }) => {
      // GIVEN: table with datetime field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'events',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'event_time', type: 'datetime' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })
      await executeQuery("INSERT INTO events (id, event_time) VALUES (1, '2024-06-15 14:30:00+00')")

      // WHEN: requesting record with invalid timezone
      const response = await request.get(
        '/api/tables/1/records?format=display&timezone=Invalid/Timezone'
      )

      // THEN: API rejects with 400 Bad Request
      expect(response.status()).toBe(400)
      const data = await response.json()
      expect(data.error).toMatch(/invalid timezone/i)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-FORMAT-024: should apply query timezone to all datetime fields in response',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, request }) => {
      // GIVEN: table with multiple datetime fields
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'appointments',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'start_time', type: 'datetime' },
              { id: 3, name: 'end_time', type: 'datetime' },
              { id: 4, name: 'reminder_time', type: 'datetime' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })
      // Insert UTC timestamps
      await executeQuery(`
        INSERT INTO appointments (id, start_time, end_time, reminder_time)
        VALUES (1, '2024-06-15 14:00:00+00', '2024-06-15 15:00:00+00', '2024-06-15 13:45:00+00')
      `)

      // WHEN: requesting record with timezone query parameter
      const response = await request.get(
        '/api/tables/1/records?format=display&timezone=Europe/Paris'
      )

      // THEN: all datetime fields are converted to Paris timezone (UTC+2 in June)
      expect(response.status()).toBe(200)
      const data = await response.json()
      const record = data.records[0]

      // 14:00 UTC = 16:00 Paris (CEST)
      expect(record.fields.start_time.displayValue).toMatch(/16:00/)
      // 15:00 UTC = 17:00 Paris
      expect(record.fields.end_time.displayValue).toMatch(/17:00/)
      // 13:45 UTC = 15:45 Paris
      expect(record.fields.reminder_time.displayValue).toMatch(/15:45/)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-FORMAT-025: user can retrieve records with all formatting options',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery, request }) => {
      await test.step('Setup: Start server with multiple formatted fields', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'data',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'price', type: 'currency', currency: 'EUR' },
                { id: 3, name: 'event_date', type: 'date', dateFormat: 'European' },
                { id: 4, name: 'scheduled_time', type: 'datetime', timeFormat: '24-hour' },
                { id: 5, name: 'duration', type: 'duration', displayFormat: 'h:mm' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
          ],
        })
      })

      await test.step('Insert test data', async () => {
        await executeQuery(`
          INSERT INTO data (id, price, event_date, scheduled_time, duration)
          VALUES (1, 1234.56, '2024-06-15', '2024-06-15 14:30:00+00', '2 hours 30 minutes')
        `)
      })

      await test.step('Verify formatted response', async () => {
        const response = await request.get('/api/tables/1/records?format=display')
        expect(response.status()).toBe(200)

        const data = await response.json()
        const record = data.records[0]

        // Currency formatting
        expect(record.fields.price.displayValue).toBe('€1.234,56')

        // Date formatting (European)
        expect(record.fields.event_date.displayValue).toBe('15/6/2024')

        // Datetime formatting (24-hour)
        expect(record.fields.scheduled_time.displayValue).toMatch(/14:30/)

        // Duration formatting (h:mm)
        expect(record.fields.duration.displayValue).toBe('2:30')
      })

      await test.step('Verify raw values are also available', async () => {
        const response = await request.get('/api/tables/1/records?format=display')
        const data = await response.json()
        const record = data.records[0]

        expect(record.fields.price.value).toBe(1234.56)
        expect(record.fields.event_date.value).toBe('2024-06-15')
      })
    }
  )
})
