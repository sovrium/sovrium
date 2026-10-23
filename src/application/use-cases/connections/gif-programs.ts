/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A composer's GIF picker, on the server side: the search, and the GIFs it
 * serves.
 *
 * The search is sent through the connection a composer names as its
 * `gif.connection`, with the operator's key placed as the connection says
 * (`apiKey.query` for GIPHY), and its answer read into one shape whose
 * addresses are the APP's own media routes. A media route serves a GIF by id:
 * the provider address behind the id is the one the provider gave the server
 * (in a search answer, or in its answer to the connection's `get` lookup), and
 * the bytes are fetched once through the guarded egress, checked to be a
 * picture within a size cap, and cached. So the key never reaches a page and a
 * reader's browser never contacts the provider.
 */

import { Data, Effect } from 'effect'
import {
  GIF_ID_PATTERN,
  GIF_SEARCH_MAX_RESULTS,
  composerGifConnectionsOf,
  readGiphyAnswer,
  type GifPick,
} from '@/domain/models/app/connections/gif-provider-service'
import {
  knownGifMedia,
  mayLookUpGif,
  rememberGifMedia,
  rememberMissingGif,
} from '@/infrastructure/egress/gif-media-registry'
import { guardedFetch, guardedText } from '@/infrastructure/egress/guarded-fetch'
import { systemResolveHost } from '@/infrastructure/egress/host-resolution'
import { fetchRemoteImage, type RemoteImage } from '@/infrastructure/egress/remote-media'
import { withAuthQuery } from '../automations/action-handlers/auth-headers'
import { buildOperationRequest } from '../automations/action-handlers/connection-request'
import { buildStaticAuthHeader } from '../automations/action-handlers/static-auth-header'
import { buildEnvLookup, resolveEnvInString } from '../automations/resolve-env-vars'
import type { GifSearchResponse } from '@/domain/models/api/connections/connections'
import type { App } from '@/domain/models/app'
import type { ConnectionOperation } from '@/domain/models/app/connections'

/** The connection is not a composer's GIF connection, or the GIF is unknown: the caller sees 404. */
export class GifNotFoundError extends Data.TaggedError('GifNotFoundError')<{
  readonly reason: string
}> {}

/** The provider did not answer usably: refused, failed, or unreachable. */
export class GifProviderError extends Data.TaggedError('GifProviderError')<{
  readonly reason: string
}> {}

/** How long one call to the provider, or one media read, may take. */
const PROVIDER_TIMEOUT_MS = 10_000

/** The largest provider answer read, in bytes. */
const ANSWER_MAX_BYTES = 2 * 1024 * 1024

/** The largest full GIF and the largest preview the app keeps and serves. */
const GIF_MAX_BYTES = 8 * 1024 * 1024
const PREVIEW_MAX_BYTES = 2 * 1024 * 1024

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

interface GifConnection {
  readonly name: string
  readonly type: string
  readonly baseUrl?: string | undefined
  readonly props: Record<string, unknown>
  readonly operations?: ReadonlyArray<ConnectionOperation> | undefined
}

/** The composer's GIF connection by name, or the 404 a name no composer uses gets. */
const gifConnectionOf = (
  app: App,
  name: string
): Effect.Effect<GifConnection, GifNotFoundError> => {
  const connection = ((app.connections ?? []) as readonly GifConnection[]).find(
    (candidate) => candidate.name === name
  )
  return connection === undefined || !composerGifConnectionsOf(app).has(name)
    ? Effect.fail(new GifNotFoundError({ reason: `no composer picks GIFs through '${name}'` }))
    : Effect.succeed(connection)
}

/** Where the connection's key goes on a request: a query parameter, or a header. */
const placedKey = (
  app: App,
  connection: GifConnection
): Effect.Effect<
  { readonly query: Readonly<Record<string, string>>; readonly headers: Record<string, string> },
  GifProviderError
> => {
  const auth = buildStaticAuthHeader(connection, buildEnvLookup(app.env, process.env))
  if ('error' in auth || 'unconfigured' in auth) {
    return Effect.fail(new GifProviderError({ reason: 'the connection has no usable key' }))
  }
  return Effect.succeed(
    'query' in auth
      ? { query: { [auth.query]: auth.value }, headers: {} }
      : { query: {}, headers: { [auth.header]: auth.value } }
  )
}

/** Send one built request through the guard and read its answer as JSON. */
const sendForJson = (request: {
  readonly url: string
  readonly method: string
  readonly headers: Record<string, string>
}): Effect.Effect<unknown, GifProviderError> =>
  Effect.gen(function* () {
    const sent = yield* Effect.tryPromise({
      try: () =>
        guardedFetch(
          request.url,
          { method: request.method, headers: request.headers },
          { timeoutMs: PROVIDER_TIMEOUT_MS, maxBodyBytes: ANSWER_MAX_BYTES }
        ),
      catch: (error) =>
        new GifProviderError({ reason: error instanceof Error ? error.message : String(error) }),
    })
    if (!sent.ok) return yield* new GifProviderError({ reason: sent.message })
    if (!sent.response.ok || sent.response.truncated) {
      return yield* new GifProviderError({ reason: `HTTP ${String(sent.response.status)}` })
    }
    const { response } = sent
    return yield* Effect.try({
      try: () => JSON.parse(guardedText(response)) as unknown,
      catch: () => new GifProviderError({ reason: 'the answer is not JSON' }),
    })
  })

/** Call one declared operation of the connection and read its JSON answer. */
const callOperation = (
  app: App,
  connection: GifConnection,
  input: { readonly operation: string; readonly params: Readonly<Record<string, unknown>> }
): Effect.Effect<unknown, GifProviderError> =>
  Effect.gen(function* () {
    const operation = connection.operations?.find((candidate) => candidate.name === input.operation)
    if (operation === undefined) {
      return yield* new GifProviderError({
        reason: `operation '${input.operation}' is not declared`,
      })
    }
    const key = yield* placedKey(app, connection)
    const baseUrl = resolveEnvInString(
      connection.baseUrl ?? '',
      buildEnvLookup(app.env, process.env)
    )
    const built = buildOperationRequest({ baseUrl, operation, params: input.params })
    if (!built.ok) return yield* new GifProviderError({ reason: built.error })
    return yield* sendForJson({
      url: withAuthQuery(built.request.url, key),
      method: built.request.method,
      headers: { ...built.request.headers, ...key.headers },
    })
  })

/** The params of the search operation the connection declares: the words, and a cap when it takes one. */
const searchParams = (connection: GifConnection, q: string): Readonly<Record<string, unknown>> => {
  const declared = connection.operations?.find((op) => op.name === 'search')?.params ?? {}
  return { q, ...('limit' in declared ? { limit: GIF_SEARCH_MAX_RESULTS } : {}) }
}

/** The app's own address of a GIF, or of its preview. */
const mediaPath = (name: string, id: string, preview: boolean): string =>
  `/api/connections/${encodeURIComponent(name)}/gifs/${id}${preview ? '/preview' : ''}`

const remember = (name: string, picks: readonly GifPick[]): void =>
  rememberGifMedia(
    name,
    picks.map((pick) => ({
      id: pick.id,
      media: { original: pick.original.url, preview: pick.preview.url },
    }))
  )

/** `GET /api/connections/:name/gif-search?q=` — the results, addressed to the app. */
export const searchGifsProgram = (
  app: App,
  name: string,
  q: string
): Effect.Effect<GifSearchResponse, GifNotFoundError | GifProviderError> =>
  Effect.gen(function* () {
    const connection = yield* gifConnectionOf(app, name)
    const answer = yield* callOperation(app, connection, {
      operation: 'search',
      params: searchParams(connection, q),
    })
    const picks = readGiphyAnswer(answer)
    yield* Effect.sync(() => remember(name, picks))
    return {
      results: picks.map((pick) => ({
        id: pick.id,
        title: pick.title,
        url: mediaPath(name, pick.id, false),
        previewUrl: mediaPath(name, pick.id, true),
        width: pick.original.width,
        height: pick.original.height,
      })),
    }
  }).pipe(Effect.withSpan('connections.search-gifs', { attributes: { connection: name } }))

/** Ask the provider for one GIF by id, through the connection's `get` operation. */
const lookUpById = (app: App, connection: GifConnection, id: string) =>
  Effect.gen(function* () {
    const get = connection.operations?.find((op) => op.name === 'get')
    if (get === undefined || !mayLookUpGif(connection.name, id)) {
      return yield* new GifNotFoundError({ reason: 'the GIF is not known' })
    }
    const pathParam = Object.entries(get.params ?? {}).find(([, param]) => param.in === 'path')?.[0]
    const answer = yield* callOperation(app, connection, {
      operation: 'get',
      params: pathParam === undefined ? {} : { [pathParam]: id },
    })
    const pick = readGiphyAnswer(answer).find((candidate) => candidate.id === id)
    if (pick === undefined) {
      rememberMissingGif(connection.name, id)
      return yield* new GifNotFoundError({ reason: 'the provider knows no GIF by this id' })
    }
    remember(connection.name, [pick])
    return { original: pick.original.url, preview: pick.preview.url }
  })

/** The provider addresses of a GIF: remembered, else looked up by id through `get`. */
const addressesOf = (app: App, connection: GifConnection, id: string) => {
  const kept = knownGifMedia(connection.name, id)
  return kept === undefined ? lookUpById(app, connection, id) : Effect.succeed(kept)
}

/**
 * `GET /api/connections/:name/gifs/:id(/preview)` — the GIF's bytes, read once
 * through the guarded egress and served by the app.
 */
export const gifMediaProgram = (
  app: App,
  input: { readonly name: string; readonly id: string; readonly preview: boolean }
): Effect.Effect<RemoteImage, GifNotFoundError | GifProviderError> =>
  Effect.gen(function* () {
    if (!GIF_ID_PATTERN.test(input.id)) {
      return yield* new GifNotFoundError({ reason: 'not a GIF id' })
    }
    const connection = yield* gifConnectionOf(app, input.name)
    const media = yield* addressesOf(app, connection, input.id)
    const read = yield* Effect.tryPromise({
      try: () =>
        fetchRemoteImage(input.preview ? media.preview : media.original, {
          maxBytes: input.preview ? PREVIEW_MAX_BYTES : GIF_MAX_BYTES,
          timeoutMs: PROVIDER_TIMEOUT_MS,
          ttlMs: DAY_MS,
          failureTtlMs: HOUR_MS,
          resolveHost: systemResolveHost,
        }),
      catch: (error) =>
        new GifProviderError({ reason: error instanceof Error ? error.message : String(error) }),
    })
    if (!read.ok) return yield* new GifProviderError({ reason: read.reason })
    return read.image
  }).pipe(
    Effect.withSpan('connections.serve-gif', {
      attributes: { connection: input.name, preview: input.preview },
    })
  )
