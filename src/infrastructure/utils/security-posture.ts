/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Single source of truth for the deployment's SECURITY POSTURE.
 *
 * Historically four independent security controls (CSRF enforcement, secure
 * cookies, outbound-URL SSRF guarding, and an encryption-key dev fallback since
 * removed) all keyed off `NODE_ENV === 'production'`. That coupled four
 * orthogonal concerns to one operational string: forgetting to set
 * `NODE_ENV=production` silently disabled all four. This module decouples each
 * control and gives each an individually-secure default with an explicit,
 * narrow opt-out.
 *
 * Design principles (mirrors the ecoconception env-var contract — secure by
 * default, opt-OUT never opt-IN):
 *
 *   | Env var                         | Default  | Effect when set                       |
 *   | ------------------------------- | -------- | ------------------------------------- |
 *   | `SOVRIUM_ALLOW_INSECURE=1`      | secure   | master relax: cookies + CSRF + SSRF   |
 *   | `SOVRIUM_ALLOW_PRIVATE_OUTBOUND`| SSRF on  | permit private/loopback outbound      |
 *   |                                 |          | targets (narrow)                      |
 *   | `BASE_URL` / `HOSTNAME`         | loopback | canonical origin / bind host —        |
 *   |                                 |          | drives transport-relax + CORS         |
 *
 * `src/domain/utils/dev-mode.ts` stays a PURE predicate layer (takes the env
 * value as a parameter). This module is the env-READING layer: it inspects
 * `process.env` directly and is the only place that decides posture.
 *
 * HARNESS NOTE (why posture is derived from BASE_URL, not the literal socket
 * bind): the E2E harness always binds the socket to loopback (PORT=0) and
 * detects startup by matching `http://localhost:` in stdout, so it cannot bind
 * a real non-loopback interface. A non-loopback CANONICAL ORIGIN — declared via
 * `BASE_URL=https://app.example.com` (or a non-loopback `HOSTNAME`) — is the
 * "this deployment is public" signal the posture resolver keys on. Therefore a
 * non-loopback `BASE_URL` makes the posture non-loopback even though the socket
 * still binds loopback.
 */

const env = process.env as Record<string, string | undefined>

/** True when the env var is set to a non-empty value (an explicit opt-in). */
const isFlagSet = (value: string | undefined): boolean => value !== undefined && value !== ''

/**
 * Master insecure opt-out (`SOVRIUM_ALLOW_INSECURE=1`). When set, every
 * narrower control relaxes: insecure cookies + CSRF off + private outbound
 * allowed. Intended for trusted private/local deployments where the operator has
 * explicitly accepted the relaxed posture. It no longer governs the encryption
 * key — there is nothing left to relax there.
 */
export const isInsecureOptOut = (): boolean => isFlagSet(env['SOVRIUM_ALLOW_INSECURE'])

/**
 * True when `host` is a loopback / non-routable bind that only the local
 * operator can reach — `localhost`, the IPv4 loopback `127.0.0.0/8` and the
 * IPv6 loopback `::1`.
 *
 * The UNSPECIFIED addresses `0.0.0.0` and `::` are deliberately NOT loopback.
 * They are the wildcard bind — every interface the machine has — which is the
 * single most public bind a server can choose, the exact opposite of "only the
 * local operator can reach it". Classifying them as loopback fed
 * `isTransportRelaxed`, which drives `useSecureCookies: !relaxed` and
 * `disableCSRFCheck: relaxed` in `better-auth/auth.ts`, so an operator running
 * the ordinary container shape (`HOSTNAME=0.0.0.0`) silently got CSRF
 * protection disabled and session cookies served without `Secure` — on the
 * most exposed bind there is.
 *
 * The codebase already carried the correct twin: `isLoopbackOrigin`
 * (`server/route-setup/auth-routes.ts`) accepts only `localhost`, `127.0.0.1`
 * and `[::1]`, and has never accepted `0.0.0.0`. The two helpers now agree.
 *
 * Empty / undefined → treated as loopback (the unset dev default; `server.ts`
 * itself falls back to `localhost` when no hostname is configured).
 */
