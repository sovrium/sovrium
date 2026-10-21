/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The vocabulary of `sovrium import`: which tools it reads, in which shapes,
 * and which parts of a migrated app it produces.
 *
 * `sovrium import` migrates an app out of another tool in two stages. The
 * `fetch` stage is the only one that touches the network: it reads a tool's API
 * read-only, with a token taken from the environment, and writes a local
 * snapshot folder. The conversion stage reads that snapshot (or an export file
 * the operator already holds) offline and deterministically, and writes config
 * entries and seed files.
 *
 * Everything in this file is data. The per-tool adapters, the fetchers and the
 * mappers are written against these names, so a tool or a domain is added here
 * first and nowhere else.
 */

import { Schema } from 'effect'

/**
 * Every tool `sovrium import` reads, as `--from` names it.
 *
 * One name per tool, not per export kind: Webflow's CMS items, its form
 * webhooks and its site-export ZIP are all `webflow`, told apart by the
 * snapshot's {@link ImportExportKindSchema}. Retool is the exception because
 * its three products share nothing but the brand: a Postgres database, a
 * workflow engine and a classic app builder.
 */
export const IMPORT_SOURCE_TOOLS = [
  'airtable',
  'notion',
  'google-sheets',
  'csv',
  'xlsx',
  'baserow',
  'retool-database',
  'webflow',
  'zapier-tables',
  'zite',
  'n8n',
  'make',
  'zapier',
  'retool-workflows',
  'retool-classic',
  'typeform',
  'jotform',
  'google-forms',
  'tally',
  'fillout',
  'microsoft-forms',
] as const

export const ImportSourceToolSchema = Schema.Literals(IMPORT_SOURCE_TOOLS).annotate({
  identifier: 'ImportSourceTool',
  title: 'Import Source Tool',
  description:
    'The tool a migration reads, as the `--from` flag of `sovrium import` names it. Detection picks it when the flag is absent.',
})

export type ImportSourceTool = Schema.Schema.Type<typeof ImportSourceToolSchema>

/**
 * The parts of an app a migration produces, as `--only` names them.
 *
 * `pages` is produced by the pages programme's converter from a site or app
 * export; this vocabulary only lets the operator select or skip it.
 */
export const IMPORT_DOMAINS = ['tables', 'data', 'automations', 'forms', 'pages'] as const

export const ImportDomainSchema = Schema.Literals(IMPORT_DOMAINS).annotate({
  identifier: 'ImportDomain',
  title: 'Import Domain',
  description:
    'One part of a migrated app: table definitions, the records they hold, automations, forms with their responses, or pages.',
})

export type ImportDomain = Schema.Schema.Type<typeof ImportDomainSchema>

/**
 * How the bytes in a snapshot's `raw/` folder were obtained.
 *
 * `api` is a fetch; every other value is an export file the operator supplied,
 * kept byte for byte so the conversion can be replayed against exactly what it
 * read.
 */
export const IMPORT_EXPORT_KINDS = [
  'api',
  'postgres',
  'csv',
  'xlsx',
  'json',
  'zip',
  'sql-dump',
] as const

export const ImportExportKindSchema = Schema.Literals(IMPORT_EXPORT_KINDS).annotate({
  identifier: 'ImportExportKind',
  title: 'Import Export Kind',
  description:
    'How the source was obtained: `api` and `postgres` by `sovrium import fetch`, the others as an export file the operator downloaded from the tool.',
})

export type ImportExportKind = Schema.Schema.Type<typeof ImportExportKindSchema>

/**
 * One source `sovrium import fetch` can read over the network.
 *
 * `tokenEnv` is the environment variable read when `--token-env` is not
 * passed. It is a NAME: the token's value is read from the environment at run
 * time and is never written anywhere — not to the snapshot, the config, a seed
 * file, the report or a log line.
 */
export interface ImportFetchSource {
  /** The scheme of the source URI, before the colon. */
  readonly scheme: string
  /** The tool the scheme reads. */
  readonly tool: ImportSourceTool
  /** The default environment variable holding the token or connection string. */
  readonly tokenEnv: string
  /** The shape of the rest of the URI, for help text and refusals. */
  readonly uri: string
  /** The parts of an app this source can provide. */
  readonly domains: readonly ImportDomain[]
}

