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
 * Source: specs/app/tables/field-types/geolocation-field/geolocation-field.schema.json
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Geolocation Field', () => {
  test.fixme(
    'APP-GEOLOCATION-FIELD-001: should create PostgreSQL POINT type for latitude/longitude storage',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_locations',
            name: 'locations',
            fields: [{ name: 'coordinates', type: 'geolocation' }],
          },
        ],
      })

      const columnInfo = await executeQuery(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='locations' AND column_name='coordinates'"
      )
      expect(columnInfo.column_name).toBe('coordinates')
      expect(columnInfo.data_type).toBe('point')

      const pointInsert = await executeQuery(
        'INSERT INTO locations (coordinates) VALUES (POINT(40.7128, -74.0060)) RETURNING coordinates'
      )
      expect(pointInsert.coordinates).toBe('(40.7128,-74.006)')

      const coordinateExtract = await executeQuery(
        'INSERT INTO locations (coordinates) VALUES (POINT(51.5074, -0.1278)) RETURNING coordinates[0] as latitude, coordinates[1] as longitude'
      )
      expect(coordinateExtract.latitude).toBe(51.5074)
      expect(coordinateExtract.longitude).toBe(-0.1278)
    }
  )

  test.fixme(
    'APP-GEOLOCATION-FIELD-002: should support distance calculations with <-> operator',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_stores',
            name: 'stores',
            fields: [
              { name: 'name', type: 'single-line-text' },
              { name: 'location', type: 'geolocation' },
            ],
          },
        ],
      })

      await executeQuery(
        "INSERT INTO stores (name, location) VALUES ('Store A', POINT(40.7128, -74.0060)), ('Store B', POINT(40.7589, -73.9851)), ('Store C', POINT(34.0522, -118.2437))"
      )

      const nearestStore = await executeQuery(
        'SELECT name, location <-> POINT(40.7128, -74.0060) as distance FROM stores ORDER BY distance LIMIT 1'
      )
      expect(nearestStore.name).toBe('Store A')
      expect(nearestStore.distance).toBe(0)

      const withinDistance = await executeQuery(
        'SELECT COUNT(*) as count FROM stores WHERE location <-> POINT(40.7128, -74.0060) < 1'
      )
      expect(withinDistance.count).toBe(2)

      const orderedByProximity = await executeQuery(
        'SELECT name FROM stores ORDER BY location <-> POINT(40.7128, -74.0060) LIMIT 2'
      )
      expect(orderedByProximity).toEqual([{ name: 'Store A' }, { name: 'Store B' }])
    }
  )

  test.fixme(
    'APP-GEOLOCATION-FIELD-003: should create GiST index for spatial queries',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_places',
            name: 'places',
            fields: [{ name: 'position', type: 'geolocation', indexed: true }],
          },
        ],
      })

      const indexInfo = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_places_position'"
      )
      expect(indexInfo.indexname).toBe('idx_places_position')
      expect(indexInfo.tablename).toBe('places')

      const indexDef = await executeQuery(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_places_position'"
      )
      expect(indexDef.indexdef).toBe(
        'CREATE INDEX idx_places_position ON public.places USING gist (position)'
      )
    }
  )

  test.fixme(
    'APP-GEOLOCATION-FIELD-004: should support bounding box queries with box containment',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_venues',
            name: 'venues',
            fields: [
              { name: 'name', type: 'single-line-text' },
              { name: 'coords', type: 'geolocation' },
            ],
          },
        ],
      })

      await executeQuery(
        "INSERT INTO venues (name, coords) VALUES ('Venue 1', POINT(40.7128, -74.0060)), ('Venue 2', POINT(40.7589, -73.9851)), ('Venue 3', POINT(34.0522, -118.2437))"
      )

      const withinBoundingBox = await executeQuery(
        'SELECT COUNT(*) as count FROM venues WHERE box(POINT(40.0, -75.0), POINT(41.0, -73.0)) @> coords'
      )
      expect(withinBoundingBox.count).toBe(2)

      const outsideBoundingBox = await executeQuery(
        'SELECT name FROM venues WHERE NOT box(POINT(40.0, -75.0), POINT(41.0, -73.0)) @> coords'
      )
      expect(outsideBoundingBox.name).toBe('Venue 3')
    }
  )

  test.fixme(
    'APP-GEOLOCATION-FIELD-005: should enforce NOT NULL and UNIQUE constraints on POINT column',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_addresses',
            name: 'addresses',
            fields: [{ name: 'location', type: 'geolocation', required: true, unique: true }],
          },
        ],
      })

      await executeQuery('INSERT INTO addresses (location) VALUES (POINT(40.7128, -74.0060))')

      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='addresses' AND column_name='location'"
      )
      expect(notNullCheck.is_nullable).toBe('NO')

      const uniqueCount = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='addresses' AND constraint_type='UNIQUE' AND constraint_name LIKE '%location%'"
      )
      expect(uniqueCount.count).toBe(1)

      await expect(
        executeQuery('INSERT INTO addresses (location) VALUES (POINT(40.7128, -74.0060))')
      ).rejects.toThrow(/duplicate key value violates unique constraint/)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-GEOLOCATION-REGRESSION-001: user can complete full geolocation-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_data',
            name: 'data',
            fields: [
              { name: 'id', type: 'integer', required: true },
              { name: 'position', type: 'geolocation', required: true },
            ],
            primaryKey: {
              fields: ['id'],
            },
          },
        ],
      })

      await executeQuery('INSERT INTO data (position) VALUES (POINT(48.8566, 2.3522))')
      const stored = await executeQuery('SELECT position FROM data WHERE id = 1')
      expect(stored.position).toBe('(48.8566,2.3522)')

      const distance = await executeQuery(
        'SELECT position <-> POINT(48.8566, 2.3522) as dist FROM data WHERE id = 1'
      )
      expect(distance.dist).toBe(0)

      const coordinates = await executeQuery(
        'SELECT position[0] as lat, position[1] as lng FROM data WHERE id = 1'
      )
      expect(coordinates.lat).toBe(48.8566)
      expect(coordinates.lng).toBe(2.3522)
    }
  )
})
