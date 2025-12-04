/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Geolocation Field
 *
 * Source: src/domain/models/app/table/field-types/geolocation-field.ts
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Geolocation Field', () => {
  test(
    'APP-TABLES-FIELD-TYPES-GEOLOCATION-001: should create PostgreSQL POINT type for latitude/longitude storage',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'locations',
            fields: [{ id: 1, name: 'coordinates', type: 'geolocation' }],
          },
        ],
      })

      // WHEN: querying the database
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='locations' AND column_name='coordinates'"
      )
      // THEN: assertion
      expect(columnInfo.column_name).toBe('coordinates')
      // THEN: assertion
      expect(columnInfo.data_type).toBe('point')

      // WHEN: querying the database
      const pointInsert = await executeQuery(
        'INSERT INTO locations (coordinates) VALUES (POINT(40.7128, -74.0060)) RETURNING coordinates'
      )
      // THEN: assertion
      expect(pointInsert.coordinates).toBe('(40.7128,-74.006)')

      const coordinateExtract = await executeQuery(
        'INSERT INTO locations (coordinates) VALUES (POINT(51.5074, -0.1278)) RETURNING coordinates[0] as latitude, coordinates[1] as longitude'
      )
      // THEN: assertion
      expect(coordinateExtract.latitude).toBe(51.5074)
      // THEN: assertion
      expect(coordinateExtract.longitude).toBe(-0.1278)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-GEOLOCATION-002: should support distance calculations with <-> operator',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'stores',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'location', type: 'geolocation' },
            ],
          },
        ],
      })

      // WHEN: querying the database
      await executeQuery(
        "INSERT INTO stores (name, location) VALUES ('Store A', POINT(40.7128, -74.0060)), ('Store B', POINT(40.7589, -73.9851)), ('Store C', POINT(34.0522, -118.2437))"
      )

      // WHEN: querying the database
      const nearestStore = await executeQuery(
        'SELECT name, location <-> POINT(40.7128, -74.0060) as distance FROM stores ORDER BY distance LIMIT 1'
      )
      // THEN: assertion
      expect(nearestStore.name).toBe('Store A')
      // THEN: assertion
      expect(nearestStore.distance).toBe(0)

      const withinDistance = await executeQuery(
        'SELECT COUNT(*) as count FROM stores WHERE location <-> POINT(40.7128, -74.0060) < 1'
      )
      // THEN: assertion
      expect(withinDistance.count).toBe(2)

      const orderedByProximity = await executeQuery(
        'SELECT name FROM stores ORDER BY location <-> POINT(40.7128, -74.0060) LIMIT 2'
      )
      // THEN: assertion
      expect(orderedByProximity.rows).toEqual([{ name: 'Store A' }, { name: 'Store B' }])
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-GEOLOCATION-003: should create GiST index for spatial queries',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'places',
            fields: [{ id: 1, name: 'position', type: 'geolocation', indexed: true }],
          },
        ],
      })

      // WHEN: querying the database
      const indexInfo = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_places_position'"
      )
      // THEN: assertion
      expect(indexInfo.indexname).toBe('idx_places_position')
      // THEN: assertion
      expect(indexInfo.tablename).toBe('places')

      // WHEN: querying the database
      const indexDef = await executeQuery(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_places_position'"
      )
      // THEN: assertion
      expect(indexDef.indexdef).toBe(
        'CREATE INDEX idx_places_position ON public.places USING gist ("position")'
      )
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-GEOLOCATION-004: should support bounding box queries with box containment',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'venues',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'coords', type: 'geolocation' },
            ],
          },
        ],
      })

      // WHEN: querying the database
      await executeQuery(
        "INSERT INTO venues (name, coords) VALUES ('Venue 1', POINT(40.7128, -74.0060)), ('Venue 2', POINT(40.7589, -73.9851)), ('Venue 3', POINT(34.0522, -118.2437))"
      )

      // WHEN: querying the database
      const withinBoundingBox = await executeQuery(
        'SELECT COUNT(*) as count FROM venues WHERE box(POINT(40.0, -75.0), POINT(41.0, -73.0)) @> coords'
      )
      // THEN: assertion
      expect(withinBoundingBox.count).toBe(2)

      const outsideBoundingBox = await executeQuery(
        'SELECT name FROM venues WHERE NOT box(POINT(40.0, -75.0), POINT(41.0, -73.0)) @> coords'
      )
      // THEN: assertion
      expect(outsideBoundingBox.name).toBe('Venue 3')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-GEOLOCATION-005: should enforce NOT NULL and UNIQUE constraints on POINT column',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'addresses',
            fields: [
              {
                id: 1,
                name: 'location',
                type: 'geolocation',
                required: true,
                unique: true,
              },
            ],
          },
        ],
      })

      // WHEN: executing query
      await executeQuery('INSERT INTO addresses (location) VALUES (POINT(40.7128, -74.0060))')

      // WHEN: querying the database
      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='addresses' AND column_name='location'"
      )
      // THEN: assertion
      expect(notNullCheck.is_nullable).toBe('NO')

      const uniqueCount = await executeQuery(
        "SELECT COUNT(*) as count FROM pg_constraint WHERE conname LIKE '%location%' AND contype = 'x'"
      )
      // THEN: assertion
      expect(uniqueCount.count).toBe(1)

      // THEN: assertion
      await expect(
        executeQuery('INSERT INTO addresses (location) VALUES (POINT(40.7128, -74.0060))')
      ).rejects.toThrow(/conflicting key value violates exclusion constraint/)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-GEOLOCATION-006: user can complete full geolocation-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Start server with geolocation field', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 6,
              name: 'data',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'position', type: 'geolocation', required: true },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
          ],
        })
      })

      await test.step('Insert and verify geolocation value', async () => {
        await executeQuery('INSERT INTO data (position) VALUES (POINT(48.8566, 2.3522))')
        const stored = await executeQuery('SELECT position FROM data WHERE id = 1')
        expect(stored.position).toBe('(48.8566,2.3522)')
      })

      await test.step('Test distance calculation', async () => {
        const distance = await executeQuery(
          'SELECT position <-> POINT(48.8566, 2.3522) as dist FROM data WHERE id = 1'
        )
        expect(distance.dist).toBe(0)
      })

      await test.step('Extract coordinates', async () => {
        const coordinates = await executeQuery(
          'SELECT position[0] as lat, position[1] as lng FROM data WHERE id = 1'
        )
        expect(coordinates.lat).toBe(48.8566)
        expect(coordinates.lng).toBe(2.3522)
      })

      await test.step('Error handling: NOT NULL constraint rejects NULL value', async () => {
        await expect(executeQuery('INSERT INTO data (position) VALUES (NULL)')).rejects.toThrow(
          /violates not-null constraint/
        )
      })
    }
  )
})
