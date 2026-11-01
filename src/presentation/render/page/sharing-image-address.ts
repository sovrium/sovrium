/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `og:image` and `twitter:image` tags whose address is a site path — one
 * leading `/`, never the protocol-relative `//`. React writes the `property`
 * (or `name`) attribute before `content` (the order `renderMetaTags` spreads
 * them in), so each tag is matched in that one shape.
 */
const PATH_SHARING_IMAGE =
  /(<meta (?:property="og:image"|name="twitter:image") content=")(\/(?!\/))/g

/**
 * Make a page's sharing images a full address on the host the request arrived
 * on.
 *
 * A social network fetches `og:image` with no page around it, so a path such as
 * `/og-en.png` — declared directly, the value of a `$t:` key, or the files
 * address of a record's attachment — resolves
 * against nothing. The host is known only per request, which is why this runs
 * on the rendered document rather than in the head component, which never sees
 * the request. Without an origin (a static render) the path is left as written.
 */
export function absolutizeSharingImage(html: string, origin: string | undefined): string {
  if (origin === undefined || !/^https?:\/\/[^"<>\s]+$/.test(origin)) return html
  return html.replace(PATH_SHARING_IMAGE, (_match, head: string, slash: string) => {
    return `${head}${origin.replace(/\/+$/, '')}${slash}`
  })
}
