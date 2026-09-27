/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { appRegion } from '@/library/manifest/app-block-kit'
import { asComponent, param, PLACE_NOTE, stringParam } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** A short confirmation that leaves on its own, raised by an action. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'toast-confirm',
  title: 'Confirmation toast',
  category: 'application',
  tags: ['toast', 'notification', 'confirmation', 'feedback'],
  description:
    'A button whose action raises a success toast in the corner — one line saying what happened, gone after five seconds.',
  notes: [
    PLACE_NOTE,
    'A toast is raised by an action rather than placed on the page. In your own config, put the same `{ type: toast }` in the `onSuccess` of the action that does the work.',
    'Say what happened and to whom, in the past tense. Errors stay until dismissed.',
  ],
  params: [
    stringParam('triggerLabel', 'The text of the button.', 'Send invoice'),
    stringParam(
      'message',
      'The confirmation line.',
      'Invoice sent. Atelier Nord will receive it in a minute.'
    ),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      appRegion([
        {
          type: 'button',
          label: p('triggerLabel'),
          action: { type: 'toast', message: p('message'), variant: 'success', duration: 5000 },
        },
      ])
    )
  },
})
