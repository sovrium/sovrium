/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures.ts'

/**
 * E2E Tests for Get record by ID
 *
 * Source: specs/api/paths/tables/{tableId}/records/{recordId}/get.json
 * Domain: api
 * Spec Count: 10
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (10 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Get record by ID', () => {
  // ============================================================================
  // @spec tests (one per spec) - EXHAUSTIVE coverage
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-GET-001: should return 200 with complete record data',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: Table 'users' with record ID=1
      await executeQuery(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          name VARCHAR(255),
          phone VARCHAR(50),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `)
      await executeQuery(`
        INSERT INTO users (email, name, phone)
        VALUES ('john.doe@example.com', 'John Doe', '555-0100')
      `)

      // WHEN: User requests record by ID
      const response = await request.get('/api/tables/1/records/1', {
        headers: {
          Authorization: 'Bearer test_token',
        },
      })

      // THEN: Returns 200 with complete record data
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.id).toBe(1)
      expect(data.email).toBe('john.doe@example.com')
      expect(data.name).toBe('John Doe')
      expect(data.phone).toBe('555-0100')
      expect(data).toHaveProperty('created_at')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-GET-002: should return 404 Not Found',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: Table 'users' exists but record ID=9999 does not
      await executeQuery(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL
        )
      `)

      // WHEN: User requests non-existent record
      const response = await request.get('/api/tables/1/records/9999', {
        headers: {
          Authorization: 'Bearer test_token',
        },
      })

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data.error).toBe('Record not found')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-GET-PERMISSIONS-UNAUTHORIZED-001: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: An unauthenticated user
      await executeQuery(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          email VARCHAR(255),
          organization_id VARCHAR(255)
        )
      `)
      await executeQuery(`
        INSERT INTO employees (id, name, email, organization_id)
        VALUES (1, 'Alice Cooper', 'alice@example.com', 'org_123')
      `)

      // WHEN: User attempts to fetch a record without auth token
      const response = await request.get('/api/tables/1/records/1')

      // THEN: Returns 401 Unauthorized error
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-GET-PERMISSIONS-FORBIDDEN-001: should return 403 Forbidden',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: User without read permission
      await executeQuery(`
        CREATE TABLE confidential (
          id SERIAL PRIMARY KEY,
          data TEXT
        )
      `)
      await executeQuery(`
        INSERT INTO confidential (id, data)
        VALUES (1, 'Secret Information')
      `)

      // WHEN: User without permission attempts to fetch record
      const response = await request.get('/api/tables/1/records/1', {
        headers: {
          Authorization: 'Bearer viewer_token',
        },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data.error).toBe('Forbidden')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-GET-PERMISSIONS-ORG-ISOLATION-001: should return 404 Not Found',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: User from different organization
      await executeQuery(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          organization_id VARCHAR(255)
        )
      `)
      await executeQuery(`
        INSERT INTO employees (id, name, organization_id)
        VALUES (1, 'John Doe', 'org_456')
      `)

      // WHEN: User from org_123 attempts to fetch record from org_456
      const response = await request.get('/api/tables/1/records/1', {
        headers: {
          Authorization: 'Bearer org1_token',
        },
      })

      // THEN: Returns 404 Not Found (don't leak existence)
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data.error).toBe('Record not found')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-GET-PERMISSIONS-FIELD-FILTER-ADMIN-001: should return all fields for admin',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: Admin user with full field access
      await executeQuery(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          email VARCHAR(255),
          salary DECIMAL(10,2)
        )
      `)
      await executeQuery(`
        INSERT INTO employees (id, name, email, salary)
        VALUES (1, 'John Doe', 'john@example.com', 75000)
      `)

      // WHEN: Admin requests record
      const response = await request.get('/api/tables/1/records/1', {
        headers: {
          Authorization: 'Bearer admin_token',
        },
      })

      // THEN: Returns all fields including salary
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('name')
      expect(data).toHaveProperty('email')
      expect(data).toHaveProperty('salary')
      expect(data.salary).toBe(75_000)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-GET-PERMISSIONS-FIELD-FILTER-MEMBER-001: should exclude salary field for member',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: Member user without salary field read permission
      await executeQuery(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          email VARCHAR(255),
          salary DECIMAL(10,2)
        )
      `)
      await executeQuery(`
        INSERT INTO employees (id, name, email, salary)
        VALUES (1, 'Jane Smith', 'jane@example.com', 85000)
      `)

      // WHEN: Member requests record
      const response = await request.get('/api/tables/1/records/1', {
        headers: {
          Authorization: 'Bearer member_token',
        },
      })

      // THEN: Returns record without salary field
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('name')
      expect(data).toHaveProperty('email')
      expect(data).not.toHaveProperty('salary')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-GET-PERMISSIONS-FIELD-FILTER-VIEWER-001: should return minimal fields for viewer',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: Viewer with limited field access
      await executeQuery(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          email VARCHAR(255),
          phone VARCHAR(50),
          salary DECIMAL(10,2)
        )
      `)
      await executeQuery(`
        INSERT INTO employees (id, name, email, phone, salary)
        VALUES (1, 'Bob Wilson', 'bob@example.com', '555-0200', 95000)
      `)

      // WHEN: Viewer requests record
      const response = await request.get('/api/tables/1/records/1', {
        headers: {
          Authorization: 'Bearer viewer_token',
        },
      })

      // THEN: Returns only permitted fields
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('name')
      expect(data).not.toHaveProperty('email')
      expect(data).not.toHaveProperty('phone')
      expect(data).not.toHaveProperty('salary')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-GET-PERMISSIONS-COMBINED-001: should apply both org and field filtering',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: Multi-tenant table with field permissions
      await executeQuery(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          email VARCHAR(255),
          salary DECIMAL(10,2),
          organization_id VARCHAR(255)
        )
      `)
      await executeQuery(`
        INSERT INTO employees (id, name, email, salary, organization_id)
        VALUES
          (1, 'Alice Cooper', 'alice@example.com', 75000, 'org_123'),
          (2, 'Bob Smith', 'bob@example.com', 85000, 'org_456')
      `)

      // WHEN: Member from org_123 requests their org's record
      const response = await request.get('/api/tables/1/records/1', {
        headers: {
          Authorization: 'Bearer member_org1_token',
        },
      })

      // THEN: Returns org_123 record without salary field
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.id).toBe(1)
      expect(data.name).toBe('Alice Cooper')
      expect(data.email).toBe('alice@example.com')
      expect(data.organization_id).toBe('org_123')
      expect(data).not.toHaveProperty('salary')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-GET-PERMISSIONS-READONLY-FIELD-001: should include readonly fields in response',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: Table with readonly system fields
      await executeQuery(`
        CREATE TABLE tasks (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `)
      await executeQuery(`
        INSERT INTO tasks (id, title)
        VALUES (1, 'Important Task')
      `)

      // WHEN: User requests record
      const response = await request.get('/api/tables/1/records/1', {
        headers: {
          Authorization: 'Bearer test_token',
        },
      })

      // THEN: Returns readonly fields in response (can read but not write)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('title')
      expect(data).toHaveProperty('created_at')
      expect(data).toHaveProperty('updated_at')
    }
  )

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'user can complete full get record workflow',
    { tag: '@regression' },
    async ({ request, executeQuery }) => {
      // GIVEN: Table with record and permissions
      await executeQuery(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          name VARCHAR(255)
        )
      `)
      await executeQuery(`
        INSERT INTO users (email, name)
        VALUES ('test@example.com', 'Test User')
      `)

      // WHEN/THEN: Fetch record by ID
      const response = await request.get('/api/tables/1/records/1', {
        headers: {
          Authorization: 'Bearer test_token',
        },
      })

      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.id).toBe(1)
      expect(data.email).toBe('test@example.com')
      expect(data.name).toBe('Test User')
    }
  )
})
