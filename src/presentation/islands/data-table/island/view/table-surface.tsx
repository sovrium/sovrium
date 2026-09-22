/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { BulkActionBar } from '../bulk-actions'
import { GridBody } from './grid-body'
import { FilterPanel, SortPanel } from './grid-panels'
import type { TableSurfaceProps } from '../view-props'

/**
 * Everything below the dialogs: the bulk-action bar, then the data region.
 *
 * One guard covers the whole data region, not one per element. The six sites
 * it replaced were already contiguous and already tested the same predicate,
 * so a single wrapper is exactly equivalent — and, unlike six copies, cannot
 * drift out of step with itself.
 */
export function TableSurface(props: TableSurfaceProps) {
  return (
    <>
      {props.bulkActionsConfig && props.bulkActionsConfig.length > 0 && (
        <BulkActionBar
          bulkActions={props.bulkActionsConfig}
          selectedCount={props.selectedCount}
          onExecute={props.onBulkExecute}
        />
      )}
      {!props.importDialogOpen && (
        <>
          {props.filterOverlayOpen && <FilterPanel {...props.panels} />}
          {props.sortOverlayOpen && <SortPanel {...props.panels} />}
          <GridBody {...props.body} />
        </>
      )}
    </>
  )
}
