/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { cn } from '@/presentation/design/class-merge'
import { resolveLucideIcon } from '@/presentation/render/elements/lucide-resolver'
import type { PartClassMap } from '@/domain/models/app/design/component-parts'

/**
 * Decorative leading icon for a nav section, driven by config. The icon name
 * comes from the group's resolved `groupIcon` (`nav.groupIcons[group]`, surfaced
 * by the content-dir lister). Returns undefined when the section has no
 * configured icon or the name does not resolve to a real Lucide icon, so the
 * label renders on its own. Always `aria-hidden` (the label carries meaning).
 */
export const renderSectionIcon = (
  iconName: string | undefined
): Readonly<ReactElement> | undefined => {
  const LucideIcon = resolveLucideIcon(iconName)
  if (!LucideIcon) return undefined
  return (
    <LucideIcon
      aria-hidden="true"
      size={16}
      color="currentColor"
      strokeWidth={2}
      className="shrink-0"
    />
  )
}

/**
 * The disclosure chevron closing a folding group's summary: the lucide
 * `chevron-down`, a quarter turn back (pointing right) while the group is
 * closed and as drawn (pointing down) once it opens, the turn animated. The
 * `navGroupChevron` part restyles it. Decorative: the `<details>` states its
 * own open state to assistive technology.
 */
export const renderGroupChevron = (
  parts: PartClassMap | undefined
): Readonly<ReactElement> | undefined => {
  const Chevron = resolveLucideIcon('chevron-down')
  if (!Chevron) return undefined
  return (
    <Chevron
      aria-hidden="true"
      size={16}
      color="currentColor"
      strokeWidth={2}
      className={cn(
        'text-foreground-subtle ml-2 size-4 shrink-0 -rotate-90 transition-transform duration-150 group-open/nav-group:rotate-0',
        parts?.['navGroupChevron']
      )}
    />
  )
}
