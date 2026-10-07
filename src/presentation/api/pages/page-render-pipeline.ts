/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Page-render pipeline shared by every route that serves a page.
 *
 * Extracted verbatim from `page-routes.ts`, which now holds only route
 * REGISTRATION (which URLs are mounted, and in which order). This module holds
 * the orthogonal concern — how a matched path becomes an HTTP response: session
 * extraction, the preview flag, the page-output cache, and the request-edge
 * tracing wrapper.
 *
 * The dependency now runs strictly one way (`page-routes.ts` → this file). It
 * previously did not: `HonoAppConfig` lived in `page-routes.ts`, so this file
 * and four other route-setup siblings imported the type back out of it, forming
 * five import cycles. They were type-only and erased at compile time, so nothing
 * broke at runtime — but a config contract shared by five modules is not one
 * module's private type, and the old note here argued for keeping it in
 * `page-routes.ts` on exactly the grounds that condemned it. It now lives in the
 * leaf module `./hono-app-config`, which imports no sibling. Import it from
 * there, never re-export it from a route module.
 */

import { Data, Effect } from 'effect'
import { type Context } from 'hono'
import { PageCache, type CachedPage } from '@/application/ports/services/page-cache'
import { runDomainPromise, runRequestEffect } from '@/infrastructure/logging/request-effect'
import {
  recordPageCacheOutcome,
  type PageCacheOutcome,
} from '@/infrastructure/process/page-cache-telemetry'
import { isPartialRequest } from '@/presentation/api/runtime/content-partial'
import { microphonePolicyHeaders } from '@/presentation/api/runtime/microphone-permission'
import { varyOnPartial } from '@/presentation/api/runtime/vary'
import { pageCapturesMicrophone } from '@/presentation/render/page/page-microphone-detection'
import { absolutizeSharingImage } from '@/presentation/render/page/sharing-image-address'
import { resolveRequestBaseUrl } from '../../../domain/kernel/url/request-base-url'
import {
  systemRecordFetcher,
  systemRowsFetcher,
} from '../../../infrastructure/egress/system-rows-fetcher'
import { readTableAsCaller } from './caller-table-reader'
import { fileUrlSigner } from './file-url-signer'
import {
  CACHED_PAGE_CACHE_CONTROL,
  buildPageCacheKey,
  decidePageCache,
  REVALIDATED_PAGE_CACHE_CONTROL,
} from './page-cache-decision'
import { isPartialEligible, pagePartialOf } from './page-partial'
import { sendRevalidatedPage } from './page-revalidation'
import type { HonoAppConfig } from '../../../application/ports/contracts/hono-app-config'
import type {
  PageRenderResult,
  ReadTableAsCaller,
  SignFileUrl,
} from '@/application/ports/services/page-renderer'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'

/**
 * Status served by the rendered error page.
 *
 * Declared once and interpolated into BOTH the log line and the response so the
 * two can never drift. A `→ 500` hard-coded into a log message drifts as soon
 * as the response status becomes variable (in `createHonoApp`'s `.onError` an
 * `HTTPException` carries its own), leaving the log claiming 500 for what the
 * wire reported as a 504 — a mismatch that makes a production incident
 * unreadable from logs.
 */
export const ERROR_PAGE_STATUS = 500

/**
 * Renders an access error page with a visible error message
 */
function renderAccessErrorPage(message: string): string {
  return `<!DOCTYPE html><html><head><title>Access Error</title></head><body><p>${message}</p></body></html>`
}

type ResolvedPage =
  | { readonly redirect: string }
  | { readonly html: string }
  | { readonly unauthorized: true }
  | undefined

/**
 * Resolves a PageRenderResult into one of: redirect URL, error HTML, page HTML,
 * unauthorized signal, or undefined (404)
 */
function resolvePageResult(result: PageRenderResult): ResolvedPage {
  if (typeof result === 'string') return { html: result }
  if (!result || typeof result !== 'object') return undefined
  return resolveObjectResult(result)
}

function resolveObjectResult(
  result:
    { readonly redirect: string } | { readonly error: string } | { readonly unauthorized: true }
): ResolvedPage {
  if ('redirect' in result) return { redirect: result.redirect }
  if ('error' in result) return { html: renderAccessErrorPage(result.error) }
  if ('unauthorized' in result) return { unauthorized: true }
  return undefined
}

