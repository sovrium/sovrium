/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type Hono } from 'hono'
import {
  readEmbeddedBrandMark,
  readEmbeddedSample,
  type EmbeddedAsset,
} from '@/infrastructure/assets/embedded-static-assets'
import { getCacheControlHeader } from './asset-cache-control'

/**
 * The routes serving asset families embedded in the binary: the design-system
 * console's sample media and Sovrium's own brand marks.
 */

/** Route prefix the design-system console's media specimens link. */
const DESIGN_SYSTEM_SAMPLE_PREFIX = '/assets/design-system/'

/**
 * Build a `GET`/`HEAD` route serving one embedded asset family off `prefix`.
 *
 * THE LOOKUP KEY IS THE WHOLE REMAINDER of the path, never its last segment,
 * and the family's reader is a property read on a frozen map. Together those
 * two facts are what make this fail CLOSED: there is no path join anywhere in
 * the handler, so a nested or traversing spelling (`../../.env`,
 * `nested/sample-still.avif`) is an ordinary miss answering 404 rather than a
 * read that has to be defended against. A key the family does not hold is the
 * same miss, which is how files deliberately left out of a family — the
 * live-text brand marks, say — stay unreachable rather than merely unused.
 *
 * `GET` and `HEAD`, because a reader weighing an asset should not have to
 * download it to learn its size; `Content-Length` is explicit so the HEAD
 * answer carries it with no body to derive it from.
 *
 * Shared by both families rather than written twice, so the two cannot drift
 * apart on the property that matters — an asset route that started answering
 * 500 on an unknown key, or resolving one, would be a security regression in
 * whichever copy was edited second.
 */
const embeddedAssetRoute =
  (prefix: string, read: (key: string) => Promise<EmbeddedAsset | undefined>) =>
  (honoApp: Readonly<Hono>): Readonly<Hono> =>
    honoApp.on(['GET', 'HEAD'], `${prefix}*`, async (c) => {
      const asset = await read(c.req.path.slice(prefix.length))
      if (asset === undefined) return c.notFound()
      return new Response(asset.bytes, {
        headers: {
          'Content-Type': asset.contentType,
          'Content-Length': String(asset.bytes.byteLength),
          'Cache-Control': getCacheControlHeader(),
        },
      })
    })

/**
 * Serve the design-system console's sample media at `/assets/design-system/*`.
 *
 * The console's `audio`, `video` and `image` specimens draw a real file rather
 * than an empty transport or a `data:` rectangle, and these are the three
 * bytes-on-the-wire that make that true. They are embedded in the binary, so
 * this route answers identically from a checkout and from a compiled
 * executable — see `readEmbeddedSample`.
 *
 * MOUNTED AT THE ROOT, NOT UNDER `/_admin`, and that is load-bearing rather
 * than incidental: the admin mount serves PAGE routes only, so a console page
 * reaches every asset — its own stylesheet included — by absolute root path.
 * A sample served under the mount would 404 for exactly the reader it exists
 * for.
 *
 * Fail-closed lookup and the GET/HEAD contract come from
 * {@link embeddedAssetRoute}, which both asset families share.
 */
export const setupDesignSystemSampleRoute = embeddedAssetRoute(
  DESIGN_SYSTEM_SAMPLE_PREFIX,
  readEmbeddedSample
)

/**
 * Route prefix the console's own brand mark is served from. Exported so the
 * image-format check resolves engine-served references by THIS value rather
 * than a copy of it.
 */
export const BRAND_MARK_PREFIX = '/assets/brand/'

/**
 * Serve Sovrium's own brand marks at `/assets/brand/<unit>/<file>`.
 *
 * WHY THE ENGINE HAS TO SERVE THESE AT ALL. `design.logo` resolves its `src`
 * against the HOSTING app's `public/` directory, and the operator console is
 * mounted inside somebody else's app — so a config path to a Sovrium asset
 * resolves into Acme's `public/` and 404s in every real deployment. The `icon`
 * component-type renders lucide nodes only, and this mark is not one. Embedding
 * the bytes is what lets the console look like itself on a machine with no
 * network, no CDN, and no cooperation from the app hosting it.
 *
 * MOUNTED AT THE ROOT, NOT UNDER `/_admin`, for the same load-bearing reason
 * {@link setupDesignSystemSampleRoute} is: the admin mount serves PAGE routes
 * only, so a console page reaches every asset by absolute root path, and a mark
 * served under the mount would 404 for exactly the page it exists for. The
 * console's sign-in card therefore names the absolute path deliberately, where
 * every other link on that page is mount-relative.
 *
 * The shared lookup key is the WHOLE remainder of the path — here `<unit>/<file>`,
 * because all four business units hold marks of the same filename and the
 * directory is what distinguishes them. Names outside the family miss like any
 * other, the live-text `mark-light.svg` among them: it is excluded on purpose,
 * since an `<img>`-loaded SVG reaches no webfont and would draw the mark in a
 * fallback typeface.
 */
export const setupBrandMarkRoute = embeddedAssetRoute(BRAND_MARK_PREFIX, readEmbeddedBrandMark)
