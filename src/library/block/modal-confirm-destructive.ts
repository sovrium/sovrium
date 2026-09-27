/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { appRegion } from '@/library/manifest/app-block-kit'
import { asComponent, param, PLACE_NOTE, stringParam } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** A destructive action behind a confirmation that names what is lost. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'modal-confirm-destructive',
  title: 'Confirm a destructive action',
  category: 'application',
  tags: ['dialog', 'confirmation', 'delete', 'destructive', 'modal'],
  description:
    'A destructive button that opens a confirmation dialog naming exactly what will be lost, with a cancel and a destructive confirm.',
  notes: [
    PLACE_NOTE,
    'Give the dialog an `action` — usually a `crud` delete — so confirming runs it; without one, confirming only closes the dialog.',
    'Name what disappears and say it cannot be undone. For a gate the reader must type through, use a `button` with `confirm: { input: { matchValue } }` instead.',
    'The dialog is named after the installed block, so two installs never share one.',
  ],
  params: [
    stringParam('triggerLabel', 'The text of the button that opens the dialog.', 'Delete client'),
    stringParam('title', 'The question the dialog asks.', 'Delete Atelier Nord?'),
    stringParam(
      'description',
      'What is lost, and that it cannot be undone.',
      'Its 12 invoices and 48 comments are deleted with it. This cannot be undone.'
    ),
    stringParam('confirmLabel', 'The text of the destructive confirm button.', 'Delete client'),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    const dialogId = `${name}-dialog`
    return asComponent(
      name,
      appRegion([
        {
          type: 'button',
          variant: 'destructive',
          label: p('triggerLabel'),
          interactions: { click: { modal: dialogId } },
        },
        {
          type: 'alert-dialog',
          confirmLabel: p('confirmLabel'),
          cancelLabel: 'Cancel',
          props: {
            id: dialogId,
            title: p('title'),
            description: p('description'),
            variant: 'destructive',
          },
        },
      ])
    )
  },
})
