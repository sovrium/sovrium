/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ViewLoading, type ViewStrings } from '../parts/view-states'
import type { ReactElement } from 'react'

const LOADING_ATTRIBUTES = { 'data-timeline-state': 'loading' } as const

/**
 * The timeline's loading state. It draws no frame: the host's shell
 * (`TIMELINE_SHELL_CLASSES`) frames it — the same frame the records arrive
 * into, so the chrome never re-draws under them. The failure, missing-binding
 * and empty states are the shared view states, and the host's shell steps out
 * of the box around them: the neutral data-view frame would make a
 * misconfiguration look like a successfully-rendered timeline that happens to
 * be empty.
 */
export function TimelineLoading({ strings }: { readonly strings: ViewStrings }): ReactElement {
  return (
    <ViewLoading
      attributes={LOADING_ATTRIBUTES}
      label={strings?.['timeline.loading'] ?? 'Loading timeline...'}
    >
      <div className="bg-muted mb-3 h-4 w-40 animate-pulse rounded" />
      <div className="space-y-2">
        <div className="bg-muted h-6 w-3/4 animate-pulse rounded" />
        <div className="bg-muted h-6 w-1/2 animate-pulse rounded" />
        <div className="bg-muted h-6 w-2/3 animate-pulse rounded" />
      </div>
    </ViewLoading>
  )
}
