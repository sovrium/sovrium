/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The observed-apps catalogue: the third-party apps real automation exports
 * call that the connection library (`src/library/connection/`) does not hold
 * yet, each written as the connection an import scaffolds for it.
 *
 * ## Where an app step lands
 *
 * 1. **The library holds the app**: the import installs the library's own
 *    connection, exactly as `sovrium library add` writes it, and the step is a
 *    `connection/call`. This file is never read for it.
 * 2. **This catalogue holds the app**: the import writes the connection
 *    declared here, and a step whose action names an operation of the entry
 *    is a `connection/call` of it. An action whose endpoint is not known is an
 *    `http/request` authenticated by the same connection, its address a TODO.
 * 3. **Neither does**: the connection is a skeleton named after the app, its
 *    base URL and token read from env names derived from that name.
 *
 * ## Every entry is shaped to be promoted
 *
 * An entry carries what a library connection entry carries — the provider and
 * where its documentation lives, the env names, the connection without its
 * name, the operations — so it can be moved into `src/library/connection/` as
 * it stands. Once moved, it is deleted from here: the co-located test refuses
 * a slug both places hold, so an app has one definition at a time.
 *
 * ## Nothing is invented
 *
 * Each fact an entry states cites the page it was read on, and says whether
 * the vendor's own documentation states it (`verified`), a secondary source
 * does (`secondary`), or neither could be confirmed (`unverified`). An action
 * whose endpoint could not be found names no operation: it carries the reason
 * instead, and the import writes the TODO from it.
 */

import { Schema } from 'effect'
import { ConnectionOperationSchema } from '@/domain/models/app/connections/operations'
import type { Connection } from '@/domain/models/app/connections/connection'
import type { ConnectionOperation } from '@/domain/models/app/connections/operations'

/** How far a fact was confirmed. */
export const CatalogueFactStatusSchema = Schema.Literals([
  'verified',
  'secondary',
  'unverified',
]).annotate({
  description:
    "Whether the vendor's own documentation states the fact (verified), only a secondary source does (secondary), or neither could be confirmed (unverified)",
})

/** One fact an entry states, and where it was read. */
export const CatalogueFactSchema = Schema.Struct({
  claim: Schema.String.annotate({ description: 'The fact, in one sentence' }),
  url: Schema.String.annotate({ description: 'The page it was read on' }),
  status: CatalogueFactStatusSchema,
})

/** A source action the entry covers, and the operation it calls, or why it calls none. */
export const CatalogueActionSchema = Schema.Struct({
  tool: Schema.Literals(['n8n', 'make', 'zapier']).annotate({
    description: 'The automation tool whose export names the action',
  }),
  app: Schema.String.annotate({
    description:
      "The app in the tool's own spelling: a Zapier `selected_api` without version or platform suffix compares equal",
  }),
  operation: Schema.String.annotate({
    description: "The action in the tool's own spelling (`file`, `file.upload`)",
  }),
  kind: Schema.Literals(['step', 'trigger']).annotate({
    description:
      'A step calls the operation; a trigger becomes a webhook the operation registers with the vendor',
  }),
  calls: Schema.optional(
    Schema.String.annotate({ description: 'The operation of the entry it calls or registers with' })
  ),
  unknown: Schema.optional(
    Schema.String.annotate({
      description:
        'Why no operation is named: the endpoint behind the action could not be found. The step becomes an http/request on the connection, its address a TODO',
    })
  ),
})

/** The OAuth application the operator registers with the vendor, for an oauth2 entry. */
export const CatalogueOAuthAppSchema = Schema.Struct({
  registerAt: Schema.String.annotate({
    description: 'Where the operator creates the OAuth application and sets its redirect URI',
  }),
  scopes: Schema.Array(Schema.String).annotate({
    description: 'The scopes the declared operations need',
  }),
})

/** One app of the catalogue. */
export const FlowAppCatalogueEntrySchema = Schema.Struct({
  slug: Schema.String.check(Schema.isPattern(/^[a-z][a-z0-9-]*$/)).annotate({
    description:
      'The connection name the import writes, and the library slug the entry takes once promoted',
  }),
  title: Schema.String.annotate({ description: 'What the connection is, in a library title' }),
  rank: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)).annotate({
    description:
      'Its place among the apps missing from the library, by how often the observed exports call it (1 = most often); the order promotions should follow',
  }),
  provider: Schema.Struct({
    name: Schema.String,
    docsUrl: Schema.String,
    verifiedOn: Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/)),
  }).annotate({ description: 'The vendor, its API documentation, and when it was last read' }),
  env: Schema.Array(Schema.String.check(Schema.isPattern(/^[A-Z][A-Z0-9_]*$/))).annotate({
    description: 'The env NAMES the connection reads; a value is never written',
  }),
  connection: Schema.Record(Schema.String, Schema.Unknown).annotate({
    description:
      'The `connections[]` entry without its name and operations: type, label, description, props and baseUrl, as a library entry builds it',
  }),
  operations: Schema.Array(ConnectionOperationSchema).annotate({
    description: 'The operations behind the actions the exports call, and only those',
  }),
  oauthApp: Schema.optional(CatalogueOAuthAppSchema),
  actions: Schema.Array(CatalogueActionSchema).annotate({
    description: 'Every source action the observed exports call on the app',
  }),
  facts: Schema.Array(CatalogueFactSchema).annotate({
    description: 'Where the auth scheme, the base URL and each operation were read',
  }),
  notes: Schema.Array(Schema.String).annotate({
    description: 'What the operator has to know, in the voice of a library note',
  }),
})

export type FlowAppCatalogueEntry = Schema.Schema.Type<typeof FlowAppCatalogueEntrySchema>

/** The connection fields an entry carries, typed against the real connection union. */
type ScaffoldConnection = Connection extends infer One
  ? One extends Connection
    ? Omit<One, 'name' | 'operations'>
    : never
  : never

/** A connection as an entry carries it, checked against the real connection union. */
export const scaffold = (connection: ScaffoldConnection): Readonly<Record<string, unknown>> =>
  connection

/** An operation, checked against the real operation schema. */
export const operation = (definition: ConnectionOperation): ConnectionOperation => definition

/** The day the entries were last checked against their sources. */
export const CHECKED_ON = '2026-10-20'
