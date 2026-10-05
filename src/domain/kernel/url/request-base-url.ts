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
 * Whether this process sits behind a reverse proxy the operator DECLARED.
 *
 * `TRUSTED_PROXY_HOPS` is the one switch that decides whether any forwarding
 * header is believed — `X-Forwarded-For` for the client address, and here
 * `X-Forwarded-Host` / `X-Forwarded-Proto` for the address this instance
 * prints. With no proxy declared (the default, `0`) those headers are whatever
 * the CLIENT typed, and an address built from them lets a caller plant its own
 * domain in a page a shared cache keeps.
 *
 * Read here rather than through the `process-env` parser because the kernel may
 * not reach a model; the parser (`models/process-env/proxy.ts`) is still the
 * contract, and it refuses an invalid value at boot. Anything that is not a
 * positive whole number reads as "no proxy" — the failure mode that believes
 * nothing.
 */
export const isBehindDeclaredProxy = (): boolean => {
  const hops = Number(Bun.env.TRUSTED_PROXY_HOPS)
  return Number.isInteger(hops) && hops >= 1
}

/**
 * A forwarded scheme, confined to the two an address can have. A proxy may send
 * a comma-joined list; the first entry is the one the client used. Anything else
 * — including markup — is ignored rather than printed.
 */
export const confineForwardedScheme = (value: string | undefined): 'http' | 'https' | undefined => {
  const first = value?.split(',')[0]?.trim().toLowerCase()
  return first === 'http' || first === 'https' ? first : undefined
}

/**
 * A host as an address may carry it: a DNS name or dotted IPv4 (letters,
 * digits, `-`, `_`, dots), or a bracketed IPv6 literal, with an optional port.
 * Nothing else — no scheme, path, userinfo (`@`), query, fragment, quote or
 * whitespace.
 */
const HOST_PATTERN = /^(?:[\w-]+(?:\.[\w-]+)*\.?|\[[\d.:a-f]+\])(?::\d{1,5})?$/i

/**
 * A `Host` or `X-Forwarded-Host` value confined to a host, or `undefined`.
 *
 * Both headers are text a client can type — `Host` always, a forwarded one
 * whenever the proxy passes it through — and the server accepts any value:
 * `evil.com/<img src=x onerror=…>` reaches a handler verbatim. An origin built
 * by concatenating it would carry that markup, path or userinfo into every
 * absolute URL this instance prints, so a value that is not a host is ignored
 * rather than printed. A proxy may send a comma-joined list; the first entry
 * is the one the client addressed.
 */
export const confineHost = (value: string | undefined): string | undefined => {
  const first = value?.split(',')[0]?.trim()
  return first !== undefined && HOST_PATTERN.test(first) ? first : undefined
}

/**
 * The forwarded host and scheme, when a declared proxy wrote them; nothing
 * otherwise.
 */
export const trustedForwarding = (
  header: (name: string) => string | undefined
): { readonly host?: string; readonly proto?: 'http' | 'https' } => {
  if (!isBehindDeclaredProxy()) return {}
  const host = confineHost(header('X-Forwarded-Host'))
  const proto = confineForwardedScheme(header('X-Forwarded-Proto'))
  return { ...(host ? { host } : {}), ...(proto ? { proto } : {}) }
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
 *  2. Behind a declared proxy (`TRUSTED_PROXY_HOPS` >= 1), `X-Forwarded-Host`
 *     and `X-Forwarded-Proto` — the externally visible origin the proxy
 *     vouched for. Otherwise the `Host` the request was addressed to, over
 *     `http`. A forwarded scheme other than `http`/`https` is never used.
 *  3. The request URL origin — final fallback when no usable `Host` header is
 *     present. A `Host` or forwarded host that is not a host (a path, markup,
 *     userinfo) is ignored, never printed ({@link confineHost}).
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

  // Bun hands a handler a RELATIVE `req.url` when the `Host` it received is not
  // a host, so there may be no origin to read here either.
  return URL.canParse(requestUrl) ? new URL(requestUrl).origin : 'http://localhost'
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
export const resolveRequestBaseUrl = (c: OriginRequestContext): string => {
  const forwarded = trustedForwarding((name) => c.req.header(name))
  return resolveBaseUrlFromParts(
    c.req.url,
    forwarded.host ?? confineHost(c.req.header('Host')),
    forwarded.proto
  )
}
