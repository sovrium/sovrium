/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

test.describe('Single Attachment Field', () => {
  test.fixme(
    'APP-SINGLE-ATTACHMENT-FIELD-001: should create VARCHAR column for single file URL storage',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_documents',
            name: 'documents',
            fields: [{ name: 'file_url', type: 'single-attachment' }],
          },
        ],
      })

      const column = await executeQuery(
        "SELECT data_type FROM information_schema.columns WHERE table_name='documents' AND column_name='file_url'"
      )
      expect(column.data_type).toBe('character varying')
    }
  )

  test.fixme(
    'APP-SINGLE-ATTACHMENT-FIELD-002: should store file metadata as JSONB',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_attachments',
            name: 'attachments',
            fields: [{ name: 'file_meta', type: 'json' }],
          },
        ],
      })

      await executeQuery(
        'INSERT INTO attachments (file_meta) VALUES (\'{"name": "document.pdf", "size": 1024, "type": "application/pdf"}\')'
      )
      const meta = await executeQuery('SELECT file_meta FROM attachments WHERE id = 1')
      expect(meta.file_meta.name).toBe('document.pdf')
    }
  )

  test.fixme(
    'APP-SINGLE-ATTACHMENT-FIELD-003: should enforce file type validation via CHECK constraint',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_images',
            name: 'images',
            fields: [
              {
                name: 'file_type',
                type: 'single-line-text',
                allowedValues: ['image/png', 'image/jpeg', 'image/gif'],
              },
            ],
          },
        ],
      })

      await expect(
        executeQuery("INSERT INTO images (file_type) VALUES ('video/mp4')")
      ).rejects.toThrow(/violates check constraint/)
    }
  )

  test.fixme(
    'APP-SINGLE-ATTACHMENT-FIELD-004: should enforce file size limit via CHECK constraint',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_uploads',
            name: 'uploads',
            fields: [{ name: 'file_size', type: 'integer', max: 10_485_760 }],
          },
        ],
      })

      await expect(
        executeQuery('INSERT INTO uploads (file_size) VALUES (20000000)')
      ).rejects.toThrow(/violates check constraint/)
    }
  )

  test.fixme(
    'APP-SINGLE-ATTACHMENT-FIELD-005: should support NULL for optional attachments',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_records',
            name: 'records',
            fields: [{ name: 'attachment', type: 'single-attachment' }],
          },
        ],
      })

      await executeQuery('INSERT INTO records (attachment) VALUES (NULL)')
      const result = await executeQuery('SELECT attachment FROM records WHERE id = 1')
      expect(result.attachment).toBeNull()
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-SINGLE-ATTACHMENT-REGRESSION-001: user can complete full single-attachment-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_files',
            name: 'files',
            fields: [
              { name: 'url', type: 'single-attachment' },
              { name: 'metadata', type: 'json' },
            ],
          },
        ],
      })

      await executeQuery(
        "INSERT INTO files (url, metadata) VALUES ('https://example.com/file.pdf', '{\"size\": 1024}')"
      )
      const file = await executeQuery('SELECT url, metadata FROM files WHERE id = 1')
      expect(file.url).toBe('https://example.com/file.pdf')
    }
  )
})
