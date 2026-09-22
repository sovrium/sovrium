/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, integer, index } from 'drizzle-orm/sqlite-core'
import { systemTable } from './table-helpers'

/**
 * Form Submissions Table — sqlite-core mirror of `schema/form-submissions.ts`.
 *
 * Persists submissions from BOTH form-submission shapes the platform supports:
 *
 *   1. **Share-link forms** (existing) — public forms exposed via a share
 *      token attached to a page. Identified by (pageName, shareToken,
 *      tableName, submittedData).
 *
 *   2. **Top-level forms** (audit H5) — first-class forms defined under
 *      `app.forms[]`, optionally with their own lifecycle status, submitter
 *      identity, and a link to the record they created.
 *
 * The two shapes coexist in one table because the audit, rate-limit, and
 * soft-delete columns are identical between them. All discriminating columns
 * are nullable so each write path only populates its own columns.
 */
export const formSubmissions = systemTable(
  'form_submissions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // Share-link shape (nullable so top-level form writes can omit them)
    pageName: text('page_name'),
    shareToken: text('share_token'),
    tableName: text('table_name'),
    submittedData: text('submitted_data', { mode: 'json' }),
    // Top-level forms shape (audit H5)
    formName: text('form_name'),
    formId: integer('form_id'),
    status: text('status'),
    statusReason: text('status_reason'),
    data: text('data', { mode: 'json' }),
    submitterUserId: text('submitter_user_id'),
    submitterIpHash: text('submitter_ip_hash'),
    userAgent: text('user_agent'),
    linkedRecordTable: text('linked_record_table'),
    linkedRecordId: text('linked_record_id'),
    // Common audit columns (apply to both shapes)
    guestEmail: text('guest_email'),
    ipAddress: text('ip_address'),
    submittedAt: integer('submitted_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('form_submissions_shareToken_idx').on(table.shareToken),
    index('form_submissions_ip_submitted_idx').on(table.ipAddress, table.submittedAt),
    index('form_submissions_deletedAt_idx').on(table.deletedAt),
    // Audit H5: top-level-forms read path is `WHERE form_name = $1
    // ORDER BY submitted_at DESC`, served by this composite index.
    index('form_submissions_formName_submitted_idx').on(table.formName, table.submittedAt),
  ]
)

// Type inference
