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

import { parseEcoPageCache } from '@/domain/models/env/eco/eco-page-cache'
import { computeAppRenderChecksum } from '@/domain/services/app-render-checksum'
import { classifyRenderablePath } from '@/domain/services/pages/page-cacheability'
import { computeContentDirCorpusChecksum } from '@/infrastructure/markdown/content-dir-enumerator'
import { getPageCacheKey } from '@/infrastructure/server/cache/page-cache-service'
import { isPageCacheDevBypassed } from '@/infrastructure/utils/env'
import type { App } from '@/domain/models/app'
import type { RenderablePathCacheability } from '@/domain/services/pages/page-cacheability'
import type { SessionInfo } from '@/domain/types/session-info'

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
 * The scan deliberately passes NO `include` narrowing, because it must cover
 * everything the render actually reads — and the sidebar lister
 * (`content-dir-lister`) has always listed the full directory regardless of
 * `include`. Narrowing here would leave a page whose sidebar changed but whose
 * keyed corpus did not, i.e. a cache entry stale for as long as the process
 * lives.
 */
async function resolveCorpusChecksum(
  classification: RenderablePathCacheability
): Promise<string | undefined> {
  if (classification.verdict !== 'content') return undefined
  const { contentDir } = classification.page ?? {}
  if (contentDir === undefined) return undefined
  return computeContentDirCorpusChecksum(contentDir.directory)
}

/**
 * Build the cache key for a request the {@link decidePageCache} verdict deemed
 * cacheable. Awaits the corpus stat-scan for a `'content'` page; resolves
 * without touching the filesystem for a `'static'` one.
 */
export async function buildPageCacheKey(
  app: App,
  path: string,
  request: { readonly detectedLanguage?: string; readonly urlLanguage?: string },
  classification: RenderablePathCacheability
): Promise<string> {
  return getPageCacheKey(computeAppRenderChecksum(app), path, request.detectedLanguage, {
    urlLanguage: request.urlLanguage,
    corpusChecksum: await resolveCorpusChecksum(classification),
  })
}
