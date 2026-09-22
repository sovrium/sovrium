/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `filter-bar` — one filter, many views.
 *
 * ## The gap it closes
 *
 * Filtering exists twice today and neither half is authorable as a control.
 * `dataSource.filter[]` narrows a component before the page loads and a reader
 * cannot touch it; the grid's own filter overlay is inside the grid, so it
 * narrows that grid and nothing else. A page showing a table, a KPI strip and a
 * chart over the same records has no way to filter all three at once.
 *
 * ## It publishes; it does not read
 *
 * A filter bar has no `dataSource` of its own, and that is the design rather
 * than an omission: it holds a condition set, not rows. It publishes on the
 * SHARED-FILTER CHANNEL that already exists — the same `bindTo` namespace a
 * `select` uses through `publishes`, and the one a subscriber names in
 * `dataSource.bindTo` beside `sharedFilter`. So every data-bound component that
 * can already merge a shared param bag subscribes to a filter bar the day this
 * type ships, with no change of its own.
 *
 * What it publishes is one param, `filter`, holding the JSON filter expression
 * the records endpoint already parses (`?filter={"and":[…]}`, see
 * `parseFilterParameter`). One param and not one per condition, because the
 * conditions are a TREE — a combinator over leaves — and a flat bag cannot say
 * which leaves an `or` groups.
 *
 * ## `fields` is declared, not derived
 *
 * The bar has no table binding, so it cannot introspect a schema; the author
 * names the filterable fields and what KIND each is. That is more writing than
 * deriving would be, and it is also the only shape that works when the
 * subscribers are two different tables sharing a channel — which is a thing the
 * shared-filter mechanism already permits and a derived field list would refuse.
 *
 * `kind` selects the operator subset offered, using the four categories the
 * grid's own builder already sorts field types into
 * (`islands/data-table/island/filter-operators.ts`).
 *
 * ## Which subscribers exist TODAY, measured rather than assumed
 *
 * The subscriber half is `use-shared-filter.ts`, and on 2026-09-09 exactly ONE
 * island consumed it: the data-table, through
 * `data-table/island/setup/use-system-query-params.ts`. `kpi`, `chart`, `list`,
 * `gallery` and `kanban` declare `bindTo` + `sharedFilter` in their schema and
 * ignore it at runtime.
 *
 * So a bar drives every GRID on its channel today — including grids over
 * different tables, which is the case `fields` is declared rather than derived
 * for — and the canvas's "one bar, a table and a KPI" picture needs those five
 * islands to adopt the hook. That is one call each in an island this wave does
 * not open, so it belongs to the wave that redraws the data views (R-D) rather
 * than here. Recorded rather than implied: a schema key that validates and does
 * nothing is the exact failure this type's `publishes.bindTo` refuses to risk.
 *
 * ## The operators are the SERVER's eight, not the grid's seventeen
 *
 * `eq neq contains gt lt gte lte in` — `FilterOperatorSchema`, what
 * `dataSource.filter[]` accepts and what the SQL WHERE builder executes. The
 * grid's overlay offers a longer spaced-English list (`starts with`, `between`,
 * `is any of`) because it filters rows already in the browser. A bar that
 * offered those would publish a filter the endpoint drops silently, which is a
 * filter that validates and narrows nothing — the exact failure
 * `SharedFilterPublisher.param` refuses to risk by having no default.
 *
 * `between` is two conditions and `is any of` is `in`; only `starts with` /
 * `ends with` have no server form, and they are recorded as deferred rather
 * than offered.
 *
 * Source: [internal ref]
 * Specs: [internal ref] … 008, plus this type's own REGRESSION rollup
 */

import { Schema } from 'effect'
import { FilterOperatorSchema } from '../../data-source'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const FilterBarTypeLiteral = Schema.Literal('filter-bar')

/**
 * What kind of value a filterable field holds.
 *
 * Four categories rather than the forty-odd field types, because the only thing
 * the bar decides from it is which operators to offer and what control to draw
 * for the value — and those collapse to four answers. The names match the
 * categories `categorize()` already sorts field types into, so the bar and the
 * grid's overlay offer the same operators for the same field.
 */
export const FilterFieldKindSchema = Schema.Literals(['text', 'number', 'date', 'select']).annotate(
  {
    title: 'Field Kind',
    description:
      'What the field holds, which decides the operators offered and the value control drawn: `text` (is / is not / contains), `number` and `date` (the comparisons), `select` (is / is not / is any of).',
  }
)

