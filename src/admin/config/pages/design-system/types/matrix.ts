/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `matrix` — two sets of nodes crossed into a grid of glyphs.
//
// Drawn from the specimen graph: people down the side, projects across the
// top, and at each crossing the access that person has to that project. A
// crossing with no edge stays empty, which is the half of the drawing a table
// could not show.

import { SPECIMEN_GRAPH_ENDPOINT } from '../../../system-sources'
import type { PageComponent, TypePageBody } from './body-shape'

const BOUND = { system: { endpoint: SPECIMEN_GRAPH_ENDPOINT } }

/** The same grid every time, with the glyph changed. */
const grid = (id: string, glyph: 'quadrant' | 'filled' | 'ops-label') =>
  ({
    type: 'matrix' as const,
    props: { id },
    dataSource: BOUND,
    rows: { kinds: ['person'], groupBy: 'family' },
    columns: { kinds: ['project'] },
    cell: { from: 'edges', kind: 'access', glyph, opsField: 'ops' },
    label: 'Who can reach which project',
    emptyMessage: 'No access to draw.',
  }) as PageComponent

const matrix: TypePageBody = {
  drawings: [{ label: 'quadrant', children: [grid('design-system-matrix-default', 'quadrant')] }],
  options: [
    {
      id: 'glyph',
      title: 'Glyph',
      configKey: 'cell.glyph',
      drawings: [
        { label: 'glyph: quadrant', children: [grid('mx-quadrant', 'quadrant')] },
        { label: 'glyph: filled', children: [grid('mx-filled', 'filled')] },
        { label: 'glyph: ops-label', children: [grid('mx-ops', 'ops-label')] },
      ],
    },
  ],
}

export default matrix
