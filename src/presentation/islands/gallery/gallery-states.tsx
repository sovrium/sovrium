/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ReactElement } from 'react'

export function GalleryMissingTable(): ReactElement {
  return (
    <div className="border-warning-border bg-warning-bg text-warning-fg rounded border p-3 text-sm">
      Gallery is missing required <code>dataSource.table</code> configuration.
    </div>
  )
}

export function GalleryLoading(): ReactElement {
  return (
    <div
      className="grid w-full grid-cols-1 gap-4 p-2 sm:grid-cols-2 lg:grid-cols-3"
      aria-label="Loading gallery..."
      role="status"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={`gallery-loading-card-${String(i)}`}
          className="border-border bg-background-raised flex flex-col gap-2 rounded-lg border p-3 shadow-sm"
        >
          <div className="bg-background-subtle h-32 w-full animate-pulse rounded" />
          <div className="bg-background-subtle h-5 w-3/4 animate-pulse rounded" />
          <div className="bg-background-subtle h-4 w-1/2 animate-pulse rounded" />
        </div>
      ))}
    </div>
  )
}

export function GalleryError({ error }: { readonly error: unknown }): ReactElement {
  return (
    <div
      className="border-error-border bg-error-bg text-error-fg rounded border p-3 text-sm"
      role="alert"
    >
      Failed to load gallery records: {error instanceof Error ? error.message : String(error)}
    </div>
  )
}

export function GalleryEmpty({ message }: { readonly message: string | undefined }): ReactElement {
  return (
    <div
      className="border-border bg-background-subtle text-foreground-muted rounded border p-6 text-center text-sm"
      data-component="gallery"
      data-empty="true"
    >
      {message ?? 'No records found'}
    </div>
  )
}
