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

export function LoadMoreButton({ onClick }: LoadMoreButtonProps): ReactElement {
  return (
    <div className="flex w-full justify-center p-3">
      <button
        type="button"
        onClick={onClick}
        className="border-border bg-background-raised text-foreground hover:bg-background-subtle rounded-md border px-4 py-2 text-sm font-medium"
      >
        Load More
      </button>
    </div>
  )
}
