/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry } from '@/library/manifest/define'

/**
 * Every submission of a form becomes a Brevo contact.
 *
 * `updateEnabled: true` makes the call an upsert: a person who signs up twice
 * is updated rather than refused with a duplicate-contact error, which is the
 * behaviour a sign-up form wants.
 */
export const entry = defineLibraryEntry({
  kind: 'recipe',
  slug: 'form-to-brevo',
  title: 'Add each form submission to Brevo as a contact',
  category: 'marketing',
  tags: ['brevo', 'form', 'newsletter', 'contacts', 'sign-up'],
  description:
    'An automation that sends each submission of one of your forms to Brevo as a contact, optionally into a list.',
  notes: [
    'The automation runs when the form named by `form` is submitted, and posts the submitted email address to the Brevo contacts endpoint through the `brevo` connection, which is installed with it.',
    'An address already known to Brevo is updated rather than refused. Set `listId` to add the contact to one of your Brevo lists; leave it unset to create the contact without a list.',
  ],
  params: [
    {
      name: 'form',
      description: 'The name of the form whose submissions are sent, from your `forms` list.',
      type: 'string',
      required: true,
    },
    {
      name: 'emailField',
      description: 'The form field holding the email address.',
      type: 'string',
      default: 'email',
    },
    {
      name: 'listId',
      description: 'The numeric id of the Brevo list to add the contact to.',
      type: 'number',
    },
  ],
  env: [],
  requires: ['connection/brevo'],
  provider: {
    name: 'Brevo',
    docsUrl: 'https://developers.brevo.com/reference/create-contact',
    verifiedOn: '2026-09-23',
  },
  build: ({ name, params }) => {
    const { listId } = params
    return {
      name,
      trigger: { type: 'form', form: String(params['form'] ?? '') },
      actions: [
        {
          name: 'addContact',
          type: 'http',
          operator: 'post',
          props: {
            url: 'https://api.brevo.com/v3/contacts',
            connection: 'brevo',
            contentType: 'json',
            body: {
              email: `{{trigger.data.${String(params['emailField'] ?? 'email')}}}`,
              updateEnabled: true,
              ...(listId === undefined ? {} : { listIds: [Number(listId)] }),
            },
          },
        },
      ],
    }
  },
})