/** One field the bar offers to filter on. */
const FilterFieldSchema = Schema.Struct({
  name: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.annotate({
      title: 'Field',
      description: 'Column name, as the subscribers’ tables spell it',
      examples: ['status', 'amount'],
    })
  ),
  label: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({
        title: 'Label',
        description: 'What the field is called in the bar. Falls back to `name`.',
        examples: ['Status', 'Amount'],
      })
    )
  ),
  kind: Schema.optional(FilterFieldKindSchema),
  /**
   * The choices offered for a `select` field.
   *
   * Unread under the other kinds — a number has no option list — and INERT
   * rather than refused, following the catalogue's rule that a refusal is for a
   * key whose presence loses an author's work.
   */
  options: Schema.optional(
    Schema.Array(
      Schema.Struct({
        value: Schema.String.annotate({ description: 'The value written into the condition' }),
        label: Schema.optional(
          Schema.String.annotate({ description: 'What the choice reads. Falls back to `value`.' })
        ),
      })
    ).annotate({
      title: 'Choices',
      description:
        'Choices offered for a `select` field. Unread under the other kinds — a number has no option list.',
      examples: [
        [
          { value: 'paid', label: 'Paid' },
          { value: 'due', label: 'Due' },
        ],
      ],
    })
  ),
}).annotate({
  identifier: 'FilterBarField',
  title: 'Filterable Field',
  description: 'One field the bar offers to filter on',
})

/** One condition the bar opens with. */
const FilterConditionSchema = Schema.Struct({
  field: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.annotate({
      description:
        'Field to filter on. Must name one of the bar’s own `fields` — a cross-key rule an open struct cannot carry, so it is refused BY NAME at boot in `component-xor-rules.ts` rather than claimed here and never checked.',
      examples: ['status'],
    })
  ),
  operator: FilterOperatorSchema,
  value: Schema.String.annotate({
    description:
      'Value to compare against. A string on the wire; the endpoint coerces it against the column’s own type. For `in`, a comma-separated list.',
    examples: ['paid', '1000'],
  }),
}).annotate({
  identifier: 'FilterBarCondition',
  title: 'Condition',
  description: 'One field / operator / value condition',
})

/** The channel the bar publishes its filter expression on. */
const FilterBarPublisherSchema = Schema.Struct({
  bindTo: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.annotate({
      title: 'Channel',
      description:
        'The shared-filter channel this bar publishes on — the same string every subscriber names in `dataSource.bindTo` beside `sharedFilter`.',
      examples: ['invoices-filter'],
    })
  ),
}).annotate({
  identifier: 'FilterBarPublisher',
  title: 'Publishes',
  description: 'The shared-filter channel the bar publishes its filter expression on',
})

export const filterBarFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  /**
   * Where the filter goes.
   *
   * Required. A bar with no channel narrows nothing, and unlike an unread
   * styling key that is not inert — it is a control a reader will operate and
   * watch do nothing. There is no default to fall back on either: guessing the
   * bar's own `props.id` is the mistake `SharedFilterPublisher.param` documents
   * at length, one namespace over.
   *
   * The param published on it is always `filter`, so subscribers merge the
   * whole bag (`sharedFilter: {}`) rather than selecting keys.
   */
  publishes: FilterBarPublisherSchema,
  /**
   * The fields the bar offers.
   *
   * Required and non-empty: a bar that offers no field can only ever show the
   * conditions it was born with, which is a chip list and not a filter.
   */
  fields: Schema.Array(FilterFieldSchema)
    .pipe(Schema.check(Schema.isMinLength(1)))
    .annotate({
      title: 'Filterable Fields',
      description:
        'The fields the bar offers, in menu order. Declared rather than derived: the bar has no table binding, and one channel may drive subscribers over different tables.',
      examples: [
        [
          { name: 'status', label: 'Status', kind: 'select' },
          { name: 'amount', label: 'Amount', kind: 'number' },
        ],
      ],
    }),
  /**
   * The conditions the bar opens with.
   *
   * Published on first render, so a page can land already filtered — the
   * difference from `dataSource.filter[]` being that a reader can then remove
   * one, which they cannot do to a filter baked into the binding.
   */
  conditions: Schema.optional(
    Schema.Array(FilterConditionSchema).annotate({
      title: 'Initial Conditions',
      description:
        'Conditions the bar opens with, published on first render. Removable by the reader, unlike `dataSource.filter[]`.',
      examples: [[{ field: 'status', operator: 'eq', value: 'paid' }]],
    })
  ),
  /**
   * How the conditions combine.
   *
   * `and` by default. `or` is published as a nested group — `{and:[{or:[…]}]}` —
   * because the endpoint's root node is an `and` and its leaves nest.
   */
  combinator: Schema.optional(
    Schema.Literals(['and', 'or']).annotate({
      title: 'Combinator',
      description:
        'How the conditions combine (default `and`). The reader can change it when more than one condition is applied.',
    })
  ),
  /**
   * Whether the reader may add conditions.
   *
   * Off turns the bar into a read-only display of what the page was opened
   * with — still removable, because a filter a reader can see and not lift is a
   * dead end.
   */
  allowAdd: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Whether the reader may add conditions (default: true). Off leaves the existing chips removable — a filter that can be seen and not lifted is a dead end.',
    })
  ),
} as const
