/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The wire half of a content-only (SPA) navigation: asking for a partial,
 * deciding whether the answer IS one, and applying what it carries for the
 * document around the swapped region (title, density, client script).
 *
 * The header names are spelled here rather than imported: this module is
 * client-bundle code and the server constants live in
 * `presentation/api/runtime/content-partial.ts`, which the browser must never
 * pull in. The two spellings must agree; `content-partial.test.ts` pins the
 * server half, and the title header is asserted end-to-end by
 * [internal ref].
 */

import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'

const PARTIAL_HEADER = 'X-Sovrium-Partial'
const PARTIAL_VALUE = 'content'
const TITLE_HEADER = 'X-Sovrium-Title'
const DENSITY_HEADER = 'X-Sovrium-Density'
const NEEDS_CLIENT_HEADER = 'X-Sovrium-Needs-Client'

/**
 * How a navigation swaps: `mount` keeps the region node and replaces its
 * children (the operator console), `app` replaces the region node itself.
 */
export type SpaNavScope = 'mount' | 'app'

/** The page client script a region may need, at its unprefixed path. */
const CLIENT_SCRIPT_PATH = '/assets/client.js'

/** What a partial answer carries. */
export interface PartialAnswer {
  readonly html: string
  /** The final URL, after any redirect the fetch followed. */
  readonly url: string
  readonly title: string | undefined
  readonly density: string | undefined
  readonly needsClient: boolean
}

/** A partial, or the URL a full navigation should load instead. */
export type FetchedPartial =
  | { readonly ok: true; readonly answer: PartialAnswer }
  | { readonly ok: false; readonly fallbackUrl: string }

/**
 * Whether the response says its body IS a partial.
 *
 * A route that cannot extract its region answers with the FULL document, and a
 * full document swapped into a region nests a whole page inside the first. The
 * echo is the server's statement that it did not fall back.
 */
const isEchoedPartial = (response: Response): boolean =>
  response.headers.get(PARTIAL_HEADER) === PARTIAL_VALUE

/**
 * Fetch a content-only partial.
 *
 * `fetch` follows a 302 transparently, so `response.url` is the redirected
 * target when a bare console object-page path resolved to its first object
 * (Pass 1 item 1.5a) — the console swaps it and pushes that URL. An app page
 * that redirects is a different matter: an app redirects to send the reader
 * somewhere else entirely (a sign-in page, a moved page), so the `app` scope
 * hands a redirect to a full navigation of the redirected URL.
 */
export async function fetchPartial(
  url: string,
  scope: SpaNavScope,
  signal: AbortSignal | undefined
): Promise<FetchedPartial> {
  try {
    const response = await fetch(url, {
      headers: { [PARTIAL_HEADER]: PARTIAL_VALUE, Accept: 'text/html' },
      signal,
    })
    // Falls back to the requested URL when the response exposes no `url` (defensive).
    const finalUrl = response.url || url
    const refused = !response.ok || !isEchoedPartial(response)
    if (refused || (scope === 'app' && response.redirected)) {
      return { ok: false, fallbackUrl: response.redirected ? finalUrl : url }
    }
    const answer: PartialAnswer = {
      html: await response.text(),
      url: finalUrl,
      title: response.headers.get(TITLE_HEADER) ?? undefined,
      density: response.headers.get(DENSITY_HEADER) ?? undefined,
      needsClient: response.headers.get(NEEDS_CLIENT_HEADER) === '1',
    }
    return { ok: true, answer }
  } catch {
    return { ok: false, fallbackUrl: url }
  }
}

/**
 * Adopt the swapped-in page's document title.
 *
 * A missing header leaves the current title alone: a destination that declares
 * no title is not a destination whose title is empty, and blanking the tab is a
 * louder wrong answer than keeping a stale one.
 */
export function adoptTitle(encoded: string | undefined): void {
  if (encoded === undefined || encoded === '') return
  try {
    // eslint-disable-next-line functional/immutable-data -- the title IS the mutation
    document.title = decodeURIComponent(encoded)
  } catch {
    // A malformed percent-sequence would throw; a stale title beats a crashed
    // navigation, so the swap carries on with the title it had.
  }
}

/**
 * Adopt the swapped-in page's density step on the document root, which the
 * region's body cannot reach. Absent leaves the current step alone.
 */
export function adoptDensity(density: string | undefined): void {
  if (density === undefined || density === '') return
  // eslint-disable-next-line functional/immutable-data -- the root attribute IS the mutation
  document.documentElement.dataset.density = density
}

/**
 * The path prefix this document's assets are served under, read off an asset
 * the document already loads — so an app served under a base path asks for the
 * client script where its other assets live.
 */
function assetPathPrefix(): string {
  const probe =
    document.querySelector('script[src*="/assets/islands/"]')?.getAttribute('src') ??
    document.querySelector('link[href*="/assets/output.css"]')?.getAttribute('href')
  if (probe === undefined || probe === null) return ''
  const { pathname } = new URL(probe, window.location.href)
  return pathname.slice(0, Math.max(0, pathname.indexOf('/assets/')))
}

/**
 * Load the page client script once, when a swapped-in region needs it and the
 * document was served without it (a page with no interactive features does not
 * ship it, and a swap does not re-run the document's own `<script>` tags).
 */
export function ensureClientScript(): void {
  if (document.querySelector(`script[src$="${CLIENT_SCRIPT_PATH}"]`)) return
  const src = toSafeRedirectPath(`${assetPathPrefix()}${CLIENT_SCRIPT_PATH}`)
  if (src === undefined) return
  const script = document.createElement('script')
  // eslint-disable-next-line functional/immutable-data -- configuring the element we are about to insert
  script.defer = true
  // eslint-disable-next-line functional/immutable-data -- a same-origin path, proven by the check above
  script.src = src
  document.body.append(script)
}
