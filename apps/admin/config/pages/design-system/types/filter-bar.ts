/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `filter-bar` — the conditions, separated from the thing they filter.
//
// This is the type's whole design, and the third drawing is the only one that
// shows it: the bar filters nothing itself. It PUBLISHES its conditions on a
// channel, and a component naming that channel in `dataSource.bindTo` merges
// them into its own request. So one bar can drive a grid, three grids, or grids
// over different tables — which is also why `fields` is declared by the author
// rather than derived from a binding the bar does not have.
//
// ─── TWO THINGS THE REFERENCE DRAWS THAT ARE NOT CONFIG ────────────────────
//
// Its second board shows the add-condition menu open. `allowAdd` defaults to
// TRUE, so that is the same config as the first board with a popover open —
// nothing an author writes. The real second drawing is the opposite: `false`,
// which leaves the chips removable and offers no new ones.
//
// And the operators a bar offers are the SERVER's eight — eq, neq, contains,
// gt, lt, gte, lte, in — not the seventeen the grid's own overlay shows. A bar
// offering "starts with" would publish a filter the endpoint drops in silence.

import { SPECIMEN_ROWS_ENDPOINT } from '../../../systemSources'
import type { PageComponent, TypePageBody } from './_shape'

const FIELDS = [
  {
    name: 'status',
    label: 'Status',
    kind: 'select' as const,
    options: [
      { value: 'Active', label: 'Active' },
      { value: 'Paused', label: 'Paused' },
    ],
  },
  { name: 'role', label: 'Role', kind: 'text' as const },
]

const CONDITIONS = [{ field: 'status', operator: 'eq' as const, value: 'Active' }]

const bar = (channel: string, extra: Record<string, unknown> = {}) =>
  ({
    type: 'filter-bar' as const,
    publishes: { bindTo: channel },
    conditions: CONDITIONS,
    fields: FIELDS,
    ...extra,
  }) as PageComponent

const grid = (channel: string) =>
  ({
    type: 'table' as const,
    props: { id: `${channel}-table`, 'aria-label': 'Filtered specimen rows' },
    dataSource: {
      system: {
        endpoint: SPECIMEN_ROWS_ENDPOINT,
        rowsKey: 'items',
        query: { rows: '3' },
        idKey: 'id',
        totalKey: 'total',
        bindTo: channel,
        sharedFilter: {},
      },
    },
    columns: [
      { field: 'name', label: 'Name' },
      { field: 'role', label: 'Role' },
      { field: 'status', label: 'Status' },
    ],
    emptyMessage: 'No rows match',
  }) as PageComponent

const ops = (category: string, list: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex w-full flex-col gap-1' },
    children: [
      {
        type: 'text',
        element: 'p',
        content: category,
        props: { className: 'text-foreground text-[11px] font-medium' },
      },
      {
        type: 'text',
        element: 'p',
        content: list,
        props: { className: 'text-foreground-subtle font-mono text-[11px]' },
      },
    ],
  }) as PageComponent

const filterBar: TypePageBody = {
  drawings: [
    {
      label: 'bar',
      children: [
        {
          type: 'filter-bar',
          publishes: { bindTo: 'design-system-filter-bar' },
          conditions: CONDITIONS,
          fields: FIELDS,
        },
      ],
    },
    {
      label: 'fixed conditions',
      children: [
        {
          type: 'filter-bar',
          publishes: { bindTo: 'design-system-filter-fixed' },
          conditions: CONDITIONS,
          fields: FIELDS,
          allowAdd: false,
        },
      ],
    },
    {
      label: 'applied to a grid',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex w-full flex-col gap-3' },
          children: [
            {
              type: 'filter-bar',
              publishes: { bindTo: 'design-system-filter-grid' },
              conditions: CONDITIONS,
              fields: FIELDS,
            },
            {
              type: 'table',
              props: {
                id: 'design-system-filter-grid-table',
                'aria-label': 'Filtered specimen rows',
              },
              dataSource: {
                system: {
                  endpoint: SPECIMEN_ROWS_ENDPOINT,
                  rowsKey: 'items',
                  query: { rows: '3' },
                  idKey: 'id',
                  totalKey: 'total',
                  bindTo: 'design-system-filter-grid',
                  sharedFilter: {},
                },
              },
              columns: [
                { field: 'name', label: 'Name' },
                { field: 'role', label: 'Role' },
                { field: 'status', label: 'Status' },
              ],
              emptyMessage: 'No rows match',
            },
          ],
        },
      ],
    },
  ],
  options: [
    {
      id: 'declarative',
      title: 'Declarative',
      configKey: 'dataSource.filter[]',
      drawings: [
        {
          label: '{ field, operator, value }',
          children: [
            {
              type: 'code',
              props: { language: 'yaml' },
              content:
                'dataSource:\n  table: deals\n  filter:\n    - field: status\n      operator: eq\n      value: won',
            } as PageComponent,
          ],
        },
        {
          label: 'value: currentUser',
          children: [
            {
              type: 'code',
              props: { language: 'yaml' },
              content: 'filter:\n  - field: owner\n    operator: eq\n    value: currentUser',
            } as PageComponent,
          ],
        },
        {
          label: 'value: routeParam',
          children: [
            {
              type: 'code',
              props: { language: 'yaml' },
              content: 'filter:\n  - field: companyId\n    operator: eq\n    value: routeParam',
            } as PageComponent,
          ],
        },
      ],
    },
    {
      id: 'vocabulary',
      title: 'Vocabulary',
      configKey: 'filter-bar.fields[].kind',
      drawings: [
        {
          label: "kind: 'text'",
          children: [
            ops('text', 'is · is not · contains · does not contain · is empty · is not empty'),
          ],
        },
        {
          label: "kind: 'number'",
          children: [ops('number', '= · ≠ · > · < · ≥ · ≤ · between')],
        },
        {
          label: "kind: 'date'",
          children: [ops('date', 'is · is before · is after · is on or before · is on or after')],
        },
        {
          label: "kind: 'select'",
          children: [ops('select', 'is · is not · is any of · is none of')],
        },
      ],
    },
    {
      id: 'shared',
      title: 'Shared',
      configKey: 'publishes.bindTo → dataSource.bindTo',
      drawings: [
        {
          label: 'one bar, one grid',
          children: [
            {
              type: 'container',
              element: 'div',
              props: { className: 'flex w-full flex-col gap-3' },
              children: [bar('design-system-filter-shared'), grid('design-system-filter-shared')],
            } as PageComponent,
          ],
        },
      ],
    },
  ],
}

export default filterBar
