/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What selecting a node does: `navigate` follows the configured path filled
 * with the node's `$record.*` values, held to this site; `openDrawer` opens
 * the record in the named drawer — the two verbs a card click takes.
 */

import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'
import { cardPathClick, openCardDrawer } from '../runtime/card-click'
import type { TableRecord } from '../runtime/types'

export type TreeSelect =
  | { readonly type: 'navigate'; readonly path: string }
  | { readonly action: 'openDrawer'; readonly component: string }

export function selectTreeNode(
  onSelect: TreeSelect | undefined,
  record: TableRecord,
  table: string | undefined
): void {
  if (onSelect === undefined) return
  if ('action' in onSelect) {
    openCardDrawer(onSelect.component, record, table)
    return
  }
  cardPathClick(substituteRecordVars(onSelect.path, record))?.()
}
