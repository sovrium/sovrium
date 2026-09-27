/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  card,
  DATA_NOTE,
  panel,
  panelHead,
  param,
  PLACE_NOTE,
  stringParam,
  THEME_NOTE,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** A card holding a two-column form that creates a record in one of your tables. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'record-form-two-column',
  title: 'Record form in two columns',
  category: 'application',
  tags: ['form', 'create', 'record', 'two columns', 'crud'],
  description:
    'A card with a title and a two-column form that creates a record in one of your tables — four short fields side by side and a notes field across the width. It stacks to one column on a phone.',
  notes: [
    PLACE_NOTE,
    DATA_NOTE,
    'Each control is drawn from the field’s own type, so an email field gets an email keyboard and its validation. The submit writes through the records API and respects the table’s create permission.',
    THEME_NOTE,
  ],
  params: [
    stringParam('headline', 'The title of the card.', '[New client]'),
    stringParam('table', 'The table the form creates a record in.', 'clients'),
    stringParam('nameField', 'A text field.', 'name'),
    stringParam('emailField', 'An email field.', 'email'),
    stringParam('phoneField', 'A phone number field.', 'phone'),
    stringParam('websiteField', 'A URL field.', 'website'),
    stringParam('notesField', 'A long text field drawn across both columns.', 'notes'),
    stringParam(
      'successMessage',
      'What the form says once the record is saved.',
      'Record created.'
    ),
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'name', param: 'nameField', type: 'single-line-text' },
        { name: 'email', param: 'emailField', type: 'email' },
        { name: 'phone', param: 'phoneField', type: 'phone-number' },
        { name: 'website', param: 'websiteField', type: 'url' },
        { name: 'notes', param: 'notesField', type: 'long-text' },
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
        card(
          [
            {
              type: 'container',
              props: { className: 'border-b border-border px-6 py-4' },
              children: [panelHead(p('headline'))],
            },
            {
              type: 'container',
              props: { className: 'px-6 py-5' },
              children: [
                {
                  type: 'form',
                  layout: 'two-column',
                  fields: [
                    { field: p('nameField'), label: '[Name]' },
                    { field: p('emailField'), label: '[Email]', placeholder: 'name@example.com' },
                    { field: p('phoneField'), label: '[Phone]' },
                    { field: p('websiteField'), label: '[Website]', placeholder: 'https://' },
                    { field: p('notesField'), label: '[Notes]' },
                  ],
                  action: {
                    type: 'crud',
                    operation: 'create',
                    table,
                    onSuccess: { toast: { message: p('successMessage'), variant: 'success' } },
                  },
                },
              ],
            },
          ],
          'max-w-3xl overflow-hidden p-0'
        ),
      ])
    )
  },
})
