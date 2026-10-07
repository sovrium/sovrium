/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The list island's chrome for what it shows INSTEAD of its rows: a missing
 * binding, the fetch in flight, or its failure.
 */

import { computeListShellClasses } from '@/presentation/design/list-default-classes'
import { isRateLimitedRead, RateLimitedNotice } from '../runtime/read-failure'
import type { ReactElement } from 'react'

/** The loading, failure and rate-limit chrome in the page language. */
export type ListStrings = Readonly<Record<string, string>> | undefined

/** Missing-binding fallback — neither `table` nor `system` configured. */
export function ListMissing(): ReactElement {
  return (
    <div className="border-warning-border bg-warning-bg text-warning-fg text-md rounded border p-3">
      List is missing required <code>dataSource</code> configuration.
    </div>
  )
}

/**
 * Loading skeleton — VISIBLE pulse rows so the host has a non-zero box while the
 * fetch is in flight. Rows are `<div>` (not `<li>`) so `#id li` stays zero until
 * the real itemTemplate items render.
 *
 * The container carries the SHELL chrome the loaded `<ul>` will carry, so the
 * bordered surface is already drawn while the fetch is in flight and the box
 * does not appear from nothing when the records land.
 */
export function ListLoading({ strings }: { readonly strings: ListStrings }): ReactElement {
  return (
    <div
      role="status"
      aria-label={strings?.['list.loading'] ?? 'Loading list...'}
      className={`${computeListShellClasses()} space-y-2 p-2`}
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={`list-loading-row-${String(i)}`}
          className="bg-background-subtle h-6 w-full animate-pulse rounded"
        />
      ))}
    </div>
  )
}

/** A rate-limited read offers a Retry; any other failure says what went wrong. */
export function ListError({
  error,
  onRetry,
  strings,
}: {
  readonly error: unknown
  readonly onRetry: () => void
  readonly strings: ListStrings
}): ReactElement {
  if (isRateLimitedRead(error))
    return (
      <RateLimitedNotice
        onRetry={onRetry}
        strings={strings}
      />
    )
  const template = strings?.['list.loadFailed'] ?? 'Failed to load list items: {error}'
  return (
    <p
      className="border-error-border bg-error-bg text-error-fg text-md rounded border p-3"
      role="alert"
    >
      {template.replace('{error}', () => (error instanceof Error ? error.message : String(error)))}
    </p>
  )
}
