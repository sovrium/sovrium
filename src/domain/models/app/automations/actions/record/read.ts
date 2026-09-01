/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

/**
 * Record Read Action (type: record, operator: read)
 *
 * Fetch a single record by primary key. `id` is REQUIRED — there is no
 * filter form and no "at least one of" rule, because a required `id`
 * states that in the type where a reader will find it.
 *
 * Condition-based reads live on the sibling `record/list` operator, which
 * owns `filter` plus `sort`, `limit`, `offset` and `fields`. The split is
 * not cosmetic: the removed filter form ran an UNORDERED `listRecords` and
 * returned `records[0]`, so "the first match" was whichever row the engine
 * happened to return first, and nothing in the config said which. Ordering
 * is a property of a set, so it belongs on the operator that admits it has
 * one.
 *
 * Both operators emit the same `{ record, records }` output envelope, so a
 * config migrating a filtered read to `list` needs no template changes.
 */
export const RecordReadActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('record'),
  operator: Schema.Literal('read'),
  props: Schema.Struct({
    table: Schema.String.pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({ description: 'Target table name' })
    ),
    /**
     * Primary key of the record to fetch. Dispatches straight to
     * `getRecord` (a single SELECT by id). Supports template variables
     * (`{{trigger.data.userId}}`) so YAML authors can wire the id from the
     * upstream payload.
     */
    id: TemplateStringSchema.pipe(
      Schema.annotate({ description: 'Record id (or template) to fetch by primary key' })
    ),
  }),
}).pipe(
  Schema.annotate({
    identifier: 'RecordReadAction',
    title: 'Record Read Action',
    description: 'Fetch a single record from a table by its primary key',
  })
)

/** @public */
export type RecordReadAction = Schema.Schema.Type<typeof RecordReadActionSchema>
