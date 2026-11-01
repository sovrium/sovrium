/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  LIST_SKELETON_CLASSES,
  computeListShellClasses,
} from '@/presentation/design/list-default-classes'
import { ViewError, ViewLoading, ViewMissing, type ViewStrings } from '../parts/view-states'
import type { ReactElement } from 'react'

/**
 * Loading skeleton — VISIBLE pulse rows so the host has a non-zero box while the
 * fetch is in flight. Rows are `<div>` (not `<li>`) so `#id li` stays zero until
 * the real itemTemplate items render.
 *
 * The container carries the SHELL chrome the loaded `<ul>` will carry, so the
 * bordered surface is already drawn while the fetch is in flight and the box
 * does not appear from nothing when the records land.
 */
export function ListLoading({ strings }: { readonly strings: ViewStrings }): ReactElement {
  return (
    <ViewLoading
      className={`${computeListShellClasses()} gap-2 p-2`}
      label={strings?.['list.loading'] ?? 'Loading list...'}
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={`list-loading-row-${String(i)}`}
          data-slot="skeleton"
          className={LIST_SKELETON_CLASSES}
        />
      ))}
    </ViewLoading>
  )
}

/** The list's English for the shared view states. */
const LIST_WORDS = {
  'list.loadFailed': 'Failed to load list items: {error}',
  'list.missing': 'List is missing required {setting} configuration.',
} as const

/** A list bound to no table and no system read. */
export function ListMissing({ strings }: { readonly strings: ViewStrings }): ReactElement {
  return (
    <ViewMissing
      sentence="list.missing"
      setting="dataSource"
      words={LIST_WORDS}
      strings={strings}
    />
  )
}

/** The list's failed read: a spent budget offers a Retry, anything else says why. */
export function ListFailure({
  error,
  onRetry,
  strings,
}: {
  readonly error: unknown
  readonly onRetry: () => void
  readonly strings: ViewStrings
}): ReactElement {
  return (
    <ViewError
      of="list"
      words={LIST_WORDS}
      hint={false}
      error={error}
      onRetry={onRetry}
      strings={strings}
    />
  )
}
