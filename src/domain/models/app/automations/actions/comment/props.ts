/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'

/**
 * The prop shapes the three `comment` operators share.
 *
 * Every one of them addresses a THREAD: the comments of one record of one
 * table. The table is a literal (it is a config name, checked at validation
 * like `record/*`'s), the record a template — the archetypal record is
 * `{{trigger.record.id}}` or the id an earlier step found.
 *
 * `runAs` is not shared as a node: its description says something different
 * for each operator (whose name a comment carries, whose reads a list makes,
 * whose rules a deletion meets), so each operator builds its own with
 * {@link commentRunAsSchema}.
 */

/** The table whose record's thread the step addresses. */
export const CommentActionTableSchema = Schema.String.pipe(
  Schema.annotate({ description: 'Name of the table holding the record the thread belongs to' }),
  Schema.check(Schema.isMinLength(1))
)

/** The record whose thread the step addresses, as a template. */
export const CommentActionRecordIdSchema = TemplateStringSchema.pipe(
  Schema.annotate({
    description:
      "Id of the record whose thread the step addresses, as a template (e.g. '{{trigger.record.id}}' or '{{findRequest.data.id}}')",
  }),
  Schema.check(Schema.isMinLength(1))
)

/** One comment of that thread, as a template. */
export const CommentActionCommentIdSchema = TemplateStringSchema.pipe(
  Schema.annotate({
    description:
      "Id of a comment on that record's thread, as a template (e.g. '{{postNote.result.id}}')",
  }),
  Schema.check(Schema.isMinLength(1))
)

/**
 * `runAs` for a comment step, described for what it decides on that operator.
 * Absent and `'system'` mean the same thing.
 */
export const commentRunAsSchema = (description: string) =>
  Schema.Literals(['system', 'triggering-user']).pipe(
    Schema.annotate({ defaultNote: "'system'", description })
  )
