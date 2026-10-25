/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Context, MiddlewareHandler } from 'hono'

/**
 * The noindex posture: an instance that asks search engines to stay away.
 *
 * Every response it passes carries `X-Robots-Tag: noindex`, every page has its
 * robots meta replaced by a `noindex` one, and `GET /robots.txt` answers a file
 * closing the whole site. Two callers wear it: the preview gate, on the
 * traffic it admits, and a dev-mode instance whose operator set
 * `SOVRIUM_DEV_PUBLIC` to say its public address is deliberate.
 *
 * The rewrite runs on the way OUT, after every cache below has answered, so a
 * cached page is served marked without the cache ever holding the mark.
 */

/** What `/robots.txt` answers under the posture: the whole site closed. */
const NOINDEX_ROBOTS_CONTENT = 'User-agent: *\nDisallow: /\n'

/** The robots meta every page carries; any robots meta the page had is replaced. */
const withNoindexMeta = (response: Response): Response =>
  new HTMLRewriter()
    .on('meta[name="robots"]', {
      element: (element) => {
        element.remove()
      },
    })
    .on('head', {
      element: (element) => {
        element.prepend('<meta name="robots" content="noindex">', { html: true })
      },
    })
    .transform(response)

/** Mark the response in hand as never to be indexed. */
const markNoindex = (c: Context): void => {
  const isHtml = (c.res.headers.get('Content-Type') ?? '').includes('text/html')
  const response = isHtml ? withNoindexMeta(c.res) : c.res
  c.res = response
  c.res.headers.set('X-Robots-Tag', 'noindex')
}

/**
 * The posture as a middleware: answer `GET /robots.txt` with the closed file,
 * otherwise let the request through and mark what comes back.
 */
export const noindexPosture: MiddlewareHandler = async (c, next) => {
  if (c.req.method === 'GET' && c.req.path === '/robots.txt') {
    c.header('X-Robots-Tag', 'noindex')
    return c.text(NOINDEX_ROBOTS_CONTENT, 200)
  }
  await next()
  markNoindex(c)
  return undefined
}
