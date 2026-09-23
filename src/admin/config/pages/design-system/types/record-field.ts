/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `record-field` — one field of the record its page is bound to, printed.
//
// ─── THIS PAGE IS BOUND TO A RECORD, SO THE DRAWINGS ARE REAL ──────────────
//
// The catalogue refuses this type, and it is right to: a card on an index has
// no record behind it. This page does. Every type page here binds the component
// type's own detail record — the row that supplies the heading, the category
// badge and the figures in the meta line — so a `record-field` placed on it has
// something to read, and every drawing below is reading it.
//
// What that record carries decides what can be shown. Strings: `type`,
// `category`, `purpose`, `title`, `href`, `snippet`. Numbers: `variantCount`,
// `pageCount`, `siblingCount`. Booleans: `drawable`, `configured`, `styleable`.
// No dates and no rich text — which is why the five date formats and the
// field-type dispatch are stated below rather than drawn.
//
// ─── `props.field` IS A NAME, NOT A TOKEN ──────────────────────────────────
//
// It carries the field NAME — `purpose`, not `$record.purpose`. The renderer
// and the data-source resolver inject the value; a `$record.` token here would
// be looked up as a field called `$record.purpose` and find nothing.

import { CHROME_BAR_OFFSET_CLASS, CHROME_BAR_STICKY_MAX_H_CLASS } from '../../../components/shell'
import { COMPONENT_TYPE_DETAIL_ENDPOINT, FIELD_TYPES_ENDPOINT } from '../../../system-sources'
import { kitType } from '../sections'
import type { PageComponent, TypePageBody } from './body-shape'

/** The page's own record, read by field name. */
const field = (name: string, extra: Record<string, unknown> = {}) =>
  ({ type: 'record-field' as const, props: { field: name }, ...extra }) as PageComponent

/** A line of body text, for a drawing the console composes rather than renders. */
const plain = (content: string): PageComponent =>
  ({
    type: 'text',
    element: 'p',
    props: { className: 'text-foreground text-sm' },
    content,
  }) as PageComponent

/** A raw value beside what a format makes of it. */
const pair = (raw: string, drawn: PageComponent): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex items-baseline gap-3' },
    children: [
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground-subtle font-mono text-[11px]' },
        content: raw,
      },
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground-subtle' },
        content: '→',
      },
      drawn,
    ],
  }) as PageComponent

// ─── THE FIELD CATALOGUE LIVES HERE, AND IT USED TO LIVE ON A PAGE OF ITS OWN ─
//
// `/design-system/ui-kit/fields` drew the same forty-nine field types in the
// same nine categories that this page's own board has drawn since the canvas's
// ninth round. Two routes, one catalogue, derived from one registry — so the
// route went and the drawings came here, which is where a reader already is
// when they are asking what a field of a given type looks like.
//
// ─── WHICH COMPONENT DRAWS WHICH SLOT ──────────────────────────────────────
//
// A field type has more than one rendering, and they belong to different
// components. The FORM control below is a `field-specimen`: it draws the
// control from the field type alone, with no table and no record, which is the
// only way forty-nine of them fit on one page. The read-only print and the
// table cell are `record-field`'s own job — this page's other drawings — and
// neither is drawn per type here. See the note under the grid for why.
//
// ─── DERIVED, NEVER TRANSCRIBED ────────────────────────────────────────────
//
// The rows come from the endpoint, so a fiftieth field type appears with no
// edit. That is also why the nine categories are ONE binding with a gated
// heading rather than nine sections with nine `?category=` reads: the endpoint
// takes no query and publishes `firstInCategory` precisely so a page can head
// each group without naming the groups. Nine literal slugs here would go stale
// on the day a tenth category ships, silently, showing eight of nine.

const FIELD_ROWS = {
  system: { endpoint: FIELD_TYPES_ENDPOINT, rowsKey: 'items', idKey: 'type' },
} as const

/**
 * The heading over each category, printed once.
 *
 * A row template sees only its own row — no previous row, no comparison, no
 * arithmetic — so the group boundary cannot be computed here. It arrives as a
 * published fact and the heading is a sibling gated on it.
 */
const fieldCategoryHeading = (): PageComponent =>
  ({
    type: 'text',
    element: 'p',
    props: {
      className: 'text-foreground-subtle pt-2 text-[11px] font-medium tracking-[0.04em] uppercase',
    },
    visibility: { record: { field: 'firstInCategory', eq: true } },
    content: '$record.categoryTitle',
  }) as PageComponent

/** The micro-label over one of a field type's three renderings. */
const slotLabel = (text: string): PageComponent =>
  ({
    type: 'text',
    element: 'span',
    props: {
      className: 'text-foreground-muted text-[10px] font-medium tracking-[0.04em] uppercase',
    },
    content: text,
  }) as PageComponent

