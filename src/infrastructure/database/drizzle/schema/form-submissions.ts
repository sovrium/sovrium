/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { text, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core'
import { systemSchema } from './migration-audit'

export const formSubmissions = systemSchema.table(
  'form_submissions',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    pageName: text('page_name'),
    shareToken: text('share_token'),
    tableName: text('table_name'),
    submittedData: jsonb('submitted_data'),
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
    guestEmail: text('guest_email'),
    ipAddress: text('ip_address'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('form_submissions_shareToken_idx').on(table.shareToken),
    index('form_submissions_ip_submitted_idx').on(table.ipAddress, table.submittedAt),
    index('form_submissions_deletedAt_idx').on(table.deletedAt),
    index('form_submissions_formName_submitted_idx').on(table.formName, table.submittedAt),
  ]
)

export type FormSubmission = typeof formSubmissions.$inferSelect
export type NewFormSubmission = typeof formSubmissions.$inferInsert