/**
 * Cache disposition for a page response, surfaced via the `X-Render-Cache`
 * header: `hit` (served from the page cache), `miss` (rendered then stored),
 * `bypass` (not cacheable, authenticated, preview, or `ECO_PAGE_CACHE=off`).
 *
 * Aliases the telemetry module's own type so the header and the footprint
 * dashboard's counters can never describe different vocabularies.
 */
type CacheStatus = PageCacheOutcome

/** Per-request render context threaded through to the page renderer. */
export interface PageRequestContext {
  readonly detectedLanguage?: string
  readonly session?: SessionInfo
  readonly cookies?: Readonly<Record<string, string>>
  readonly previewMode?: boolean
  /** [internal ref] / a forms spec: request query string for embedded `$query` prefill. */
  readonly requestQuery?: Readonly<Record<string, string>>
  /**
   * G1: the scheme + host this request arrived on, feeding `$app.origin`. Never
   * supplied by a route — {@link renderWithCache} attaches it, for the same
   * reason it attaches the rows reader: it is the one funnel every page surface
   * passes through, and the only place holding the request the origin is
   * resolved from.
   */
  readonly requestOrigin?: string
  /**
   * P3: server-side rows reader for `page.redirectToFirst`. Never supplied by a
   * route — {@link renderWithCache} attaches it, since it is the one place that
   * holds the request the reader must borrow its credentials from.
   */
  readonly fetchSystemRows?: (
    endpoint: string,
    rowsKey: string
  ) => Promise<readonly Record<string, unknown>[]>
  /**
   * server-side single-record reader for a page-level `{ system }`
   * binding. Attached by the same funnels and for the same reason as the rows
   * reader above — a page NAMED by its record must read it before the document
   * ships, as the caller.
   */
  readonly fetchSystemRecord?: (
    endpoint: string,
    recordKey: string | undefined
  ) => Promise<Readonly<Record<string, unknown>> | undefined>
  /**
   * The `/:lang/` URL-prefix locale, when the request
   * carried one. `detectedLanguage` above collapses the URL prefix and the
   * browser `Accept-Language` guess into one value; this keeps the URL prefix
   * distinguishable, because only IT outranks a page's own `meta.lang`.
   */
  readonly urlLanguage?: string
  /**
   * The table API's answer to "what may this caller see of this table?" — the
   * views, permission map and fields a data-table grid hands its reader. Never
   * supplied by a route: {@link renderWithCache} attaches it beside the readers.
   */
  readonly readTableAsCaller?: ReadTableAsCaller
  readonly signFileUrl?: SignFileUrl // the `file-preview` signer, attached beside the readers
}

/**
 * Sends a resolved page result as an HTTP response, or returns undefined for 404.
 *
 * HTML page responses carry two cache headers:
 *  - `X-Render-Cache`: the {@link CacheStatus} (diagnostic / E2E observable).
 *  - `Cache-Control`: the disposition chosen by the caller — see
 *    `page-cache-decision.ts` for the three constants and the decision matrix.
 *
 * Redirect and unauthorized responses are not pages and carry no cache headers.
 */
interface ResponseDisposition {
  readonly cacheStatus: CacheStatus
  readonly cacheControl: string
  /**
   * Permissions-Policy grants derived from the matched page's CONFIG
   * (`pageCapturesMicrophone`) — never from the rendered HTML, which a
   * record value or a query-string prefill can put any string into.
   */
  readonly grants: Readonly<Record<string, string>>
  /**
   * Whether the matched page may answer a content-only partial (see
   * `page-partial.ts`) — decided from its CONFIG, beside `grants`.
   */
  readonly partialEligible: boolean
}

