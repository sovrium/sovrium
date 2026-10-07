/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  DATA_NOTE,
  panel,
  param,
  PLACE_NOTE,
  stringParam,
  THEME_NOTE,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** A button that opens a dialog holding a short form which adds a record. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'modal-form',
  title: 'Form in a dialog',
  category: 'application',
  tags: ['dialog', 'modal', 'form', 'create', 'invite'],
  description:
    'A button that opens a dialog with a title, one sentence of context and a short form that creates a record in one of your tables. Escape or the backdrop closes it.',
  notes: [
    PLACE_NOTE,
    DATA_NOTE,
    "The form is installed into `forms:` under the block's name and placed in the dialog with `formRef`, so it adds the record through that form. Its submissions do not reach the Submissions inbox; set `submitTo.storeSubmission: true` on it to keep them there.",
    'Focus moves into the dialog when it opens and stays there until it closes. The dialog is named after the installed block, so two copies on one page open their own dialogs.',
    THEME_NOTE,
  ],
  params: [
    stringParam(
      'buttonLabel',
      'The text of the button that opens the dialog.',
      '[Invite a member]'
    ),
    stringParam('title', 'The dialog title.', '[Invite a member]'),
    stringParam(
      'description',
      'One sentence under the title.',
      'They receive an email with a link to join. The link expires after seven days.'
    ),
    stringParam('table', 'The table the form creates a record in.', 'members'),
    stringParam('nameField', 'A text field.', 'name'),
    stringParam('emailField', 'An email field.', 'email'),
    stringParam(
      'successMessage',
      'What the form says once the record is saved.',
      'Invitation recorded.'
    ),
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'name', param: 'nameField', type: 'single-line-text' },
        { name: 'email', param: 'emailField', type: 'email' },
      ],
    },
  ],
  env: [],
  requires: [],
  forms: ({ name, params }) => {
    const p = param(params)
    return [
      {
        name,
        title: p('title'),
        submitTo: { table: p('table') },
        fields: [
          { kind: 'table-field', column: p('nameField'), label: '[Name]' },
          {
            kind: 'table-field',
            column: p('emailField'),
            label: '[Email]',
            placeholder: 'name@example.com',
          },
        ],
        onSuccess: { type: 'toast', message: p('successMessage'), variant: 'success' },
      },
    ]
  },
  build: ({ name, params }) => {
    const p = param(params)
    const dialogId = `${name}-dialog`
    return asComponent(
      name,
      panel([
        {
          type: 'button',
          props: {
            id: `${name}-open`,
            label: p('buttonLabel'),
            interactions: { click: { modal: dialogId } },
          },
        },
        {
          type: 'dialog',
          props: { id: dialogId, title: p('title'), description: p('description') },
          formRef: name,
        },
      ])
    )
  },
})
