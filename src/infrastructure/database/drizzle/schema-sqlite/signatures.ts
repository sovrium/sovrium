/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { blob, check, index, integer, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { users } from './auth-tables'
import { systemTable } from './table-helpers'

/**
 * sqlite-core mirror of `schema/signatures.ts` — physical tables
 * `system_signature_requests`, `system_signature_signers`,
 * `system_signature_challenges`, `system_signature_evidence` and
 * `system_signature_subjects`. See the pg module for what each one holds; the
 * triggers that refuse the writes a flow never makes are created by the
 * migration that adds the tables, on both engines.
 */

const REQUEST_STATUSES = sql`'pending', 'signing', 'sealing', 'completed', 'declined', 'cancelled', 'expired'`

const SIGNER_STATUSES = sql`'waiting', 'invited', 'verified', 'signed', 'declined'`

const createdAt = () =>
  integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())

export const signatureRequests = systemTable(
  'signature_requests',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    flowName: text('flow_name').notNull(),
    tableName: text('table_name').notNull(),
    recordId: text('record_id').notNull(),
    status: text('status').notNull().default('pending'),
    signingOrder: text('signing_order').notNull(),
    statements: text('statements', { mode: 'json' }).notNull(),
    documentHash: text('document_hash'),
    documentKey: text('document_key'),
    sealedDocumentKey: text('sealed_document_key'),
    proofKey: text('proof_key'),
    createdAt: createdAt(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
    keepUntil: integer('keep_until', { mode: 'timestamp_ms' }),
    sealLevel: text('seal_level').notNull().default('none'),
    lastError: text('last_error'),
  },
  (table) => [
    index('signature_requests_record_idx').on(table.tableName, table.recordId),
    index('signature_requests_status_idx').on(table.status),
    index('signature_requests_keep_until_idx').on(table.keepUntil),
    check('signature_requests_status_check', sql`${table.status} IN (${REQUEST_STATUSES})`),
    check('signature_requests_seal_level_check', sql`${table.sealLevel} IN ('none', 'b-b', 'b-t')`),
  ]
)

export const signatureSigners = systemTable(
  'signature_signers',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    requestId: text('request_id')
      .notNull()
      .references(() => signatureRequests.id),
    signerName: text('signer_name').notNull(),
    position: integer('position').notNull(),
    status: text('status').notNull().default('waiting'),
    tokenHash: text('token_hash'),
    tokenExpiresAt: integer('token_expires_at', { mode: 'timestamp_ms' }),
    fieldName: text('field_name'),
    placement: text('placement', { mode: 'json' }),
    deliveredAt: integer('delivered_at', { mode: 'timestamp_ms' }),
    lastNotifiedAt: integer('last_notified_at', { mode: 'timestamp_ms' }),
    signedAt: integer('signed_at', { mode: 'timestamp_ms' }),
    identityKind: text('identity_kind').notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (table) => [
    index('signature_signers_request_idx').on(table.requestId),
    uniqueIndex('signature_signers_request_position_unique').on(table.requestId, table.position),
    uniqueIndex('signature_signers_token_hash_unique').on(table.tokenHash),
    index('signature_signers_user_idx').on(table.userId),
    check('signature_signers_status_check', sql`${table.status} IN (${SIGNER_STATUSES})`),
  ]
)

export const signatureChallenges = systemTable(
  'signature_challenges',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    signerId: text('signer_id')
      .notNull()
      .references(() => signatureSigners.id),
    channel: text('channel').notNull(),
    codeHmac: text('code_hmac').notNull(),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    consumedAt: integer('consumed_at', { mode: 'timestamp_ms' }),
    documentHash: text('document_hash'),
    createdAt: createdAt(),
  },
  (table) => [
    index('signature_challenges_signer_idx').on(table.signerId),
    check('signature_challenges_channel_check', sql`${table.channel} IN ('email', 'sms')`),
  ]
)

export const signatureEvidence = systemTable(
  'signature_evidence',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    requestId: text('request_id')
      .notNull()
      .references(() => signatureRequests.id),
    seq: integer('seq').notNull(),
    eventType: text('event_type').notNull(),
    canonicalBytes: blob('canonical_bytes', { mode: 'buffer' }).notNull(),
    previousHash: text('previous_hash'),
    hash: text('hash').notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex('signature_evidence_request_seq_unique').on(table.requestId, table.seq)]
)

export const signatureSubjects = systemTable(
  'signature_subjects',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    requestId: text('request_id')
      .notNull()
      .references(() => signatureRequests.id),
    signerId: text('signer_id')
      .notNull()
      .references(() => signatureSigners.id),
    name: text('name'),
    email: text('email'),
    phone: text('phone'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    reason: text('reason'),
    salts: text('salts', { mode: 'json' }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('signature_subjects_request_idx').on(table.requestId),
    index('signature_subjects_signer_idx').on(table.signerId),
  ]
)
