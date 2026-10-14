/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `scroll-area` — a region that scrolls inside the page.
//
// The real component, holding more than it can show: twelve entries of an
// activity log behind a 12rem height, so the thin scrollbar it draws is there
// to be seen and used. A scroll area with too little in it draws nothing but
// its content, which is why the drawing fills it rather than describing it.

import { box, line } from './overlay-panel'
import type { PageComponent, TypePageBody } from './body-shape'

const ENTRIES: readonly (readonly [string, string])[] = [
  ['09:02', 'Léa Fontaine opened the deal Rénovation atelier'],
  ['09:14', 'Stage moved from Qualified to Proposal'],
  ['09:31', 'Quote Q-2318 attached'],
  ['10:05', 'Marc Dubois added a note'],
  ['10:47', 'Close date set to 28 November'],
  ['11:20', 'Owner changed to Léa Fontaine'],
  ['13:08', 'Call logged, 14 minutes'],
  ['13:55', 'Quote Q-2318 sent to the client'],
  ['14:30', 'Discount of 5 % approved'],
  ['15:12', 'Stage moved from Proposal to Negotiation'],
  ['16:40', 'Reminder set for Monday'],
  ['17:03', 'Deal starred by Marc Dubois'],
]

const entry = ([time, text]: readonly [string, string]): PageComponent =>
  box('flex gap-3 border-b py-2 text-sm last:border-b-0', [
    line(time, 'text-muted-foreground font-mono tabular-nums', undefined, 'span'),
    line(text, 'text-foreground', undefined, 'span'),
  ])

/** The real component, sized below its content so it scrolls. */
const live = {
  type: 'scroll-area',
  scrollAreaHeight: '12rem',
  scrollOrientation: 'vertical',
  props: { className: 'w-full max-w-md rounded-md border' },
  children: [box('px-4', ENTRIES.map(entry))],
} as PageComponent

const scrollArea: TypePageBody = {
  drawings: [{ label: 'default', children: [live] }],
}

export default scrollArea