function sendResolved(
  resolved: ReturnType<typeof resolvePageResult>,
  { cacheStatus, cacheControl, grants, partialEligible }: ResponseDisposition,
  c: Context
): Response | undefined {
  if (!resolved) return undefined
  if ('redirect' in resolved) return c.redirect(resolved.redirect, 302)
  if ('unauthorized' in resolved) {
    return c.text('Unauthorized', 401)
  }
  // Counted HERE rather than at each of the four call sites, and only on the
  // branch that actually emits a page: a redirect, a 401, and a 404
  // fall-through all reach this function carrying a `cacheStatus` they never
  // used, and counting them would inflate `bypasses` with responses the cache
  // was never asked about.

  recordPageCacheOutcome(cacheStatus)
  // One URL answers the document or its main region, by request header — so
  // every page response says so, partial or not.
  varyOnPartial(c)
  const headers = { 'X-Render-Cache': cacheStatus, 'Cache-Control': cacheControl, ...grants }
  // Past every gate above: a partial is the same answer, cut down — never a
  // way around a redirect, a 401 or a 404.
  const partial = partialEligible && isPartialRequest(c) ? pagePartialOf(resolved.html) : undefined
  const body = partial?.body ?? resolved.html
  const sent = { ...headers, ...partial?.headers }
  // A page reading record data is revalidated on every visit — see
  // `page-revalidation.ts` for the tag and the 304.
  if (cacheControl === REVALIDATED_PAGE_CACHE_CONTROL) return sendRevalidatedPage(c, body, sent)
  return c.html(body, 200, sent)
}

/**
 * The two ends of the page store, reached through the `PageCache` port on THIS
 * request's services (W5c).
 *
 * They ran the store's Effects directly until the page routes became
 * presentation, which may not import `infrastructure/server/`. Named rather than
 * inlined so {@link renderWithCache} keeps reading as the decision sequence it
 * is — the `Effect.gen` ceremony around a two-method port is noise at the point
 * where the question is "hit or miss".
 */
const readCachedPage = (c: Context, cacheKey: string): Promise<CachedPage | undefined> =>
  runDomainPromise(
    c,
    Effect.gen(function* () {
      const cache = yield* PageCache
      return yield* cache.get(cacheKey)
    })
  )

/** @see readCachedPage */
const storeRenderedPage = (c: Context, cacheKey: string, html: string): Promise<void> =>
  runDomainPromise(
    c,
    Effect.gen(function* () {
      const cache = yield* PageCache
      return yield* cache.set(cacheKey, { html, timestamp: Date.now() })
    })
  )

/**
 * Render a page, serving it from — or storing it in — the static page-output
 * cache when eligible. Returns the HTTP response, or `undefined` for a 404
 * fall-through (the caller then renders its own not-found page).
 *
 * The cache is consulted only for anonymous, non-preview requests to a
 * `'static'` or `'content'` path while `ECO_PAGE_CACHE` is on (see
 * `domain/services/pages/page-cacheability.ts` for the safety model). Every
 * other request renders fresh and reports `bypass`. Cache entries are keyed by
 * the app render-checksum — so a schema change makes stale entries unreachable
 * — plus, for a `'content'` page, its content-corpus checksum, so a markdown
 * edit invalidates the entry with no schema change and no restart.
 */
