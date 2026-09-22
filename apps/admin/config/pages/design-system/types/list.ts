/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `list` — records as lines, for records a reader reads rather than compares.
//
// `listDisplay.itemTemplate` is the whole component: a title, an optional
// subtitle, an optional badge. Three slots, which is the point — a list that
// wants a fourth column wants to be a table.
//
// The one authoring fact worth the page: the template's grammar is
// `$record.<field>`. A bare field name matches nothing and reaches the page as
// the literal word — a specimen of the template rather than of the component.

import { SPECIMEN_ROWS_ENDPOINT } from '../../../systemSources'
import type { PageComponent, TypePageBody } from './_shape'

const BOUND = {
  system: {
    endpoint: SPECIMEN_ROWS_ENDPOINT,
    rowsKey: 'items',
    idKey: 'id',
    totalKey: 'total',
    query: { rows: '3' },
  },
}

/** The same list every time, with one part of the template changed. */
const rows = (
  id: string,
  listDisplay: Record<string, unknown>,
  extra: Record<string, unknown> = {}
) =>
  ({
    type: 'list' as const,
    props: { id },
    dataSource: BOUND,
    listDisplay: { emptyMessage: 'No specimen rows', ...listDisplay },
    ...extra,
  }) as PageComponent

const list: TypePageBody = {
  drawings: [
    {
      label: 'default',
      children: [
        {
          type: 'list',
          props: { id: 'design-system-list-default' },
          dataSource: BOUND,
          listDisplay: {
            itemTemplate: { title: '$record.name', subtitle: '$record.role' },
            emptyMessage: 'No specimen rows',
          },
        },
      ],
    },
    {
      label: 'with trailing badge',
      children: [
        {
          type: 'list',
          props: { id: 'design-system-list-badge' },
          dataSource: BOUND,
          listDisplay: {
            itemTemplate: {
              title: '$record.name',
              subtitle: '$record.role',
              badge: '$record.status',
            },
            emptyMessage: 'No specimen rows',
          },
        },
      ],
    },
  ],
  options: [
    {
      id: 'item-template',
      title: 'Item template',
      configKey: 'listDisplay.itemTemplate',
      drawings: [
        {
          label: 'itemTemplate: { title }',
          children: [rows('ls-t', { itemTemplate: { title: '$record.name' } })],
        },
        {
          label: 'itemTemplate: { title, subtitle }',
          children: [
            rows('ls-ts', { itemTemplate: { title: '$record.name', subtitle: '$record.role' } }),
          ],
        },
        {
          label: 'itemTemplate: { …, badge }',
          children: [
            rows('ls-tsb', {
              itemTemplate: {
                title: '$record.name',
                subtitle: '$record.role',
                badge: '$record.status',
              },
            }),
          ],
        },
        {
          label: 'itemTemplate: { …, metadata }',
          children: [
            rows('ls-meta', {
              itemTemplate: {
                title: '$record.name',
                subtitle: '$record.role',
                metadata: [
                  { field: 'startsAt', format: 'relative-date' },
                  { field: 'status', format: 'badge' },
                ],
              },
            }),
          ],
        },
        {
          label: 'itemTemplate: { …, image }',
          children: [
            {
              type: 'code',
              props: { language: 'yaml' },
              content:
                'listDisplay:\n  itemTemplate:\n    image: $record.avatar\n    title: $record.name',
            } as PageComponent,
          ],
        },
      ],
    },
    {
      id: 'divider',
      title: 'Divider',
      configKey: 'listDisplay.divider',
      drawings: [
        {
          label: 'divider: true',
          children: [
            rows('ls-div-on', {
              itemTemplate: { title: '$record.name', subtitle: '$record.role' },
              divider: true,
            }),
          ],
        },
        {
          label: 'divider: false',
          children: [
            rows('ls-div-off', {
              itemTemplate: { title: '$record.name', subtitle: '$record.role' },
              divider: false,
            }),
          ],
        },
      ],
    },
    {
      id: 'paging',
      title: 'Paging',
      configKey: 'listDisplay.loadMore | maxItems | highlight',
      drawings: [
        {
          label: "loadMore: 'button'",
          children: [
            rows('ls-more-btn', { itemTemplate: { title: '$record.name' }, loadMore: 'button' }),
          ],
        },
      ],
    },
    {
      id: 'empty',
      title: 'Empty',
      configKey: 'listDisplay.emptyMessage',
      drawings: [
        {
          label: "emptyMessage: 'No clients yet. Import a CSV or add the first one.'",
          children: [
            {
              type: 'list',
              props: { id: 'ls-empty' },
              dataSource: {
                system: {
                  endpoint: SPECIMEN_ROWS_ENDPOINT,
                  rowsKey: 'items',
                  idKey: 'id',
                  totalKey: 'total',
                  query: { rows: '0' },
                },
              },
              listDisplay: {
                itemTemplate: { title: '$record.name' },
                emptyMessage: 'No clients yet. Import a CSV or add the first one.',
              },
            } as PageComponent,
          ],
        },
      ],
    },
  ],
}

export default list
