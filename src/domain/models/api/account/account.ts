/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { email, looseIsoDateTime } from '@/domain/models/api/combinators/formats'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import { transformed } from '@/domain/models/api/combinators/transform'
import { isIssuedAvatarUrl } from '@/domain/models/app/auth/avatar-url'
import { timestampSchema } from '../combinators/common'

/**
 * Account self-service & GDPR API schemas
 *
 * Zod schemas for the authenticated account endpoints:
 * - `GET  /api/account/export` — GDPR Art. 15 (access) + Art. 20 (portability)
 * - `POST /api/account/delete` — GDPR Art. 17 (erasure)
 *
 * Both endpoints operate only on the authenticated caller. There is no
 * client-supplied user id, so cross-account access is impossible by
 * construction (anti-enumeration).
 */

// ============================================================================
// Account Export Schemas
// ============================================================================

/**
 * Account export — profile section
 *
 * The caller's `auth.user` row. Secret material is never present on this row.
 */
export const accountExportProfileSchema = Schema.Struct({
  ...Schema.Struct({
    id: Schema.String.annotate({ description: 'Unique user identifier' }),
    email: email({ description: 'User email address' }),
    name: Schema.NullOr(Schema.String.annotate({ description: 'User display name' })),
    image: transformed(Schema.NullOr(Schema.String), Schema.NullOr(Schema.String), (value) =>
      // `null` is this field's wire contract (`Schema.NullOr` above);
      // `undefined` would drop the key from the JSON export entirely.
      // eslint-disable-next-line unicorn/no-null
      isIssuedAvatarUrl(value) ? value : null
    ).annotate({ description: 'User avatar URL — a root-relative bucket object, or null' }),
    emailVerified: Schema.Boolean.annotate({
      description: 'Whether the email address is verified',
    }),
    role: Schema.Literals(['admin', 'member', 'viewer']).annotate({ description: 'User role' }),
    // The caller's own interface-language preference — an engine-owned column on
    // `auth.user`, declared through Better Auth's `user.additionalFields` rather
    // than as an app config option, so it exists for every auth-enabled app and
    // is hard-deleted with the subject's row.
    //
    // It belongs on the export because this section IS the caller's `auth.user`
    // row, and the access right covers the row rather than a chosen subset of
    // it. Note that the erasure/export coverage map is keyed by TABLE and
    // already reads `auth.user` as exported, so a new column cannot grow that
    // map — the reason to declare the field here is completeness, not the gate.
    //
    // REQUIRED and nullable, like `name` and `image` beside it. It was declared
    // optional while the column did not yet exist, so the published OpenAPI
    // document would not advertise a field the binary did not return; the column,
    // the `buildExportPayload` line and this tightening landed together, which is
    // what the three being one contract meant.
    language: Schema.NullOr(
      Schema.String.annotate({
        description:
          "The user's interface-language preference (a code or locale the app declares), or null",
      })
    ),
    // The two operator-email preferences — engine-owned `auth.user` columns,
    // `NOT NULL DEFAULT true`, exported for the reason `language` is: this
    // section IS the caller's row. Required, because `buildExportPayload`
    // always writes them.
    notifyAutomationAlerts: Schema.Boolean.annotate({
      description: 'Whether this account receives automation-failure emails',
    }),
    notifyWeeklyDigest: Schema.Boolean.annotate({
      description: 'Whether this account receives the weekly summary email',
    }),
  }).fields,
  ...timestampSchema.fields,
}).annotate({ identifier: 'AccountExportProfile' })

/**
 * Account export — session section
 *
 * One entry per `auth.session` row belonging to the caller. The session token
 * is deliberately omitted — it is a live credential, not export-relevant data.
 */
