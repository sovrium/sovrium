/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeBadgeClasses, type BadgeVariant } from '@/presentation/design/badge-default-classes'
import { cn } from '@/presentation/design/class-merge'

/** The tones a card badge's `badgeVariant` may name: the page badge's own. */
const BADGE_TONES: ReadonlySet<unknown> = new Set<BadgeVariant>([
  'default',
  'secondary',
  'destructive',
  'outline',
  'ghost',
  'link',
  'success',
  'warning',
  'info',
])

/**
 * One card child, a `badge` naming a tone or a class given `badgeClassName`:
 * the tone's recipe (secondary when it names none) with the author's class
 * merged over it, so the class wins a conflict as it does on a page badge.
 * Every other child, and a badge naming neither, is returned as it came.
 */
const resolveChild = (child: unknown): unknown => {
  if (typeof child !== 'object' || child === null) return child
  const entry = child as Readonly<Record<string, unknown>>
  if (entry['type'] !== 'badge') return child
  const tone = entry['badgeVariant']
  const variant = BADGE_TONES.has(tone) ? (tone as BadgeVariant) : undefined
  const className = (entry['props'] as { readonly className?: unknown } | undefined)?.className
  const author = typeof className === 'string' ? className : undefined
  if (variant === undefined && author === undefined) return child
  return {
    ...entry,
    badgeClassName: cn(computeBadgeClasses({ variant: variant ?? 'secondary' }), author),
  }
}

const resolveChildren = (children: unknown): unknown =>
  Array.isArray(children) ? children.map(resolveChild) : children

/**
 * A card template (a kanban `card`, a gallery `galleryCard`) with the classes of
 * each badge in its `children` and its `hoverOverlay.children` merged here, on
 * the server. The class merger stays out of the islands' payloads: the island
 * reads the merged string and draws it.
 *
 * @param card - The card template as the page config declares it, if any.
 */
export const resolveCardBadgeClasses = <T>(card: T): T => {
  if (typeof card !== 'object' || card === null) return card
  const template = card as Readonly<Record<string, unknown>>
  const overlay = template['hoverOverlay']
  return {
    ...template,
    ...(Array.isArray(template['children'])
      ? { children: resolveChildren(template['children']) }
      : {}),
    ...(typeof overlay === 'object' && overlay !== null && 'children' in overlay
      ? { hoverOverlay: { ...overlay, children: resolveChildren(overlay.children) } }
      : {}),
  } as T
}
