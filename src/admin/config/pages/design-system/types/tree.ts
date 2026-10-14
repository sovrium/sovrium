/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `tree` — the records of one table nested by their parent.
//
// The specimen rows carry a `parentId`, three levels deep and free of loops,
// so the console nests them without reading a record of yours.

import { SPECIMEN_TABLE_NAME } from '../../../system-sources'
import type { PageComponent, TypePageBody } from './body-shape'

const ROWS = { table: SPECIMEN_TABLE_NAME }

/** The same tree every time, with one key changed. */
const nested = (id: string, extra: Readonly<Record<string, unknown>> = {}) =>
  ({
    type: 'tree' as const,
    props: { id },
    dataSource: ROWS,
    parentField: 'parentId',
    labelField: 'name',
    sortBy: { field: 'name' },
    emptyMessage: 'No specimen rows to nest.',
    ...extra,
  }) as PageComponent

const tree: TypePageBody = {
  drawings: [{ label: 'default', children: [nested('design-system-tree-default')] }],
  options: [
    {
      id: 'expanded',
      title: 'Open levels',
      configKey: 'expanded',
      drawings: [
        { label: 'expanded: 1', children: [nested('tr-exp-1')] },
        { label: 'expanded: 2', children: [nested('tr-exp-2', { expanded: 2 })] },
      ],
    },
    {
      id: 'search',
      title: 'Search',
      configKey: 'search',
      drawings: [{ label: 'search: false', children: [nested('tr-no-search', { search: false })] }],
    },
  ],
}

export default tree
