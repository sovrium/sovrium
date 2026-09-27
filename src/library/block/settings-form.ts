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

/** One settings record edited in a single form, its fields grouped under headed sections. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'settings-form',
  title: 'Settings form, grouped',
  category: 'application',
  tags: ['settings', 'form', 'preferences', 'edit', 'record'],
  description:
    'A settings page body: one form that edits one record of your settings table, its fields grouped under labelled sections — identity first, reminders second — with a single Save.',
  notes: [
    'Place it on a page whose path carries the record id, such as `/settings/:id`: the form loads that record and saves it back. `recordParam` names the path segment it reads.',
    DATA_NOTE,
    'The two sections are `fieldGroups` of one form, so everything saves at once. To save each section on its own, install the block twice and keep one group in each.',
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
              fields: [
                { field: p('legalNameField'), label: '[Legal name]' },
                { field: p('taxIdField'), label: '[Tax number]' },
                { field: p('emailField'), label: '[Billing email]' },
                { field: p('enabledField'), label: '[Send reminders]' },
                { field: p('daysField'), label: '[Days after the due date]' },
              ],
              fieldGroups: [
                {
                  label: p('firstGroup'),
                  fields: [p('legalNameField'), p('taxIdField'), p('emailField')],
                },
                { label: p('secondGroup'), fields: [p('enabledField'), p('daysField')] },
              ],
              action: {
                type: 'crud',
                operation: 'update',
                table,
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