export const accountExportSessionSchema = Schema.Struct({
  ...Schema.Struct({
    id: Schema.String.annotate({ description: 'Session identifier' }),
    userId: Schema.String.annotate({ description: 'User ID this session belongs to' }),
    expiresAt: looseIsoDateTime({ description: 'ISO 8601 session expiration timestamp' }),
    ipAddress: Schema.NullOr(
      Schema.String.annotate({ description: 'IP address the session was created from' })
    ),
    userAgent: Schema.NullOr(
      Schema.String.annotate({ description: 'User agent string of the session client' })
    ),
  }).fields,
  ...timestampSchema.fields,
}).annotate({ identifier: 'AccountExportSession' })

/**
 * Account export — linked-account section
 *
 * One entry per `auth.account` row (OAuth providers and the email/password
 * credential record). Secret material (`password`, `accessToken`,
 * `refreshToken`, `idToken`) is deliberately OMITTED — exporting credentials is
 * a security risk and is not required by GDPR Art. 15.
 */
export const accountExportLinkedAccountSchema = Schema.Struct({
  ...Schema.Struct({
    id: Schema.String.annotate({ description: 'Linked account identifier' }),
    userId: Schema.String.annotate({ description: 'User ID this linked account belongs to' }),
    providerId: Schema.String.annotate({
      description: 'Authentication provider identifier (e.g. "credential", "google")',
    }),
    accountId: Schema.String.annotate({ description: 'Provider-scoped account identifier' }),
    scope: Schema.NullOr(
      Schema.String.annotate({ description: 'OAuth scopes granted, if applicable' })
    ),
  }).fields,
  ...timestampSchema.fields,
}).annotate({ identifier: 'AccountExportLinkedAccount' })

/**
 * Account export — authored-record section
 *
 * One entry per table record across the app where `created_by` equals the
 * caller. Satisfies the GDPR Art. 20 portability requirement for
 * user-generated content.
 */
export const accountExportRecordSchema = Schema.Struct({
  ...Schema.Struct({
    tableSlug: Schema.String.annotate({ description: 'Slug of the table the record belongs to' }),
    recordId: Schema.String.annotate({ description: 'Record identifier' }),
    fields: Schema.Record(Schema.String, Schema.Unknown).annotate({
      description: 'Record field values keyed by field name',
    }),
  }).fields,
  ...timestampSchema.fields,
}).annotate({ identifier: 'AccountExportRecord' })

/**
 * Account export — form-submission section
 *
 * One entry per `system.form_submissions` row whose `submitter_user_id` equals
 * the caller. Submissions made anonymously (no `submitter_user_id`) belong to
 * nobody and are never attributed to an exporting user.
 *
 * `submitter_ip_hash` is deliberately OMITTED. Sovrium never holds the
 * submitter's IP: it is hashed at the route boundary and the raw address never
 * reaches the application layer, so there is no address to disclose — only a
 * digest of one. That digest is stable — the salt is derived from the install's
 * root secret, so the same address hashes identically across restarts — but it
 * remains an opaque, install-scoped correlation token: the salt never leaves
 * the install, so the value is meaningless anywhere else and cannot be reversed
 * to an address. It is therefore neither intelligible under Art. 15 nor portable
 * under Art. 20. Where an IP IS retained in clear, the
 * export already surfaces it (`sessions[].ipAddress`).
 */
export const accountExportFormSubmissionSchema = Schema.Struct({
  submissionId: Schema.String.annotate({ description: 'Ledger row identifier of the submission' }),
  formName: Schema.NullOr(
    Schema.String.annotate({
      description:
        'Name of the submitted form — nullable because the ledger also stores share-link submissions, which carry no form name',
    })
  ),
  status: Schema.NullOr(
    Schema.String.annotate({ description: 'Lifecycle status of the submission (e.g. "received")' })
  ),
  data: Schema.Record(Schema.String, Schema.Unknown).annotate({
    description: 'The values the caller actually submitted, keyed by field name',
  }),
  userAgent: Schema.NullOr(
    Schema.String.annotate({
      description: 'User agent string the submission was sent with, when recorded',
    })
  ),
  submittedAt: looseIsoDateTime({ description: 'ISO 8601 timestamp the submission was received' }),
}).annotate({ identifier: 'AccountExportFormSubmission' })

