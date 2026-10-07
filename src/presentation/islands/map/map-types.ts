/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** The shapes the map island's modules share. */

import type { LatLng } from './map-projection'
import type { TableRecord } from '../runtime/types'

/** One record as the map holds it: its name, its place (if any) and its pin colour. */
export interface MapItem {
  readonly id: string
  readonly label: string
  readonly at?: LatLng
  readonly color?: string
  readonly record: TableRecord
}

export type PinClick =
  | { readonly type: 'navigate'; readonly path: string }
  | { readonly action: 'openDrawer'; readonly component: string }
