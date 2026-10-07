/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/**
 * The signature-request lifecycle of the Yousign API v3: create a request
 * (from a template, so no document has to be uploaded), add a signer, send
 * it, read its status.
 */
const OPERATIONS: LibraryOperations = [
  {
    name: 'create-signature-request',
    method: 'POST',
    path: '/signature_requests',
    summary: 'Create a draft signature request, optionally from a template',
    params: {
      name: { in: 'body', type: 'string', required: true },
      delivery_mode: { in: 'body', type: 'string', required: true, enum: ['email', 'none'] },
      template_id: { in: 'body', type: 'string', description: 'The id of an active template' },
      template_placeholders: {
        in: 'body',
        type: 'object',
        description: '{ signers: [{ label, info: { first_name, last_name, email, locale } }] }',
      },
      ordered_signers: { in: 'body', type: 'boolean' },
      external_id: { in: 'body', type: 'string' },
      expiration_date: { in: 'body', type: 'string', format: 'date' },
    },
  },
  {
    name: 'add-signer',
    method: 'POST',
    path: '/signature_requests/{signatureRequestId}/signers',
    summary: 'Add a signer to a draft signature request',
    params: {
      signatureRequestId: { in: 'path', type: 'string', required: true },
      info: {
        in: 'body',
        type: 'object',
        required: true,
        description: '{ first_name, last_name, email, locale }',
      },
      signature_level: {
        in: 'body',
        type: 'string',
        required: true,
        enum: [
          'electronic_signature',
          'advanced_electronic_signature',
          'qualified_electronic_signature',
        ],
      },
      fields: { in: 'body', type: 'array', description: 'Where the signer signs, per document' },
    },
  },
  {
    name: 'activate-signature-request',
    method: 'POST',
    path: '/signature_requests/{signatureRequestId}/activate',
    summary: 'Send a draft signature request to its signers',
    params: {
      signatureRequestId: { in: 'path', type: 'string', required: true },
    },
  },
  {
    name: 'get-signature-request',
    method: 'GET',
    path: '/signature_requests/{signatureRequestId}',
    summary: 'Read a signature request and its status',
    params: {
      signatureRequestId: { in: 'path', type: 'string', required: true },
    },
  },
]

/** Yousign electronic signature, authenticated with an API key. */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'yousign',
  title: 'Electronic signature with Yousign (API key)',
  category: 'documents',
  tags: ['yousign', 'signature', 'esignature', 'contract', 'documents'],
  description:
    'Authenticated calls to the Yousign API v3, with operations to create, send and follow signature requests.',
  notes: [
    'Create an API key in the Yousign app under Developers, API keys, and set it as `YOUSIGN_API_KEY`. A key belongs to one environment: a sandbox key works only against the sandbox address, so install with `--set apiUrl=https://api-sandbox.yousign.app/v3` while you test.',
    'A request is created as a draft and sent by `activate-signature-request`. Creating it from a template prepared in Yousign avoids uploading a document: name the template with `template_id` and fill its signer placeholders with `template_placeholders`, each `label` matching the template exactly. With `delivery_mode: email`, Yousign emails the signers itself.',
  ],
  params: [
    {
      name: 'apiUrl',
      description: 'The Yousign API address: production, or the sandbox while testing.',
      type: 'string',
      default: 'https://api.yousign.app/v3',
    },
  ],
  env: ['YOUSIGN_API_KEY'],
  requires: [],
  provider: {
    name: 'Yousign',
    docsUrl: 'https://developers.yousign.com/docs/use-templates-to-create-signature-requests',
    verifiedOn: '2026-10-06',
  },
  build: ({ name, params }) => ({
    name,
    type: 'bearer',
    label: 'Yousign',
    description: 'Yousign API v3, authenticated with an API key',
    props: { token: '$env.YOUSIGN_API_KEY' },
    baseUrl: String(params['apiUrl'] ?? 'https://api.yousign.app/v3'),
    operations: OPERATIONS,
  }),
})
