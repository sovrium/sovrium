/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The observed-apps catalogue, by rank: the apps real exports call that the
 * connection library does not hold yet. The schema and the rules are in
 * `flow-app-catalogue.ts`; the apps reached through a trigger are in
 * `flow-app-catalogue-trigger-rows.ts`.
 */

import { CHECKED_ON, scaffold, type FlowAppCatalogueEntry } from './flow-app-catalogue'
import { FLOW_APP_TRIGGER_ROWS } from './flow-app-catalogue-trigger-rows'

/**
 * The observed apps the library lacks, by rank. Calendly and lemlist, which
 * the exports also call often, are library connections already: lemlist's
 * activity trigger registers its webhook with the library's `post-hooks`.
 * Promoted to the library since: Dropbox, Mailjet, Typeform, Jotform, Webflow,
 * Trello, MeisterTask.
 */
export const FLOW_APP_CATALOGUE: readonly FlowAppCatalogueEntry[] = [
  {
    slug: 'pdffiller',
    title: 'PDF forms with pdfFiller (token)',
    rank: 1,
    provider: {
      name: 'pdfFiller',
      docsUrl: 'https://docs.pdffiller.com/',
      verifiedOn: CHECKED_ON,
    },
    env: ['PDFFILLER_API_TOKEN'],
    connection: scaffold({
      type: 'bearer',
      label: 'pdfFiller',
      description: 'pdfFiller API, authenticated with an access token',
      props: { token: '$env.PDFFILLER_API_TOKEN' },
      baseUrl: 'https://api.pdffiller.com/v2',
    }),
    operations: [],
    actions: [
      {
        tool: 'zapier',
        app: 'PDFfillerCLIAPI',
        operation: 'create_fillable_template_async',
        kind: 'step',
        unknown:
          "pdfFiller's own reference could not be read, and no secondary source names the v2 endpoint that turns a document into a fillable template",
      },
    ],
    facts: [
      {
        claim: 'The v2 API lives at https://api.pdffiller.com/v2 and takes a bearer access token',
        url: 'https://pipedream.com/apps/pdffiller',
        status: 'unverified',
      },
    ],
    notes: [
      'Check the base URL and the token type against your pdfFiller account before switching an automation on: neither could be confirmed in pdfFiller’s own documentation.',
    ],
  },
  ...FLOW_APP_TRIGGER_ROWS,
]
