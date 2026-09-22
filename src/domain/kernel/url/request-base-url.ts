/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The slice of a Hono `Context` the resolver reads. Structural rather than the
 * `Context` type itself: `Context`'s env generic defaults to
 * `{ Variables: ContextVariableMap & Record<string, any> }`, which the `BlankEnv`
 * (`{}`) context produced by a plain `app.get('/x', (c) => …)` handler does not
 * satisfy — `Readonly<Context>` fails with TS2345 at the `/api/openapi.json`,
 * `/sitemap.xml` and `/robots.txt` call sites. Naming the two members we touch
 * keeps every call site assignable without a cast.
 *
 * A generic `<E extends Env>(c: Readonly<Context<E>>)` also typechecks, and was
 * rejected rather than overlooked: it re-couples a pure function to Hono's type
 * surface and carries a type parameter the body never uses, in exchange for
 * documentation this comment already provides. The structural form additionally
 * makes the resolver unit-testable from a literal — no Hono import, no cast.
 */
type OriginRequestContext = {
  readonly req: {
    readonly url: string
    readonly header: (name: string) => string | undefined
  }
}

/**
 * Resolve the public origin this instance should advertise, from the operator's
 * declaration or from the request that just arrived.
 *
 * Precedence:
 *  1. `BASE_URL` env var — the canonical production origin, declared by the
 *     operator. Wins over any request-derived value so what we advertise stays
 *     correct behind a reverse proxy, where the request the server sees is the
 *     INTERNAL one.
 *  2. Request `X-Forwarded-Host` (proxy-set, preferred) or `Host` header, paired
 *     with `X-Forwarded-Proto` — derives the externally visible origin from the
 *     incoming request, defaulting the scheme to `http`.
 *  3. The request URL origin — final fallback when no `Host` header is present.
 *
 * The trailing slash (if any) is trimmed so callers can append `${path}` safely.
 */
const resolveBaseUrlFromParts = (
  requestUrl: string,
  host?: string,
  forwardedProto?: string
): string => {
  const fromEnv = Bun.env.BASE_URL
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  if (host) {
    const proto = forwardedProto || 'http'
    return `${proto}://${host}`.replace(/\/$/, '')
  }

  return new URL(requestUrl).origin
}

/**
 * The shared origin resolver for every surface that must PRINT or ADVERTISE this
 * instance's address: the live SEO routes (`<loc>` entries, robots policy), the
 * served OpenAPI document's `servers[0].url`, and the Developers docs pages
 * (`/_admin/api`, `/_admin/mcp`), whose every copy-pasteable block names it.
 *
 * A single resolver is deliberate. The proxy-header branch is the whole point:
 * a resolver that reads only `BASE_URL` and the request URL documents the
 * INTERNAL address whenever an operator runs behind a reverse proxy without
 * declaring `BASE_URL` — an address no outside caller can reach.
 *
 * @param c - the live Hono request context
 * @returns the origin WITHOUT a trailing slash (e.g. `https://app.example.com`)
 */
export const resolveRequestBaseUrl = (c: OriginRequestContext): string =>
  resolveBaseUrlFromParts(
    c.req.url,
    c.req.header('X-Forwarded-Host') ?? c.req.header('Host'),
    c.req.header('X-Forwarded-Proto')
  )
