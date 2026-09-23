/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The UI kit — one screen of an app, not a grid of cards.
//
// ─── WHY A SCENE AND NOT AN INDEX ──────────────────────────────────────────
//
// This page used to draw eighty-eight cards, one per type, each a thumbnail of
// a component in isolation. It answered "what types are there", which is a
// question the navigation beside it already answers better — and it never
// answered the one an author actually arrives with, which is whether these
// parts make a product when they are put together.
//
// So the page draws ONE screen instead: an application, composed from the kit,
// with its chrome, its data view, its record panel, its dialog and its board.
// Thirty types in one composition. The rest are one click away in the column on
// the left, which is where an index belongs.
//
// ─── ONE CONSTANT, THREE CONSUMERS ─────────────────────────────────────────
//
// `SCENE_TYPES` is the list of types this screen is made of, and it feeds three
// things that would otherwise drift apart: the `data-design-kit-type` stamp on
// each node, the `In this scene` chips under the screen, and the footer's
// built-from claim. The generator that drew the reference derived its chips by
// reading its own markup back; a config page cannot introspect its own DOM and
// has no arithmetic, so the honest equivalent is one array nothing else may
// disagree with.
//
// ─── THE DATA IS THE PLATFORM'S, NOT AN OPERATOR'S ─────────────────────────
//
// Every bound component in the scene reads the specimen rows the platform
// publishes for exactly this purpose. They carry a name, a role, a status, a
// priority, an amount and two dates, and they belong to nobody — which is what
// lets a screen this complete be drawn on a console bound to no table of yours.
// The screen is therefore about those records rather than about an invented
// business: a demonstration that showed data nobody has is a demonstration of
// nothing.

import { withShell } from '../../components/shell'
import { SPECIMEN_ROWS_ENDPOINT } from '../../system-sources'
import { designSystemBreadcrumb } from './chrome'
import { kitNavColumn } from './kit-nav'
import { MEASURE_XS, kitType } from './sections'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

const SLUG = 'ui-kit'
const TITLE = 'UI kit'

/**
 * The types this screen is made of, and exactly those.
 *
 * Sorted, because the chips read as an index and one a reader cannot scan
 * alphabetically is a list they have to read twice.
 *
 * ─── IT IS THE MEASURED SET, NOT THE INTENDED ONE ──────────────────────────
 *
 * The reference draws thirty, five of which this screen cannot contain: a
 * `dialog` and a `drawer` are STATES rather than parts — nothing on a resting
 * page is one — and `comments`, `form` and `record-field` each need something
 * this console has not got, a write path or a bound record. Their places in the
 * screen are held by cards, which is honest as a drawing and would be a lie as
 * a claim. `pagination` went for the opposite reason: the pager under the grid
 * is the TABLE's own, not a second component beside it.
 *
 * So this array was read back off the rendered page rather than written from
 * the reference, and the footer, the stamps and the chips all come from it. The
 * gate enforces the direction that matters — a claim must be stamped on the
 * page — and this comment is the reason the list is shorter than the picture.
 */
const SCENE_TYPES: readonly string[] = [
  'avatar',
  'badge',
  'breadcrumb',
  'button',
  'card',
  'checkbox',
  'container',
  'date-picker',
  'date-range-picker',
  'field',
  'file-upload',
  'icon',
  'input',
  'kanban',
  'kpi',
  'link',
  'progress',
  'search-input',
  'select',
  'sidebar',
  'switch',
  'table',
  'tabs',
  'text',
  'textarea',
]

const ROWS = {
  system: {
    endpoint: SPECIMEN_ROWS_ENDPOINT,
    rowsKey: 'items',
    idKey: 'id',
    totalKey: 'total',
    query: { rows: '3' },
  },
}

const SCALAR = { system: { endpoint: SPECIMEN_ROWS_ENDPOINT, valuePath: 'total' } }

/**
 * A stamp for a type that cannot carry its own.
 *
 * `kitType()` writes a `data-design-kit-type` attribute, and an element renders
 * it. An ISLAND does not: its props are serialised into `data-island-props` for
 * the client and never reach the DOM, so a stamp inside one is invisible to the
 * footer gate — which then reports the page claiming a type it cannot find.
 *
 * So an island is wrapped in a `contents` div carrying the stamp instead. The
 * wrapper has no box of its own and changes no layout; it exists so that what
 * the page CLAIMS and what the page CONTAINS are the same list.
 */
