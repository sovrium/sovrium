/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/** Every path is versioned; one constant keeps the set on one API version. */
const V = '/services/data/v67.0'

const CONTACT_FIELDS = {
  FirstName: { in: 'body', type: 'string' },
  LastName: { in: 'body', type: 'string' },
  Email: { in: 'body', type: 'string', format: 'email' },
  Phone: { in: 'body', type: 'string' },
  Title: { in: 'body', type: 'string' },
  AccountId: { in: 'body', type: 'string' },
} as const

const OPPORTUNITY_FIELDS = {
  Name: { in: 'body', type: 'string' },
  StageName: { in: 'body', type: 'string' },
  CloseDate: { in: 'body', type: 'string', format: 'date' },
  Amount: { in: 'body', type: 'number' },
  AccountId: { in: 'body', type: 'string' },
} as const

/**
 * A curated subset: the generic REST calls every org has (SOQL, one record of
 * any object by id) and the standard objects the recipes write.
 */
const OPERATIONS: LibraryOperations = [
  {
    name: 'query',
    method: 'GET',
    path: `${V}/query`,
    summary: 'Run a SOQL query',
    params: { q: { in: 'query', type: 'string', required: true } },
  },
  {
    name: 'get-record',
    method: 'GET',
    path: `${V}/sobjects/{sobject}/{id}`,
    summary: 'Retrieve one record of any object by id',
    params: {
      sobject: { in: 'path', type: 'string', required: true, description: 'Lead, Contact, …' },
      id: { in: 'path', type: 'string', required: true },
      fields: { in: 'query', type: 'string', description: 'Comma-separated field names' },
    },
  },
  {
    name: 'delete-record',
    method: 'DELETE',
    path: `${V}/sobjects/{sobject}/{id}`,
    summary: 'Delete one record of any object by id',
    params: {
      sobject: { in: 'path', type: 'string', required: true },
      id: { in: 'path', type: 'string', required: true },
    },
  },
  {
    name: 'create-lead',
    method: 'POST',
    path: `${V}/sobjects/Lead`,
    summary: 'Create a lead',
    params: {
      FirstName: { in: 'body', type: 'string' },
      LastName: { in: 'body', type: 'string', required: true },
      Company: { in: 'body', type: 'string', required: true },
      Email: { in: 'body', type: 'string', format: 'email' },
      Phone: { in: 'body', type: 'string' },
      LeadSource: { in: 'body', type: 'string' },
      Description: { in: 'body', type: 'string' },
    },
  },
  {
    name: 'upsert-lead',
    method: 'PATCH',
    path: `${V}/sobjects/Lead/{externalIdField}/{externalId}`,
    summary: 'Create or update a lead by an external id field',
    params: {
      externalIdField: { in: 'path', type: 'string', required: true },
      externalId: { in: 'path', type: 'string', required: true },
      FirstName: { in: 'body', type: 'string' },
      LastName: { in: 'body', type: 'string' },
      Company: { in: 'body', type: 'string' },
      Email: { in: 'body', type: 'string', format: 'email' },
      Phone: { in: 'body', type: 'string' },
      LeadSource: { in: 'body', type: 'string' },
    },
  },
  {
    name: 'upsert-contact',
    method: 'PATCH',
    path: `${V}/sobjects/Contact/{externalIdField}/{externalId}`,
    summary: 'Create or update a contact by an external id field',
    params: {
      externalIdField: { in: 'path', type: 'string', required: true },
      externalId: { in: 'path', type: 'string', required: true },
      ...CONTACT_FIELDS,
    },
  },
  {
    name: 'update-contact',
    method: 'PATCH',
    path: `${V}/sobjects/Contact/{id}`,
    summary: 'Update a contact by id',
    params: { id: { in: 'path', type: 'string', required: true }, ...CONTACT_FIELDS },
  },
  {
    name: 'create-opportunity',
    method: 'POST',
    path: `${V}/sobjects/Opportunity`,
    summary: 'Create an opportunity',
    params: {
      ...OPPORTUNITY_FIELDS,
      Name: { in: 'body', type: 'string', required: true },
      StageName: { in: 'body', type: 'string', required: true },
      CloseDate: { in: 'body', type: 'string', format: 'date', required: true },
    },
  },
  {
    name: 'update-opportunity',
    method: 'PATCH',
    path: `${V}/sobjects/Opportunity/{id}`,
    summary: 'Update an opportunity by id',
    params: { id: { in: 'path', type: 'string', required: true }, ...OPPORTUNITY_FIELDS },
  },
]

/**
 * Salesforce with OAuth. The token response names the org's own API host as
 * `instance_url`: the connection keeps it with the token and calls it.
 */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'salesforce',
  title: 'CRM with Salesforce (OAuth)',
  category: 'sales',
  tags: ['salesforce', 'crm', 'leads', 'contacts', 'opportunities', 'sales', 'oauth'],
  description:
    'A Salesforce org connected with OAuth, with SOQL queries, generic record reads and the lead, contact and opportunity writes the recipes use.',
  notes: [
    'Create an External Client App (or a Connected App) in Salesforce Setup with OAuth enabled, the `api` and `refresh_token` scopes, and the callback URL `sovrium library add` prints. Set its consumer key and secret as environment variables and connect the org from your app once. For a sandbox, set `authorizationUrl` and `tokenUrl` to the `test.salesforce.com` endpoints.',
    "Salesforce returns the org's API address as `instance_url` with each token; the connection keeps it (`tokenFields`) and calls every operation there (`baseUrl: $token.instance_url`). The upsert operations need an External ID field on the object; the operations use API version 67.0.",
  ],
  params: [],
  env: ['SALESFORCE_CLIENT_ID', 'SALESFORCE_CLIENT_SECRET'],
  requires: [],
  provider: {
    name: 'Salesforce',
    docsUrl:
      'https://trailhead.salesforce.com/content/learn/projects/build-integrations-with-external-client-apps/implement-the-oauth-20-web-server-flow',
    verifiedOn: '2026-09-24',
  },
  build: ({ name }) => ({
    name,
    type: 'oauth2',
    label: 'Salesforce',
    description: 'Salesforce REST API, connected with OAuth',
    props: {
      provider: 'salesforce',
      clientId: '$env.SALESFORCE_CLIENT_ID',
      clientSecret: '$env.SALESFORCE_CLIENT_SECRET',
      scopes: ['api', 'refresh_token'],
      pkce: 'S256',
      tokenFields: ['instance_url'],
    },
    baseUrl: '$token.instance_url',
    operations: OPERATIONS,
  }),
})