/**
 * Account export — one audit-log entry the caller made
 *
 * One `audit_log` row whose actor is the caller: what they did, when, to what,
 * and with what outcome. Nothing else. The row's `metadata` is left out because
 * emitters write free-form metadata and some of it describes somebody else (a
 * role change carries the target's previous and new role); the transport and
 * the actor block are left out because the actor is the caller. Entries in
 * which the caller is only the resource acted upon (their role was changed,
 * they were banned) are an admin's act and are not listed.
 */
export const accountExportAuditEntrySchema = Schema.Struct({
  action: Schema.String.annotate({
    description: 'What the caller did, as an audit action name (e.g. "user.role.changed")',
  }),
  occurredAt: looseIsoDateTime({ description: 'ISO 8601 timestamp the act was recorded' }),
  resourceType: Schema.String.annotate({
    description: 'Kind of thing the act was done to (e.g. "user", "account")',
  }),
  resourceId: Schema.String.annotate({
    description: 'Identifier of the thing the act was done to',
  }),
  result: Schema.String.annotate({
    description: 'Outcome the audit trail recorded for the act (e.g. "success")',
  }),
}).annotate({ identifier: 'AccountExportAuditEntry' })

/**
 * Account export — one file the caller attached to a chat
 *
 * One `system.ai_chat_attachments` row the caller uploaded: its name, size,
 * type, and the conversation it was sent in (`null` when it was never sent).
 * The bytes are not inlined; the caller downloads each file from
 * `GET /api/ai/chat/attachments/{id}` while it exists.
 */
export const accountExportChatAttachmentSchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'Attachment identifier' }),
  name: Schema.String.annotate({ description: 'The file name as uploaded' }),
  size: Schema.Int.annotate({ description: 'Size of the file in bytes' }),
  mimeType: Schema.String.annotate({ description: 'The media type read from the file content' }),
  sessionId: Schema.NullOr(
    Schema.String.annotate({ description: 'The conversation the file was sent in' })
  ),
  uploadedAt: looseIsoDateTime({ description: 'ISO 8601 timestamp the file was uploaded' }),
}).annotate({ identifier: 'AccountExportChatAttachment' })

/**
 * Account export — one tool call an assistant turn asked for, by reference
 *
 * The call's correlation id and the tool's name. Its arguments are left out:
 * the model wrote them from the conversation, and they routinely name the
 * people and rows the caller asked about, which are somebody else's data. The
 * caller's own words are already in the message `content` they typed.
 */
export const accountExportAiToolCallRefSchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'Correlation id the model gave the tool call' }),
  name: Schema.String.annotate({ description: 'Name of the tool the assistant asked to run' }),
}).annotate({ identifier: 'AccountExportAiToolCallRef' })

/**
 * Account export — one message of one of the caller's AI conversations
 *
 * A `system.ai_messages` row, in the order it was written. The text is
 * exported verbatim, whoever wrote it: what the caller typed and what the
 * assistant answered them are both part of the conversation they had.
 */
export const accountExportAiMessageSchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'Message identifier' }),
  role: Schema.String.annotate({
    description: 'Who wrote the message: `user`, `assistant`, or `tool`',
  }),
  content: Schema.String.annotate({
    description: 'The message text, verbatim — empty for a turn that only called tools',
  }),
  status: Schema.String.annotate({
    description:
      '`complete`, or `incomplete` for an answer whose stream was interrupted before it finished',
  }),
  model: Schema.NullOr(
    Schema.String.annotate({ description: 'The model that wrote an assistant message' })
  ),
  toolCalls: Schema.NullOr(
    Schema.Array(accountExportAiToolCallRefSchema).annotate({
      description:
        'The tools an assistant turn asked to run, by name — arguments and results left out',
    })
  ),
  sentAt: looseIsoDateTime({ description: 'ISO 8601 timestamp the message was recorded' }),
}).annotate({ identifier: 'AccountExportAiMessage' })

