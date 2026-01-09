/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Single Attachment Field
 *
 * Source: src/domain/models/app/table/field-types/single-attachment-field.ts
 * Domain: app
 * Spec Count: 7
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (11 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Single Attachment Field', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
    'APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-001: should create VARCHAR column for single file URL storage',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'documents',
            fields: [{ id: 1, name: 'file_url', type: 'single-attachment' }],
          },
        ],
      })

      // WHEN: querying the database
      const column = await executeQuery(
        "SELECT data_type FROM information_schema.columns WHERE table_name='documents' AND column_name='file_url'"
      )
      // THEN: assertion
      expect(column.data_type).toBe('character varying')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-002: should store file metadata as JSONB',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'attachments',
            fields: [{ id: 1, name: 'file_meta', type: 'json' }],
          },
        ],
      })

      // WHEN: querying the database
      await executeQuery(
        'INSERT INTO attachments (file_meta) VALUES (\'{"name": "document.pdf", "size": 1024, "type": "application/pdf"}\')'
      )
      // WHEN: querying the database
      const meta = await executeQuery('SELECT file_meta FROM attachments WHERE id = 1')
      // THEN: assertion
      expect(meta.file_meta.name).toBe('document.pdf')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-003: should enforce file type validation via CHECK constraint',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'images',
            fields: [
              {
                id: 1,
                name: 'file_type',
                type: 'single-select',
                options: ['image/png', 'image/jpeg', 'image/gif'],
              },
            ],
          },
        ],
      })

      // WHEN/THEN: executing query and asserting error
      await expect(
        executeQuery("INSERT INTO images (file_type) VALUES ('video/mp4')")
      ).rejects.toThrow(/violates check constraint/)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-004: should enforce file size limit via CHECK constraint',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'uploads',
            fields: [{ id: 1, name: 'file_size', type: 'integer', max: 10_485_760 }],
          },
        ],
      })

      // WHEN/THEN: executing query and asserting error
      await expect(
        executeQuery('INSERT INTO uploads (file_size) VALUES (20000000)')
      ).rejects.toThrow(/violates check constraint/)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-005: should support NULL for optional attachments',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'records',
            fields: [{ id: 1, name: 'attachment', type: 'single-attachment' }],
          },
        ],
      })

      // WHEN: executing query
      await executeQuery('INSERT INTO records (attachment) VALUES (NULL)')
      // WHEN: querying the database
      const result = await executeQuery('SELECT attachment FROM records WHERE id = 1')
      // THEN: assertion
      expect(result.attachment).toBeNull()
    }
  )

  // NOTE: UI upload tests (MIME type restriction, max file size, thumbnail generation)
  // have been moved to:
  // specs/api/tables/{tableId}/records/format.spec.ts (for metadata display)
  // Future: specs/api/upload/post.spec.ts (when upload endpoint is implemented)
  // These tests now validate API responses rather than UI interactions.

  test(
    'APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-006: should store image dimensions in metadata',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with single-attachment field for images
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 10,
            name: 'images',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'photo',
                type: 'single-attachment',
                storeMetadata: true,
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: image file is uploaded
      await executeQuery(
        'INSERT INTO images (photo) VALUES (\'{"url": "image.jpg", "width": 1920, "height": 1080}\')'
      )

      // THEN: metadata includes width and height
      const metadata = await executeQuery('SELECT photo FROM images WHERE id = 1')
      const photoData = JSON.parse(metadata.photo)
      expect(photoData.width).toBe(1920)
      expect(photoData.height).toBe(1080)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-007: should store video duration in metadata',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with single-attachment field for videos
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 11,
            name: 'videos',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'video_file',
                type: 'single-attachment',
                storeMetadata: true,
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: video file is uploaded
      await executeQuery(
        'INSERT INTO videos (video_file) VALUES (\'{"url": "video.mp4", "duration": 120.5}\')'
      )

      // THEN: metadata includes duration in seconds
      const metadata = await executeQuery('SELECT video_file FROM videos WHERE id = 1')
      const videoData = JSON.parse(metadata.video_file)
      expect(videoData.duration).toBe(120.5)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test(
    'APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-REGRESSION: user can complete full single-attachment-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // Setup: Start server with single-attachment fields demonstrating all configurations
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'data',
            fields: [
              { id: 1, name: 'file_url', type: 'single-attachment' },
              { id: 2, name: 'file_meta', type: 'json' },
              {
                id: 3,
                name: 'file_type',
                type: 'single-select',
                options: ['image/png', 'image/jpeg', 'image/gif'],
              },
              { id: 4, name: 'file_size', type: 'integer', max: 10_485_760 },
              { id: 5, name: 'attachment', type: 'single-attachment' },
              { id: 6, name: 'photo', type: 'single-attachment', storeMetadata: true },
              { id: 7, name: 'video_file', type: 'single-attachment', storeMetadata: true },
            ],
          },
        ],
      })

      await test.step('APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-001: Creates VARCHAR column for file URL', async () => {
        // WHEN: querying column info for single-attachment field
        const column = await executeQuery(
          "SELECT data_type FROM information_schema.columns WHERE table_name='data' AND column_name='file_url'"
        )
        // THEN: VARCHAR column is created for URL storage
        expect(column.data_type).toBe('character varying')
      })

      await test.step('APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-002: Stores file metadata as JSONB', async () => {
        // WHEN: inserting file metadata as JSON
        await executeQuery(
          'INSERT INTO data (file_meta) VALUES (\'{"name": "document.pdf", "size": 1024, "type": "application/pdf"}\')'
        )
        const meta = await executeQuery('SELECT file_meta FROM data WHERE id = 1')
        // THEN: file metadata is stored and queryable
        expect(meta.file_meta.name).toBe('document.pdf')
      })

      await test.step('APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-003: Enforces file type validation via CHECK', async () => {
        // WHEN: attempting to insert invalid file type
        // THEN: CHECK constraint rejects the value
        await expect(
          executeQuery("INSERT INTO data (file_type) VALUES ('video/mp4')")
        ).rejects.toThrow(/violates check constraint/)
      })

      await test.step('APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-004: Enforces file size limit via CHECK', async () => {
        // WHEN: attempting to insert file size exceeding limit
        // THEN: CHECK constraint rejects the value
        await expect(
          executeQuery('INSERT INTO data (file_size) VALUES (20000000)')
        ).rejects.toThrow(/violates check constraint/)
      })

      await test.step('APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-005: Supports NULL for optional attachments', async () => {
        // WHEN: inserting NULL for optional attachment
        await executeQuery('INSERT INTO data (attachment) VALUES (NULL)')
        const result = await executeQuery('SELECT attachment FROM data WHERE attachment IS NULL LIMIT 1')
        // THEN: NULL is accepted for optional attachments
        expect(result.attachment).toBeNull()
      })

      await test.step('APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-006: Stores image dimensions in metadata', async () => {
        // WHEN: inserting image attachment with dimensions metadata
        await executeQuery(
          'INSERT INTO data (photo) VALUES (\'{"url": "image.jpg", "width": 1920, "height": 1080}\')'
        )
        const metadata = await executeQuery('SELECT photo FROM data WHERE photo IS NOT NULL LIMIT 1')
        const photoData = JSON.parse(metadata.photo)
        // THEN: image dimensions are stored in metadata
        expect(photoData.width).toBe(1920)
        expect(photoData.height).toBe(1080)
      })

      await test.step('APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-007: Stores video duration in metadata', async () => {
        // WHEN: inserting video attachment with duration metadata
        await executeQuery(
          'INSERT INTO data (video_file) VALUES (\'{"url": "video.mp4", "duration": 120.5}\')'
        )
        const metadata = await executeQuery('SELECT video_file FROM data WHERE video_file IS NOT NULL LIMIT 1')
        const videoData = JSON.parse(metadata.video_file)
        // THEN: video duration is stored in metadata
        expect(videoData.duration).toBe(120.5)
      })
    }
  )
})
