/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium import fetch` — the fetchers this release ships, and the checks
 * each one needs before its first request: the source address, the token or
 * connection URL read from the environment, and the origin requests go to.
 *
 * Two kinds: an HTTP fetcher reads a tool's API through the shared client
 * (timeouts, rate limits, the loopback override); a database fetcher opens a
 * connection with the URL it is handed (Retool Database, Supabase). Either one then
 * writes into the snapshot through the same sink.
 */

import { refuse } from '@/cli/commands/app-prelude'
import { airtableTarget, fetchAirtableBase } from '@/infrastructure/egress/import/airtable'
import {
  baserowTarget,
  fetchBaserowDatabase,
  parseBaserowAddress,
} from '@/infrastructure/egress/import/baserow'
import {
  IMPORT_FETCH_BASE_URL_ENV,
  resolveImportBase,
  type ImportFetchError,
  type ImportFetchTarget,
} from '@/infrastructure/egress/import/client'
import {
  fetchFilloutForm,
  filloutTarget,
  refuseFilloutSource,
} from '@/infrastructure/egress/import/fillout'
import {
  fetchGoogleForm,
  googleFormsTarget,
  refuseGoogleFormsSource,
} from '@/infrastructure/egress/import/google-forms'
import {
  fetchJotformForm,
  jotformTarget,
  refuseJotformSource,
} from '@/infrastructure/egress/import/jotform'
import { fetchMakeTeam, makeTarget, refuseMakeSource } from '@/infrastructure/egress/import/make'
import { fetchN8nInstance, n8nTarget, refuseN8nSource } from '@/infrastructure/egress/import/n8n'
import {
  fetchNotionDatabase,
  notionTarget,
  refuseNotionSource,
} from '@/infrastructure/egress/import/notion'
import {
  fetchRetoolDatabase,
  type PostgresFetchContext,
} from '@/infrastructure/egress/import/retool-database'
import {
  fetchSpreadsheetSheets,
  refuseSheetsSource,
  sheetsTarget,
} from '@/infrastructure/egress/import/sheets'
import {
  fetchSupabaseProject,
  supabaseStorageOrigin,
  type SupabaseStorageAccess,
} from '@/infrastructure/egress/import/supabase'
import {
  fetchTallyForm,
  refuseTallySource,
  tallyTarget,
} from '@/infrastructure/egress/import/tally'
import {
  fetchTypeformForm,
  refuseTypeformSource,
  typeformTarget,
} from '@/infrastructure/egress/import/typeform'
import {
  fetchWebflowSite,
  refuseWebflowSource,
  webflowTarget,
} from '@/infrastructure/egress/import/webflow'
import {
  fetchZiteDatabase,
  refuseZiteSource,
  ziteTarget,
} from '@/infrastructure/egress/import/zite'
import { CONNECTION_URL_TOOLS, type FetchRequest } from './request'
import type { ImportDomain, ImportExportKind } from '@/domain/models/import/import-source'
import type { FetchContext, FetchSummary, SnapshotSink } from '@/infrastructure/egress/import/sink'
import type { Effect } from 'effect'

/** A fetcher that reads an HTTP API, through the shared client and its loopback override. */
interface HttpFetcher {
  readonly kind: 'http'
  /** How the source is reached, given the token and the address after the scheme. */
  readonly target: (token: string, address: string) => ImportFetchTarget
  /** Why the address is refused, before anything is read; `undefined` when it is fine. */
  readonly refuseAddress?: (address: string) => string | undefined
  /** Whether attachments on the address's own origin are trusted (a self-hosted instance). */
  readonly trustsOwnOrigin?: boolean
  readonly run: (
    context: FetchContext,
    address: string
  ) => Effect.Effect<FetchSummary, ImportFetchError>
}

/** What a database fetcher is handed beyond the connection URL. */
type DatabaseFetchContext = PostgresFetchContext & {
  readonly storage: SupabaseStorageAccess | undefined
}

/** A fetcher that opens a database connection with the secret it is handed. */
interface DatabaseFetcher {
  readonly kind: 'database'
  readonly exportKind: ImportExportKind
  /** The object store the source's files are downloaded from, checked before anything is read. */
  readonly storage?: (
    request: FetchRequest,
    domains: readonly ImportDomain[]
  ) => SupabaseStorageAccess | undefined
  readonly run: (
    secret: string,
    context: DatabaseFetchContext
  ) => Effect.Effect<FetchSummary, ImportFetchError>
}

const SUPABASE_URL_ENV = 'SUPABASE_URL'
const SUPABASE_KEY_ENV = 'SUPABASE_SERVICE_ROLE_KEY'

/**
 * Where a Supabase project's objects are downloaded from: `SUPABASE_URL` and
 * `SUPABASE_SERVICE_ROLE_KEY`, both required unless no object is downloaded
 * (`--skip-attachments`, or `--only` without `buckets`). Refused by name, never
 * by value, before anything is read.
 */
const supabaseStorageOf = (
  request: FetchRequest,
  domains: readonly ImportDomain[]
): SupabaseStorageAccess | undefined => {
  if (request.skipAttachments || !domains.includes('buckets')) return undefined
  const url = process.env[SUPABASE_URL_ENV] ?? ''
  const key = process.env[SUPABASE_KEY_ENV] ?? ''
  if (url === '' || key === '') {
    return refuse(
      `Error: ${SUPABASE_URL_ENV} and ${SUPABASE_KEY_ENV} must both be set to download the storage objects, so nothing was fetched.\n\n` +
        `  Put the project URL in ${SUPABASE_URL_ENV} and the service-role key in ${SUPABASE_KEY_ENV},\n` +
        '  or pass --skip-attachments to read the buckets without their files. Neither is ever written to the snapshot.'
    )
  }
  const origin = supabaseStorageOrigin(url, SUPABASE_URL_ENV)
  return origin.ok
    ? { origin: origin.origin, serviceRoleKey: key }
    : refuse(`Error: ${origin.reason} Nothing was fetched.`)
}

type Fetcher = HttpFetcher | DatabaseFetcher

const FETCHERS: Readonly<Partial<Record<string, Fetcher>>> = {
  airtable: { kind: 'http', target: airtableTarget, run: fetchAirtableBase },
  baserow: {
    kind: 'http',
    target: baserowTarget,
    refuseAddress: (address) => {
      const parsed = parseBaserowAddress(address)
      return parsed.ok ? undefined : parsed.reason
    },
    trustsOwnOrigin: true,
    run: fetchBaserowDatabase,
  },
  make: { kind: 'http', target: makeTarget, refuseAddress: refuseMakeSource, run: fetchMakeTeam },
  n8n: { kind: 'http', target: n8nTarget, refuseAddress: refuseN8nSource, run: fetchN8nInstance },
  notion: {
    kind: 'http',
    target: notionTarget,
    refuseAddress: refuseNotionSource,
    run: fetchNotionDatabase,
  },
  'google-sheets': {
    kind: 'http',
    target: sheetsTarget,
    refuseAddress: refuseSheetsSource,
    run: fetchSpreadsheetSheets,
  },
  'retool-database': { kind: 'database', exportKind: 'postgres', run: fetchRetoolDatabase },
  supabase: {
    kind: 'database',
    exportKind: 'postgres',
    storage: supabaseStorageOf,
    run: fetchSupabaseProject,
  },
  webflow: {
    kind: 'http',
    target: webflowTarget,
    refuseAddress: refuseWebflowSource,
    run: fetchWebflowSite,
  },
  zite: {
    kind: 'http',
    target: ziteTarget,
    refuseAddress: refuseZiteSource,
    run: fetchZiteDatabase,
  },
  typeform: {
    kind: 'http',
    target: typeformTarget,
    refuseAddress: refuseTypeformSource,
    run: fetchTypeformForm,
  },
  tally: {
    kind: 'http',
    target: tallyTarget,
    refuseAddress: refuseTallySource,
    run: fetchTallyForm,
  },
  fillout: {
    kind: 'http',
    target: filloutTarget,
    refuseAddress: refuseFilloutSource,
    run: fetchFilloutForm,
  },
  jotform: {
    kind: 'http',
    target: jotformTarget,
    refuseAddress: refuseJotformSource,
    run: fetchJotformForm,
  },
  'google-forms': {
    kind: 'http',
    target: googleFormsTarget,
    refuseAddress: refuseGoogleFormsSource,
    run: fetchGoogleForm,
  },
}

/** The token from the environment, or a refusal naming the variable. Never echoed. */
const readToken = (request: FetchRequest): string => {
  const value = process.env[request.tokenEnv]
  if (value !== undefined && value !== '') return value
  const what = CONNECTION_URL_TOOLS.has(request.source.tool) ? 'connection URL' : 'token'
  return refuse(
    `Error: ${request.tokenEnv} is not set, so nothing was fetched.\n\n` +
      `  Put the ${request.source.tool} ${what} in ${request.tokenEnv}, or name the variable that holds it with --token-env <VAR>.\n` +
      `  The ${what} is read from the environment only, and is never written to the snapshot.`
  )
}

/** The fetch, ready to run into a sink once the folder is known. */
type Runner = (sink: SnapshotSink) => Effect.Effect<FetchSummary, ImportFetchError>

/** What follows the scheme of a source URI: an id, or an instance URL and an id. */
const addressOf = (uri: string): string => uri.slice(uri.indexOf(':') + 1)

/** An HTTP fetch: the address checked, the token read, the origin resolved. */
const httpRunner = (
  fetcher: HttpFetcher,
  request: FetchRequest,
  domains: readonly ImportDomain[]
): Runner => {
  const address = addressOf(request.uri)
  const refusal = fetcher.refuseAddress?.(address)
  if (refusal !== undefined) return refuse(`Error: ${refusal}`)
  const target = fetcher.target(readToken(request), address)
  const override = process.env[IMPORT_FETCH_BASE_URL_ENV] || undefined
  const base = resolveImportBase(target, override)
  if (!base.ok) return refuse(`Error: ${base.reason}`)
  const trusted =
    override === undefined
      ? fetcher.trustsOwnOrigin === true
        ? new URL(target.realBaseUrl).origin
        : undefined
      : new URL(override).origin
  return (sink) =>
    fetcher.run(
      {
        target,
        base: base.base,
        overrideOrigin: trusted,
        sink,
        domains,
        skipAttachments: request.skipAttachments,
      },
      address
    )
}

/** The fetcher a request names, ready to run, and the export kind its snapshot records. */
export const fetchRunnerOf = (
  request: FetchRequest,
  domains: readonly ImportDomain[]
): { readonly runner: Runner; readonly exportKind: ImportExportKind } => {
  const fetcher =
    FETCHERS[request.source.tool] ??
    refuse(
      `Error: Fetching ${request.source.tool} is not in this release, so nothing was fetched.\n\n` +
        '  Export the data from the tool and give the export file to `sovrium import`.'
    )
  if (fetcher.kind === 'http') {
    return { runner: httpRunner(fetcher, request, domains), exportKind: 'api' }
  }
  const secret = readToken(request)
  const storage = fetcher.storage?.(request, domains)
  return {
    runner: (sink) => fetcher.run(secret, { sink, domains, storage }),
    exportKind: fetcher.exportKind,
  }
}