/**
 * Account export — one AI conversation the caller held
 *
 * A `system.ai_conversations` row whose `user_id` is the caller, with every
 * message in it, oldest first. The files sent in it are listed by id in
 * `attachmentIds`; each one is described in the export's `aiChatAttachments`.
 * The row's `metadata` is the store's own bookkeeping and is left out.
 */
export const accountExportAiConversationSchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'Conversation identifier' }),
  sessionId: Schema.NullOr(
    Schema.String.annotate({ description: 'The session key the chat used for this conversation' })
  ),
  agentName: Schema.NullOr(
    Schema.String.annotate({
      description: 'The agent the caller talked to, when one drove the chat',
    })
  ),
  title: Schema.NullOr(Schema.String.annotate({ description: 'The conversation title' })),
  startedAt: looseIsoDateTime({ description: 'ISO 8601 timestamp the conversation was opened' }),
  lastActivityAt: looseIsoDateTime({
    description: 'ISO 8601 timestamp of the last message in the conversation',
  }),
  attachmentIds: Schema.Array(Schema.String).annotate({
    description: 'Ids of the files sent in this conversation, as listed in `aiChatAttachments`',
  }),
  messages: Schema.Array(accountExportAiMessageSchema).annotate({
    description: 'Every message of the conversation, oldest first',
  }),
}).annotate({ identifier: 'AccountExportAiConversation' })

/**
 * Account export — one fact an agent remembers about the caller
 *
 * A `system.ai_facts` row whose `user_id` is the caller: the long-term memory
 * an agent inferred about them, which is personal data by construction. The
 * row's `metadata` is the store's own bookkeeping and is left out.
 */
export const accountExportAiFactSchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'Fact identifier' }),
  namespace: Schema.String.annotate({
    description: 'The memory namespace the agent keeps the fact in',
  }),
  agentName: Schema.String.annotate({ description: 'The agent that remembers the fact' }),
  fact: Schema.String.annotate({ description: 'The fact, as the agent stored it' }),
  learnedAt: looseIsoDateTime({ description: 'ISO 8601 timestamp the fact was stored' }),
}).annotate({ identifier: 'AccountExportAiFact' })

/**
 * Account export — one entry of the AI activity feed that names the caller
 *
 * A `system.ai_activity_logs` row that names the caller — as its actor, by user
 * id or by address, or as the person an agent acted for (`user_email`): the
 * same rows erasure deletes. The caller's id and address are left out, since
 * every listed row names them; when an agent acted, its name is kept so the
 * caller can tell who did it. The projection is explicit: a column
 * the feed gains later reaches the export only when it is added here, so a new
 * column never breaks the export and never leaks into it unreviewed.
 */
export const accountExportAiActivityEntrySchema = Schema.Struct({
  action: Schema.String.annotate({
    description: 'What happened, as an activity action name (e.g. "ai.chat.message")',
  }),
  targetTable: Schema.NullOr(
    Schema.String.annotate({ description: 'The table the action touched, when it touched one' })
  ),
  agentName: Schema.NullOr(
    Schema.String.annotate({
      description:
        "The agent that acted on the caller's behalf, or null when the caller acted themselves",
    })
  ),
  surface: optionalField(
    Schema.NullOr(
      Schema.String.annotate({
        description:
          'Where the agent ran (a chat, an automation, a schedule), when the feed recorded it',
      })
    )
  ),
  occurredAt: looseIsoDateTime({ description: 'ISO 8601 timestamp the entry was recorded' }),
}).annotate({ identifier: 'AccountExportAiActivityEntry' })

