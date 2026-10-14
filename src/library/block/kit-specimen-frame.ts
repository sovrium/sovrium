/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  param,
  PLACE_NOTE,
  stringParam,
  THEME_NOTE,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** One drawing of a component in its own bordered frame, under the config line that makes it. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'kit-specimen-frame',
  shadcnBlock: null,
  title: 'Specimen frame',
  category: 'console',
  tags: ['specimen', 'preview', 'example', 'component', 'design system'],
  description:
    'One component drawn at full width in a bordered frame, under the config line that produces it: the example panel a component library shows a reader.',
  notes: [
    'No shadcn counterpart: this is the frame shadcn/ui’s own documentation draws each component example in, made a block for a page that documents components.',
    'Replace the button inside the frame with the component you want to show, and set `label` to the line an author writes to get it (`variant: outline`). Leave `label` empty to draw the frame alone.',
    PLACE_NOTE,
    THEME_NOTE,
  ],
  params: [
    stringParam(
      'label',
      'The config line the drawing shows, in monospace. Empty to omit.',
      'variant: outline'
    ),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(name, {
      type: 'container',
      element: 'div',
      props: { className: 'flex flex-col gap-2' },
      children: [
        ...(p('label') === ''
          ? []
          : [
              {
                type: 'text',
                element: 'span',
                props: { className: 'font-mono text-xs text-muted-foreground' },
                content: p('label'),
              },
            ]),
        {
          type: 'container',
          element: 'div',
          props: {
            className:
              'flex flex-wrap items-start justify-center gap-4 rounded-lg border px-6 py-10 text-base',
          },
          children: [{ type: 'button', variant: 'outline', content: 'Button' }],
        },
      ],
    })
  },
})