/**
 * One field type in its three renderings.
 *
 * ─── WHICH COMPONENT OWNS WHICH SLOT ───────────────────────────────────────
 *
 * The FORM slot is a `field-specimen`: it draws the control from the field type
 * alone, with no table and no record, which is the only way forty-nine of them
 * fit on one page. The TABLE and READ-ONLY slots are what `record-field` does —
 * it prints a value — and they differ from each other only in chrome, because
 * that is the whole of the difference in the product too: a cell has a box
 * around it and a printed field does not.
 *
 * ─── AND WHY THE VALUE IS NOT INVENTED HERE ────────────────────────────────
 *
 * Both printed slots read `sampleValue` off the row. Forty-nine literals
 * written into this file would be a transcription of the registry that goes
 * stale on the fiftieth — the thing the binding exists to prevent. The
 * catalogue publishes one per type for exactly this drawing.
 *
 * ─── A READ-ONLY TYPE HAS NO CONTROL, AND SAYS SO ──────────────────────────
 *
 * Eighteen of the forty-nine are computed or stamped by the system: a form
 * draws no input for them because there is nothing for a reader to type. The
 * form slot carries one sentence instead, gated on the published flag rather
 * than on a list kept here.
 */
const fieldCell = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    // ─── ONE TYPE, ONE SECTION ──────────────────────────────────────────────
    //
    // Forty-nine types in one flowing column, each printing three renderings in
    // sequence, gave a reader nothing to tell one type's third drawing from the
    // next type's first. The border is what makes a type a unit, and the anchor
    // is what the index beside it points at — `scroll-mt-6` is the offset every
    // other anchored block on this page already uses.
    props: {
      id: 'design-system-field-$record.type',
      className:
        'border-border flex min-w-0 scroll-mt-6 flex-col gap-2.5 rounded-md border px-4 py-3',
      'data-design-field': '$record.type',
    },
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex items-baseline gap-2' },
        children: [
          {
            type: 'text',
            element: 'span',
            props: { className: 'text-foreground font-mono text-[11px]' },
            content: '$record.type',
          },
          {
            type: 'text',
            element: 'span',
            props: { className: 'text-foreground-muted text-[10px]' },
            visibility: { record: { field: 'readOnly', eq: true } },
            content: 'read-only',
          },
        ],
      },
      {
        // The three renderings ACROSS rather than down. Stacked, one type ran
        // three screens deep and a reader scrolling met `IN A TABLE` with no way
        // to see which type it belonged to; side by side the comparison the
        // three slots exist for happens in one glance. It falls back to one
        // column under `md`, where three of anything is unreadable.
        type: 'container',
        element: 'div',
        props: { className: 'grid grid-cols-1 gap-4 md:grid-cols-3' },
        children: [
          {
            type: 'container',
            element: 'div',
            props: { className: 'flex min-w-0 flex-col gap-1.5' },
            children: [
              slotLabel('In a form'),
              {
                type: 'container',
                element: 'div',
                props: { className: 'contents' },
                visibility: { record: { field: 'readOnly', eq: false } },
                children: [
                  {
                    type: 'field-specimen',
                    fieldType: '$record.type',
                    compact: true,
                    props: { ...kitType('field-specimen') },
                  },
                ],
              },
              {
                type: 'text',
                element: 'span',
                props: { className: 'text-foreground-subtle text-sm' },
                visibility: { record: { field: 'readOnly', eq: true } },
                content: 'Set by the system — a form draws no control for it.',
              },
            ],
          },
          {
            type: 'container',
            element: 'div',
            props: { className: 'flex min-w-0 flex-col gap-1.5' },
            children: [
              slotLabel('In a table'),
              {
                type: 'container',
                element: 'div',
                props: {
                  // ─── THE SLOT CLIPS, BECAUSE THE VALUE CANNOT ────────────
                  //
                  // `record-field` drops the `className` an author gives it —
                  // it renders `<div data-component="record-field">` with no
                  // class at all — so the `truncate` below never reaches the
                  // DOM and a long value spills across the next slot. Clipping
                  // here is the containment a config page can still guarantee;
                  // the ellipsis needs the renderer to forward the class.
                  className:
                    'border-border bg-background flex min-h-7 min-w-0 items-center overflow-hidden rounded-sm border px-2 py-1',
                },
                children: [
                  {
                    type: 'record-field',
                    props: { field: 'sampleValue', className: 'text-foreground truncate text-sm' },
                  } as PageComponent,
                ],
              },
            ],
          },
          {
            type: 'container',
            element: 'div',
            // `overflow-hidden` for the reason the table slot above states: the
            // value's own class never reaches it, so the column is what keeps
            // the value inside its third.
            props: { className: 'flex min-w-0 flex-col gap-1.5 overflow-hidden' },
            children: [
              slotLabel('Read-only'),
              {
                type: 'record-field',
                props: {
                  field: 'sampleValue',
                  className: 'text-foreground-subtle truncate text-sm',
                },
              } as PageComponent,
            ],
          },
        ],
      } as PageComponent,
    ],
  }) as PageComponent

