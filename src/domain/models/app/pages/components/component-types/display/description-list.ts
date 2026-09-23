/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `description-list` — term and detail pairs, as `<dl>`.
 *
 * ## What it is for, and how it differs from `record-field`
 *
 * A summary panel: the facts about one thing, each named. `record-field` draws
 * ONE column of a bound record with that field's own type-aware formatting;
 * this draws a LIST of authored pairs, and the pairs are ordinary text, so a
 * detail may be `$record.amount`, a `$t:` lookup, or a literal. The two answer
 * different questions — "render this field as the field it is" versus "lay out
 * these facts as a list" — and an author reaching for the second today has to
 * build a two-column `grid` by hand and get the alignment right themselves.
 *
 * The element is a real `<dl>` with `<dt>`/`<dd>` pairs. That is not decoration:
 * a screen reader announces the term with its detail, which a `grid` of `text`
 * components cannot do at any amount of styling.
 *
 * ## `layout` changes the reading direction, not the markup
 *
 * `rows` (default) puts the term left of the detail in a two-column grid;
 * `stacked` puts it above, and the pairs flow as a responsive row of blocks.
 * Both emit the same `<dl>`, so the accessible pairing survives the switch —
 * which is the reason the choice is a key here rather than two components.
 *
 * ## The action column is a link, deliberately
 *
 * `items[].action` draws a control in a third column. It takes an `href` and is
 * a link: a clipboard action would need the delegated copy runtime, which is
 * scoped to code blocks (`[data-code-copy-scope]` in `page-body-scripts.tsx`) and
 * generalising it belongs to whoever owns that runtime, not to this type. A
 * link is inert-free — it always does what it says — where a copy button with
 * no runtime behind it would be a control that visibly does nothing.
 *
 * Source: [internal ref]
 * Specs: [internal ref] … 005, plus this type's own REGRESSION rollup
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const DescriptionListTypeLiteral = Schema.Literal('description-list')

/** The control drawn in a row's third column. */
const DescriptionActionSchema = Schema.Struct({
  label: Schema.String.pipe(
    Schema.annotate({
      title: 'Action Label',
      description: 'Visible text of the control',
      examples: ['Open', 'Edit'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  href: Schema.String.pipe(
    Schema.annotate({
      title: 'Action Target',
      description:
        'Where the control goes. Required: a control with nowhere to go is a control that does nothing.',
      examples: ['/records/invoices/$record.id'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
}).annotate({
  identifier: 'DescriptionListAction',
  title: 'Row Action',
  description: 'A link drawn in the row’s third column',
})

/** One term-and-detail pair. */
const DescriptionItemSchema = Schema.Struct({
  term: Schema.String.pipe(
    Schema.annotate({
      title: 'Term',
      description: 'What the fact is called — the `<dt>`',
      examples: ['Client', 'Amount'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  detail: Schema.String.pipe(
    Schema.annotate({
      title: 'Detail',
      description:
        'The fact itself — the `<dd>`. Ordinary text, so `$record.<field>` and `$t:<key>` both resolve here. Empty is legal and draws the empty-value placeholder rather than collapsing the row, so a list of facts keeps its shape when one is missing.',
      examples: ['$record.client', '4,120.00 €'],
    })
  ),
  action: Schema.optional(DescriptionActionSchema),
}).annotate({
  identifier: 'DescriptionListItem',
  title: 'Description List Item',
  description: 'One term-and-detail pair',
})

export const descriptionListFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  /**
   * The pairs. Required and non-empty: a description list of nothing is not a
   * loading state, it is a config that forgot its content, and drawing an empty
   * `<dl>` would hide that behind a blank strip.
   */
  items: Schema.Array(DescriptionItemSchema)
    .pipe(Schema.check(Schema.isMinLength(1)))
    .annotate({
      title: 'Pairs',
      description: 'The term-and-detail pairs, in reading order. At least one.',
      examples: [
        [
          { term: 'Client', detail: '$record.client' },
          { term: 'Amount', detail: '$record.amount' },
        ],
      ],
    }),
  /** Where the term sits relative to its detail. */
  layout: Schema.optional(
    Schema.Literals(['rows', 'stacked']).annotate({
      title: 'Layout',
      description:
        '`rows` (default) puts the term left of the detail in two columns; `stacked` puts it above and flows the pairs as a responsive row of blocks. Same `<dl>` markup either way.',
    })
  ),
  /**
   * Rules between the rows.
   *
   * Default on under `rows`, where the rule is what keeps a long list scannable;
   * ignored under `stacked`, whose pairs are separated by whitespace and would
   * be cut in half by a horizontal rule.
   */
  dividers: Schema.optional(
    Schema.Boolean.annotate({
      defaultNote: 'true',
      description:
        'Draw a rule under each row. On by default under `layout: rows`; unread under `stacked`.',
    })
  ),
} as const
