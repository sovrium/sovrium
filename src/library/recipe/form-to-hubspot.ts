/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry } from '@/library/manifest/define'

/** Each submission of a form becomes a HubSpot contact, through the connection's own operation. */
export const entry = defineLibraryEntry({
  kind: 'recipe',
  slug: 'form-to-hubspot',
  title: 'Add each form submission to HubSpot as a contact',
  category: 'sales',
  tags: ['hubspot', 'form', 'crm', 'contacts', 'lead'],
  description:
    'An automation that creates a HubSpot contact from each submission of one of your forms.',
  notes: [
    'The automation runs when the form named by `form` is submitted and creates a contact with the submitted email address, first name and last name, through the `post-v3-objects-contacts` operation of the `hubspot` connection, which is installed with it.',
    'HubSpot refuses a second contact with the same email address; the step then fails and the run shows the refusal. Add other HubSpot properties to the `properties` of the installed step, by their internal names.',
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
      name: 'firstNameField',
      description: 'The form field holding the first name.',
      type: 'string',
      default: 'first_name',
    },
    {
      name: 'lastNameField',
      description: 'The form field holding the last name.',
      type: 'string',
      default: 'last_name',
    },
  ],
  env: [],
  requires: ['connection/hubspot'],
  provider: {
    name: 'HubSpot',
    docsUrl: 'https://developers.hubspot.com/docs/api/crm/contacts',
    verifiedOn: '2026-09-24',
  },
  build: ({ name, params }) => ({
    name,
    trigger: { type: 'form', form: String(params['form'] ?? '') },
    actions: [
      {
        name: 'createContact',
        type: 'connection',
        operator: 'call',
        props: {
          connection: 'hubspot',
          operation: 'post-v3-objects-contacts',
          params: {
            properties: {
              email: `{{trigger.data.${String(params['emailField'] ?? 'email')}}}`,
              firstname: `{{trigger.data.${String(params['firstNameField'] ?? 'first_name')}}}`,
              lastname: `{{trigger.data.${String(params['lastNameField'] ?? 'last_name')}}}`,
            },
            associations: [],
          },
        },
      },
    ],
  }),
})
