/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { appRegion, para, span } from '@/library/manifest/app-block-kit'
import { asComponent, flex, PLACE_NOTE, stack, THEME_NOTE } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** A progress bar with what is running, how far it is, and what the reader may do meanwhile. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'progress-bar',
  title: 'Progress bar with a label',
  category: 'application',
  tags: ['progress', 'loading', 'import', 'status'],
  description:
    'A progress bar under the name of the task and its count, with one line on how long is left and whether the reader may leave.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'The values are static: set `progressValue` and `progressMax` from your data, for example with `$record.<field>` on a page bound to a record.',
  ],
  params: [],
  env: [],
  requires: [],
  build: ({ name }) =>
    asComponent(
      name,
      appRegion([
        stack(
          [
            flex(
              [
                span('Importing clients', 'text-md font-medium text-foreground'),
                span('312 / 480', 'font-mono text-sm text-foreground-subtle'),
              ],
              'items-center justify-between gap-4'
            ),
            {
              type: 'progress',
              progressVariant: 'bar',
              progressValue: 312,
              progressMax: 480,
              size: 'sm',
              props: { label: 'Importing clients' },
            },
            para(
              'About 2 minutes left. You can leave this page.',
              'text-sm text-foreground-subtle'
            ),
          ],
          'max-w-xl gap-2'
        ),
      ])
    ),
})
