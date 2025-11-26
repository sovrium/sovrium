/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

test.describe('Multiple Attachments Field', () => {
  test.fixme(
    'APP-MULTIPLE-ATTACHMENTS-FIELD-001: should create JSONB ARRAY column for multiple file storage',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
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

      const column = await executeQuery(
        "SELECT data_type FROM information_schema.columns WHERE table_name='posts' AND column_name='attachments'"
      )
      expect(column.data_type).toBe('jsonb')
    }
  )

  test.fixme(
    'APP-MULTIPLE-ATTACHMENTS-FIELD-002: should store array of file metadata objects',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
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

      await executeQuery(
        'INSERT INTO messages (files) VALUES (\'[{"url": "file1.pdf", "size": 100}, {"url": "file2.jpg", "size": 200}]\')'
      )
      const files = await executeQuery('SELECT files FROM messages WHERE id = 1')
      expect(files.files.length).toBe(2)
    }
  )

  test.fixme(
    'APP-MULTIPLE-ATTACHMENTS-FIELD-003: should enforce maximum attachment count via CHECK constraint',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'records',
            fields: [{ id: 1, name: 'attachments', type: 'multiple-attachments', maxFiles: 5 }],
          },
        ],
      })

      await expect(
        executeQuery("INSERT INTO records (attachments) VALUES ('[1,2,3,4,5,6]')")
      ).rejects.toThrow(/violates check constraint/)
    }
  )

  test.fixme(
    'APP-MULTIPLE-ATTACHMENTS-FIELD-004: should support querying by attachment properties',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          { id: 4, name: 'docs', fields: [{ id: 1, name: 'files', type: 'multiple-attachments' }] },
        ],
      })

      await executeQuery('INSERT INTO docs (files) VALUES (\'[{"type": "pdf"}]\')')
      const result = await executeQuery(
        'SELECT COUNT(*) as count FROM docs WHERE files @> \'[{"type": "pdf"}]\''
      )
      expect(result.count).toBe(1)
    }
  )

  test.fixme(
    'APP-MULTIPLE-ATTACHMENTS-FIELD-005: should create GIN index for efficient JSON queries',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'items',
            fields: [{ id: 1, name: 'attachments', type: 'multiple-attachments', indexed: true }],
          },
        ],
      })

      const index = await executeQuery(
        "SELECT indexname FROM pg_indexes WHERE indexname = 'idx_items_attachments'"
      )
      expect(index.indexname).toBe('idx_items_attachments')
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-MULTIPLE-ATTACHMENTS-REGRESSION-001: user can complete full multiple-attachments-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          { id: 6, name: 'data', fields: [{ id: 1, name: 'files', type: 'multiple-attachments' }] },
        ],
      })

      await executeQuery(
        'INSERT INTO data (files) VALUES (\'[{"url": "a.pdf"}, {"url": "b.jpg"}]\')'
      )
      const files = await executeQuery(
        'SELECT jsonb_array_length(files) as count FROM data WHERE id = 1'
      )
      expect(files.count).toBe(2)
    }
  )
})