/**
 * The note that keeps the catalogue honest — required, not tolerated.
 *
 * A catalogue showing one of a field type's renderings and saying nothing would
 * be confidently wrong in the one place an operator goes to stop guessing. The
 * second half of the sentence is the part that cannot be drawn: the printed
 * value and the table cell each need a VALUE, and the field-type catalogue
 * publishes none — `type`, `category`, `categoryTitle`, `firstInCategory` and
 * nothing else, under `strictKeys`. Nor is there a component that prints a
 * field type's value from the type alone: a `record-field` needs a record
 * behind it, and this page's record carries no date, no rich text and no
 * attachment. Stating that is the honest move; forty-nine hand-written sample
 * values would be a transcription of the registry that rots on the fiftieth.
 */
const fieldSurfaceNote = (): PageComponent =>
  ({
    type: 'text',
    element: 'p',
    props: {
      className: 'text-foreground-subtle text-[11px] leading-relaxed',
      'data-testid': 'design-system-field-surface-note',
    },
    content:
      'Each type in its three renderings: the control a record form draws, the same value in a table cell, and the same value printed read-only. The grid\u2019s inline cell EDITOR is a fourth and is not drawn \u2014 a select becomes a menu on the cell and an attachment a popover, neither of which a still drawing can hold.',
  }) as PageComponent

/**
 * The index beside the catalogue: every type, by category, one click away.
 *
 * Forty-nine sections is a document, and a document with no contents page is
 * read by scrolling until something looks right. The index is bound to the SAME
 * rows the sections are, so it cannot list a type the catalogue did not draw and
 * the catalogue cannot draw one the index omits — both read the endpoint, once
 * each.
 *
 * It pins to the chrome bar's own offset and scrolls its own overflow, for the
 * reason the shell's nav column states next door: a column that cleared the bar
 * by a different margin would read as a misalignment rather than as a decision.
 *
 * Hidden below `lg`, where the catalogue is one column wide and an index beside
 * it would take the width the drawings need.
 */
const fieldIndex = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: `sticky ${CHROME_BAR_OFFSET_CLASS} hidden ${CHROME_BAR_STICKY_MAX_H_CLASS} w-40 flex-none list-none flex-col gap-0.5 overflow-y-auto pb-8 [scrollbar-width:thin] lg:flex`,
      'data-testid': 'design-system-field-index',
    },
    dataSource: FIELD_ROWS,
    children: [
      {
        // `p`, not `span`. A category heading and the first entry under it are
        // kept by the SAME row, so they share one row wrapper and an inline
        // element would sit beside its own first entry rather than above it.
        type: 'text',
        element: 'p',
        props: {
          className:
            'text-foreground-subtle pt-3 text-[10px] font-medium tracking-[0.04em] uppercase first:pt-0',
        },
        visibility: { record: { field: 'firstInCategory', eq: true } },
        content: '$record.categoryTitle',
      },
      {
        type: 'link',
        props: {
          href: '#design-system-field-$record.type',
          className:
            'text-foreground-subtle hover:text-foreground hover:bg-background-subtle truncate rounded-sm px-1.5 py-1 font-mono text-[11px] no-underline',
          'data-design-field-index-entry': '$record.type',
          ...kitType('link'),
        },
        content: '$record.type',
      },
    ],
  }) as PageComponent

/** Every field type, drawn once, under its category heading — and its index. */
const fieldCatalogue = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex w-full flex-col gap-4' },
    children: [
      fieldSurfaceNote(),
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex w-full flex-row items-start gap-6' },
        children: [
          {
            type: 'container',
            element: 'div',
            props: {
              className: 'flex min-w-0 flex-1 list-none flex-col gap-3',
            },
            dataSource: FIELD_ROWS,
            children: [fieldCategoryHeading(), fieldCell()],
          } as PageComponent,
          fieldIndex(),
        ],
      } as PageComponent,
    ],
  }) as PageComponent

