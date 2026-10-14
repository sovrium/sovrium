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

/** An intake questionnaire: one question per screen, the answers sent once through a form. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'questionnaire',
  shadcnBlock: null,
  title: 'Questionnaire',
  category: 'console',
  tags: ['questionnaire', 'survey', 'quiz', 'intake', 'onboarding', 'form'],
  description:
    'Three questions asked one at a time, with a count of how many remain, whose answers are saved as one record in one of your tables when the last one is answered.',
  notes: [
    'No shadcn counterpart: shadcn/ui has no questionnaire block. Each screen draws shadcn parts — the choices as option cards, the typed answer as a field, Previous and Next as buttons.',
    'A choice question moves on as soon as an answer is picked. The last question is optional, so it offers Skip, and a skipped answer is saved empty. Previous returns to an earlier question with its answer still chosen. Once the answers are saved, the questionnaire is replaced by a line saying they were sent.',
    PLACE_NOTE,
    DATA_NOTE,
    "The form is installed into `forms:` under the block's name and the questionnaire sends its answers through it with `formRef`, so the form's validation and permissions apply and nothing is saved before the last screen. Edit the questions, their choices and the labels in `items` of the installed fragment; an item's `name` is the field its answer is saved in.",
    THEME_NOTE,
  ],
  params: [
    stringParam('table', 'The table each set of answers is saved in.', 'intake_answers'),
    stringParam('teamField', 'A text field for the first answer.', 'team_size'),
    stringParam('goalField', 'A text field for the second answer.', 'main_goal'),
    stringParam('noteField', 'A long text field for the optional note.', 'note'),
    stringParam('submitLabel', 'The text of the button on the last screen.', 'Send answers'),
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'team_size', param: 'teamField', type: 'single-line-text' },
        { name: 'main_goal', param: 'goalField', type: 'single-line-text' },
        { name: 'note', param: 'noteField', type: 'long-text' },
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
        title: '[Intake]',
        submitTo: { table: p('table') },
        fields: [
          { kind: 'table-field', column: p('teamField') },
          { kind: 'table-field', column: p('goalField') },
          { kind: 'table-field', column: p('noteField'), required: false },
        ],
      },
    ]
  },
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      panel([
        {
          type: 'questionnaire',
          formRef: name,
          submitLabel: p('submitLabel'),
          items: [
            {
              name: p('teamField'),
              prompt: '[How many people will use it?]',
              choices: [
                { value: '1-5', label: '[1 to 5]' },
                { value: '6-20', label: '[6 to 20]' },
                { value: '21+', label: '[More than 20]' },
              ],
            },
            {
              name: p('goalField'),
              prompt: '[What do you want to do first?]',
              choices: [
                { value: 'track-clients', label: '[Track clients]' },
                { value: 'plan-projects', label: '[Plan projects]' },
                { value: 'send-invoices', label: '[Send invoices]' },
              ],
            },
            {
              name: p('noteField'),
              prompt: '[Anything we should know?]',
              required: false,
              input: { label: '[Note]', placeholder: '[A deadline, a tool you use today…]' },
            },
          ],
        },
      ])
    )
  },
})
