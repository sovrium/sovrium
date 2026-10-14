/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `tooltip` — a word that appears beside a control, drawn on both sides.
//
// The component renders, but what it renders at rest is its TRIGGER: the bubble
// exists only while a pointer is on it. So the first drawing is the real
// component, whose bubble a pointer on the trigger opens, and the two after it
// compose the bubble in the position `floatingSide` would put it — the one axis
// a reader is choosing between.
//
// base-nova draws the inverse of every other overlay: a small chip in the
// `foreground` colour with `background` text, and — alone among them — an
// arrow, a rotated square pointing at the trigger. shadcn gives the arrow no
// `data-slot`, so the drawing gives it none either.

import { box, line } from './overlay-panel'
import type { PageComponent, TypePageBody } from './body-shape'

const bubble = (text: string, side: 'top' | 'bottom'): PageComponent =>
  box(
    'bg-foreground text-background relative inline-flex w-fit max-w-xs items-center rounded-md px-3 py-1.5 text-xs',
    [
      line(text, '', undefined, 'span'),
      box(
        `bg-foreground absolute left-1/2 size-2.5 -translate-x-1/2 rotate-45 rounded-[2px] ${side === 'top' ? '-bottom-1' : '-top-1'}`,
        []
      ),
    ],
    'tooltip-content'
  )

const trigger = (): PageComponent =>
  ({
    type: 'button',
    variant: 'outline',
    label: 'Revoke',
    props: { type: 'button' },
  }) as PageComponent

/**
 * The real component: at rest it is its trigger, its first child. The trigger
 * is a word rather than a `button`, because the tooltip draws its own trigger
 * as a button around the child, and a button inside a button is invalid HTML.
 */
const live = {
  type: 'tooltip',
  tooltipContent: 'Tuesday 17 November, 18:00',
  floatingSide: 'top',
  children: [
    line(
      'Expires in 3 days',
      'text-foreground text-sm underline decoration-dotted underline-offset-4',
      undefined,
      'span'
    ),
  ],
} as PageComponent

const tooltip: TypePageBody = {
  drawings: [
    { label: 'closed', children: [live] },
    {
      label: 'top',
      children: [
        box('flex flex-col items-center gap-2.5', [
          bubble('Stops the link working immediately', 'top'),
          trigger(),
        ]),
      ],
    },
    {
      label: 'bottom',
      children: [
        box('flex flex-col items-center gap-2.5', [
          trigger(),
          bubble('Stops the link working immediately', 'bottom'),
        ]),
      ],
    },
  ],
}

export default tooltip
