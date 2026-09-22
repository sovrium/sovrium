/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Page-cache decision layer — the "may this request be served from, or stored
 * in, the static page-output cache, and under which key?" half of
 * `renderWithCache` (see `page-routes.ts`).
 *
 * Split out of the route module so the render path stays a short, readable
 * sequence: decide → maybe serve → maybe store. It also keeps the one
 * filesystem read the cache needs (the content-corpus stat scan) next to the
 * decision that asks for it, rather than inline in a Hono handler.
 */

import { Effect } from 'effect'
import { ContentDirReader } from '@/application/ports/services/content-dir-reader'
import { computeAppRenderChecksum } from '@/domain/models/app/app-render-checksum'
import { getPageCacheKey } from '@/domain/models/app/pages/page-cache-key'
import { classifyRenderablePath } from '@/domain/models/app/pages/page-cacheability'
import {
  pageQuerySupplyKey,
  pageQueryVariantKey,
  resolvePageQueryValues,
} from '@/domain/models/app/pages/query-props'
import { pageWindowVariantKey, resolvePageWindow } from '@/domain/models/app/pages/window-props'
import { parseEcoPageCache } from '@/domain/models/process-env/eco/eco-page-cache'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import { isPageCacheDevBypassed } from '@/infrastructure/process/env'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { RenderablePathCacheability } from '@/domain/models/app/pages/page-cacheability'
import type { Context } from 'hono'

/** `Cache-Control` for renders served from / stored in the page cache. */
export const CACHED_PAGE_CACHE_CONTROL = 'public, max-age=300'

/**
 * `Cache-Control` for ANONYMOUS renders of paths the page cache cannot hold
 * (dynamic routes, presence pages, database-backed collections). The HTML still
 * varies only with public data, so browsers and CDNs may share it briefly —
 * this is what lets a CDN absorb navigation even though the server renders
 * fresh. `stale-while-revalidate` keeps repeat navigation instant while the
 * shared copy refreshes in the background.
 */
export const SHARED_BYPASS_CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=300'

/**
 * `Cache-Control` for responses that must never be shared: a session or
 * preview render (personalised output), or any render while the operator has
 * turned the page cache off (`ECO_PAGE_CACHE=off` / dev bypass — honour the
 * "don't cache" intent end-to-end).
 */
export const PRIVATE_CACHE_CONTROL = 'private, no-cache'

/** The pre-render disposition of one page request. */
export interface PageCacheDecision {
  /** Whether the cache may be read from and written to for this request. */
  readonly usable: boolean
  /** The `Cache-Control` to send if this request bypasses the cache. */
  readonly bypassCacheControl: string
  /** The path's cacheability verdict plus the page that matched it. */
  readonly classification: RenderablePathCacheability
}

/**
 * Decide, before any rendering happens, whether this request may use the page
 * cache — and what `Cache-Control` a bypass should carry.
 *
 * The cache is usable only for an anonymous, non-preview request to a
 * `'static'` or `'content'` path while `ECO_PAGE_CACHE` is on. Everything else
 * renders fresh; a session or preview render (or a cache-off render) must stay
 * private, while an anonymous bypass of a dynamic path is still shareable
 * downstream.
 */
export function decidePageCache(
  app: App,
  path: string,
  request: { readonly session?: SessionInfo; readonly previewMode?: boolean }
): PageCacheDecision {
  const cacheEnabled = parseEcoPageCache(process.env) === 'on' && !isPageCacheDevBypassed()
  const anonymousRender = request.session === undefined && request.previewMode !== true
  const shareableBypass = cacheEnabled && anonymousRender
  const classification = classifyRenderablePath(app, path)
  return {
    usable: shareableBypass && classification.verdict !== 'dynamic',
    bypassCacheControl: shareableBypass ? SHARED_BYPASS_CACHE_CONTROL : PRIVATE_CACHE_CONTROL,
    classification,
  }
}

