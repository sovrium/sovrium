/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { appRegion } from '@/library/manifest/app-block-kit'
import { asComponent, PLACE_NOTE, THEME_NOTE } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

const STEPS = ['Client', 'Items', 'Review', 'Send'] as const

/** The 1-based step the reader is on. */
const CURRENT = 3

/** One step of the rail: a rule above its name, solid up to and including the current one. */
const step = (label: string, index: number): Readonly<Record<string, unknown>> => {
  const position = index + 1
  const tone =
    position === CURRENT
      ? 'border-foreground font-medium text-foreground'
      : position < CURRENT
        ? 'border-foreground text-foreground-muted'
        : 'border-border text-foreground-subtle'
  return {
    type: 'container',
    props: {
      role: 'listitem',
      ...(position === CURRENT ? { 'aria-current': 'step' } : {}),
      className: `flex-1 border-t-2 pt-3 text-sm ${tone}`,
    },
    children: [{ type: 'text', element: 'span', content: label }],
  }
}

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
    'The third of four steps is marked current. Rename the steps in your copy, and move `aria-current` and the solid rule to the step the reader is on.',
  ],
  params: [],
  env: [],
  requires: [],
  build: ({ name }) =>
    asComponent(
      name,
      appRegion([
        {
          // A list of named positions, the current one marked, drawn from plain
          // containers so every rule is the block's own class.
          type: 'container',
          element: 'nav',
          props: { 'aria-label': 'Invoice progress', className: 'max-w-3xl' },
          children: [
            {
              type: 'flex',
              props: { role: 'list', className: 'flex w-full gap-2' },
              children: STEPS.map(step),
            },
          ],
        },
      ])
    ),
})
