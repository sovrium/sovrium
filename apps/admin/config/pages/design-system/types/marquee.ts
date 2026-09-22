/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `marquee` — a band that never settles.
//
// It drew as a blank box for as long as it was on the derived path, and the
// reason is worth writing down: the derived drawing gives the type ONE short
// span, and a marquee duplicates its child group and translates the track by
// half its width. One narrow span makes a track barely wider than a word, so
// whatever is on it spends most of the cycle outside the band — motion with
// nothing to see, which is the worst reading a component can get.
//
// So every drawing here hands it a GROUP wide enough to fill the band, and the
// band is given a height and a ground of its own. The direction drawing is the
// one that needs two: `up` is only legible against something that is going the
// other way.

import type { PageComponent, TypePageBody } from './_shape'

/** One chip of the band, sized so the track is wider than the frame. */
const chip = (label: string): PageComponent =>
  ({
    type: 'text',
    element: 'span',
    props: {
      className:
        'border-border text-foreground-subtle shrink-0 rounded-full border px-3 py-1 text-[11px] whitespace-nowrap',
    },
    content: label,
  }) as PageComponent

/** The band's cargo — eight chips, which is more than one frame holds. */
const CARGO: readonly string[] = [
  'one config file',
  'tables',
  'pages',
  'automations',
  'permissions',
  'your own infrastructure',
  'one binary',
  'no build step',
]

/** The marquee itself, with one key changed. */
const band = (extra: Record<string, unknown>): PageComponent =>
  ({
    type: 'marquee',
    marqueeGap: '1rem',
    pauseOnHover: true,
    props: {
      className: 'border-border bg-background-subtle w-full rounded-md border py-3',
    },
    children: CARGO.map(chip),
    ...extra,
  }) as PageComponent

const marquee: TypePageBody = {
  drawings: [
    {
      label: 'left',
      children: [band({ marqueeDirection: 'left' })],
    },
    {
      label: 'right',
      children: [band({ marqueeDirection: 'right' })],
    },
    {
      label: 'up',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'h-40 w-full' },
          children: [
            {
              type: 'marquee',
              marqueeDirection: 'up',
              marqueeGap: '0.75rem',
              pauseOnHover: true,
              props: {
                className:
                  'border-border bg-background-subtle flex h-40 flex-col rounded-md border px-3 py-2',
              },
              children: CARGO.slice(0, 5).map(chip),
            } as PageComponent,
          ],
        } as PageComponent,
      ],
    },
  ],
}

export default marquee
