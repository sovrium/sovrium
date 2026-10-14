/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `hover-card` — what a name expands into when a pointer rests on it.
//
// Renders its trigger: the first drawing is the real component, whose card a
// pointer resting on the name opens, and the second composes that card open. It differs from a popover in what
// opens it and therefore in what it may hold: nobody clicked, so nothing in here
// may be the only way to reach something. base-nova draws it as the popover's
// ringed card, narrower, with no arrow.

import { box, floatingPanel, line } from './overlay-panel'
import type { PageComponent, TypePageBody } from './body-shape'

const name = (): PageComponent =>
  ({
    type: 'link',
    props: { href: '/design-system/ui-kit/avatar' },
    content: 'Léa Fontaine',
  }) as PageComponent

const summary = (): PageComponent =>
  box('flex items-center gap-3', [
    { type: 'avatar', initials: 'LF', label: 'Léa Fontaine' } as PageComponent,
    box('flex flex-col', [
      line('Léa Fontaine', 'text-foreground text-sm font-medium', undefined, 'span'),
      line('Owner · 14 open deals', 'text-muted-foreground text-xs', undefined, 'span'),
    ]),
  ])

/** The real component: its first child is the trigger, the rest is the card. */
const live = {
  type: 'hover-card',
  floatingSide: 'bottom',
  floatingAlign: 'start',
  children: [name(), summary()],
} as PageComponent

const hoverCard: TypePageBody = {
  drawings: [
    { label: 'closed', children: [live] },
    {
      label: 'open',
      children: [
        box('flex flex-col items-start gap-1', [name(), floatingPanel('hover-card', [summary()])]),
      ],
    },
  ],
}

export default hoverCard
