/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@playwright/test'

test.fixme(
  'API-SEARCH-FTS-001: should search records using full-text query',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, request }) => {
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

    const response = await request.get('/api/tables/tbl_articles/search?q=PostgreSQL', {
      headers: { Authorization: 'Bearer valid_token' },
    })

    expect(response.status()).toBe(200)
    const body = await response.json()

    expect(body.results).toHaveLength(1)
    expect(body.results[0].fields.title).toBe('Introduction to PostgreSQL')
  }
)

test.fixme(
  'API-SEARCH-FTS-002: should rank search results by relevance',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, request }) => {
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
              { field: 'fld_title', weight: 'A' },
              { field: 'fld_body', weight: 'B' },
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

    const response = await request.get('/api/tables/tbl_posts/search?q=TypeScript', {
      headers: { Authorization: 'Bearer valid_token' },
    })

    expect(response.status()).toBe(200)
    const body = await response.json()

    expect(body.results).toHaveLength(3)
    expect(body.results[0].fields.title).toBe('TypeScript Best Practices')
    expect(body.results[0]._score).toBeGreaterThan(body.results[2]._score)
    expect(body.results[2].fields.title).toBe('JavaScript Tips')
  }
)

test.fixme(
  'API-SEARCH-FTS-003: should search within specific field only',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, request }) => {
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

    const response = await request.get('/api/tables/tbl_books/search?q=Robert&fields=author', {
      headers: { Authorization: 'Bearer valid_token' },
    })

    expect(response.status()).toBe(200)
    const body = await response.json()

    expect(body.results).toHaveLength(1)
    expect(body.results[0].fields.title).toBe('Clean Code')
    expect(body.results[0].fields.author).toBe('Robert Martin')
  }
)

test.fixme(
  'API-SEARCH-FTS-004: should search 100k records in < 100ms',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, request }) => {
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
            indexType: 'GIN',
          },
        },
      ],
    })

    const batchSize = 1000
    for (let i = 0; i < 100; i++) {
      const values = Array.from(
        { length: batchSize },
        (_, j) => `('Document ${i * batchSize + j} with searchable content about database systems')`
      ).join(',')
      await executeQuery(`INSERT INTO documents (content) VALUES ${values}`)
    }

    await executeQuery(`
      INSERT INTO documents (content) VALUES ('Special unique searchable term postgresql')
    `)

    const startTime = performance.now()
    const response = await request.get('/api/tables/tbl_documents/search?q=postgresql', {
      headers: { Authorization: 'Bearer valid_token' },
    })
    const endTime = performance.now()

    expect(response.status()).toBe(200)
    expect(endTime - startTime).toBeLessThan(100)

    const body = await response.json()
    expect(body.results).toHaveLength(1)
  }
)

test.fixme(
  'API-SEARCH-REGRESSION: full-text search works correctly',
  { tag: '@regression' },
  async ({ startServerWithSchema, executeQuery, request }) => {
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_notes',
          name: 'notes',
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

    await executeQuery(
      `INSERT INTO notes (title, content) VALUES ('Test Note', 'PostgreSQL search')`
    )

    const response = await request.get('/api/tables/tbl_notes/search?q=PostgreSQL', {
      headers: { Authorization: 'Bearer valid_token' },
    })

    const body = await response.json()
    expect(body.results).toHaveLength(1)
    expect(body.results[0].fields.title).toBe('Test Note')
  }
)
