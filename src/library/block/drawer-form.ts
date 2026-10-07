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

/** A button that slides in a side panel holding a form which adds a record. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'drawer-form',
  title: 'Form in a side panel',
  category: 'application',
  tags: ['drawer', 'slide-over', 'panel', 'form', 'create'],
  description:
    'A button that slides a panel in from the right with a form that creates a record in one of your tables — for a task that needs more room than a dialog, beside the list it came from.',
  notes: [
    PLACE_NOTE,
    DATA_NOTE,
    "The form is installed into `forms:` under the block's name and placed in the panel with `formRef`, so it adds the record through that form. Its submissions do not reach the Submissions inbox; set `submitTo.storeSubmission: true` on it to keep them there.",
    'The panel is named after the installed block, so two copies on one page open their own panels. Escape or the close control dismisses it.',
    THEME_NOTE,
  ],
  params: [
    stringParam('buttonLabel', 'The text of the button that opens the panel.', '[New reminder]'),
    stringParam('title', 'The panel title.', '[New reminder]'),
    stringParam('formTitle', 'The heading of the form inside the panel.', '[Reminder details]'),
    stringParam('table', 'The table the form creates a record in.', 'reminders'),
    stringParam('nameField', 'A text field.', 'name'),
    stringParam('daysField', 'A whole-number field.', 'days_late'),
    stringParam('messageField', 'A long text field.', 'message'),
    stringParam(
      'successMessage',
      'What the form says once the record is saved.',
      'Reminder created.'
    ),
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'name', param: 'nameField', type: 'single-line-text' },
        { name: 'days_late', param: 'daysField', type: 'integer' },
        { name: 'message', param: 'messageField', type: 'long-text' },
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
        title: p('formTitle'),
        submitTo: { table: p('table') },
        fields: [
          { kind: 'table-field', column: p('nameField'), label: '[Name]' },
          { kind: 'table-field', column: p('daysField'), label: '[Days after the due date]' },
          { kind: 'table-field', column: p('messageField'), label: '[Message]' },
        ],
        onSuccess: { type: 'toast', message: p('successMessage'), variant: 'success' },
      },
    ]
  },
  build: ({ name, params }) => {
    const p = param(params)
    const drawerId = `${name}-drawer`
    return asComponent(
      name,
      panel([
        {
          type: 'button',
          props: {
            id: `${name}-open`,
            label: p('buttonLabel'),
            interactions: { click: { modal: drawerId } },
          },
        },
        {
          type: 'drawer',
          props: { id: drawerId, title: p('title') },
          drawerSide: 'right',
          drawerSize: 'md',
          children: [{ type: 'form', formRef: name, props: { headingLevel: 'h3' } }],
        },
      ])
    )
  },
})