export async function renderWithCache(
  config: HonoAppConfig,
  path: string,
  reqCtx: PageRequestContext,

  c: Context
): Promise<Response | undefined> {
  const { app, renderPage } = config

  // P3: the renderer's request-bound readers (and the file signer), built HERE:
  // the one funnel every page passes through and the only place holding the request.
  const renderCtx: PageRequestContext = {
    ...reqCtx,
    fetchSystemRows: systemRowsFetcher(c),
    // The SINGLE-RECORD sibling. A page bound to a `{ system }`
    // detail endpoint is NAMED by its record, so it must be read before the
    // document ships — as the caller, and 404ing when there is none.
    fetchSystemRecord: systemRecordFetcher(c),
    // G1: the address this request arrived on — the shared resolver every
    // surface printing this instance's address uses, so none can disagree.
    requestOrigin: resolveRequestBaseUrl(c),
    // A grid's payload carries only what the table API answers its reader; a
    // `file-preview` draws its file through an address signed for this caller.
    readTableAsCaller,
    signFileUrl: fileUrlSigner(app, reqCtx.session),
  }

  const decision = decidePageCache(app, path, reqCtx)
  const pageDisposition = {
    grants: microphonePolicyHeaders(pageCapturesMicrophone(decision.classification.page, app)),
    partialEligible: isPartialEligible(decision.classification.page),
  }
  const send = (resolved: ResolvedPage, cacheStatus: CacheStatus, cacheControl: string) =>
    sendResolved(resolved, { cacheStatus, cacheControl, ...pageDisposition }, c)
  if (!decision.usable) {
    return send(
      resolvePageResult(await renderPage(app, path, renderCtx)),
      'bypass',
      decision.bypassCacheControl
    )
  }

  const cacheKey = await buildPageCacheKey(c, {
    app,
    path,
    request: reqCtx,
    classification: decision.classification,
  })
  // The cache key names no host, so the stored document must name none either:
  // it is rendered WITHOUT the request's origin, and the one origin-bearing
  // part a cacheable page carries — a sharing image given as a path or a `$t:`
  // key — is made absolute per response. Rendered with the origin, the first
  // request's `Host` / `X-Forwarded-Host` was frozen into every later
  // visitor's `og:image` (a page naming `$app.origin` is never cacheable).
  const { requestOrigin, ...originFreeCtx } = renderCtx
  const onThisHost = (html: string): string => absolutizeSharingImage(html, requestOrigin)
  const cached = await readCachedPage(c, cacheKey)
  if (cached !== undefined) {
    return send({ html: onThisHost(cached.html) }, 'hit', CACHED_PAGE_CACHE_CONTROL)
  }

  const resolved = resolvePageResult(await renderPage(app, path, originFreeCtx))
  if (resolved !== undefined && 'html' in resolved) {
    await storeRenderedPage(c, cacheKey, resolved.html)
    return send({ html: onThisHost(resolved.html) }, 'miss', CACHED_PAGE_CACHE_CONTROL)
  }
  return send(resolved, 'bypass', decision.bypassCacheControl)
}

/**
 * Extracts session info from request headers using the config's getSession callback
 */
export async function extractSession(
  config: HonoAppConfig,
  headers: Headers
): Promise<SessionInfo | undefined> {
  return config.getSession ? config.getSession(headers) : undefined
}

const EDITORIAL_ROLES: ReadonlySet<string> = new Set(['admin', 'editor'])

/**
 * Resolve the `previewMode` flag.
 *
 * Returns `true` only when:
 *  1. The request URL carries `?preview=true`, AND
 *  2. The active session belongs to a built-in editorial role (`admin` or
 *     `editor`).
 *
 * Anonymous visitors and members/viewers see the same 404 they would
 * otherwise see on a draft slug — the preview path is privileged opt-in,
 * not a security boundary. Reading the query string explicitly (rather
 * than passing the whole URL through) keeps the page renderer pure and
 * Hono-agnostic.
 */
export function resolvePreviewMode(
  c: { readonly req: { readonly query: (key: string) => string | undefined } },
  session: SessionInfo | undefined
): boolean {
  if (session === undefined) return false
  if (!EDITORIAL_ROLES.has(session.role)) return false
  return c.req.query('preview') === 'true'
}

/**
 * Render a page through the request-edge tracing wrapper.
 *
 * `runRequestEffect` opens the ROOT `http.server <METHOD> <route>` span (and the
 * in-span request log that auto-correlates to it); the SSR render runs as a CHILD
 * `page.render` span chaining under that root — the guaranteed child a `GET /`
 * fires. Transparent when traces are off: `Effect.withSpan`
 * resolves to the no-op tracer, so only the render runs and the Response is
 * returned unchanged.
 */
class PageRenderError extends Data.TaggedError('PageRenderError')<{
  readonly cause: unknown
}> {}

export function renderTracedPage(
  c: Context,
  config: HonoAppConfig,
  path: string,
  reqCtx: PageRequestContext
): Promise<Response | undefined> {
  return runRequestEffect(
    c,
    // Typed rather than `Effect.promise`: a render that throws is an ordinary
    // 500 through the app's error boundary either way, but as a DEFECT it also
    // skipped the span's own failure recording, so a broken page looked like a
    // successful trace.
    Effect.tryPromise({
      try: () => renderWithCache(config, path, reqCtx, c),
      catch: (cause) => new PageRenderError({ cause }),
    }).pipe(Effect.withSpan('page.render', { attributes: { route: c.req.routePath } }))
  )
}
