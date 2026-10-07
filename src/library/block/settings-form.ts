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
  panelHead,
  param,
  stack,
  stringParam,
  THEME_NOTE,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** One settings record edited section by section, each section its own form under a heading. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'settings-form',
  title: 'Settings form, grouped',
  category: 'application',
  tags: ['settings', 'form', 'preferences', 'edit', 'record'],
  description:
    'A settings page body that edits one record of your settings table as one form in two titled sections — identity first, reminders second — labels beside the controls and a save bar that counts the unsaved changes.',
  notes: [
    'Place it on a page whose path carries the record id, such as `/settings/:id`: the form loads that record and saves it back. `recordParam` names the path segment it reads.',
    DATA_NOTE,
    'It is one form over the record: the save bar stays in view while the page scrolls, counts the changes, and Save stores them all at once. Leaving with unsaved changes asks first.',
    THEME_NOTE,
  ],
  params: [
    stringParam('headline', 'The heading above the form. Empty to omit.', '[Settings]'),
    stringParam('table', 'The table the settings record lives in.', 'settings'),
    stringParam('recordParam', 'The page path segment holding the record id.', 'id'),
    stringParam('firstGroup', 'The label of the first section.', '[Organisation]'),
    stringParam('legalNameField', 'A text field in the first section.', 'legal_name'),
    stringParam('taxIdField', 'A second text field in the first section.', 'tax_id'),
    stringParam('emailField', 'An email field in the first section.', 'billing_email'),
    stringParam('secondGroup', 'The label of the second section.', '[Reminders]'),
    stringParam('enabledField', 'A yes/no field in the second section.', 'reminders_enabled'),
    stringParam('daysField', 'A whole-number field in the second section.', 'reminder_days'),
    stringParam(
      'successMessage',
      'What the form says once the settings are saved.',
      'Settings saved.'
    ),
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'legal_name', param: 'legalNameField', type: 'single-line-text' },
        { name: 'tax_id', param: 'taxIdField', type: 'single-line-text' },
        { name: 'billing_email', param: 'emailField', type: 'email' },
        { name: 'reminders_enabled', param: 'enabledField', type: 'checkbox' },
        { name: 'reminder_days', param: 'daysField', type: 'integer' },
      ],
    },
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    const table = p('table')
    return asComponent(
      name,
      panel([
        stack(
          [
            ...(p('headline') === '' ? [] : [panelHead(p('headline'))]),
            {
              type: 'form',
              dataSource: { table, mode: 'single', param: p('recordParam') },
              labelPlacement: 'side',
              stickyActions: true,
              fields: [
                { field: p('legalNameField'), label: '[Legal name]' },
                { field: p('taxIdField'), label: '[Tax number]' },
                { field: p('emailField'), label: '[Billing email]' },
                { field: p('enabledField'), label: '[Send reminders]' },
                { field: p('daysField'), label: '[Days after the due date]' },
              ],
              sections: [
                {
                  title: p('firstGroup'),
                  description: 'How the organisation appears on documents.',
                  fields: [p('legalNameField'), p('taxIdField'), p('emailField')],
                },
                {
                  title: p('secondGroup'),
                  description: 'When a late payment gets a reminder.',
                  fields: [p('enabledField'), p('daysField')],
                },
              ],
              action: {
                type: 'crud',
                operation: 'update',
                table,
                submitLabel: 'Save settings',
                onSuccess: { toast: { message: p('successMessage'), variant: 'success' } },
              },
            },
          ],
          'max-w-3xl gap-6'
        ),
      ])
    )
  },
})
