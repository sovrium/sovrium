/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry } from '@/library/manifest/define'

/**
 * Each form submission becomes a Pipedrive lead: the person first, since a
 * lead must be linked to one, then the lead naming that person.
 */
export const entry = defineLibraryEntry({
  kind: 'recipe',
  slug: 'form-to-pipedrive-lead',
  title: 'Turn each form submission into a Pipedrive lead',
  category: 'sales',
  tags: ['pipedrive', 'crm', 'lead', 'form', 'sales'],
  description:
    'An automation that creates a person and a lead in Pipedrive for each submission of one of your forms.',
  notes: [
    "The automation runs when the form named by `form` is submitted. It creates a person from the submission's `nameField` and `emailField` through the `pipedrive` connection, which is installed with it, then a lead titled with `titlePrefix` and the person's name, linked to that person. The lead lands in Pipedrive's Leads inbox, owned by the user whose API token the connection uses.",
    'Every submission creates a new person, even for an email Pipedrive already knows; add a `search-persons` step before it if your form receives repeat visitors.',
  ],
  params: [
    {
      name: 'form',
      description: 'The name of the form whose submissions become leads, from your `forms` list.',
      type: 'string',
      required: true,
    },
    {
      name: 'nameField',
      description: "The form field holding the person's name.",
      type: 'string',
      default: 'name',
    },
    {
      name: 'emailField',
      description: "The form field holding the person's email.",
      type: 'string',
      default: 'email',
    },
    {
      name: 'titlePrefix',
      description: "The words the lead's title starts with, before the person's name.",
      type: 'string',
      default: 'Website enquiry',
    },
  ],
  env: [],
  requires: ['connection/pipedrive'],
  provider: {
    name: 'Pipedrive',
    docsUrl: 'https://developers.pipedrive.com/docs/api/v1/Leads#addLead',
    verifiedOn: '2026-10-06',
  },
  build: ({ name, params }) => {
    const nameField = String(params['nameField'] ?? 'name')
    const emailField = String(params['emailField'] ?? 'email')
    return {
      name,
      trigger: { type: 'form', form: String(params['form'] ?? '') },
      actions: [
        {
          name: 'person',
          type: 'connection',
          operator: 'call',
          props: {
            connection: 'pipedrive',
            operation: 'create-person',
            params: {
              name: `{{trigger.data.${nameField}}}`,
              emails: [{ value: `{{trigger.data.${emailField}}}`, primary: true, label: 'work' }],
            },
          },
        },
        {
          name: 'lead',
          type: 'connection',
          operator: 'call',
          props: {
            connection: 'pipedrive',
            operation: 'create-lead',
            params: {
              title: `${String(params['titlePrefix'] ?? 'Website enquiry')}: {{trigger.data.${nameField}}}`,
              person_id: '{{steps.person.data.data.id}}',
            },
          },
        },
      ],
    }
  },
})
