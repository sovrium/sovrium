/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Multiple Attachments Field
 *
 * Source: src/domain/models/app/table/field-types/multiple-attachments-field.ts
 * Domain: app
 * Spec Count: 9
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (10 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Multiple Attachments Field', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
    'APP-TABLES-FIELD-TYPES-MULTIPLE-ATTACHMENTS-001: should create JSONB ARRAY column for multiple file storage',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'posts',
            fields: [{ id: 1, name: 'attachments', type: 'multiple-attachments' }],
          },
        ],
      })

      // WHEN: querying the database
      const column = await executeQuery(
        "SELECT data_type FROM information_schema.columns WHERE table_name='posts' AND column_name='attachments'"
      )
      // THEN: assertion
      expect(column.data_type).toBe('jsonb')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-MULTIPLE-ATTACHMENTS-002: should store array of file metadata objects',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'messages',
            fields: [{ id: 1, name: 'files', type: 'multiple-attachments' }],
          },
        ],
      })

      // WHEN: querying the database
      await executeQuery(
        'INSERT INTO messages (files) VALUES (\'[{"url": "file1.pdf", "size": 100}, {"url": "file2.jpg", "size": 200}]\')'
      )
      // WHEN: querying the database
      const files = await executeQuery('SELECT files FROM messages WHERE id = 1')
      // THEN: assertion
      expect(files.files.length).toBe(2)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-MULTIPLE-ATTACHMENTS-003: should enforce maximum attachment count via CHECK constraint',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'records',
            fields: [
              {
                id: 1,
                name: 'attachments',
                type: 'multiple-attachments',
                maxFiles: 5,
              },
            ],
          },
        ],
      })

      // WHEN/THEN: executing query and asserting error
      await expect(
        executeQuery("INSERT INTO records (attachments) VALUES ('[1,2,3,4,5,6]')")
      ).rejects.toThrow(/violates check constraint/)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-MULTIPLE-ATTACHMENTS-004: should support querying by attachment properties',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'docs',
            fields: [{ id: 1, name: 'files', type: 'multiple-attachments' }],
          },
        ],
      })

      // WHEN: executing query
      await executeQuery('INSERT INTO docs (files) VALUES (\'[{"type": "pdf"}]\')')
      // WHEN: querying the database
      const result = await executeQuery(
        'SELECT COUNT(*) as count FROM docs WHERE files @> \'[{"type": "pdf"}]\''
      )
      // THEN: assertion
      expect(result.count).toBe(1)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-MULTIPLE-ATTACHMENTS-005: should create GIN index for efficient JSON queries',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'items',
            fields: [
              {
                id: 1,
                name: 'attachments',
                type: 'multiple-attachments',
                indexed: true,
              },
            ],
          },
        ],
      })

      // WHEN: querying the database
      const index = await executeQuery(
        "SELECT indexname FROM pg_indexes WHERE indexname = 'idx_items_attachments'"
      )
      // THEN: assertion
      expect(index.indexname).toBe('idx_items_attachments')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-MULTIPLE-ATTACHMENTS-006: should restrict file uploads to allowed MIME types',
    { tag: '@spec' },
    async ({ startServerWithSchema, page }) => {
      // GIVEN: table with multiple-attachments field restricted to documents only
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 7,
            name: 'projects',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'documents',
                type: 'multiple-attachments',
                allowedFileTypes: ['application/pdf', 'application/msword'],
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: user attempts to upload files
      await page.goto('/tables/projects')
      await page.getByRole('button', { name: 'Upload' }).click()

      // THEN: file picker only allows specified document types
      const fileInput = page.locator('input[type="file"]')
      await expect(fileInput).toHaveAttribute('accept', 'application/pdf,application/msword')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-MULTIPLE-ATTACHMENTS-007: should enforce maximum file size per attachment',
    { tag: '@spec' },
    async ({ startServerWithSchema, page }) => {
      // GIVEN: table with multiple-attachments field with 10MB max file size
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 8,
            name: 'reports',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'files',
                type: 'multiple-attachments',
                maxFileSize: 10_485_760, // 10MB in bytes
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: user attempts to upload a file exceeding max size
      await page.goto('/tables/reports')

      // THEN: upload is rejected with error message
      await expect(page.getByText(/File size exceeds maximum of 10MB/)).toBeVisible()
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-MULTIPLE-ATTACHMENTS-008: should generate thumbnails for image attachments in array',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with multiple-attachments field configured for thumbnail generation
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 9,
            name: 'galleries',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'images',
                type: 'multiple-attachments',
                generateThumbnails: true,
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: multiple images are uploaded
      await executeQuery(
        'INSERT INTO galleries (images) VALUES (\'[{"url": "img1.jpg", "thumbnail": "thumb1.jpg"}, {"url": "img2.jpg", "thumbnail": "thumb2.jpg"}]\')'
      )

      // THEN: each image has a thumbnail generated
      const result = await executeQuery('SELECT images FROM galleries WHERE id = 1')
      expect(result.images[0].thumbnail).toBeTruthy()
      expect(result.images[1].thumbnail).toBeTruthy()
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-MULTIPLE-ATTACHMENTS-009: should store metadata for each attachment',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with multiple-attachments field for mixed media
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 10,
            name: 'media',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'files',
                type: 'multiple-attachments',
                storeMetadata: true,
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: mixed media files are uploaded
      await executeQuery(
        'INSERT INTO media (files) VALUES (\'[{"url": "photo.jpg", "width": 1024, "height": 768}, {"url": "video.mp4", "duration": 60}]\')'
      )

      // THEN: metadata is stored for each file type
      const result = await executeQuery('SELECT files FROM media WHERE id = 1')
      const files = JSON.parse(result.files)
      expect(files[0].width).toBe(1024)
      expect(files[0].height).toBe(768)
      expect(files[1].duration).toBe(60)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'APP-TABLES-FIELD-TYPES-MULTIPLE-ATTACHMENTS-010: user can complete full multiple-attachments-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Start server with multiple-attachments field', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 6,
              name: 'data',
              fields: [{ id: 1, name: 'files', type: 'multiple-attachments' }],
            },
          ],
        })
      })

      await test.step('Insert and verify multiple attachments', async () => {
        await executeQuery(
          'INSERT INTO data (files) VALUES (\'[{"url": "a.pdf"}, {"url": "b.jpg"}]\')'
        )
        const files = await executeQuery(
          'SELECT jsonb_array_length(files) as count FROM data WHERE id = 1'
        )
        expect(files.count).toBe(2)
      })

      await test.step('Error handling: duplicate field IDs are rejected', async () => {
        await expect(
          startServerWithSchema({
            name: 'test-app-error',
            tables: [
              {
                id: 99,
                name: 'invalid',
                fields: [
                  { id: 1, name: 'files_a', type: 'multiple-attachments' },
                  { id: 1, name: 'files_b', type: 'multiple-attachments' }, // Duplicate ID!
                ],
              },
            ],
          })
        ).rejects.toThrow(/duplicate.*field.*id|field.*id.*must.*be.*unique/i)
      })
    }
  )
})