/**
 * Account export — one AI tool call the caller made
 *
 * A `system.ai_tool_calls` row recorded under the caller's user id. What ran,
 * when, through which door and how it ended — not what it carried. `input`,
 * `output` and the error text are left out: they hold the record payloads the
 * tool read or wrote, which belong to the people those records describe, and
 * a copy frozen at call time would hand the caller rows their role may no
 * longer let them read. The records themselves stay reachable, under today's
 * permissions, through the records API.
 */
export const accountExportAiToolCallSchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'Tool-call identifier' }),
  toolName: Schema.String.annotate({ description: 'Name of the tool that ran' }),
  callerRole: Schema.String.annotate({ description: 'The role the caller held when it ran' }),
  transport: Schema.String.annotate({ description: 'How the call arrived (e.g. "http")' }),
  sessionId: Schema.NullOr(
    Schema.String.annotate({ description: 'The client session the call belonged to' })
  ),
  outcome: Schema.Literals(['success', 'error']).annotate({
    description: '`error` when the tool answered with an error, `success` otherwise',
  }),
  errorCode: Schema.NullOr(
    Schema.Int.annotate({ description: 'The error code of a failed call, or null' })
  ),
  latencyMs: Schema.Int.annotate({ description: 'How long the call took, in milliseconds' }),
  calledAt: looseIsoDateTime({ description: 'ISO 8601 timestamp the call was recorded' }),
}).annotate({ identifier: 'AccountExportAiToolCall' })

/**
 * Account export response schema
 *
 * The complete personal-data footprint of the authenticated caller, returned by
 * `GET /api/account/export`. A single machine-readable JSON document covering
 * GDPR Art. 15 (right of access) and Art. 20 (right to data portability).
 */
export const accountExportResponseSchema = Schema.Struct({
  exportedAt: looseIsoDateTime({ description: 'ISO 8601 timestamp the export was generated' }),
  format: Schema.Literal('json').annotate({
    description: 'Export payload format (future-proofs other formats)',
  }),
  schemaVersion: Schema.Literal('1.0').annotate({ description: 'Export payload contract version' }),
  profile: accountExportProfileSchema.annotate({
    description: "The caller's profile (auth.user row)",
  }),
  sessions: Schema.Array(accountExportSessionSchema).annotate({
    description: "The caller's authentication sessions",
  }),
  accounts: Schema.Array(accountExportLinkedAccountSchema).annotate({
    description: "The caller's linked accounts, with all secret material omitted",
  }),
  authoredRecords: Schema.Array(accountExportRecordSchema).annotate({
    description: 'Every table record the caller authored (created_by = caller)',
  }),
  formSubmissions: Schema.Array(accountExportFormSubmissionSchema).annotate({
    description: 'Every form submission the caller made (submitter_user_id = caller)',
  }),
  auditTrail: Schema.Array(accountExportAuditEntrySchema).annotate({
    description:
      'Every admin audit-log entry the caller made, newest first — the acts only, without their metadata. Empty for an account that never performed an audited act.',
  }),
  aiChatAttachments: Schema.Array(accountExportChatAttachmentSchema).annotate({
    description: 'Every file the caller attached to a chat, oldest first',
  }),
  aiConversations: Schema.Array(accountExportAiConversationSchema).annotate({
    description: 'Every AI conversation the caller held, with its messages, newest first',
  }),
  aiFacts: Schema.Array(accountExportAiFactSchema).annotate({
    description: 'Every fact an agent remembers about the caller, newest first',
  }),
  aiActivity: Schema.Array(accountExportAiActivityEntrySchema).annotate({
    description:
      'Every AI activity-feed entry naming the caller, as its actor or as the person an agent acted for, newest first',
  }),
  aiToolCalls: Schema.Array(accountExportAiToolCallSchema).annotate({
    description: 'Every AI tool call the caller made, newest first — without what it read or wrote',
  }),
}).annotate({ identifier: 'AccountExportResponse' })

// ============================================================================
// Account Deletion Schemas
// ============================================================================

/**
 * Account delete — confirm request shape
 *
 * `{ confirm: true }` schedules the account for erasure. The literal-`true`
 * requirement is an explicit anti-fat-finger confirmation.
 */
