/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryBuildInput } from '@/library/manifest/define'

type Params = LibraryBuildInput['params']

/** The template reference to the field a parameter names, or its default. */
const recordField = (params: Params, key: string, fallback: string): string =>
  `{{trigger.data.record.${String(params[key] ?? fallback)}}}`

/** The template's signer placeholder, filled from the new record. */
const signerPlaceholder = (params: Params) => ({
  label: String(params['signerLabel'] ?? 'Signer'),
  info: {
    first_name: recordField(params, 'firstNameField', 'first_name'),
    last_name: recordField(params, 'lastNameField', 'last_name'),
    email: recordField(params, 'emailField', 'email'),
    locale: String(params['locale'] ?? 'fr'),
  },
})

/**
 * Each new record sends a document for signature: a Yousign signature request
 * created from a template the operator prepared, its signer placeholder filled
 * from the record, then activated so Yousign emails the signer.
 */
export const entry = defineLibraryEntry({
  kind: 'recipe',
  slug: 'record-to-yousign-signature-request',
  title: 'Send a Yousign signature request for each new record',
  category: 'documents',
  tags: ['yousign', 'signature', 'esignature', 'contract', 'record'],
  description:
    'An automation that sends a document prepared as a Yousign template for signature to the person each new record of one of your tables names.',
  notes: [
    "The automation runs when a record is created in the table named by `table`. It creates a signature request from the Yousign template `templateId` through the `yousign` connection, which is installed with it, fills the template's signer placeholder `signerLabel` with the record's first name, last name and email, and sends the request. Yousign then emails the signer a link to sign.",
    "Prepare the template in Yousign with its document, its signature fields and one signer placeholder, and set it active: the label you gave that placeholder is `signerLabel`, matched exactly, case included. The request is named after the record's `lastNameField`; the `locale` sets the language of Yousign's emails and signing page.",
  ],
  params: [
    {
      name: 'templateId',
      description: 'The id of the active Yousign template to send.',
      type: 'string',
      required: true,
    },
    {
      name: 'signerLabel',
      description: "The label of the template's signer placeholder.",
      type: 'string',
      default: 'Signer',
    },
    {
      name: 'locale',
      description: "The language of the signer's emails and signing page, such as fr or en.",
      type: 'string',
      default: 'fr',
    },
    {
      name: 'table',
      description: 'The table whose new records each send a request.',
      type: 'string',
      default: 'contracts',
    },
    {
      name: 'firstNameField',
      description: "The field holding the signer's first name.",
      type: 'string',
      default: 'first_name',
    },
    {
      name: 'lastNameField',
      description: "The field holding the signer's last name.",
      type: 'string',
      default: 'last_name',
    },
    {
      name: 'emailField',
      description: "The field holding the signer's email.",
      type: 'string',
      default: 'email',
    },
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'first_name', param: 'firstNameField', type: 'single-line-text' },
        { name: 'last_name', param: 'lastNameField', type: 'single-line-text' },
        { name: 'email', param: 'emailField', type: 'email' },
      ],
    },
  ],
  env: [],
  requires: ['connection/yousign'],
  provider: {
    name: 'Yousign',
    docsUrl: 'https://developers.yousign.com/docs/use-templates-to-create-signature-requests',
    verifiedOn: '2026-10-06',
  },
  build: ({ name, params }) => ({
    name,
    trigger: {
      type: 'record',
      table: String(params['table'] ?? 'contracts'),
      events: ['create'],
    },
    actions: [
      {
        name: 'request',
        type: 'connection',
        operator: 'call',
        props: {
          connection: 'yousign',
          operation: 'create-signature-request',
          params: {
            name: `Signature: ${recordField(params, 'lastNameField', 'last_name')}`,
            delivery_mode: 'email',
            template_id: String(params['templateId'] ?? ''),
            template_placeholders: { signers: [signerPlaceholder(params)] },
          },
        },
      },
      {
        name: 'send',
        type: 'connection',
        operator: 'call',
        props: {
          connection: 'yousign',
          operation: 'activate-signature-request',
          params: { signatureRequestId: '{{steps.request.data.id}}' },
        },
      },
    ],
  }),
})
