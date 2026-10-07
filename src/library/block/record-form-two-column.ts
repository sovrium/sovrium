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
  param,
  PLACE_NOTE,
  stringParam,
  THEME_NOTE,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** A card holding a form that adds a record to one of your tables. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'record-form-two-column',
  title: 'Record form in a card',
  category: 'application',
  tags: ['form', 'create', 'record', 'card', 'crud'],
  description:
    "A card holding a form that adds a record to one of your tables — name, email, phone, website and notes, under the card's title.",
  notes: [
    PLACE_NOTE,
    DATA_NOTE,
    "The form is installed into `forms:` under the block's name and placed in the card with `formRef`. It is shown only to a reader who may add a record to the table, and its submissions do not reach the Submissions inbox unless you set `submitTo.storeSubmission: true` on it.",
    'Each control is drawn from the field’s own type, so an email field gets an email keyboard and its validation.',
    THEME_NOTE,
  ],
  params: [
    stringParam('headline', 'The title of the card.', '[New client]'),
    stringParam('table', 'The table the form creates a record in.', 'clients'),
    stringParam('nameField', 'A text field.', 'name'),
    stringParam('emailField', 'An email field.', 'email'),
    stringParam('phoneField', 'A phone number field.', 'phone'),
    stringParam('websiteField', 'A URL field.', 'website'),
    stringParam('notesField', 'A long text field.', 'notes'),
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
  forms: ({ name, params }) => {
    const p = param(params)
    return [
      {
        name,
        title: p('headline'),
        submitTo: { table: p('table') },
        fields: [
          { kind: 'table-field', column: p('nameField'), label: '[Name]' },
          {
            kind: 'table-field',
            column: p('emailField'),
            label: '[Email]',
            placeholder: 'name@example.com',
          },
          { kind: 'table-field', column: p('phoneField'), label: '[Phone]' },
          {
            kind: 'table-field',
            column: p('websiteField'),
            label: '[Website]',
            placeholder: 'https://',
          },
          { kind: 'table-field', column: p('notesField'), label: '[Notes]' },
        ],
        onSuccess: { type: 'toast', message: p('successMessage'), variant: 'success' },
      },
    ]
  },
  build: ({ name }) =>
    asComponent(
      name,
      panel([
        card(
          [{ type: 'form', formRef: name, props: { headingLevel: 'h3' } }],
          'max-w-3xl px-6 py-5'
        ),
      ])
    ),
})
