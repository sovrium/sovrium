/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Make fetcher: every scenario of one team, read through the Web API v2
 * on the organisation's own zone (pinned under
 * `[internal ref]`).
 *
 * - `GET /api/v2/scenarios?teamId=…` page by page, `pg[offset]` as the cursor
 *   and `pg[sortBy]=id` for a stable order (`raw/scenarios/page-0001.json`, …).
 *   The API sends no total, so the listing stops on a page shorter than the
 *   limit it echoes.
 * - `GET /api/v2/scenarios/{id}/blueprint` once per scenario
 *   (`raw/blueprints/<id>.json`), skipped on a resumed run when the file is
 *   already in the snapshot.
 *
 * Only `GET` is sent. The token travels as `Authorization: Token …`; a `429`
 * comes back as plain text with a `Retry-After`, which the client waits out
 * (a minute when it names none).
 */

import { Effect } from 'effect'
import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { fetchSourceJson, type ImportFetchError } from './import-fetch-client'
import { heldOrFetched, type FetchContext, type FetchSummary } from './import-fetch-sink'

/** A Make zone: `eu1`, or its host (`eu1.make.com`, `us1.make.celonis.com`). */
const ZONE = /^(?:([a-z]{2}\d)|([a-z]{2}\d\.make(?:\.celonis)?\.com))$/

/** The zone host and team a `make:<zone>/<teamId>` source names, or `undefined`. */
export const parseMakeSource = (
  id: string
): { readonly host: string; readonly teamId: string } | undefined => {
  const slash = id.indexOf('/')
  const zone = ZONE.exec(id.slice(0, slash < 0 ? id.length : slash))
  const teamId = slash < 0 ? '' : id.slice(slash + 1)
  if (zone === null || !/^\d+$/.test(teamId)) return undefined
  return { host: zone[2] ?? `${zone[1] ?? ''}.make.com`, teamId }
}

/** Why a `make:` source is not one the fetcher reads, or `undefined`. */
export const refuseMakeSource = (id: string): string | undefined =>
  parseMakeSource(id) === undefined
    ? `"make:${id}" does not name a Make zone and team. Write it make:<zone>/<teamId>, the zone being the host of your Make dashboard (eu1, eu2, us1, us2, or a full host such as eu1.make.celonis.com).`
    : undefined

/** How Make is reached, given the operator's token and the `<zone>/<teamId>` source. */
export const makeTarget = (token: string, id: string) => ({
  tool: 'make',
  realBaseUrl: `https://${parseMakeSource(id)?.host ?? 'eu1.make.com'}`,
  headers: { authorization: `Token ${token}` },
  lockoutSeconds: 60,
})

/** Scenarios per page: the largest `pg[limit]` the API accepts. */
const PAGE_SIZE = 10_000

const scenariosOf = (page: unknown): readonly unknown[] =>
  isRecord(page) && Array.isArray(page['scenarios']) ? page['scenarios'] : []

/** The scenario ids a list page holds. */
const idsOf = (page: unknown): readonly string[] =>
  scenariosOf(page).flatMap((scenario) =>
    isRecord(scenario) && typeof scenario['id'] === 'number' ? [String(scenario['id'])] : []
  )

/** The page size the API applied, as it echoes it in `pg.limit`. */
const limitOf = (page: unknown): number => {
  const pg = isRecord(page) && isRecord(page['pg']) ? page['pg'] : {}
  const limit = Number(pg['limit'])
  return Number.isInteger(limit) && limit > 0 ? limit : PAGE_SIZE
}

const pagePath = (page: number): string =>
  `raw/scenarios/page-${String(page).padStart(4, '0')}.json`

const RESOURCE = 'scenarios'

/** The ids of the pages a previous run already wrote. */
const heldIds = (
  context: FetchContext,
  pages: number
): Effect.Effect<readonly string[], ImportFetchError> =>
  Effect.forEach(
    Array.from({ length: pages }, (_unused, index) => pagePath(index + 1)),
    (path) => context.sink.readRaw(path)
  ).pipe(Effect.map((held) => held.flatMap(idsOf)))

/** One list page at `offset`. */
const listPage = (context: FetchContext, teamId: string, offset: number) =>
  fetchSourceJson(context.target, context.base, {
    method: 'GET',
    path: '/api/v2/scenarios',
    query: {
      teamId,
      'pg[limit]': String(PAGE_SIZE),
      'pg[offset]': String(offset),
      'pg[sortBy]': 'id',
      'pg[sortDir]': 'asc',
    },
  })

/** Every scenario id of the team, page by page, from where a previous run stopped. */
const listScenarios = (
  context: FetchContext,
  teamId: string
): Effect.Effect<readonly string[], ImportFetchError> => {
  const previous = context.sink.cursorOf(RESOURCE)
  const step = (
    pages: number,
    offset: number,
    ids: readonly string[]
  ): Effect.Effect<readonly string[], ImportFetchError> =>
    listPage(context, teamId, offset).pipe(
      Effect.tap((response) => context.sink.writeRaw(pagePath(pages + 1), response.bytes)),
      Effect.flatMap((response) => {
        const found = [...ids, ...idsOf(response.json)]
        const served = scenariosOf(response.json).length
        const complete = served === 0 || served < limitOf(response.json)
        const next = offset + served
        const cursor = complete ? {} : { cursor: String(next) }
        return context.sink
          .saveCursor({ resource: RESOURCE, pages: pages + 1, complete, ...cursor })
          .pipe(
            Effect.flatMap(() => (complete ? Effect.succeed(found) : step(pages + 1, next, found)))
          )
      })
    )
  const pages = previous?.pages ?? 0
  const held = heldIds(context, pages)
  return previous?.complete === true
    ? held
    : held.pipe(Effect.flatMap((ids) => step(pages, Number(previous?.cursor ?? 0), ids)))
}

/** One scenario's blueprint, unless a previous run already wrote it. */
const fetchBlueprint = (
  context: FetchContext,
  scenarioId: string
): Effect.Effect<void, ImportFetchError> =>
  heldOrFetched(
    context,
    `raw/blueprints/${scenarioId}.json`,
    `/api/v2/scenarios/${scenarioId}/blueprint`
  ).pipe(Effect.asVoid)

/** Fetch every scenario blueprint of one Make team into the snapshot. */
export const fetchMakeTeam = (
  context: FetchContext,
  id: string
): Effect.Effect<FetchSummary, ImportFetchError> =>
  Effect.gen(function* () {
    const teamId = parseMakeSource(id)?.teamId ?? ''
    const scenarioIds = yield* listScenarios(context, teamId)
    yield* Effect.forEach(scenarioIds, (scenarioId) => fetchBlueprint(context, scenarioId), {
      discard: true,
    })
    return { ids: [teamId, ...scenarioIds], apiVersion: 'v2' }
  }).pipe(Effect.withSpan('import.fetch-make-team'))