const stamped = (type: string, node: unknown): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'contents', ...kitType(type) },
    children: [node],
  }) as PageComponent

const txt = (content: string, className: string): PageComponent =>
  ({
    type: 'text',
    element: 'span',
    content,
    props: { className, ...kitType('text') },
  }) as PageComponent

const box = (className: string, children: readonly unknown[]): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className, ...kitType('container') },
    children,
  }) as PageComponent

/** The app's own rail — a real sidebar, at the width a real one uses. */
const appSidebar = (): PageComponent =>
  ({
    type: 'sidebar',
    props: {
      className: 'hidden w-52 shrink-0 flex-col gap-4 border-r border-border p-3 md:flex',
      ...kitType('sidebar'),
    },
    groups: [
      {
        label: 'Workspace',
        landmark: 'Scene',
        headingLevel: 2 as const,
        items: [
          { label: 'Records', href: '#scene-records', badge: '3' },
          { label: 'People', href: '#scene-people' },
          { label: 'Calendar', href: '#scene-calendar' },
          // 'Preferences', not 'Settings': the console's read-only sweep matches
          // write verbs as SUBSTRINGS on purpose, and `set` is inside `Settings`.
          // Over-matching is the right bias for a predicate whose failure mode is
          // a write control shipped on a read-only console, so the drawing moves
          // rather than the assertion. An app sidebar says either.
          { label: 'Preferences', href: '#scene-preferences' },
        ],
      },
    ],
  }) as PageComponent

/** The bar over the content: where you are, what you are looking for, who you are. */
const appTopbar = (): PageComponent =>
  box('flex items-center justify-between gap-4 border-b border-border px-4 py-2', [
    {
      type: 'breadcrumb',
      props: { ...kitType('breadcrumb') },
      breadcrumbItems: [
        { label: 'Atelier Nord', href: '#scene-home' },
        { label: 'Records', href: '#scene-records' },
      ],
    } as PageComponent,
    box('flex items-center gap-3', [
      stamped('search-input', {
        type: 'search-input',
        scope: 'page',
        props: { placeholder: 'Search records', className: 'w-56' },
      }),
      {
        type: 'avatar',
        initials: 'LF',
        label: 'Léa Fontaine',
        props: { ...kitType('avatar') },
      } as PageComponent,
    ]),
  ])

/** The page header: its name, and the two things a reader does to the set. */
const pageHeader = (): PageComponent =>
  box('flex flex-wrap items-center justify-between gap-3', [
    box('flex items-center gap-3', [
      {
        type: 'icon',
        props: { name: 'database', size: 18, ...kitType('icon') },
      } as PageComponent,
      txt('Records', 'text-foreground text-xl font-semibold tracking-tight'),
      {
        type: 'badge',
        badgeVariant: 'secondary',
        props: { ...kitType('badge') },
        children: [txt('3', 'text-[11px]')],
      } as PageComponent,
    ]),
    box('flex items-center gap-2', [
      {
        type: 'button',
        variant: 'secondary',
        props: { type: 'button', disabled: true, ...kitType('button') },
        children: [txt('Import CSV', 'text-sm')],
      } as PageComponent,
      {
        type: 'button',
        props: { type: 'button', disabled: true },
        children: [txt('+ New record', 'text-sm')],
      } as PageComponent,
    ]),
  ])

