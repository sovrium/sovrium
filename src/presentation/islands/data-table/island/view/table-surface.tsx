/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { HiddenBulkActionsPlaceholder } from '../bulk-actions'
import { GridBody } from './grid-body'
import type { TableSurfaceProps } from '../view-props'

/**
 * Everything below the banners: the rows and the bars that frame them. The
 * selection is no longer a band above the header row — it takes the bottom
 * bar's left half once rows are checked (`GridBody`).
 */
export function TableSurface(props: TableSurfaceProps) {
  return (
    <>
      {props.bulkActionsConfig !== undefined &&
        (props.body.selection?.selectedCount ?? 0) === 0 && (
          <HiddenBulkActionsPlaceholder bulkActions={props.bulkActionsConfig} />
        )}
      <GridBody {...props.body} />
    </>
  )
}
