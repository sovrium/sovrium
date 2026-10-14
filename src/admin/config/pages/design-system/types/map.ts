/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `map` — one pin per record, at its place, with a list twin beside it.
//
// The specimen rows carry a `location`, so the console pins them without
// reading a record of yours. With no tile server named by the operator, the
// map draws its neutral grid under the pins and requests nothing.
//
// The resting drawing turns clustering off: thirty rows fitted into one frame
// would otherwise fold into a handful of count markers, and the page would show
// the cluster rather than the pin. The Clusters section draws both.

import { SPECIMEN_TABLE_NAME } from '../../../system-sources'
import type { PageComponent, TypePageBody } from './body-shape'

const ROWS = { table: SPECIMEN_TABLE_NAME }

/** The same map every time, with one key changed. */
const pins = (id: string, extra: Readonly<Record<string, unknown>> = {}) =>
  ({
    type: 'map' as const,
    props: { id },
    dataSource: ROWS,
    locationField: 'location',
    labelField: 'name',
    height: 360,
    ...extra,
  }) as PageComponent

const map: TypePageBody = {
  drawings: [
    {
      label: 'one pin per row',
      children: [pins('design-system-map-default', { cluster: false })],
    },
  ],
  options: [
    {
      id: 'cluster',
      title: 'Clusters',
      configKey: 'cluster',
      drawings: [
        { label: 'cluster: true', children: [pins('mp-cluster')] },
        { label: 'cluster: false', children: [pins('mp-no-cluster', { cluster: false })] },
      ],
    },
    {
      id: 'color',
      title: 'Pin colour',
      configKey: 'colorField',
      drawings: [
        { label: 'colorField: status', children: [pins('mp-color', { colorField: 'status' })] },
      ],
    },
  ],
}

export default map
