/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `graph` — nodes in ordered columns, and the edges that join them.
//
// Drawn from the platform's own specimen graph: the specimen people, the three
// teams they belong to and the projects those teams own. It belongs to nobody,
// which is what lets the console draw it at all — the only other graph this
// instance holds is your own access map.

import { SPECIMEN_GRAPH_ENDPOINT } from '../../../system-sources'
import type { PageComponent, TypePageBody } from './body-shape'

const BOUND = { system: { endpoint: SPECIMEN_GRAPH_ENDPOINT } }

const COLUMNS = [
  { kinds: ['person'], label: 'People', groupBy: 'family' },
  { kinds: ['team'], label: 'Teams', sortBy: 'level', sortDirection: 'desc' },
  { kinds: ['project'], label: 'Projects' },
]

/** The same layered graph every time, with one key changed. */
const layered = (id: string, extra: Readonly<Record<string, unknown>> = {}) =>
  ({
    type: 'graph' as const,
    props: { id },
    layout: 'layered',
    dataSource: BOUND,
    columns: COLUMNS,
    label: 'Who works on what',
    emptyMessage: 'No specimen graph to draw.',
    ...extra,
  }) as PageComponent

const graph: TypePageBody = {
  drawings: [
    {
      label: 'layered',
      children: [
        layered('design-system-graph-default', { selection: { mode: 'single', reach: 'both' } }),
      ],
    },
  ],
  options: [
    {
      id: 'selection',
      title: 'Selection',
      configKey: 'selection',
      drawings: [
        { label: 'selection: absent', children: [layered('gr-sel-none')] },
        {
          label: 'selection: { mode: single, reach: both }',
          children: [layered('gr-sel-both', { selection: { mode: 'single', reach: 'both' } })],
        },
      ],
    },
    {
      id: 'legend',
      title: 'Legend',
      configKey: 'legend',
      drawings: [{ label: 'legend: true', children: [layered('gr-legend', { legend: true })] }],
    },
  ],
}

export default graph