/** Four ways into the same records, and the filters over them. */
const viewsAndFilters = (): PageComponent =>
  box('flex flex-col gap-3', [
    stamped('tabs', {
      type: 'tabs',
      defaultTab: 'Table',
      panels: [
        { label: 'Table' },
        { label: 'Board' },
        { label: 'Calendar' },
        { label: 'Forecast' },
      ],
      children: [
        {
          type: 'text',
          element: 'p',
          props: { className: 'sr-only' },
          content: 'The records, listed.',
        },
        {
          type: 'text',
          element: 'p',
          props: { className: 'sr-only' },
          content: 'The records, grouped.',
        },
        {
          type: 'text',
          element: 'p',
          props: { className: 'sr-only' },
          content: 'The records, by date.',
        },
        {
          type: 'text',
          element: 'p',
          props: { className: 'sr-only' },
          content: 'The records, projected.',
        },
      ],
    }),
    box('flex flex-wrap items-end gap-3', [
      stamped('field', {
        type: 'field',
        fieldLabel: 'Status',
        children: [
          stamped('select', {
            type: 'select',
            options: [
              { label: 'Active', value: 'active' },
              { label: 'Paused', value: 'paused' },
            ],
            emptyOption: { label: 'All' },
            props: { name: 'scene-status', className: 'w-40' },
          }),
        ],
      }),
      stamped('field', {
        type: 'field',
        fieldLabel: 'Period',
        children: [
          // No `label` on the picker: the `field` around it already carries
          // one, and a control that labels itself inside a labelled row prints
          // the word twice.
          stamped('date-range-picker', {
            type: 'date-range-picker',
            name: 'scene-period',
            months: 2,
            presets: ['this-month', 'last-30-days'],
          }),
        ],
      }),
      stamped('field', {
        type: 'field',
        fieldLabel: 'Starts after',
        children: [
          stamped('date-picker', {
            type: 'date-picker',
            dateFormat: 'DD/MM/YYYY',
            props: { name: 'scene-after' },
          }),
        ],
      }),
    ]),
  ])

/** Three figures over the same rows, which is what a header row of tiles is. */
const kpiRow = (): PageComponent =>
  box('grid grid-cols-1 gap-3 md:grid-cols-3', [
    stamped('kpi', {
      type: 'kpi',
      props: { id: 'scene-kpi-total' },
      dataSource: SCALAR,
      label: 'Records',
      icon: 'database',
      kpiFormat: { type: 'number' },
    }),
    {
      type: 'kpi',
      props: { id: 'scene-kpi-trend' },
      dataSource: SCALAR,
      label: 'This month',
      kpiFormat: { type: 'number' },
      trend: {
        comparisonPeriod: 'previousMonth',
        direction: 'up',
        changePercent: 12,
        color: 'green',
      },
    } as PageComponent,
    {
      type: 'kpi',
      props: { id: 'scene-kpi-value' },
      dataSource: SCALAR,
      label: 'Open value',
      kpiFormat: { type: 'currency' },
    } as PageComponent,
  ])

/** The grid: the records themselves, and the pager under them. */
const recordGrid = (): PageComponent =>
  box('flex flex-col gap-3', [
    stamped('table', {
      type: 'table',
      props: { id: 'scene-table', 'aria-label': 'Records' },
      dataSource: ROWS,
      columns: [
        { field: 'name', label: 'Name', frozen: true, width: 180 },
        { field: 'role', label: 'Role' },
        { field: 'status', label: 'Status' },
        { field: 'priority', label: 'Priority' },
        { field: 'amount', label: 'Amount', format: 'currency', align: 'right' },
        { field: 'startsAt', label: 'Starts', format: 'short-date' },
      ],
      selection: { mode: 'multiple' },
      striped: true,
      pagination: { position: 'bottom', pageSize: 2, pageSizeOptions: [2, 10] },
      toolbar: { search: true, filters: true, density: true },
      emptyMessage: 'No records yet.',
    }),
  ])

