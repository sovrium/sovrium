/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { appRegion, span } from '@/library/manifest/app-block-kit'
import { asComponent, flex, PLACE_NOTE, stack } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

interface InlineAlert {
  readonly variant: 'info' | 'warning' | 'destructive'
  readonly title: string
  readonly description: string
  readonly actionLabel: string
  readonly actionHref: string
}

const alert = ({
  variant,
  title,
  description,
  actionLabel,
  actionHref,
}: InlineAlert): Readonly<Record<string, unknown>> => ({
  type: 'alert',
  alertVariant: variant,
  props: { className: 'w-full max-w-3xl' },
  children: [
    flex(
      [
        stack(
          [span(title, 'text-md font-semibold'), span(description, 'text-sm opacity-80')],
          'min-w-0 flex-1 gap-0.5'
        ),
        {
          type: 'link',
          props: {
            href: actionHref,
            className: 'text-sm font-medium underline underline-offset-4',
          },
          content: actionLabel,
        },
      ],
      'w-full items-start justify-between gap-4'
    ),
  ],
})

/** Three inline alerts, from a neutral notice to an error. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'alert-inline',
  title: 'Inline alerts',
  category: 'application',
  tags: ['alert', 'notice', 'warning', 'error', 'callout'],
  description:
    'Three inline alerts — information, warning and error — each with a title, one sentence of consequence and the action that resolves it.',
  notes: [
    PLACE_NOTE,
    'Each alert takes its tone from `alertVariant` (`info`, `warning`, `destructive`), painted by your theme. Keep the ones you need and delete the others in the installed fragment.',
    'Say what happened, what it means for the reader, and the one action that fixes it.',
  ],
  params: [],
  env: [],
  requires: [],
  build: ({ name }) =>
    asComponent(
      name,
      appRegion(
        [
          alert({
            variant: 'info',
            title: 'Your export is ready.',
            description: 'It stays available for 7 days.',
            actionLabel: 'Download',
            actionHref: '/exports',
          }),
          alert({
            variant: 'warning',
            title: 'Two invoices have no client email.',
            description: 'They will not receive reminders.',
            actionLabel: 'Review',
            actionHref: '/invoices',
          }),
          alert({
            variant: 'destructive',
            title: 'The bank sync failed.',
            description: 'The connection token expired on 11 Sep.',
            actionLabel: 'Reconnect',
            actionHref: '/settings',
          }),
        ],
        'flex flex-col gap-3'
      )
    ),
})
