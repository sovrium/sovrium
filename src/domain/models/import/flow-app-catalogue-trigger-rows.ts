/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The observed apps behind form submissions and parsed emails: the catalogue
 * rows whose source action is a TRIGGER, each with the operation that registers
 * the vendor's webhook when one is known. The schema and the rules are in
 * `flow-app-catalogue.ts`.
 */

import { CHECKED_ON, scaffold, type FlowAppCatalogueEntry } from './flow-app-catalogue'

/**
 * Mailparser (Typeform, Jotform, Webflow, Trello and MeisterTask are library
 * connections now).
 */
export const FLOW_APP_TRIGGER_ROWS: readonly FlowAppCatalogueEntry[] = [
  {
    slug: 'mailparser',
    title: 'Parsed emails from Mailparser (API key)',
    rank: 2,
    provider: {
      name: 'Mailparser',
      docsUrl:
        'https://help.mailparser.io/hc/en-us/articles/16253343464980-What-are-webhook-integrations',
      verifiedOn: CHECKED_ON,
    },
    env: ['MAILPARSER_API_KEY'],
    connection: scaffold({
      type: 'apiKey',
      label: 'Mailparser',
      description: 'Mailparser API, authenticated with an API key',
      props: { key: '$env.MAILPARSER_API_KEY', header: 'X-API-Key' },
      baseUrl: 'https://api.mailparser.io/v1',
    }),
    operations: [],
    actions: [
      {
        tool: 'zapier',
        app: 'MailParserIOCLIAPI',
        operation: 'automatic_new_email',
        kind: 'trigger',
        unknown:
          "Mailparser's webhook is added in its own interface (Inbox, Integrations, Generic Webhook); no public API endpoint for adding one was found",
      },
    ],
    facts: [
      {
        claim:
          'A generic webhook integration posts each parsed email to a target URL, as JSON, XML or form data',
        url: 'https://help.mailparser.io/hc/en-us/articles/16253343464980-What-are-webhook-integrations',
        status: 'verified',
      },
      {
        claim:
          'The API answers on https://api.mailparser.io/v1 and reads the key from an X-API-Key header',
        url: 'https://rollout.com/integration-guides/mailparser/api-essentials',
        status: 'unverified',
      },
    ],
    notes: [
      'The trigger needs no API call: add a Generic Webhook to the inbox in Mailparser, pointing at the automation’s webhook URL. The connection only serves steps that read parsed data.',
    ],
  },
]
