/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `drawer` — a panel that rises from the bottom edge, and is dragged away.
//
// The panel from a SIDE edge is `sheet` (`sheet.ts`). This one is shadcn's
// Drawer: rounded on the edge facing the page, a grip to drag it by, its header
// centred, its actions stacked at the bottom where a thumb reaches them.
//
// Never drawn OPEN live, for the reason every modal overlay is: it covers the
// page while it is open, so an open one would cover the kit. The first drawing
// is the real component shut — its trigger, and the drawer that trigger names,
// which stays closed until it is pressed. Each drawing after it is the panel at
// rest over the ground it would dim. See `overlay-panel.ts`.

import { box, line } from './overlay-panel'
import type { PageComponent, TypePageBody } from './body-shape'

const grip = (): PageComponent =>
  box('bg-muted mx-auto mt-4 h-1.5 w-[100px] shrink-0 rounded-full', [], 'drawer-handle')

const header = (title: string, description: string): PageComponent =>
  box(
    'flex flex-col gap-0.5 p-4 text-center',
    [
      line(title, 'text-foreground text-base font-medium', 'drawer-title'),
      line(description, 'text-muted-foreground text-sm', 'drawer-description'),
    ],
    'drawer-header'
  )

const footer = (): PageComponent =>
  box(
    'mt-auto flex flex-col gap-2 p-4',
    [
      { type: 'button', variant: 'default', label: 'Show 24 deals', props: { type: 'button' } },
      { type: 'button', variant: 'outline', label: 'Cancel', props: { type: 'button' } },
    ] as PageComponent[],
    'drawer-footer'
  )

/** The panel's `drawer-content`, pinned to one edge of a page-shaped frame. */
const atEdge = (side: 'bottom' | 'top', children: readonly PageComponent[]): PageComponent =>
  box(
    `bg-background relative flex h-80 w-full flex-col overflow-hidden rounded-lg border ${side === 'bottom' ? 'justify-end' : 'justify-start'}`,
    [
      box('absolute inset-0 bg-black/10', [], 'drawer-overlay'),
      box(
        `bg-background text-foreground relative flex flex-col text-sm ${side === 'bottom' ? 'rounded-t-xl border-t' : 'rounded-b-xl border-b'}`,
        children,
        'drawer-content'
      ),
    ]
  )

/** The id the live trigger names; nothing else on the page uses it. */
const LIVE_ID = 'design-system-kit-drawer'

/** The real component, shut: a trigger, and the drawer it opens. */
const live = (): readonly PageComponent[] => [
  {
    type: 'button',
    variant: 'outline',
    label: 'Filters',
    props: { type: 'button', interactions: { click: { modal: LIVE_ID } } },
  } as PageComponent,
  {
    type: 'drawer',
    props: { id: LIVE_ID },
    title: 'Filters',
    description: 'Narrow the list without leaving it.',
    children: [
      {
        type: 'text',
        element: 'p',
        content: 'Stage, owner and close date go here.',
      },
    ],
  } as PageComponent,
]

const drawer: TypePageBody = {
  drawings: [
    { label: 'closed', children: [box('flex flex-col items-start gap-1', live())] },
    {
      label: 'bottom',
      children: [
        atEdge('bottom', [
          grip(),
          header('Filters', 'Narrow the list without leaving it.'),
          footer(),
        ]),
      ],
    },
    {
      label: "side: 'top'",
      children: [
        atEdge('top', [
          header('Search', 'Type a name, a company or an email.'),
          box('mb-4 flex flex-col', [grip()]),
        ]),
      ],
    },
    {
      label: 'handle: false',
      children: [
        atEdge('bottom', [header('Filters', 'Narrow the list without leaving it.'), footer()]),
      ],
    },
  ],
}

export default drawer