/**
 * The sources `sovrium import fetch` reads, in the order `--help` lists them.
 *
 * Absent on purpose: CSV, XLSX, Zapier Tables, Zapier, Retool Workflows,
 * Retool classic and Microsoft Forms have no read API a migration can use, so
 * they are export files only and never fetched. Pages are never fetched either:
 * a page source is always an export file the operator downloaded.
 */
export const IMPORT_FETCH_SOURCES: readonly ImportFetchSource[] = [
  {
    scheme: 'airtable',
    tool: 'airtable',
    tokenEnv: 'AIRTABLE_TOKEN',
    uri: 'airtable:<baseId>',
    domains: ['tables', 'data', 'forms'],
  },
  {
    scheme: 'notion',
    tool: 'notion',
    tokenEnv: 'NOTION_TOKEN',
    uri: 'notion:<databaseId>',
    domains: ['tables', 'data'],
  },
  {
    scheme: 'sheets',
    tool: 'google-sheets',
    tokenEnv: 'GOOGLE_TOKEN',
    uri: 'sheets:<spreadsheetId>',
    domains: ['tables', 'data'],
  },
  {
    scheme: 'baserow',
    tool: 'baserow',
    tokenEnv: 'BASEROW_TOKEN',
    uri: 'baserow:<host>#<databaseId>',
    domains: ['tables', 'data'],
  },
  {
    scheme: 'retool-db',
    tool: 'retool-database',
    tokenEnv: 'RETOOL_DB_URL',
    uri: 'retool-db:$env.RETOOL_DB_URL',
    domains: ['tables', 'data'],
  },
  {
    scheme: 'webflow',
    tool: 'webflow',
    tokenEnv: 'WEBFLOW_TOKEN',
    uri: 'webflow:<siteId>',
    domains: ['tables', 'data', 'automations', 'forms'],
  },
  {
    scheme: 'zite',
    tool: 'zite',
    tokenEnv: 'ZITE_TOKEN',
    uri: 'zite:<databaseId>',
    domains: ['tables', 'data'],
  },
  {
    scheme: 'n8n',
    tool: 'n8n',
    tokenEnv: 'N8N_API_KEY',
    uri: 'n8n:<host>',
    domains: ['automations'],
  },
  {
    scheme: 'make',
    tool: 'make',
    tokenEnv: 'MAKE_TOKEN',
    uri: 'make:<region>/<teamId>',
    domains: ['automations'],
  },
  {
    scheme: 'typeform',
    tool: 'typeform',
    tokenEnv: 'TYPEFORM_TOKEN',
    uri: 'typeform:<formId>',
    domains: ['forms'],
  },
  {
    scheme: 'jotform',
    tool: 'jotform',
    tokenEnv: 'JOTFORM_API_KEY',
    uri: 'jotform:<formId>',
    domains: ['forms'],
  },
  {
    scheme: 'gforms',
    tool: 'google-forms',
    tokenEnv: 'GOOGLE_TOKEN',
    uri: 'gforms:<formId>',
    domains: ['forms'],
  },
  {
    scheme: 'tally',
    tool: 'tally',
    tokenEnv: 'TALLY_TOKEN',
    uri: 'tally:<formId>',
    domains: ['forms'],
  },
  {
    scheme: 'fillout',
    tool: 'fillout',
    tokenEnv: 'FILLOUT_TOKEN',
    uri: 'fillout:<formId>',
    domains: ['forms'],
  },
]

/**
 * Find the fetch source a URI names, by its scheme.
 *
 * Returns `undefined` for an unknown scheme, a plain path, or a URL: the
 * caller refuses it and lists the accepted schemes. A `https://` URL is never a
 * source — the scheme must name a tool, so a fetch can only reach the tool the
 * operator named.
 */
export const findFetchSource = (uri: string): ImportFetchSource | undefined => {
  const colon = uri.indexOf(':')
  if (colon <= 0) return undefined
  const scheme = uri.slice(0, colon)
  return IMPORT_FETCH_SOURCES.find((source) => source.scheme === scheme)
}
