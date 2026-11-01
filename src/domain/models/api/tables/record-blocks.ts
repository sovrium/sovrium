/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/kernel/config-parsing/optional-field'

/**
 * The `_*` blocks a record carries beside its `fields`: what the server decided
 * about the record for this reader, without handing over the values it was
 * decided on. Each is omitted when it has nothing to say, never sent empty.
 */

/**
 * Per-field AI-compute refinement status.
 *
 * An AI-computed value resolves in two tiers: a deterministic baseline written
 * synchronously, then a provider refinement. When the refinement never lands,
 * the baseline SURVIVES as the stored value — honest, plausible-looking content
 * that is indistinguishable from a refined one. This block is what tells the
 * two apart, so it is part of the record contract rather than an incidental
 * extra: `status` is the lifecycle state, `error` the recorded provider reason.
 */
const aiComputeFieldStatusSchema = Schema.Struct({
  status: Schema.String.annotate({ description: 'pending | refined | failed | skipped' }),
  error: optionalField(Schema.String.annotate({ description: 'Recorded provider failure reason' })),
})

/**
 * The `_aiCompute` block: one status entry per AI-compute field. Omitted
 * entirely for a table that declares no AI-compute field, and for a record with
 * no status rows yet — never sent as an empty object.
 */
export const aiComputeProjectionSchema = Schema.Record(
  Schema.String,
  aiComputeFieldStatusSchema
).annotate({ description: 'AI-compute refinement status, keyed by field name' })

/**
 * The `_display` block: the human label behind a relationship column's stored
 * key, for every column whose field declared a `displayField`.
 *
 * A string for a to-one column, a list for a to-many one, so a consumer can
 * tell a single link from many without re-reading the schema. Omitted entirely
 * when a record references nothing labellable, and never sent as an empty
 * object. It sits BESIDE `fields` rather than replacing anything in it: the
 * stored key stays exactly where it was, so filters, editors and the write path
 * are unaffected.
 */
export const displayLabelsSchema = Schema.Record(
  Schema.String,
  Schema.Union([Schema.String, Schema.Array(Schema.String)])
).annotate({ description: 'Resolved relationship labels, keyed by field name' })

/**
 * The `_writeOnly` block: for every write-only field on the record, whether a
 * value is stored.
 *
 * A write-only field's value never leaves the server through a read, for any
 * role, so `fields` never carries it. This block is the one thing a reader
 * learns about it — set or not set — so an operator can tell a configured
 * secret from a missing one without seeing it. It names only the write-only
 * fields the caller could read under the ordinary field rules, and it is
 * omitted when there are none, never sent as an empty object.
 */
export const writeOnlyPresenceSchema = Schema.Record(Schema.String, Schema.Boolean).annotate({
  description:
    'Whether each write-only field holds a value (true) or not (false), keyed by field name. The value itself is never returned.',
})

/**
 * The `_disabled` block: the controls drawn on this record that its
 * `disabledWhen` holds for — a button field, a row action, a record-bound
 * button.
 *
 * The server decides it on the whole row, including a field the caller may not
 * read, so a page can draw the control disabled without ever receiving the
 * value it was decided on. That is one bit about the record per declared
 * condition, the same bit a press refused with 409 reveals. Each entry is the
 * control's id: `field:<name>` for a button field, and for a row action or a
 * record-bound button the id the page carries on it (`data-control-id`).
 * Omitted when no control is disabled, never sent as an empty array.
 */
export const disabledControlsSchema = Schema.Array(
  Schema.String.annotate({ description: 'The id of one control disabled on this record' })
).annotate({
  description:
    'The controls drawn on this record that are disabled for it, by id: `field:<name>` for a button field, the id the page gives a row action or a record-bound button otherwise. Decided by the server; the values it was decided on are not included.',
})

/**
 * The `_locks` block: what the table's business rules (`tables[].rules`) keep
 * this reader from changing on this record, decided on the stored row.
 *
 * Present only on a table that declares rules, and only when something is
 * locked or a transition limits a move. A rule whose `exemptRoles` names the
 * reader locks nothing for her. It never names a field the reader may not
 * read. A single-record read judges every rule, across a relationship too; a
 * list judges the rules that read the record's own columns only, so a lock
 * that depends on a related record shows on the record's own read.
 */
export const recordLocksSchema = Schema.Struct({
  fields: Schema.Union([
    Schema.Array(
      Schema.String.annotate({ description: 'A field the reader cannot change on this record' })
    ),
    Schema.Literal('*').annotate({
      description: 'Every field the reader can write is locked on this record',
    }),
  ]).annotate({
    description:
      'The fields the reader cannot change on this record, or `*` for every field she can write',
  }),
  delete: optionalField(
    Schema.Literal(true).annotate({ description: 'The record cannot be deleted' })
  ),
  deleteReason: optionalField(
    Schema.String.annotate({
      description:
        'The message deleting the record would be refused with, beside `delete`; the first lock blocking the delete gives it',
    })
  ),
  next: optionalField(
    Schema.Record(
      Schema.String,
      Schema.Array(Schema.String.annotate({ description: 'A value the field may move to' }))
    ).annotate({
      description:
        'For each field a transition rule moves, the values it may move to from the value it holds',
    })
  ),
  reasons: optionalField(
    Schema.Record(Schema.String, Schema.String).annotate({
      description: 'For each locked field, the message a change to it would be refused with',
    })
  ),
}).annotate({
  identifier: 'RecordLocks',
  description:
    "What the table's business rules keep this reader from changing on this record. A list judges only the rules that read the record's own columns; the single-record read judges them all.",
})