const recordField: TypePageBody = {
  drawings: [
    {
      label: 'default',
      children: [field('purpose')],
    },
    {
      label: 'every field type, by category',
      children: [fieldCatalogue()],
    },
  ],
  options: [
    {
      id: 'format',
      title: 'Format',
      configKey: 'record-field.format',
      drawings: [
        {
          label: "format: 'truncate'",
          children: [pair('purpose', field('purpose', { format: 'truncate' }))],
        },
        {
          label: "format: 'currency'",
          children: [pair('pageCount', field('pageCount', { format: 'currency' }))],
        },
        {
          label: "format: 'percentage'",
          children: [pair('pageCount', field('pageCount', { format: 'percentage' }))],
        },
        {
          label: "format: 'compact'",
          children: [pair('pageCount', field('pageCount', { format: 'compact' }))],
        },
        {
          label: "format: 'bytes'",
          children: [pair('pageCount', field('pageCount', { format: 'bytes' }))],
        },
        {
          label: "format: 'yes-no'",
          children: [pair('drawable', field('drawable', { format: 'yes-no' }))],
        },
        {
          label: "format: 'check-cross'",
          children: [pair('configured', field('configured', { format: 'check-cross' }))],
        },
      ],
    },
    {
      id: 'dispatch',
      title: 'Dispatch',
      configKey: 'record-field — with no format',
      drawings: [
        {
          label: 'anything else → plain text',
          children: [field('category')],
        },
        {
          label: 'rich-text → sanitised HTML',
          children: [
            {
              type: 'text',
              element: 'p',
              props: { className: 'text-foreground text-sm' },
              content: 'Agreed on a September pilot with two teams.',
            } as PageComponent,
          ],
        },
        {
          label: 'attachment → download link',
          children: [
            {
              type: 'link',
              props: { href: '#', className: 'text-primary text-sm' },
              content: 'signed-proposal.pdf',
            } as PageComponent,
          ],
        },
      ],
    },
    {
      id: 'source',
      title: 'Source',
      configKey: 'record-field.dataSource',
      drawings: [
        {
          label: 'dataSource: (omitted)',
          children: [field('type')],
        },
        {
          label: 'dataSource: { system: { endpoint, param } }',
          children: [
            field('title', {
              dataSource: {
                system: { endpoint: COMPONENT_TYPE_DETAIL_ENDPOINT, param: 'type', idKey: 'type' },
              },
            }),
          ],
        },
        {
          label: 'dataSource: { table, mode: single, param }',
          children: [
            {
              type: 'code',
              props: { language: 'yaml' },
              content: 'dataSource:\n  table: companies\n  mode: single\n  param: companyId',
            } as PageComponent,
          ],
        },
      ],
    },
    {
      id: 'in-a-drawer',
      title: 'In a drawer',
      configKey: 'drawer.recordFields[].renderAs',
      drawings: [
        {
          label: "renderAs: 'text'",
          children: [plain('Rack shelf 1200 for the Lyon site.')],
        },
        {
          label: "renderAs: 'json'",
          children: [
            {
              type: 'code',
              props: { language: 'json' },
              content: '{\n  "vat": 20,\n  "net": 3433\n}',
            } as PageComponent,
          ],
        },
        {
          label: "renderAs: 'list'",
          children: [
            {
              type: 'container',
              element: 'div',
              props: { className: 'flex flex-col gap-1' },
              children: ['Import the CSV', 'Set the roles', 'Invite the team'].map(
                (line) =>
                  ({
                    type: 'container',
                    element: 'div',
                    props: { className: 'flex items-baseline gap-2' },
                    children: [
                      {
                        type: 'text',
                        element: 'span',
                        props: { className: 'text-foreground-subtle text-sm' },
                        content: '\u2022',
                      },
                      {
                        type: 'text',
                        element: 'span',
                        props: { className: 'text-foreground text-sm' },
                        content: line,
                      },
                    ],
                  }) as PageComponent
              ),
            } as PageComponent,
          ],
        },
        {
          label: "renderAs: 'key-value'",
          children: [
            {
              type: 'container',
              element: 'div',
              props: { className: 'divide-border border-border divide-y rounded-md border' },
              children: [
                ['vat', '20 %'],
                ['net', '3\u202f433,00\u00a0\u20ac'],
              ].map(
                ([k, v]) =>
                  ({
                    type: 'container',
                    element: 'div',
                    props: { className: 'flex items-baseline gap-4 px-3 py-1.5' },
                    children: [
                      {
                        type: 'text',
                        element: 'span',
                        props: { className: 'text-foreground-subtle w-20 font-mono text-[11px]' },
                        content: k,
                      },
                      {
                        type: 'text',
                        element: 'span',
                        props: { className: 'text-foreground text-sm' },
                        content: v,
                      },
                    ],
                  }) as PageComponent
              ),
            } as PageComponent,
          ],
        },
        {
          label: "renderAs: 'code'",
          children: [
            {
              type: 'code',
              props: { language: 'text' },
              content: 'SUM({amount}) * 1.2',
            } as PageComponent,
          ],
        },
      ],
    },
  ],
}

export default recordField
