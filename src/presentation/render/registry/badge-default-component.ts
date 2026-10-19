/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeBadgeClasses, type BadgeVariant } from '../../design/feedback-default-classes'
import * as Renderers from '../elements'
import { convertBadgeProps } from './component-registry-helpers'
import { mergePrestyle } from './interactive-prestyle-builders'
import { bindSessionContent } from './text-components'
import type { ComponentRenderer } from './component-dispatch-config'

const BADGE_VARIANTS = new Set<BadgeVariant>([
  'default',
  'secondary',
  'destructive',
  'outline',
  'ghost',
  'link',
])

/** The tone a badge's `badgeVariant` names; base-nova's `default` when unset or unknown. */
function resolveBadgeVariant(componentRaw: Record<string, unknown>): BadgeVariant {
  const rawVariant = componentRaw['badgeVariant']
  return BADGE_VARIANTS.has(rawVariant as BadgeVariant) ? (rawVariant as BadgeVariant) : 'default'
}

export /**
 * The default `badge`: shadcn/ui's badge, its tone named by `badgeVariant` and
 * stamped as `data-variant`, a link when it carries an `href`.
 */
function defaultBadge(
  context: Parameters<ComponentRenderer>[0],
  c: Record<string, unknown>,
  authorClassName: string | undefined
): ReturnType<ComponentRenderer> {
  const { elementProps, content, renderedChildren, interactions } = context
  // Default mode: shadcn/ui's badge, its tone named by `badgeVariant` and
  // stamped as `data-variant`; the author's className beats the recipe.
  const badgeVariant = resolveBadgeVariant(c)
  const badgeProps = convertBadgeProps({
    ...elementProps,
    className: mergePrestyle(computeBadgeClasses({ variant: badgeVariant }), authorClassName),
    'data-slot': 'badge',
    'data-variant': badgeVariant,
  })

  // A `$session.<field>` in the content is filled from the caller's own session.
  const bound = bindSessionContent(badgeProps, content)
  // With an `href` the badge IS the link (shadcn's `render={<a />}`).
  if (typeof c['href'] === 'string') {
    return Renderers.renderLink(
      { ...bound.props, href: c['href'] },
      bound.content,
      renderedChildren
    )
  }
  return Renderers.renderHTMLElement({
    type: 'span',
    props: bound.props,
    content: bound.content,
    children: renderedChildren,
    interactions: interactions,
  })
}
