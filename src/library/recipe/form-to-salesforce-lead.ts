/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry } from '@/library/manifest/define'

/** Each form submission becomes a Salesforce lead, through the connection's own operation. */
export const entry = defineLibraryEntry({
  kind: 'recipe',
  slug: 'form-to-salesforce-lead',
  title: 'Create a Salesforce lead from each form submission',
  category: 'sales',
  tags: ['salesforce', 'crm', 'lead', 'form', 'sales'],
  description:
    'An automation that creates a lead in your Salesforce org from each submission of one of your forms.',
  notes: [
    'The automation runs when the form named by `form` is submitted and creates a lead with the submitted last name, company and email address, through the `create-lead` operation of the `salesforce` connection, which is installed with it. The lead source is set to `leadSource`.',
    'Salesforce requires a last name and a company on every lead: make both required in your form. The run shows the new lead id at `steps.createLead.data.id`.',
  ],
  params: [
    {
      name: 'form',
      description: 'The name of the form whose submissions become leads, from your `forms` list.',
      type: 'string',
      required: true,
    },
    {
      name: 'lastNameField',
      description: 'The form field holding the last name.',
      type: 'string',
      default: 'last_name',
    },
    {
      name: 'companyField',
      description: 'The form field holding the company.',
      type: 'string',
      default: 'company',
    },
    {
      name: 'emailField',
      description: 'The form field holding the email address.',
      type: 'string',
      default: 'email',
    },
    {
      name: 'leadSource',
      description: 'The lead source recorded on each lead.',
      type: 'string',
      default: 'Web',
    },
  ],
  env: [],
  requires: ['connection/salesforce'],
  provider: {
    name: 'Salesforce',
    docsUrl:
      'https://trailhead.salesforce.com/content/learn/projects/build-integrations-with-external-client-apps/implement-the-oauth-20-web-server-flow',
    verifiedOn: '2026-09-24',
  },
  build: ({ name, params }) => {
    const field = (param: string, fallback: string): string =>
      `{{trigger.data.${String(params[param] ?? fallback)}}}`
    return {
      name,
      trigger: { type: 'form', form: String(params['form'] ?? '') },
      actions: [
        {
          name: 'createLead',
          type: 'connection',
          operator: 'call',
          props: {
            connection: 'salesforce',
            operation: 'create-lead',
            params: {
              LastName: field('lastNameField', 'last_name'),
              Company: field('companyField', 'company'),
              Email: field('emailField', 'email'),
              LeadSource: String(params['leadSource'] ?? 'Web'),
            },
          },
        },
      ],
    }
  },
})