export const isLoopbackHost = (host: string | undefined): boolean => {
  if (host === undefined || host === '') return true
  const normalized = stripIpv6Brackets(host.trim().toLowerCase())
  if (normalized === 'localhost' || normalized === 'localhost.localdomain') return true
  if (normalized === '::1') return true
  // IPv4 loopback 127.0.0.0/8
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(normalized)
}

const stripIpv6Brackets = (host: string): string =>
  host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host

/**
 * Resolve the effective bind/canonical hostname used to decide transport
 * posture. Precedence (most-specific first):
 *   1. `explicit` (the `ServerConfig.hostname` passed by the caller),
 *   2. the host of a configured `BASE_URL` canonical origin,
 *   3. the `HOSTNAME` env var,
 *   4. `localhost` (the dev default).
 *
 * Mirrors `server.ts` (`config.hostname ?? Bun.env.HOSTNAME || 'localhost'`)
 * and `auth.ts` (`BASE_URL || http://localhost:PORT`) but folds the canonical
 * `BASE_URL` origin in so a public deployment that sets only `BASE_URL`
 * (without `HOSTNAME`) is still classified non-loopback. See the HARNESS NOTE.
 */
export const resolveBindHostname = (explicit?: string): string => {
  if (explicit !== undefined && explicit !== '') return explicit
  const baseUrlHost = parseHostFromUrl(env['BASE_URL'])
  if (baseUrlHost !== undefined) return baseUrlHost
  const hostnameEnv = env['HOSTNAME']
  if (hostnameEnv !== undefined && hostnameEnv !== '') return hostnameEnv
  return 'localhost'
}

const parseHostFromUrl = (rawUrl: string | undefined): string | undefined => {
  if (rawUrl === undefined || rawUrl === '') return undefined
  try {
    return new URL(rawUrl).hostname
  } catch {
    return undefined
  }
}

/**
 * Transport posture is RELAXED (insecure cookies allowed, CSRF off) when the
 * deployment binds loopback OR the master opt-out is set. A non-loopback
 * `BASE_URL`/`HOSTNAME` → NOT relaxed (the secure default): secure cookies +
 * CSRF enforced.
 */
export const isTransportRelaxed = (bindHost?: string): boolean =>
  isInsecureOptOut() || isLoopbackHost(resolveBindHostname(bindHost))

/**
 * SSRF guarding is ALWAYS ON. It relaxes only under the narrow
 * `SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1` opt-out (or the master
 * `SOVRIUM_ALLOW_INSECURE`). Crucially this is INDEPENDENT of the bind host —
 * a loopback-bound dev server still blocks private outbound targets unless the
 * operator opts in. The E2E harness sets the opt-out in `global-setup.ts` so
 * the webhook/http suites can reach `127.0.0.1:42xx`.
 */
export const isSsrfRelaxed = (): boolean =>
  isInsecureOptOut() || isFlagSet(env['SOVRIUM_ALLOW_PRIVATE_OUTBOUND'])

// The encryption-key surface that used to live here — `isDevKeyAllowed`,
// `isEncryptionKeyMissing` and `ENCRYPTION_KEY_REQUIRED_MESSAGE` — is gone.
//
// All three encoded one contract: that a deployment could be MISSING an
// encryption key, that it could opt into a deterministic built-in key instead,
// and that the right answer to neither being present was to refuse to boot. The
// key is now provisioned per install (`infrastructure/crypto/root-secret.ts`) —
// env var, else `<dataDir>/encryption-key`, else generate-and-persist — so there
// is no missing-key state left to predicate on and no opt-out left to grant.
//
// The constant the opt-out selected was public: all of `src/` is mirrored to a
// public repository and compiled into every shipped binary, which made it a
// worse outcome than the refusal it was meant to soften. The unwritable-data-dir
// refusal that replaced it lives in the root-secret module, beside the write it
// describes...009 and [internal ref].
