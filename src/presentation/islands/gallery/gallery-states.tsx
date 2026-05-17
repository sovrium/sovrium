/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ReactElement } from 'react'

export function GalleryMissingTable(): ReactElement {
  return (
    <div className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
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
          className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
        >
          <div className="h-32 w-full animate-pulse rounded bg-gray-200" />
          <div className="h-5 w-3/4 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
        </div>
      ))}
    </div>
  )
}

export function GalleryError({ error }: { readonly error: unknown }): ReactElement {
  return (
    <div
      className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800"
      role="alert"
    >
      Failed to load gallery records: {error instanceof Error ? error.message : String(error)}
    </div>
  )
}

export function GalleryEmpty({ message }: { readonly message: string | undefined }): ReactElement {
  return (
    <div
      className="rounded border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500"
      data-component="gallery"
      data-empty="true"
    >
      {message ?? 'No records found'}
    </div>
  )
}
