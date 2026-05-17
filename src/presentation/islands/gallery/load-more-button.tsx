/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ReactElement } from 'react'

interface LoadMoreButtonProps {
  readonly onClick: () => void
}

/**
 * "Load More" button rendered below the gallery when
 * `dataSource.pagination.style === 'loadMore'` and the current visible slice
 * is smaller than the total available records.
 */
export function LoadMoreButton({ onClick }: LoadMoreButtonProps): ReactElement {
  return (
    <div className="flex w-full justify-center p-3">
      <button
        type="button"
        onClick={onClick}
        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Load More
      </button>
    </div>
  )
}
