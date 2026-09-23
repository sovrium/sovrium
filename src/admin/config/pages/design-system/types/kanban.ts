/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `kanban` — the same records as a table, placed by one field instead of listed.
//
// `kanbanGroupBy` is what makes it a board: its field's values become the
// columns, so it has to be a field with few values and a natural order. Group a
// board by a free-text field and it draws one column per record.
//
// ─── AND THE SECOND AXIS IS A KEY OF ITS OWN ───────────────────────────────
//
// `swimlanes` names a further field, and the board becomes a grid: lanes down,
// columns across, a card at the intersection of its two values. It reads by the
// same rules as the first axis — the field's own option order, an undeclared
// value appended, one Uncategorized lane — so an author who has learned how
// columns behave has learned how lanes behave.

import { SPECIMEN_ROWS_ENDPOINT } from '../../../system-sources'
import type { PageComponent, TypePageBody } from './body-shape'

const BOUND = {
  system: {
    endpoint: SPECIMEN_ROWS_ENDPOINT,
    rowsKey: 'items',
    idKey: 'id',
    totalKey: 'total',
    query: { rows: '3' },
  },
}

// Twelve rows where every other drawing takes three. A grid needs enough cards
// to BE a grid: at three rows each lane holds one card and the drawing argues
// for a list, not for a second axis. Twelve turns `priority` four times and
// `status` a little over twice, so every cell is populated and the vertical read
// the axis exists for is the thing a reader actually sees.
const DEEP_BOUND = {
  system: {
    endpoint: SPECIMEN_ROWS_ENDPOINT,
    rowsKey: 'items',
    idKey: 'id',
    totalKey: 'total',
    query: { rows: '12' },
  },
}

/**
 * A card body naming the record, which every drawing here needs.
 *
 * A card with a footer and no body drew an empty bar above its chip: the
 * drawing showed a date or a badge floating under a blank, and a reader could
 * not tell whether the card had lost its title or the option had. The board
 * rows carry `name`, so `name` is the title.
 */
const cardTitle = (): readonly PageComponent[] => [
  {
    type: 'text',
    element: 'p',
    content: '$record.name',
    props: { className: 'text-foreground text-[11px] font-medium' },
  } as PageComponent,
]

/**
 * The same board every time, with one key changed.
 *
 * `card` is merged rather than replaced, so a drawing that sets `footer` keeps
 * the title and a drawing that sets its own `children` overrides it.
 */
const board = (id: string, extra: Readonly<Record<string, unknown>>) => {
  const { card, ...rest } = extra as { readonly card?: Record<string, unknown> }
  return {
    type: 'kanban' as const,
    props: { id },
    dataSource: BOUND,
    emptyColumnMessage: 'No specimen rows',
    card: { children: cardTitle(), ...card },
    ...rest,
  } as PageComponent
}

/** The same board again, over enough rows to fill a grid. */
const gridBoard = (id: string, extra: Readonly<Record<string, unknown>>) => {
  const { card, ...rest } = extra as { readonly card?: Record<string, unknown> }
  return {
    type: 'kanban' as const,
    props: { id },
    dataSource: DEEP_BOUND,
    kanbanGroupBy: { field: 'status' },
    emptyColumnMessage: 'No specimen rows',
    card: { children: cardTitle(), ...card },
    ...rest,
  } as PageComponent
}