export const accountDeleteConfirmRequestSchema = Schema.Struct({
  confirm: Schema.Literal(true).annotate({
    description: 'Explicit confirmation that the account should be scheduled for erasure',
  }),
}).annotate({ identifier: 'AccountDeleteConfirmRequest' })

/**
 * Account delete — cancel request shape
 *
 * `{ cancel: true }` cancels a pending erasure during the grace window.
 */
export const accountDeleteCancelRequestSchema = Schema.Struct({
  cancel: Schema.Literal(true).annotate({
    description: 'Explicit request to cancel a pending account erasure',
  }),
}).annotate({ identifier: 'AccountDeleteCancelRequest' })

/**
 * Account delete request schema
 *
 * Body of `POST /api/account/delete`. A discriminated union — exactly one of a
 * confirm-shape or a cancel-shape. A body matching neither is rejected `400`.
 */
export const accountDeleteRequestSchema = Schema.Union([
  accountDeleteConfirmRequestSchema,
  accountDeleteCancelRequestSchema,
]).annotate({ identifier: 'AccountDeleteRequest' })

/**
 * Account delete — scheduled response shape
 *
 * Returned `202 Accepted` when `{ confirm: true }` schedules an erasure.
 */
export const accountDeleteScheduledResponseSchema = Schema.Struct({
  status: Schema.Literal('scheduled').annotate({ description: 'Erasure has been scheduled' }),
  scheduledErasureAt: looseIsoDateTime({
    description: 'ISO 8601 timestamp the account will be hard-deleted (now + grace period)',
  }),
  gracePeriodDays: Schema.Literal(7).annotate({
    description: 'Number of days the erasure can still be cancelled',
  }),
  cancellable: Schema.Literal(true).annotate({
    description: 'Whether the scheduled erasure can still be cancelled',
  }),
}).annotate({ identifier: 'AccountDeleteScheduledResponse' })

/**
 * Account delete — cancelled response shape
 *
 * Returned `200 OK` when `{ cancel: true }` clears a pending erasure.
 */
export const accountDeleteCancelledResponseSchema = Schema.Struct({
  status: Schema.Literal('cancelled').annotate({
    description: 'A pending erasure has been cancelled',
  }),
}).annotate({ identifier: 'AccountDeleteCancelledResponse' })

/**
 * Account delete response schema
 *
 * Response of `POST /api/account/delete` — a union of the scheduled (`202`) and
 * cancelled (`200`) response shapes.
 */
export const accountDeleteResponseSchema = Schema.Union([
  accountDeleteScheduledResponseSchema,
  accountDeleteCancelledResponseSchema,
]).annotate({ identifier: 'AccountDeleteResponse' })

// ============================================================================
// Pending-Erasure Read Schemas
// ============================================================================

/**
 * Pending-erasure — one item
 *
 * The caller's OWN scheduled erasure, surfaced by `GET
 * /api/account/pending-erasure`. There is exactly one item while an erasure is
 * scheduled (`scheduledErasureAt` is set on the `auth.user` row), and the
 * collection is empty otherwise. The shape is a rows envelope so a `table`
 * can bind to it via `dataSource.system` and re-query it on `onSuccess.refetch`
 * (the GDPR pending-erasure list the consoles-as-config conversion needs).
 *
 * `requestedAt` is DERIVED, not stored: scheduling always sets
 * `scheduledErasureAt = requestedAt + gracePeriodDays`, so the request moment is
 * recovered as `scheduledErasureAt − gracePeriodDays` (the `auth.user` table
 * carries no separate request-timestamp column).
 *
 * `email` is the caller's OWN address. The pending erasure is always the
 * requester's own account (the read is session-bound — there is no client-supplied
 * id), so surfacing it is not a PII leak; it lets the GDPR pending-erasure
 * data-table bind a `{ field: 'email' }` column that names whose account is on its
 * way out.
 */
