/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry } from '@/library/manifest/define'

/** Each form submission opens a Zendesk ticket on behalf of the person who sent it. */
export const entry = defineLibraryEntry({
  kind: 'recipe',
  slug: 'form-to-zendesk-ticket',
  title: 'Open a Zendesk ticket for each form submission',
  category: 'support',
  tags: ['zendesk', 'support', 'ticket', 'form', 'helpdesk'],
  description:
    'An automation that opens a Zendesk ticket, requested by the person who submitted it, for each submission of one of your forms.',
  notes: [
    "The automation runs when the form named by `form` is submitted and opens a ticket through the `create-ticket` operation of the `zendesk` connection, which is installed with it. The ticket's subject is the `subjectField` of the submission, its first comment the `messageField`, and its requester the person named by `nameField` and `emailField`, whom Zendesk creates when the email is new — so replies from your agents reach them by email.",
  ],
  params: [
    {
      name: 'form',
      description: 'The name of the form whose submissions open tickets, from your `forms` list.',
      type: 'string',
      required: true,
    },
    {
      name: 'subjectField',
      description: "The form field used as the ticket's subject.",
      type: 'string',
      default: 'subject',
    },
    {
      name: 'messageField',
      description: "The form field used as the ticket's first comment.",
      type: 'string',
      default: 'message',
    },
    {
      name: 'nameField',
      description: "The form field holding the requester's name.",
      type: 'string',
      default: 'name',
    },
    {
      name: 'emailField',
      description: "The form field holding the requester's email.",
      type: 'string',
      default: 'email',
    },
  ],
  env: [],
  requires: ['connection/zendesk'],
  provider: {
    name: 'Zendesk',
    docsUrl: 'https://developer.zendesk.com/api-reference/ticketing/tickets/tickets/',
    verifiedOn: '2026-10-06',
  },
  build: ({ name, params }) => {
    const field = (key: string, fallback: string): string =>
      `{{trigger.data.${String(params[key] ?? fallback)}}}`
    return {
      name,
      trigger: { type: 'form', form: String(params['form'] ?? '') },
      actions: [
        {
          name: 'ticket',
          type: 'connection',
          operator: 'call',
          props: {
            connection: 'zendesk',
            operation: 'create-ticket',
            params: {
              ticket: {
                subject: field('subjectField', 'subject'),
                comment: { body: field('messageField', 'message') },
                requester: {
                  name: field('nameField', 'name'),
                  email: field('emailField', 'email'),
                },
              },
            },
          },
        },
      ],
    }
  },
})
