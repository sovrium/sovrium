/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `tree` — the records of ONE table, nested by a relationship that points back
 * at that same table.
 *
 * ─── THE HIERARCHY IS DATA, NOT CONFIG ─────────────────────────────────────
 *
 * A folder tree, a chart of accounts, an org chart: in each the nesting lives
 * in the records — every row names its parent — so the tree takes a
 * `parentField` and nothing else. A record whose parent is empty is a root. The
 * relationship it names must target the bound table itself; the write path
 * refuses a parent that would make a record its own ancestor, so the tree never
 * has to draw a cycle.
 *
 * ─── SELECTION SPEAKS THE RECORD VERBS, AND PUBLISHES ──────────────────────
 *
 * `onSelect` is the card vocabulary (`navigate`, `openDrawer`), for the reason
 * `map` gives. `publishes` is the shared-filter publisher a `graph` already
 * carries, so a tree can sit beside a `table` and narrow it to the selected
 * branch without inventing a second channel.
 */

import { Schema } from 'effect'
import { CardClickActionSchema } from '../../../action'
import { DataSourceSchema, SharedFilterPublisherSchema } from '../../../data-source'
import { coreFields } from '../../modules/core'
import { i18nFields } from '../../modules/i18n'
import { responsiveFields } from '../../modules/responsive'
import { visibilityFields } from '../../modules/visibility'

export const TreeTypeLiteral = Schema.Literal('tree')

export const TreeSortSchema = Schema.Struct({
  field: Schema.String.pipe(
    Schema.annotate({ description: 'Field the siblings of each branch are ordered by' }),
    Schema.check(Schema.isMinLength(1))
  ),
  direction: Schema.optional(
    Schema.Literals(['asc', 'desc']).annotate({
      description: 'Sort direction of the siblings (default: asc)',
    })
  ),
}).annotate({
  identifier: 'TreeSort',
  title: 'Tree Sort',
  description: 'How the siblings under each node are ordered',
})

export const treeFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  // The shared DB binding, unannotated here: it carries an identifier, and a
  // use-site annotation would fork its definition in the published schema.
  dataSource: Schema.optional(DataSourceSchema),
  parentField: Schema.String.pipe(
    Schema.annotate({
      description:
        'The relationship field that points each record at its parent in the SAME table. A record with no parent is a root.',
      examples: ['parent', 'parent_folder'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  labelField: Schema.String.pipe(
    Schema.annotate({
      description: 'The field whose value names each node',
      examples: ['name', 'title'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  iconField: Schema.optional(
    Schema.String.annotate({
      description:
        'A field holding an icon name drawn before each label. Omitted, nodes carry only their chevron.',
    })
  ),
  countField: Schema.optional(
    Schema.String.annotate({
      description:
        'A numeric field (often a count or rollup) whose value is drawn in mono at the end of each node',
    })
  ),
  sortBy: Schema.optional(TreeSortSchema),
  expanded: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description:
          'How many levels are open when the tree first renders (default: 1, the roots and their children). 0 shows the roots alone.',
        examples: [0, 1, 2],
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0))
    )
  ),
  search: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Draw a filter box above the tree (default: true). A match keeps its ancestors visible so it is never shown out of place.',
    })
  ),
  onSelect: Schema.optional(CardClickActionSchema),
  publishes: Schema.optional(SharedFilterPublisherSchema),
  emptyMessage: Schema.optional(
    Schema.String.annotate({
      description:
        'Sentence shown when the table has no records (default: "Nothing here yet."). Supports $t: references.',
    })
  ),
} as const
