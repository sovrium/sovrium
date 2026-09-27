/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  BARE_FORM,
  endpointForm,
  card,
  grid,
  param,
  PLACE_NOTE,
  section,
  sectionHead,
  small,
  stack,
  stringParam,
  THEME_NOTE,
  when,
  wrap,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import type { BlockNode } from '@/library/manifest/block-kit'

const messageForm = (p: (key: string) => string): BlockNode =>
  endpointForm({
    className: BARE_FORM,
    url: p('endpoint'),
    submitLabel: p('submitLabel'),
    successMessage: p('successMessage'),
    errorMessage: 'The message could not be sent. Try again.',
    fields: [
      { field: 'name', control: 'text', label: 'Name' },
      { field: 'email', control: 'email', label: 'Email' },
      { field: 'message', control: 'textarea', label: 'Message', placeholder: 'What do you need?' },
    ],
  })

/** Contact details on one side, a message form on the other. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'contact-split',
  title: 'Contact details beside a form',
  category: 'marketing',
  tags: ['contact', 'form', 'email', 'phone', 'address'],
  description:
    'Two columns: who answers and how to reach them — email, phone, address — beside a card holding a name, email and message form.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'The form posts `{ "name", "email", "message" }` as JSON to `endpoint` — your own route, or an automation webhook — and shows a toast on success or failure. It writes to no table, so the block installs into any app; to store messages in a table instead, replace `endpoint` with a `dataSource` in the fragment.',
    'The columns stack on a phone, details first.',
  ],
  params: [
    stringParam('headline', 'The section heading.', 'Talk to [a person]'),
    stringParam('subheadline', 'One sentence under the heading.', 'Say who answers and how fast.'),
    stringParam('email', 'The contact email address.', '[contact@example.com]'),
    stringParam('phone', 'The contact phone number. Empty to omit the row.', '[+33 0 00 00 00 00]'),
    stringParam('address', 'The postal address. Empty to omit the row.', '[Street, city]'),
    stringParam('endpoint', 'The URL the form posts the message to.', '/api/contact'),
    stringParam('submitLabel', 'The text of the submit button.', 'Send message'),
    stringParam(
      'successMessage',
      'The toast shown once the message is sent.',
      'Message sent. We will reply soon.'
    ),
    stringParam('replyTime', 'A small line under the form. Empty to omit.', '[Reply time]'),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    const rows = [
      { term: 'Email', detail: p('email') },
      { term: 'Phone', detail: p('phone') },
      { term: 'Address', detail: p('address') },
    ].filter((row) => row.detail.trim() !== '')
    return asComponent(
      name,
      section([
        wrap([
          grid(
            [
              stack(
                [
                  sectionHead({ title: p('headline'), lead: p('subheadline') }),
                  {
                    type: 'description-list',
                    layout: 'rows',
                    dividers: false,
                    items: rows,
                    props: { className: 'mt-6' },
                  },
                ],
                'gap-4'
              ),
              card(
                [messageForm(p), ...when(p('replyTime'), small(p('replyTime')))],
                'flex flex-col gap-4 p-6 sm:p-8'
              ),
            ],
            'gap-12 lg:grid-cols-2 lg:gap-20'
          ),
        ]),
      ])
    )
  },
})
