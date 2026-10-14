/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `collapsible` — one region a reader can show and hide.
//
// One trigger, one region: an accordion is several of these that close each
// other, and this type is the single one that does not. `hydrate` is the choice
// worth seeing: without it the region is the browser's own details element and
// ships no script; with it the trigger is a button that reports its state
// through ARIA, which is what a region whose contents change needs.

import type { PageComponent, TypePageBody } from './body-shape'

const region = (): readonly PageComponent[] => [
  {
    type: 'container',
    element: 'div',
    props: { className: 'text-muted-foreground flex flex-col gap-1 pt-2 text-sm' },
    children: [
      { type: 'text', element: 'p', content: 'Retries: 3, one minute apart.' },
      { type: 'text', element: 'p', content: 'Timeout: 30 seconds.' },
    ],
  },
]

const block = (extra: Readonly<Record<string, unknown>>): PageComponent =>
  ({
    type: 'collapsible',
    triggerLabel: 'Show advanced settings',
    props: { className: 'w-80' },
    children: region(),
    ...extra,
  }) as PageComponent

const collapsible: TypePageBody = {
  drawings: [
    { label: 'closed', children: [block({})] },
    { label: 'defaultOpen: true', children: [block({ defaultOpen: true })] },
    { label: 'hydrate: true', children: [block({ hydrate: true, defaultOpen: true })] },
  ],
}

export default collapsible
