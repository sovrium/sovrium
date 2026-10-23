/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  gifMediaProgram,
  searchGifsProgram,
} from '@/application/use-cases/connections/gif-programs'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import {
  gifSearchQuerySchema,
  gifSearchResponseSchema,
} from '@/domain/models/api/connections/connections'
import { isAuthenticatedSession } from '@/domain/models/app/auth/guest-session'
import { logError } from '@/infrastructure/logging/logger'
import { provideDomain, runRequestEffect } from '@/infrastructure/logging/request-effect'
import { notFound, requireSession } from '@/presentation/api/runtime/auth-helpers'
import { connectionError } from './error-envelopes'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * The GIF routes of a composer's picker:
 *
 *   GET /api/connections/:name/gif-search?q=      → the results, addressed to the app
 *   GET /api/connections/:name/gifs/:id           → the GIF, served by the app
 *   GET /api/connections/:name/gifs/:id/preview   → its small rendition
 *
 * Signed-in callers only, and only for a connection a composer on a page names
 * as its `gif.connection` — any other name answers 404 — so these routes are
 * not a way to call an arbitrary connection. None takes an address: the search
 * takes words, the media routes an id the provider gave the server.
 */

/** A signed-in member, or the refusal to answer: 401 signed out, 404 to a guest. */
const signedInMember = (c: Context): Response | undefined => {
  const auth = requireSession(c)
  if (!auth.ok) return auth.response
  return isAuthenticatedSession(auth.session.userId) ? undefined : notFound(c)
}

/** A provider that did not answer usably is logged with its reason, never sent to the page. */
const providerFailed = (c: Context, reason: string): Response => {
  logError('[connections] a GIF provider did not answer usably', new Error(reason), {
    'sovrium.connection.name': c.req.param('name') ?? '',
  })
  return connectionError(c, 502, 'gif_provider_failed', {
    message: 'The GIF service did not answer. Try again.',
  })
}

/** `GET /api/connections/:name/gif-search?q=` */
export async function handleGifSearch(c: Context, app: App): Promise<Response> {
  const refused = signedInMember(c)
  if (refused !== undefined) return refused
  const query = decodeSafe(gifSearchQuerySchema)({ q: c.req.query('q') ?? '' })
  if (!query.success) return connectionError(c, 400, 'gif_search_words_required')
  const result = await runRequestEffect(
    c,
    provideDomain(c, searchGifsProgram(app, c.req.param('name') ?? '', query.data.q)).pipe(
      Effect.result
    )
  )
  if (result._tag === 'Failure') {
    return result.failure._tag === 'GifNotFoundError'
      ? notFound(c)
      : providerFailed(c, result.failure.reason)
  }
  const answer = decodeSafe(gifSearchResponseSchema)(result.success)
  return answer.success
    ? c.json(answer.data, 200)
    : providerFailed(c, 'the results broke their contract')
}

/** `GET /api/connections/:name/gifs/:id` and `GET /api/connections/:name/gifs/:id/preview` */
export async function handleGifMedia(c: Context, app: App, preview: boolean): Promise<Response> {
  const refused = signedInMember(c)
  if (refused !== undefined) return refused
  const result = await runRequestEffect(
    c,
    provideDomain(
      c,
      gifMediaProgram(app, {
        name: c.req.param('name') ?? '',
        id: c.req.param('id') ?? '',
        preview,
      })
    ).pipe(Effect.result)
  )
  if (result._tag === 'Failure') {
    return result.failure._tag === 'GifNotFoundError'
      ? notFound(c)
      : providerFailed(c, result.failure.reason)
  }
  return new Response(new Blob([result.success.bytes as Uint8Array<ArrayBuffer>]), {
    headers: {
      'Content-Type': result.success.contentType,
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  })
}
