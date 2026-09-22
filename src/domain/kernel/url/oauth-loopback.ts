/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The RFC 8252 §7.3 loopback rule, as one predicate.
 *
 * An OAuth client registering a redirect URI on this instance's own origin must
 * declare an `application_type`, and which one is a FACT about the origin rather
 * than a preference: an `http` loopback redirect URI is legal only for a
 * `native` client, and every other origin — notably a deployed `https` one — is
 * genuinely `web`.
 *
 * Omitting the field defaults a client to `web` (RFC 7591), which the
 * authorization server refuses `400 invalid_redirect_uri` on the zero-config
 * self-hosted posture. So a console printing a registration body without it
 * hands the operator a command that cannot work — [internal ref], and the reason
 * `/api/admin/instance` publishes the answer rather than leaving config to
 * guess it. Config has no URL parser and no way to test a host against the
 * three loopback spellings.
 */

/**
 * The three hosts on which a cleartext `http` redirect URI is legal — and only
 * for an `application_type: "native"` client.
 *
 * Exactly `localhost`, `127.0.0.1` or `[::1]`, on any port. A host merely
 * INSIDE 127.0.0.0/8 such as `127.0.0.2` does not qualify: RFC 8252 §7.3 names
 * these three spellings, and the authorization server enforces that same list at
 * registration, so a looser test here would publish `native` for an origin the
 * server then refuses.
 */
const NATIVE_HTTP_LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * Whether an origin is an `http` loopback one — the single shape that REQUIRES
 * `application_type: "native"` and is refused as `"web"`.
 *
 * Both halves of the test are load-bearing, mirroring the authorization
 * server's own validation: a `web` client is refused a loopback host on ANY
 * scheme, and a `native` client is refused `https` on a loopback host. The
 * answer therefore turns on scheme AND host together — a host-only test would
 * mislabel an `https://localhost` deployment as native.
 *
 * An unparseable origin answers `false`, i.e. `web`. That is the conservative
 * direction: `web` is the RFC default, so a wrong `web` reproduces today's
 * behaviour while a wrong `native` would invent a claim about an address nobody
 * could resolve.
 */
export function isNativeHttpLoopbackOrigin(origin: string): boolean {
  try {
    const url = new URL(origin)
    if (url.protocol !== 'http:') return false
    // NORMALISE the IPv6 literal to its BRACKETED spelling, which is the one
    // RFC 8252 §7.3 names and the one the authorization server compares against.
    //
    // The retired builder re-bracketed unconditionally on a comment asserting
    // that `hostname` "yields `::1` unbracketed". It does not: measured on Bun's
    // WHATWG `URL`, `new URL('http://[::1]:5005').hostname` is already `[::1]`,
    // so that code produced `[[::1]]`, matched nothing, and published `web` for
    // an http loopback origin — the one value the server refuses
    // `400 invalid_redirect_uri`. Latent because nobody serves the console on
    // `[::1]`; caught here by the unit test that exercises all three spellings.
    const bare = url.hostname.replace(/^\[|\]$/g, '')
    const host = bare.includes(':') ? `[${bare}]` : bare
    return NATIVE_HTTP_LOOPBACK_HOSTS.has(host)
  } catch {
    return false
  }
}

/** The `application_type` a client registering on this origin must send. */
export function oauthApplicationTypeFor(origin: string): 'native' | 'web' {
  return isNativeHttpLoopbackOrigin(origin) ? 'native' : 'web'
}
