/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { lazy, Suspense } from 'react'
import type { ProjectedEntry } from './sidebar-entry-projection'

/**
 * A Lucide icon a row named, loaded only by a sidebar whose rows name one: a
 * group of emoji, or of no icon at all, never pays for the icon renderer.
 */
const FetchedLucideIcon = lazy(() => import('./sidebar-fetched-lucide-icon'))

/**
 * The icon before a fetched entry's label: an emoji as text, or a Lucide icon.
 * Hidden from assistive technology, so the entry's name stays its label.
 */
export function FetchedEntryIcon({ icon }: { readonly icon: ProjectedEntry['icon'] }) {
  if (icon === undefined) return undefined
  if ('emoji' in icon) return <span aria-hidden="true">{icon.emoji}</span>
  return (
    <Suspense fallback={undefined}>
      <FetchedLucideIcon name={icon.lucide} />
    </Suspense>
  )
}
