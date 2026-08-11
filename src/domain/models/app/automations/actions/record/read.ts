/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ConditionGroupSchema } from '../../conditions'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

/**
 * Record Read Action (type: record, operator: read)
 *
 * Query records from a table either by primary key (`id`) or filter
 * conditions (`filter`). At least one of the two must be provided —
 * the schema-level `Schema.filter` rejects shapes that supply neither.
 *
 * Both fields are individually optional so YAML authors can pick the
 * shorthand they prefer (id for canary "read by primary key", filter
 * for "read by business key" or multi-condition lookups). The runtime
 * handler treats `id` as a fast-path for `getRecord` and falls through
 * to `listRecords` when only `filter` is set.
 */
export const RecordReadActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('record'),
  operator: Schema.Literal('read'),
  props: Schema.Struct({
    table: Schema.String.pipe(
      Schema.minLength(1),
      Schema.annotations({ description: 'Target table name' })
    ),
    /**
     * Primary key shorthand. Equivalent to a single-condition filter
     * `{ field: 'id', operator: 'equals', value: <id> }` but cheaper
     * because the handler dispatches straight to `getRecord` without a
     * SELECT-COUNT walk. Supports template variables
     * (`{{trigger.data.userId}}`) so YAML authors can wire the id from
     * the upstream payload.
     */
    id: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({ description: 'Record id (or template) for primary-key reads' })
      )
    ),
    /**
     * Multi-condition filter. Use when the lookup is by business key
     * (email, name, status) or composite — the runtime walks the
     * condition tree against `listRecords` and returns the first match.
     */
    filter: Schema.optional(ConditionGroupSchema),
  }),
}).pipe(
  Schema.filter((action) => {
    const { id, filter } = action.props
    if (id === undefined && filter === undefined) {
      return 'record/read requires either props.id or props.filter to be provided'
    }
    return true
  }),
  Schema.annotations({
    identifier: 'RecordReadAction',
    title: 'Record Read Action',
    description: 'Query records from a table by primary key or filter conditions',
  })
)

/** @public */
export type RecordReadAction = Schema.Schema.Type<typeof RecordReadActionSchema>
