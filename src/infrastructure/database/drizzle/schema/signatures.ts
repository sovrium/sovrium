/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import {
  bytea,
  check,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { users } from '../../../auth/better-auth/schema'
import { systemSchema } from './migration-audit'

/**
 * The evidence of a signing flow, in five tables.
 *
 * A request is one document (or one form statement) put to its signers; each
 * signer is invited by a link whose token is stored only as a digest; a signer
 * who proves control of an address answers a one-time challenge whose code is
 * stored only as an HMAC; every step appends one row to the request's hash
 * chain; and the personal data the chain commits to is kept apart, with the
 * salts that open those commitments, so erasing a signer deletes the subject
 * rows and leaves a chain that still verifies.
 *
 * Evidence is independent of records: no foreign key points at an app table,
 * so purging a record never reaches its evidence. Each table refuses the
 * writes the flow never makes with database triggers created by the
 * migration that adds them (see its comments): the chain is append-only, and
 * its rows go only once the request's `keep_until` has passed.
 */

/** Request statuses, in the order a flow moves through them. */
const REQUEST_STATUSES = sql`'pending', 'signing', 'sealing', 'completed', 'declined', 'cancelled', 'expired'`

/** Signer statuses. */
const SIGNER_STATUSES = sql`'waiting', 'invited', 'verified', 'signed', 'declined'`

/**
 * `system.signature_requests` — one row per document put to signature.
 *
 * `statements` is the statement each signer reads, frozen per language when
 * the request is made. `document_hash` is the SHA-256 (hex) of the document
 * as frozen (H0), and `document_key` the storage key of that frozen copy,
 * held under the evidence namespace; `sealed_document_key` and `proof_key`
 * are written once the flow completes. `keep_until` is set when the request
 * ends (completed, declined, cancelled or expired), from the flow's
 * `evidence.keep`, and is the only date that lets evidence go. `expires_at`
 * may be moved while the request runs, and freezes once it ended.
 */
export const signatureRequests = systemSchema.table(
  'signature_requests',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    flowName: text('flow_name').notNull(),
    tableName: text('table_name').notNull(),
    recordId: text('record_id').notNull(),
    /** `pending` | `signing` | `sealing` | `completed` | `declined` | `cancelled` | `expired`. */
    status: text('status').notNull().default('pending'),
    /** How the signers are invited: all at once, or one after the other. */
    signingOrder: text('signing_order').notNull(),
    /** The frozen statement, keyed by language. */
    statements: jsonb('statements').notNull(),
    documentHash: text('document_hash'),
    documentKey: text('document_key'),
    sealedDocumentKey: text('sealed_document_key'),
    proofKey: text('proof_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    keepUntil: timestamp('keep_until', { withTimezone: true }),
    /** `none` | `b-b` | `b-t`. */
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

/**
 * `system.signature_signers` — one row per signer of a request.
 *
 * `signer_name` is the signer's name in the flow, not the person's: the
 * person's name, address and device live in `signature_subjects`. Only the
 * SHA-256 (hex) of the invitation token is stored, never the token. `user_id`
 * names the account when the signer has one, and is cleared when that
 * account is deleted. `delivered_at` is when the invitation was delivered;
 * `last_notified_at` moves with every message sent since, and is what the
 * next reminder is counted from.
 */
export const signatureSigners = systemSchema.table(
  'signature_signers',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    requestId: text('request_id')
      .notNull()
      .references(() => signatureRequests.id),
    signerName: text('signer_name').notNull(),
    position: integer('position').notNull(),
    /** `waiting` | `invited` | `verified` | `signed` | `declined`. */
    status: text('status').notNull().default('waiting'),
    /** SHA-256 hex digest of the invitation token. NEVER the token itself. */
    tokenHash: text('token_hash'),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
    fieldName: text('field_name'),
    /** Where the signature is drawn on the document. */
    placement: jsonb('placement'),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    /** When the signer was last sent their link or a reminder: the reminder clock. */
    lastNotifiedAt: timestamp('last_notified_at', { withTimezone: true }),
    signedAt: timestamp('signed_at', { withTimezone: true }),
    /** How the signer proves who they are. */
    identityKind: text('identity_kind').notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('signature_signers_request_idx').on(table.requestId),
    uniqueIndex('signature_signers_request_position_unique').on(table.requestId, table.position),
    uniqueIndex('signature_signers_token_hash_unique').on(table.tokenHash),
    index('signature_signers_user_idx').on(table.userId),
    check('signature_signers_status_check', sql`${table.status} IN (${SIGNER_STATUSES})`),
  ]
)

/**
 * `system.signature_challenges` — the one-time codes a signer answers.
 *
 * Only an HMAC of the code is stored. `document_hash` binds the code to the
 * document the signer was shown, so a code cannot sign another version.
 */
export const signatureChallenges = systemSchema.table(
  'signature_challenges',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    signerId: text('signer_id')
      .notNull()
      .references(() => signatureSigners.id),
    /** `email` | `sms`. */
    channel: text('channel').notNull(),
    /** HMAC of the code. NEVER the code itself. */
    codeHmac: text('code_hmac').notNull(),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    documentHash: text('document_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('signature_challenges_signer_idx').on(table.signerId),
    check('signature_challenges_channel_check', sql`${table.channel} IN ('email', 'sms')`),
  ]
)

/**
 * `system.signature_evidence` — the hash chain of a request, one row per
 * event, numbered by `seq` from 1.
 *
 * `canonical_bytes` is the event exactly as hashed, the previous hash included
 * (64 zeros for the first event); personal data enters it only as salted
 * commitments. `hash` is the SHA-256 (hex) of those bytes; `previous_hash`
 * repeats the previous hash, and is null for the first event.
 * `UNIQUE(request_id, seq)` is the compare-and-set two concurrent writers
 * race on: the loser's insert fails and it re-reads the head.
 */
export const signatureEvidence = systemSchema.table(
  'signature_evidence',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    requestId: text('request_id')
      .notNull()
      .references(() => signatureRequests.id),
    seq: integer('seq').notNull(),
    eventType: text('event_type').notNull(),
    canonicalBytes: bytea('canonical_bytes').notNull(),
    previousHash: text('previous_hash'),
    hash: text('hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('signature_evidence_request_seq_unique').on(table.requestId, table.seq)]
)

/**
 * `system.signature_subjects` — the personal data the chain commits to, and
 * the per-field salts that open those commitments (`salts`, keyed by field).
 * `reason` is the reason a signer gave when she declined, on a row of its own:
 * the `declined` event carries only its commitment.
 *
 * The only evidence table whose rows can go before `keep_until`: an erasure
 * deletes the signer's rows, after which the chain still verifies but no
 * longer identifies the signer.
 */
export const signatureSubjects = systemSchema.table(
  'signature_subjects',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
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
    salts: jsonb('salts').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('signature_subjects_request_idx').on(table.requestId),
    index('signature_subjects_signer_idx').on(table.signerId),
  ]
)