/**
 * Resolve the corpus-checksum key segment for a cacheability verdict.
 *
 * `'content'` pages are corpus-invariant rather than request-invariant: their
 * entry is additionally keyed by the CURRENT on-disk state of their
 * `contentDir`, so editing, adding, or removing a markdown file invalidates it
 * on the very next request. `'static'` pages have no
 * corpus and contribute nothing.
 *
 * The scan itself lives behind `ContentDirReader.corpusChecksum` (W5c): it is a
 * filesystem walk, which the HTTP surface may not reach directly, and the port
 * already existed for the markdown export route's read of the same directory.
 * Why the scan passes no `include` narrowing is recorded there, with the scan.
 *
 * A failed scan is answered with `undefined` rather than propagated, and that
 * is the pre-existing behaviour preserved: an unreadable corpus means the key
 * loses its corpus segment, so the page renders fresh and is keyed as though it
 * had no corpus. A 500 here would turn a transient directory read into an
 * outage on a page the renderer could have served.
 */
function resolveCorpusChecksum(
  c: Context,
  classification: RenderablePathCacheability
): Promise<string | undefined> {
  if (classification.verdict !== 'content') return Promise.resolve(undefined)
  const { contentDir } = classification.page ?? {}
  if (contentDir === undefined) return Promise.resolve(undefined)
  return runDomainPromise(
    c,
    Effect.gen(function* () {
      const reader = yield* ContentDirReader
      return yield* reader.corpusChecksum(contentDir)
      // effect-swallow: an unreadable corpus drops the corpus segment from the key, which is the pre-existing behaviour and the safe direction — the page renders fresh and is keyed as though it had none. A 500 here would turn a transient directory read into an outage on a page the renderer could have served, and the scan is an invalidation optimisation rather than part of the answer.
    }).pipe(Effect.orElseSucceed(() => undefined))
  )
}

/**
 * Build the cache key for a request the {@link decidePageCache} verdict deemed
 * cacheable. Awaits the corpus stat-scan for a `'content'` page; resolves
 * without touching the filesystem for a `'static'` one.
 *
 * A page declaring `page.query` gets one further key dimension: its RESOLVED
 * (enum-clamped) values. Without it, a `'static'` page — which a query-bearing
 * page still is, since `query` reads nothing outside the schema — would serve
 * the first requested value's HTML for every other value. Clamping before
 * keying is what keeps the entry count bounded by the `enum` sizes rather than
 * by how many distinct strings a visitor cares to type.
 *
 * A page declaring `page.window` gets a second one, and it carries TWO terms
 * for two different failures: the preset id (without it `?period=30d` is served
 * `7d`'s bytes) and a minute-coarsened `end` instant (without it an entry
 * written at 09:00 still claims to end "now" at 17:00 — the figures on such a
 * page are timestamped, so an uncoarsened cache is a page that lies about when
 * it was measured). Coarsening is what keeps the second term BOUNDED to one
 * live entry per preset where a raw instant would mint one per request.
 */
export async function buildPageCacheKey(
  c: Context,
  // Grouped rather than positional: the Hono context became a FIFTH parameter in
  // W5c, when the corpus scan moved behind `ContentDirReader`, and four is the
  // cap. Grouping the four that describe the RENDER — leaving the context, which
  // describes the request the services are read from — is the split that keeps
  // the call site readable.
  input: {
    readonly app: App
    readonly path: string
    readonly request: {
      readonly detectedLanguage?: string
      readonly urlLanguage?: string
      readonly requestQuery?: Readonly<Record<string, string>>
    }
    readonly classification: RenderablePathCacheability
  }
): Promise<string> {
  const { app, path, request, classification } = input
  const queryVariant = pageQueryVariantKey(
    resolvePageQueryValues(classification.page?.query, request.requestQuery)
  )
  const windowVariant = pageWindowVariantKey(
    resolvePageWindow(classification.page?.window, request.requestQuery, Date.now())
  )
  // A THIRD term, and the only one that reads the RAW query: the resolved
  // values alone cannot tell `/kit` from `/kit?category=<the default>`, which
  // render the same body and a different `aria-current` the moment a sidebar
  // entry declares a query of its own. Bounded to three states per declared
  // property — see `pageQuerySupplyKey`.
  const supplyVariant = pageQuerySupplyKey(classification.page?.query, request.requestQuery)
  // All three dimensions live in ONE key term: a page may declare any, all, or
  // none, and a page declaring none must keep a byte-identical key.
  const variant = [queryVariant, windowVariant, supplyVariant]
    .filter((term) => term !== undefined)
    .join('|')
  return getPageCacheKey(computeAppRenderChecksum(app), path, request.detectedLanguage, {
    urlLanguage: request.urlLanguage,
    corpusChecksum: await resolveCorpusChecksum(c, classification),
    ...(variant !== '' ? { queryVariant: variant } : {}),
  })
}
