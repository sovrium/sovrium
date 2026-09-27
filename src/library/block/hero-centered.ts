/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  actions,
  asComponent,
  eyebrow,
  h1,
  lead,
  linkButton,
  section,
  small,
  stack,
  str,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** A centered hero: headline, supporting line and one call to action. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'hero-centered',
  title: 'Centered hero with a call to action',
  category: 'marketing',
  tags: ['hero', 'landing', 'header', 'call to action'],
  description:
    'A centered opening section: a short label, a headline, one supporting sentence, a primary and a secondary action, and a reassurance line.',
  notes: [
    'The block is a reusable component. Place it on a page with `component: <name>` under the page `components` list, as many times as you need.',
    'Colours come from the theme tokens, so the block follows your `theme` without edits. The primary action uses `--color-primary`.',
    'Set `eyebrow`, `secondaryLabel` or `reassurance` to an empty string to drop that element.',
  ],
  params: [
    {
      name: 'eyebrow',
      description: 'A short label above the headline — a category or a release note.',
      type: 'string',
      default: '[Eyebrow — category or release note]',
    },
    {
      name: 'headline',
      description: 'The main heading, rendered as the page h1.',
      type: 'string',
      default: 'State the offer in one sentence the visitor can repeat',
    },
    {
      name: 'subheadline',
      description: 'One sentence under the headline.',
      type: 'string',
      default:
        'A second line names who it is for and what changes for them once they start. No adjectives it cannot prove.',
    },
    {
      name: 'ctaLabel',
      description: 'The text of the primary call-to-action link.',
      type: 'string',
      default: '[Primary action]',
    },
    {
      name: 'ctaHref',
      description: 'Where the primary call-to-action link points.',
      type: 'string',
      default: '/contact',
    },
    {
      name: 'secondaryLabel',
      description: 'The text of the secondary link.',
      type: 'string',
      default: '[Secondary action]',
    },
    {
      name: 'secondaryHref',
      description: 'Where the secondary link points.',
      type: 'string',
      default: '/about',
    },
    {
      name: 'reassurance',
      description: 'A small line under the actions — what the visitor does not need to start.',
      type: 'string',
      default: '[Reassurance line — what the visitor does not need to start]',
    },
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = (key: string): string => str(params, key)
    return asComponent(
      name,
      section([
        stack(
          [
            ...(p('eyebrow') === '' ? [] : [eyebrow(p('eyebrow'))]),
            h1(p('headline')),
            lead(p('subheadline'), 'max-w-2xl'),
            actions(
              [
                linkButton(p('ctaLabel'), p('ctaHref'), 'primary', 'lg'),
                ...(p('secondaryLabel') === ''
                  ? []
                  : [linkButton(p('secondaryLabel'), p('secondaryHref'), 'secondary', 'lg')]),
              ],
              'mt-2 w-full sm:w-auto sm:justify-center'
            ),
            ...(p('reassurance') === '' ? [] : [small(p('reassurance'), 'mt-2')]),
          ],
          'mx-auto max-w-3xl items-center gap-6 text-center'
        ),
      ])
    )
  },
})
