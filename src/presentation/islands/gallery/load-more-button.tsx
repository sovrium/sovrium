/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import { computeGalleryPagerClasses } from '@/presentation/design/gallery-default-classes'
import type { ReactElement } from 'react'

interface LoadMoreButtonProps {
  readonly onClick: () => void
}

/**
 * "Load More" button rendered below the gallery when
 * `dataSource.pagination.style === 'loadMore'` and the current visible slice
 * is smaller than the total available records.
 *
 * Both halves are recipes now. The footer is the gallery's pager chrome, which
 * a numbered pager would share; the control is the shared F1 secondary button,
 * so a gallery's "Load More" and a list's are the same control rather than two
 * hand-written approximations of one.
 */
export function LoadMoreButton({ onClick }: LoadMoreButtonProps): ReactElement {
  return (
    <div className={computeGalleryPagerClasses()}>
      <button
        type="button"
        onClick={onClick}
        className={computeButtonDefaultClasses({ variant: 'secondary', size: 'sm' })}
      >
        Load More
      </button>
    </div>
  )
}