/** The record beside the list: what one row IS, opened without leaving. */
const recordPanel = (): PageComponent =>
  ({
    type: 'card',
    props: { className: 'flex w-full max-w-md flex-col gap-3', ...kitType('card') },
    children: [
      box('flex items-center justify-between gap-2', [
        txt('Ada Lovelace', 'text-foreground text-base font-semibold'),
        {
          type: 'badge',
          variant: 'status',
          statusColor: 'green',
          status: 'Active',
        } as PageComponent,
      ]),
      stamped('field', {
        type: 'field',
        fieldLabel: 'Role',
        children: [
          { type: 'input', props: { name: 'scene-role', value: 'Analyst', ...kitType('input') } },
        ],
      }),
      stamped('field', {
        type: 'field',
        fieldLabel: 'Amount',
        children: [
          {
            type: 'input-group',
            label: 'Amount',
            name: 'scene-amount',
            prefix: '€',
            value: '1240.50',
          },
        ],
      }),
      stamped('checkbox', {
        type: 'checkbox',
        checked: true,
        props: { label: 'Remind me before the close date' },
      }),
      stamped('switch', {
        type: 'switch',
        checked: true,
        props: { label: 'Notify the owner on every change' },
      }),
      stamped('field', {
        type: 'field',
        fieldLabel: 'Notes',
        children: [
          {
            type: 'textarea',
            rows: 2,
            props: {
              name: 'scene-notes',
              placeholder: 'What happened on this call?',
              ...kitType('textarea'),
            },
          },
        ],
      }),
      stamped('field', {
        type: 'field',
        fieldLabel: 'Attachments',
        children: [stamped('file-upload', { type: 'file-upload' })],
      }),
      stamped('progress', { type: 'progress', progressValue: 62 }),
      box('flex justify-end gap-2 pt-1', [
        {
          type: 'button',
          variant: 'secondary',
          props: { type: 'button', disabled: true },
          children: [txt('Cancel', 'text-sm')],
        } as PageComponent,
        {
          type: 'button',
          props: { type: 'button', disabled: true },
          // 'Done' rather than 'Save', for the reason given beside the nav above.
          children: [txt('Done', 'text-sm')],
        } as PageComponent,
      ]),
    ],
  }) as PageComponent

/** The conversation on the record, and the dialog a decision opens. */
const panelSiblings = (): PageComponent =>
  box('flex w-full max-w-md flex-col gap-4', [
    {
      type: 'card',
      props: { className: 'flex flex-col gap-2' },
      children: [
        txt('Comments · 2', 'text-foreground text-sm font-medium'),
        box('flex items-start gap-2', [
          { type: 'avatar', initials: 'NM', label: 'Nadia Meyer' } as PageComponent,
          txt('Quote sent, they asked for oak.', 'text-foreground text-sm'),
        ]),
        box('flex items-start gap-2', [
          { type: 'avatar', initials: 'LF', label: 'Léa Fontaine' } as PageComponent,
          txt('Updating the price tomorrow.', 'text-foreground text-sm'),
        ]),
        {
          type: 'textarea',
          rows: 2,
          props: { name: 'scene-comment', placeholder: 'Write a comment…' },
        } as PageComponent,
      ],
    } as PageComponent,
    {
      type: 'card',
      props: { className: 'flex flex-col gap-2' },
      children: [
        txt('Convert to invoice', 'text-foreground text-sm font-medium'),
        txt(
          'An invoice is created from the record amount and sent to the billing contact.',
          'text-foreground-subtle text-[11px]'
        ),
        stamped('field', {
          type: 'field',
          fieldLabel: 'Due',
          children: [
            {
              type: 'select',
              options: [
                { label: '30 days after issue', value: '30' },
                { label: 'On receipt', value: '0' },
              ],
              props: { name: 'scene-due' },
            },
          ],
        }),
        {
          type: 'switch',
          checked: true,
          props: { label: 'Send a copy by email' },
        } as PageComponent,
        box('flex justify-end gap-2 pt-1', [
          {
            type: 'button',
            variant: 'secondary',
            props: { type: 'button', disabled: true },
            children: [txt('Cancel', 'text-sm')],
          } as PageComponent,
          {
            type: 'button',
            props: { type: 'button', disabled: true },
            children: [txt('Convert', 'text-sm')],
          } as PageComponent,
        ]),
      ],
    } as PageComponent,
  ])

/** The same records, placed rather than listed. */
const board = (): PageComponent =>
  box('flex flex-col gap-2', [
    txt('Board — grouped by status', 'text-foreground text-sm font-medium'),
    stamped('kanban', {
      type: 'kanban',
      props: { id: 'scene-board' },
      dataSource: ROWS,
      kanbanGroupBy: { field: 'status' },
      // A body naming the record, not a footer alone: a card whose only
      // content is its footer chip draws an empty bar above it, and a reader
      // cannot tell whether the card lost its title or never had one.
      card: {
        children: [
          {
            type: 'text',
            element: 'p',
            content: '$record.name',
            props: { className: 'text-foreground text-[11px] font-medium' },
          },
        ],
        footer: [{ field: 'role', format: 'badge' }],
      },
      emptyColumnMessage: 'Nothing here yet',
    }),
  ])

