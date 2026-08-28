/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import {
  FILTER_OPERATOR_VOCABULARY,
  isVocabularyTerm,
  unknownTermRefusal,
} from '../closed-vocabulary'

/**
 * View Filter Condition Schema
 *
 * A single filter condition for filtering records.
 *
 * `operator` is a CLOSED vocabulary. It used to be a bare `Schema.String`, and
 * `generateSqlCondition` answers an operator it does not recognise with
 * `field = value` rather than an error — so `{ operator: 'gt' }` decoded, booted
 * and then silently selected equality. `gt` is not a hypothetical typo: it is a
 * real operator in the page/data-source filter vocabulary, so an author moving a
 * filter between the two surfaces wrote it in good faith and got the wrong rows.
 *
 * The refusal is attached to the STRUCT, not to `operator`, so the message can
 * name the `field` the condition came from — a config with filters on six
 * columns is otherwise unnavigable from a path like `tables[0].views[0]`.
 *
 * This schema is shared by FOUR config surfaces — table `views[].filters` and
 * the `filters` block of the `rollup`, `lookup` and `count` field types — all of
 * which compile through `generateSqlCondition`. One refusal binds all four; that
 * is intended, not incidental.
 *
 * @example
 * ```typescript
 * { field: 'status', operator: 'equals', value: 'active' }
 * { field: 'age', operator: 'greaterThan', value: 18 }
 * ```
 */
export const ViewFilterConditionSchema = Schema.Struct({
  field: Schema.String,
  operator: Schema.String,
  // `Schema.optional`, not a bare `Schema.Unknown`. Effect 3 excluded an
  // `unknown`-typed property from a struct's required keys — the published
  // `Condition` def has `required: ['field','operator']` — and accepted
  // `{ field, operator }` with the key absent, which is what value-less
  // operators need. Effect 4 requires the key, so a filter written exactly as
  // the PUBLISHED schema still blesses it was rejected by `sovrium validate`.
  // This edit moves the DECODER back into agreement with the published
  // `required`, which it does not change.
  value: Schema.optional(Schema.Unknown),
}).pipe(
  // ANNOTATIONS FIRST, REFINEMENT SECOND — the order is load-bearing, not
  // stylistic. `JSONSchema.make` renders a struct refinement from its `from`
  // side and DROPS annotations piped after the `Schema.filter`, so writing them
  // below would silently strip this node's title and description out of the
  // published `app.json` every author's editor reads. Measured: it deleted five
  // `Filter Condition` blocks from the snapshot.
  Schema.annotate({
    title: 'Filter Condition',
    description:
      'A single filter condition specifying field, operator, and value. `operator` must be one of: ' +
      `${FILTER_OPERATOR_VOCABULARY.terms.join(', ')}.`,
  }),
  Schema.check(
    Schema.makeFilter((condition) =>
      isVocabularyTerm(FILTER_OPERATOR_VOCABULARY, condition.operator)
        ? undefined
        : unknownTermRefusal({
            kind: 'filter operator',
            value: condition.operator,
            subject: `field "${condition.field}"`,
            vocabulary: FILTER_OPERATOR_VOCABULARY,
          })
    )
  )
)

export type ViewFilterCondition = Schema.Schema.Type<typeof ViewFilterConditionSchema>

/**
 * View Filter Node
 *
 * Recursive type for filter expressions. Can be either:
 * - A condition: `{ field, operator, value }`
 * - An AND group: `{ and: [...] }`
 * - An OR group: `{ or: [...] }`
 */
export type ViewFilterNode =
  | ViewFilterCondition
  | { readonly and: ReadonlyArray<ViewFilterNode> }
  | { readonly or: ReadonlyArray<ViewFilterNode> }

/**
 * View Filter Node Schema
 *
 * Recursive schema for nested filter expressions.
 * Uses a simple `{ and: [...] }` or `{ or: [...] }` format.
 *
 * @example Simple condition
 * ```typescript
 * { field: 'status', operator: 'equals', value: 'active' }
 * ```
 *
 * @example AND group
 * ```typescript
 * {
 *   and: [
 *     { field: 'status', operator: 'equals', value: 'active' },
 *     { field: 'archived', operator: 'equals', value: false }
 *   ]
 * }
 * ```
 *
 * @example Nested groups (Prisma/MongoDB style)
 * ```typescript
 * // (status = 'active') AND ((priority = 'high') OR (priority = 'urgent'))
 * {
 *   and: [
 *     { field: 'status', operator: 'equals', value: 'active' },
 *     {
 *       or: [
 *         { field: 'priority', operator: 'equals', value: 'high' },
 *         { field: 'priority', operator: 'equals', value: 'urgent' }
 *       ]
 *     }
 *   ]
 * }
 * ```
 *
 * @example Complex nested logic
 * ```typescript
 * {
 *   or: [
 *     {
 *       and: [
 *         { field: 'type', operator: 'equals', value: 'task' },
 *         { field: 'status', operator: 'equals', value: 'completed' }
 *       ]
 *     },
 *     {
 *       and: [
 *         { field: 'type', operator: 'equals', value: 'bug' },
 *         { field: 'severity', operator: 'equals', value: 'critical' }
 *       ]
 *     }
 *   ]
 * }
 * ```
 */
export const ViewFilterNodeSchema: Schema.Codec<ViewFilterNode> = Schema.Union([
  ViewFilterConditionSchema,
  Schema.Struct({
    and: Schema.Array(Schema.suspend((): Schema.Codec<ViewFilterNode> => ViewFilterNodeSchema)),
  }),
  Schema.Struct({
    or: Schema.Array(Schema.suspend((): Schema.Codec<ViewFilterNode> => ViewFilterNodeSchema)),
  }),
]).pipe(
  Schema.annotate({
    identifier: 'ViewFilterNode',
    title: 'Filter Node',
    description: 'A filter condition or a logical group (and/or) of filter nodes.',
  })
)

/**
 * View Filters Schema
 *
 * Root filter configuration for views. Can be a single condition or a logical group.
 *
 * @example Single condition (implicit)
 * ```typescript
 * { field: 'status', operator: 'equals', value: 'active' }
 * ```
 *
 * @example Multiple conditions with AND
 * ```typescript
 * {
 *   and: [
 *     { field: 'status', operator: 'equals', value: 'active' },
 *     { field: 'archived', operator: 'equals', value: false }
 *   ]
 * }
 * ```
 *
 * @example Complex nested filters
 * ```typescript
 * {
 *   and: [
 *     { field: 'status', operator: 'equals', value: 'active' },
 *     {
 *       or: [
 *         { field: 'priority', operator: 'equals', value: 'high' },
 *         { field: 'priority', operator: 'equals', value: 'urgent' }
 *       ]
 *     }
 *   ]
 * }
 * ```
 */
export const ViewFiltersSchema = ViewFilterNodeSchema.pipe(
  Schema.annotate({
    title: 'View Filters',
    description: 'Filter configuration using nested and/or groups.',
  })
)

/** @public */
export type ViewFilters = Schema.Schema.Type<typeof ViewFiltersSchema>