const kanban: TypePageBody = {
  drawings: [
    {
      label: 'columns',
      children: [
        {
          type: 'kanban',
          props: { id: 'design-system-kanban-columns' },
          dataSource: BOUND,
          kanbanGroupBy: { field: 'status' },
          emptyColumnMessage: 'No specimen rows',
        },
      ],
    },
    {
      label: 'card body',
      children: [
        {
          type: 'kanban',
          props: { id: 'design-system-kanban-card' },
          dataSource: BOUND,
          kanbanGroupBy: { field: 'status' },
          card: {
            children: [{ type: 'text', element: 'p', content: '$record.name' }],
            footer: [{ field: 'role', format: 'text' }],
          },
          emptyColumnMessage: 'No specimen rows',
        },
      ],
    },
  ],
  options: [
    {
      id: 'columns',
      title: 'Columns',
      configKey: 'kanban.kanbanGroupBy.field',
      drawings: [
        {
          label: "kanbanGroupBy: { field: 'status' }",
          children: [board('kb-col-status', { kanbanGroupBy: { field: 'status' } })],
        },
        {
          label: "kanbanGroupBy: { field: 'role' }",
          children: [board('kb-col-role', { kanbanGroupBy: { field: 'role' } })],
        },
      ],
    },
    {
      id: 'swimlanes',
      title: 'Swimlanes',
      configKey: 'kanban.swimlanes.field',
      drawings: [
        {
          label: "swimlanes: { field: 'priority' }",
          children: [gridBoard('kb-lane-priority', { swimlanes: { field: 'priority' } })],
        },
        {
          label: "swimlanes: { field: 'category' }",
          children: [gridBoard('kb-lane-category', { swimlanes: { field: 'category' } })],
        },
        {
          label: "swimlanes: { collapsed: ['Low'] }",
          children: [
            gridBoard('kb-lane-collapsed', {
              swimlanes: { field: 'priority', collapsed: ['Low'] },
            }),
          ],
        },
        {
          label: 'swimlanes: { showEmpty: false }',
          children: [
            {
              type: 'code',
              props: { language: 'yaml' },
              content: 'swimlanes:\n  field: priority\n  showEmpty: false',
            } as PageComponent,
          ],
        },
      ],
    },
    {
      id: 'card',
      title: 'Card',
      configKey: 'kanban.card',
      drawings: [
        {
          label: 'card: (omitted)',
          // NOT through `board()`: this drawing IS the untouched default, so
          // it must not pick up the helper's card body.
          children: [
            {
              type: 'kanban',
              props: { id: 'kb-card-bare' },
              dataSource: BOUND,
              kanbanGroupBy: { field: 'status' },
              emptyColumnMessage: 'No specimen rows',
            } as PageComponent,
          ],
        },
        {
          label: 'card: { children }',
          children: [
            board('kb-card-children', {
              kanbanGroupBy: { field: 'status' },
              card: {
                children: [
                  { type: 'text', element: 'p', content: '$record.name' },
                  {
                    type: 'text',
                    element: 'p',
                    content: '$record.role',
                    props: { className: 'text-foreground-subtle text-[11px]' },
                  },
                ],
              },
            }),
          ],
        },
        {
          label: "colorField: 'priority'",
          children: [
            board('kb-card-color', { kanbanGroupBy: { field: 'status' }, colorField: 'priority' }),
          ],
        },
        {
          label: 'card: { coverImage }',
          children: [
            {
              type: 'code',
              props: { language: 'yaml' },
              content: 'card:\n  coverImage: $record.thumbnail',
            } as PageComponent,
          ],
        },
      ],
    },
    {
      id: 'footer',
      title: 'Footer',
      configKey: 'kanban.card.footer[].format',
      drawings: [
        ...(['relative-date', 'short-date', 'text'] as const).map((format) => ({
          label: `footer: [{ field: 'startsAt', format: '${format}' }]`,
          children: [
            board(`kb-footer-${format}`, {
              kanbanGroupBy: { field: 'status' },
              card: { footer: [{ field: 'startsAt', format }] },
            }),
          ],
        })),
        {
          label: "footer: [{ field: 'name', format: 'avatar' }]",
          children: [
            board('kb-footer-avatar', {
              kanbanGroupBy: { field: 'status' },
              card: { footer: [{ field: 'name', format: 'avatar' }] },
            }),
          ],
        },
        {
          label: "footer: [{ field: 'role', format: 'badge' }]",
          children: [
            board('kb-footer-badge', {
              kanbanGroupBy: { field: 'status' },
              card: { footer: [{ field: 'role', format: 'badge' }] },
            }),
          ],
        },
      ],
    },
    {
      id: 'drag',
      title: 'Drag',
      configKey: 'kanban.drag',
      drawings: [
        {
          label: 'drag: { enabled: true } · false',
          children: [
            board('kb-drag-on', { kanbanGroupBy: { field: 'status' }, drag: { enabled: true } }),
          ],
        },
        {
          label: 'drag: { persistAction }',
          children: [
            {
              type: 'container',
              element: 'div',
              props: {
                className:
                  'border-border flex w-56 items-center justify-between rounded-md border px-3 py-2',
              },
              children: [
                {
                  type: 'text',
                  element: 'span',
                  props: { className: 'text-foreground text-sm' },
                  content: 'Ada Lovelace',
                },
                { type: 'badge', variant: 'status', statusColor: 'green', status: 'Saved' },
              ],
            } as PageComponent,
          ],
        },
        {
          label: 'permission denied',
          children: [
            {
              type: 'container',
              element: 'div',
              props: { className: 'flex w-56 flex-col gap-1' },
              children: [
                {
                  type: 'container',
                  element: 'div',
                  props: { className: 'border-border rounded-md border px-3 py-2' },
                  children: [
                    {
                      type: 'text',
                      element: 'span',
                      props: { className: 'text-foreground text-sm' },
                      content: 'Ada Lovelace',
                    },
                  ],
                },
                {
                  type: 'text',
                  element: 'p',
                  props: { className: 'text-foreground-subtle text-[11px]' },
                  content: 'You can read this board but not move cards on it.',
                },
              ],
            } as PageComponent,
          ],
        },
      ],
    },
    {
      id: 'empty-column',
      title: 'Empty column',
      configKey: 'kanban.emptyColumnMessage',
      drawings: [
        {
          label: "emptyColumnMessage: 'No specimen rows'",
          children: [
            {
              type: 'container',
              element: 'div',
              props: {
                className: 'bg-background-subtle flex w-56 flex-col gap-2 rounded-md px-3 py-3',
              },
              children: [
                {
                  type: 'text',
                  element: 'p',
                  props: { className: 'text-foreground text-[11px] font-medium uppercase' },
                  content: 'Closed',
                },
                {
                  type: 'text',
                  element: 'p',
                  props: { className: 'text-foreground-subtle py-6 text-center text-[11px]' },
                  content: 'No specimen rows',
                },
              ],
            } as PageComponent,
          ],
        },
      ],
    },
  ],
}

export default kanban
