/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { text, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core'
import { systemSchema } from './migration-audit'

/**
 * Form Submissions Table
 *
 * Persists submissions from BOTH form-submission shapes the platform supports:
 *
 *   1. **Share-link forms** (existing) — public forms exposed via a share
 *      token attached to a page. Identified by (pageName, shareToken,
 *      tableName, submittedData).
 *
 *   2. **Top-level forms** (audit H5; this commit) — first-class forms
 *      defined under `app.forms[]`, optionally with their own lifecycle
 *      status, submitter identity, and a link to the record they created.
 *      Identified by (formName, formId, status, data, …).
 *
 * The two shapes coexist in one table because the audit, rate-limit, and
 * soft-delete columns are identical between them; a future refactor can
 * split them if the shapes diverge further. All discriminating columns
 * are nullable so each write path only populates its own columns; readers
 * filter on the column unique to their shape (`share_token` vs
 * `form_name`).
 *
 * Features:
 * - JSONB payload for flexible form data storage (two columns:
 *   `submitted_data` for share-link writes, `data` for top-level forms;
 *   kept separate to avoid coupling the two shapes' writers)
 * - IP-based rate limiting (10 per minute per IP)
 * - Soft delete support
 * - Linked to share tokens (share-link shape) OR linked records
 *   (top-level forms shape) for downstream resolution
 */
export const formSubmissions = systemSchema.table(
  'form_submissions',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    // Share-link shape (now nullable so top-level form writes can omit them)
    pageName: text('page_name'),
    shareToken: text('share_token'),
    tableName: text('table_name'),
    submittedData: jsonb('submitted_data'),
    // Top-level forms shape (audit H5)
    formName: text('form_name'),
    formId: integer('form_id'),
    status: text('status'),
    statusReason: text('status_reason'),
    data: jsonb('data'),
    submitterUserId: text('submitter_user_id'),
    submitterIpHash: text('submitter_ip_hash'),
    userAgent: text('user_agent'),
    linkedRecordTable: text('linked_record_table'),
    linkedRecordId: text('linked_record_id'),
    // Common audit columns (apply to both shapes)
    guestEmail: text('guest_email'),
    ipAddress: text('ip_address'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
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
export type FormSubmission = typeof formSubmissions.$inferSelect
export type NewFormSubmission = typeof formSubmissions.$inferInsert
