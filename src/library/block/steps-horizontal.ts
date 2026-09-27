/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { appRegion } from '@/library/manifest/app-block-kit'
import { asComponent, PLACE_NOTE, THEME_NOTE } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

const STEP_RAIL =
  'max-w-3xl [&_ol]:m-0 [&_ol]:flex [&_ol]:w-full [&_ol]:list-none [&_ol]:gap-2 [&_ol]:p-0 [&_li]:flex-1 [&_li]:border-t-2 [&_li]:border-border [&_li]:pt-3 [&_li]:text-sm [&_li]:text-foreground-subtle [&_li:has(~li[aria-current])]:border-foreground [&_li:has(~li[aria-current])]:text-foreground-muted [&_li[aria-current]]:border-foreground [&_li[aria-current]]:font-medium [&_li[aria-current]]:text-foreground'

/** How far a known task has run, and what is left, as named steps. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'steps-horizontal',
  title: 'Steps',
  category: 'application',
  tags: ['steps', 'progress', 'wizard', 'stepper'],
  description:
    'A rail of named steps with the current one marked, for a task done in a known order such as a form in several parts.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    '`progressValue` is the 1-based current step: `3` of four marks the third. Edit `steps` to name your own.',
  ],
  params: [],
  env: [],
  requires: [],
  build: ({ name }) =>
    asComponent(
      name,
      appRegion([
        {
          // The step rail ships unstyled outside a multi-step form, so the
          // rail is drawn here from its own markup: one rule per step, solid
          // up to and including the current one.
          type: 'container',
          props: { className: STEP_RAIL },
          children: [
            {
              type: 'progress',
              progressVariant: 'steps',
              steps: ['Client', 'Items', 'Review', 'Send'],
              progressValue: 3,
              props: { label: 'Invoice progress' },
            },
          ],
        },
      ])
    ),
})