export const accountPendingErasureItemSchema = Schema.Struct({
  id: Schema.String.annotate({
    description:
      "The caller's user id — a stable row id so a table system binding (idKey) and refetch can key off it",
  }),
  email: email({
    description:
      "The caller's OWN email address — session-bound (not a PII leak), so the pending-erasure table can render whose account is scheduled for erasure",
  }),
  scheduledErasureAt: looseIsoDateTime({
    description:
      'ISO 8601 — when the account will be hard-deleted (end of the grace window); the date a relative-time column renders as "dans N j"',
  }),
  requestedAt: looseIsoDateTime({
    description: 'ISO 8601 — when the erasure was requested (scheduledErasureAt − gracePeriodDays)',
  }),
  gracePeriodDays: Schema.Literal(7).annotate({
    description: 'Number of days the erasure can still be cancelled before it is purged',
  }),
}).annotate({ identifier: 'AccountPendingErasureItem' })

/**
 * Pending-erasure response schema
 *
 * Body of `GET /api/account/pending-erasure` — the caller's OWN pending erasure
 * as a `{ items }` rows envelope. Exactly one item while an erasure is scheduled;
 * an empty `items` array once it is cancelled (or was never scheduled). The
 * endpoint is session-bound (no client-supplied id → no enumeration surface);
 * an unauthenticated request is rejected `401` (the same `unauthorized` envelope
 * as the sibling export/delete handlers), never leaking another caller's state.
 */
export const accountPendingErasureResponseSchema = Schema.Struct({
  items: Schema.Array(accountPendingErasureItemSchema).annotate({
    description:
      "The caller's OWN pending erasure — exactly one item while scheduled, empty once cancelled or never requested",
  }),
}).annotate({ identifier: 'AccountPendingErasureResponse' })

// ============================================================================
// TypeScript Types
// ============================================================================

export type AccountExportProfile = typeof accountExportProfileSchema.Type
export type AccountExportSession = typeof accountExportSessionSchema.Type
export type AccountExportLinkedAccount = typeof accountExportLinkedAccountSchema.Type
export type AccountExportRecord = typeof accountExportRecordSchema.Type
export type AccountExportFormSubmission = typeof accountExportFormSubmissionSchema.Type
export type AccountExportResponse = typeof accountExportResponseSchema.Type
export type AccountDeleteConfirmRequest = typeof accountDeleteConfirmRequestSchema.Type
export type AccountDeleteCancelRequest = typeof accountDeleteCancelRequestSchema.Type
export type AccountDeleteRequest = typeof accountDeleteRequestSchema.Type
export type AccountDeleteScheduledResponse = typeof accountDeleteScheduledResponseSchema.Type
export type AccountDeleteCancelledResponse = typeof accountDeleteCancelledResponseSchema.Type
export type AccountDeleteResponse = typeof accountDeleteResponseSchema.Type
export type AccountPendingErasureItem = typeof accountPendingErasureItemSchema.Type
export type AccountPendingErasureResponse = typeof accountPendingErasureResponseSchema.Type

// ─── Account lists ───────────────────────────────────────────────────────────

/**
 * `GET /api/account/lists/:list` — the five account lists a page binds with
 * `dataSource: { auth: <list> }`, each scoped to the reader by the server.
 *
 * Every row is projected here, never handed over as the auth store holds it: a
 * session row carries its bearer token and an API key row its hash, and
 * neither may reach a page. The answer is `{ rows }`, the shape a system read
 * source names with `rowsKey: rows`.
 */

const text = (description: string) => Schema.String.annotate({ description })
const optionalText = (description: string) =>
  Schema.optional(Schema.NullOr(Schema.String.annotate({ description })))

export const accountPasskeyRowSchema = Schema.Struct({
  id: text('Passkey id — the `target` of renamePasskey and removePasskey'),
  name: text('The name the reader gave the passkey (empty when she gave none)'),
  deviceType: optionalText('Authenticator class: `singleDevice` or `multiDevice`'),
  createdAt: optionalText('ISO 8601 instant the passkey was registered'),
})

