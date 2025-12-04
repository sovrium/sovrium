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
 * Spec Count: 10
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

  test.fixme(
    'APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-006: should restrict file uploads to allowed MIME types',
    { tag: '@spec' },
    async ({ startServerWithSchema, page }) => {
      // GIVEN: table with single-attachment field restricted to images only
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 7,
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

      // WHEN: user attempts to upload a PDF file
      await page.goto('/tables/profiles')
      await page.getByRole('button', { name: 'Upload' }).click()

      // THEN: file picker only allows image types and rejects PDF
      const fileInput = page.locator('input[type="file"]')
      await expect(fileInput).toHaveAttribute('accept', 'image/png,image/jpeg,image/gif')
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-007: should enforce maximum file size limit',
    { tag: '@spec' },
    async ({ startServerWithSchema, page }) => {
      // GIVEN: table with single-attachment field with 5MB max file size
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 8,
            name: 'documents',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'file',
                type: 'single-attachment',
                maxFileSize: 5_242_880, // 5MB in bytes
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: user attempts to upload a 10MB file
      await page.goto('/tables/documents')
      // Simulate upload attempt (implementation depends on upload UI)

      // THEN: upload is rejected with error message
      await expect(page.getByText(/File size exceeds maximum of 5MB/)).toBeVisible()
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-008: should generate thumbnails for image attachments',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, page }) => {
      // GIVEN: table with single-attachment field configured for thumbnail generation
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 9,
            name: 'photos',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'image',
                type: 'single-attachment',
                generateThumbnail: true,
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: user uploads an image file
      await page.goto('/tables/photos')
      // Upload image (implementation specific)

      // THEN: thumbnail is generated and stored in metadata
      const metadata = await executeQuery('SELECT image FROM photos WHERE id = 1')
      expect(metadata.image).toContain('thumbnail')
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-009: should store image dimensions in metadata',
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

  test.fixme(
    'APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-010: should store video duration in metadata',
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
    'APP-TABLES-FIELD-TYPES-SINGLE-ATTACHMENT-011: user can complete full single-attachment-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Start server with single-attachment field', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 6,
              name: 'files',
              fields: [
                { id: 1, name: 'url', type: 'single-attachment' },
                { id: 2, name: 'metadata', type: 'json' },
              ],
            },
          ],
        })
      })

      await test.step('Insert and verify attachment', async () => {
        await executeQuery(
          "INSERT INTO files (url, metadata) VALUES ('https://example.com/file.pdf', '{\"size\": 1024}')"
        )
        const file = await executeQuery('SELECT url, metadata FROM files WHERE id = 1')
        expect(file.url).toBe('https://example.com/file.pdf')
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
                  { id: 1, name: 'file_a', type: 'single-attachment' },
                  { id: 1, name: 'file_b', type: 'single-attachment' }, // Duplicate ID!
                ],
              },
            ],
          })
        ).rejects.toThrow(/duplicate.*field.*id|field.*id.*must.*be.*unique/i)
      })
    }
  )
})
