/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The content-only partial of an app page — what a sidebar opting into
 * client-side navigation (`sidebar.clientSideNavigation`) swaps in place of the
 * page's `<main id="main-content">`.
 *
 * The partial is cut out of the FULL document the page pipeline already
 * rendered, after every gate that document passed (session, 401 / 302 / 404,
 * the page cache). It is never a second
 * render path and never a way around those gates: a request that would not get
 * the document gets no partial either.
 */

import {
  DENSITY_HEADER,
  NEEDS_CLIENT_HEADER,
  documentLoadsClientScript,
  extractDocumentDensity,
  extractRegionElement,
  partialEchoHeaders,
} from '@/presentation/api/runtime/content-partial'
import type { Page } from '@/domain/models/app/pages'

/** The id of the region an app page's navigation swaps — `PageMain`'s landmark. */
const APP_CONTENT_REGION_ID = 'main-content'

/**
 * Whether a page may be answered as a partial at all.
 *
 * A page carrying anything rendered OUTSIDE its main region, or anything only a
 * document load runs, is declined, so the client loads it in full:
 *   - `scripts` — a swap does not run a destination's own `<script>` tags;
 *   - `presence: true` — the presence indicator mounts beside the region;
 *   - `layout.sidebar` — the record-bound layout sidebar sits beside it too.
 *
 * `undefined` (the implicit default homepage) is declined: it is not an
 * authored page and renders no navigation that could ask.
 */
export function isPartialEligible(page: Page | undefined): boolean {
  if (page === undefined) return false
  return page.scripts === undefined && page.presence !== true && page.layout?.sidebar === undefined
}

/**
 * The headers and body of a page's content-only partial, or `undefined` when
 * the document holds no region to cut out — the caller then answers the full
 * document with no echo, and the client loads it in full.
 */
export function pagePartialOf(
  html: string
): { readonly body: string; readonly headers: Readonly<Record<string, string>> } | undefined {
  const body = extractRegionElement(html, APP_CONTENT_REGION_ID)
  if (body === undefined) return undefined
  const density = extractDocumentDensity(html)
  return {
    body,
    headers: {
      ...partialEchoHeaders(html),
      ...(density === undefined ? {} : { [DENSITY_HEADER]: density }),
      ...(documentLoadsClientScript(html) ? { [NEEDS_CLIENT_HEADER]: '1' } : {}),
    },
  }
}