export const accountSessionRowSchema = Schema.Struct({
  id: text('Session id — the `target` of revokeSession; never the session token'),
  device: text('A readable name for the browser and system the session was opened on'),
  ipAddress: optionalText('The address the session was opened from'),
  lastActiveAt: optionalText('ISO 8601 instant the session was last refreshed'),
  current: Schema.Boolean.annotate({ description: 'Whether this is the session reading the list' }),
})

export const accountApiKeyRowSchema = Schema.Struct({
  id: text('API key id — the `target` of revokeApiKey; never the key'),
  name: text('The key’s name'),
  prefix: text('The first characters of the key, enough to recognise it'),
  lastUsedAt: optionalText('ISO 8601 instant the key was last used'),
  expiresAt: optionalText('ISO 8601 instant the key stops working'),
})

export const accountMemberRowSchema = Schema.Struct({
  id: text('User id — the `target` of setRole'),
  name: text('Display name'),
  email: text('Email address'),
  image: optionalText('Avatar URL'),
  role: text('The member’s role'),
  joinedAt: optionalText('ISO 8601 instant the account was created'),
})

export const accountInvitationRowSchema = Schema.Struct({
  id: text(
    'Invitation id — the `target` of resendInvitation and revokeInvitation; never its token'
  ),
  email: text('Address the invitation was sent to'),
  role: text('Role the invitee will join as'),
  invitedBy: optionalText('Email of the person who sent it'),
  sentAt: optionalText('ISO 8601 instant it was sent'),
  expiresAt: text('ISO 8601 instant the link stops working'),
})

const rowsOf = <S extends Schema.Top>(row: S, identifier: string) =>
  Schema.Struct({ rows: Schema.Array(row) }).annotate({
    strictKeys: true,
    title: 'sovrium:strict-keys',
    identifier,
  })

export const accountPasskeysResponseSchema = rowsOf(accountPasskeyRowSchema, 'AccountPasskeys')
export const accountSessionsResponseSchema = rowsOf(accountSessionRowSchema, 'AccountSessions')
export const accountApiKeysResponseSchema = rowsOf(accountApiKeyRowSchema, 'AccountApiKeys')
export const accountMembersResponseSchema = rowsOf(accountMemberRowSchema, 'AccountMembers')
export const accountInvitationsResponseSchema = rowsOf(
  accountInvitationRowSchema,
  'AccountInvitations'
)

export type AccountSessionRow = Schema.Schema.Type<typeof accountSessionRowSchema>

/** `POST /api/auth/revoke-session` — one of the caller's sessions, by id (a list row) or token. */
export const accountRevokeSessionRequestSchema = Schema.Struct({
  id: Schema.optional(
    Schema.String.annotate({ description: 'Session id, as a sessions row holds it' })
  ),
  token: Schema.optional(
    Schema.String.annotate({ description: 'Session token, as Better Auth takes it' })
  ),
})

/**
 * `POST /api/auth/decline-invitation` — the invitee's answer from her invitation
 * link. Public: the token is the credential. An outstanding invitation is
 * withdrawn exactly as a revoke; any other token answers 404.
 */
export const accountDeclineInvitationRequestSchema = Schema.Struct({
  token: Schema.String.annotate({
    description: 'The invitation token, as the link in the invitation email carries it',
  }).check(Schema.isMinLength(1)),
}).annotate({ identifier: 'AccountDeclineInvitationRequest' })

/** Returned `200 OK` once the invitation is declined and its link stops working. */
export const accountDeclineInvitationResponseSchema = Schema.Struct({
  declined: Schema.Literal(true).annotate({
    description: 'The invitation was declined; its link no longer works',
  }),
}).annotate({ identifier: 'AccountDeclineInvitationResponse' })