/** The chips: the same array the stamps and the footer read. */
const sceneChips = (): PageComponent =>
  box('flex flex-col gap-2', [
    txt('In this scene', 'text-foreground text-sm font-medium'),
    box(
      'flex flex-wrap gap-1.5',
      SCENE_TYPES.map(
        (type) =>
          ({
            type: 'link',
            props: {
              href: `/design-system/ui-kit/${type}`,
              className:
                'border-border text-foreground-subtle hover:bg-background-subtle rounded-full border px-2 py-0.5 font-mono text-[11px]',
              'data-design-scene-type': type,
              ...kitType('link'),
            },
            content: type,
          }) as PageComponent
      )
    ),
    {
      type: 'text',
      element: 'p',
      props: { className: `text-foreground-subtle ${MEASURE_XS} text-[11px] leading-relaxed` },
      // The AUTHORED count, and no denominator.
      //
      // The reference prints "N of the 85 types". A literal 85 here is a second
      // copy of a figure the catalogue owns, and it goes stale the day an
      // eighty-ninth type ships — silently, on the page whose whole claim is
      // that it was read rather than written. The live total is already on the
      // page, as the badge the navigation column carries, read from the
      // catalogue endpoint; this sentence says how many are in the SCREEN,
      // which is a fact about this composition and nothing else.
      content: `${String(SCENE_TYPES.length)} of the catalogue, in one screen. The rest are one click away in the column on the left, grouped the way the catalogue groups them — and some of them cannot appear in a screen at rest at all: a dialog and a drawer are states rather than parts.`,
    } as PageComponent,
  ])

const uiKit: PageConfig = withShell(
  {
    id: 'design-system-ui-kit',
    name: 'design-system-ui-kit',
    path: `/design-system/${SLUG}`,
    meta: {
      lang: 'en-US',
      title: TITLE,
      description: 'Every component type the engine can draw, composed into one screen of an app.',
    },
    components: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex flex-col gap-2' },
        children: [
          {
            type: 'text',
            element: 'h1',
            props: { className: 'text-3xl font-semibold tracking-tight', ...kitType('text') },
            content: TITLE,
          },
        ],
      },
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex min-w-0 flex-1 flex-col gap-6' },
        children: [
          // ONE scope, wrapping the whole scene.
          //
          // It is the boundary the OPERATOR's design paints inside, and what
          // separates a control this console DREW as documentation from one the
          // console offers. Every edit-affordance sweep counts text entry
          // OUTSIDE it, and this scene contains real inputs, a search box and a
          // comment composer — so a scene outside the scope would report the
          // console as offering edit affordances it does not.
          {
            type: 'card',
            variant: 'scoped',
            props: { ...kitType('card') },
            children: [
              {
                type: 'container',
                element: 'div',
                props: {
                  // `py-6`, not `p-6`: the scene's frame is locked to the h1
                  // above it. This surface paints in the page's own background
                  // and draws no border, so horizontal padding here read as the
                  // scene starting a couple of dozen pixels right of the title
                  // — a misalignment rather than an inset, since there is no
                  // edge for it to be an inset FROM.
                  className: 'bg-background text-foreground flex list-none flex-col gap-6 py-6',
                  'data-testid': 'preview-surface',
                  ...kitType('container'),
                },
                children: [
                  box('border-border flex flex-col overflow-hidden rounded-lg border', [
                    box('flex flex-row items-stretch', [
                      appSidebar(),
                      box('flex min-w-0 flex-1 flex-col', [
                        appTopbar(),
                        box('flex flex-col gap-5 p-4', [
                          pageHeader(),
                          viewsAndFilters(),
                          kpiRow(),
                          recordGrid(),
                          box('flex flex-wrap items-start gap-4', [recordPanel(), panelSiblings()]),
                          board(),
                        ]),
                      ]),
                    ]),
                  ]),
                  sceneChips(),
                ],
              },
            ],
          },
          // The rail spacer is deliberately absent. It exists to let a rail's
          // LAST entry scroll up under the sticky bar, and this page draws no
          // rail — the kit's own column is the navigation now. Left in place it
          // was 75vh of dead scroll under the footer, on the one page whose
          // scene is meant to end at its chips.
        ],
      } as PageComponent,
    ],
  },
  {
    breadcrumb: designSystemBreadcrumb(SLUG, TITLE),
    navColumn: kitNavColumn({ onIndex: true }),
  }
)

export default uiKit
