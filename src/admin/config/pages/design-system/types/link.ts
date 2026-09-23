/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `link` — navigation inside a run of text, and the same link carrying a glyph.
//
// The type declares no variant union: a link is a link. Both drawings are the
// real component, and what differs is the CONTEXT — the first sits in a
// sentence, because a link's whole design question is whether it reads as part
// of the prose, and the second carries an icon beside it.

import type { TypePageBody } from './body-shape'

const link: TypePageBody = {
  drawings: [
    {
      label: 'inline',
      children: [
        {
          type: 'text',
          element: 'p',
          props: { className: 'text-foreground max-w-xl text-md leading-relaxed' },
          children: [
            {
              type: 'text',
              element: 'span',
              content: 'Every page this app serves is declared in one file. ',
            },
            {
              type: 'link',
              props: { href: '/design-system/foundations' },
              content: 'Read the foundations',
            },
            { type: 'text', element: 'span', content: ' to see what it inherits.' },
          ],
        },
      ],
    },
    {
      label: 'with icon',
      children: [
        {
          type: 'link',
          props: { href: '/design-system/ui-kit', className: 'inline-flex items-center gap-1.5' },
          children: [
            { type: 'text', element: 'span', content: 'Open the UI kit' },
            // The glyph is named in `props`, not as a field: `icon` declares only the
            // core and visibility modules, so `name` at the top level is refused
            // at decode.
            { type: 'icon', props: { name: 'arrow-right', size: 14 } },
          ],
        },
      ],
    },
  ],
}

export default link
