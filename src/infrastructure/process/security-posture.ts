/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Single source of truth for the deployment's SECURITY POSTURE.
 *
 * Independent security controls (CSRF enforcement, secure cookies,
 * outbound-URL SSRF guarding) must not all key off `NODE_ENV === 'production'`:
 * that couples orthogonal concerns to one operational string, so forgetting to
 * set `NODE_ENV=production` would silently disable all of them. This module decouples each
 * control and gives each an individually-secure default with an explicit,
 * narrow opt-out.
 *
 * Design principles (mirrors the ecoconception env-var contract — secure by
 * default, opt-OUT never opt-IN):
 *
 *   | Env var                         | Default  | Effect when set                       |
 *   | ------------------------------- | -------- | ------------------------------------- |
 *   | `SOVRIUM_ALLOW_INSECURE=1|true` | secure   | master relax: cookies + CSRF + SSRF   |
 *   | `SOVRIUM_ALLOW_PRIVATE_OUTBOUND`| SSRF on  | permit private/loopback outbound      |
 *   |                                 |          | targets (narrow)                      |
 *   | `BASE_URL` / `HOSTNAME`         | loopback | canonical origin / bind host —        |
 *   |                                 |          | drives transport-relax + CORS         |
 *
 * `src/domain/models/process-env/dev-mode.ts` stays a PURE predicate layer (takes the env
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

/**
 * The two posture flags. Each is VALUE-keyed: `1` or `true` (any case, outer
 * whitespace ignored) relaxes, empty or absent is the secure default, and any
 * other value is refused at boot by {@link validatePostureFlags}.
 *
 * Presence-keyed reading was the defect this replaces: an operator who wrote
 * `SOVRIUM_ALLOW_INSECURE=0` or `=false` to switch the relaxation OFF switched
 * it ON, because any non-empty value counted as set.
 */
const POSTURE_FLAGS = {
  SOVRIUM_ALLOW_INSECURE: 'relax the security posture',
  SOVRIUM_ALLOW_PRIVATE_OUTBOUND: 'permit private and loopback outbound targets',
} as const

type PostureFlag = keyof typeof POSTURE_FLAGS

/** How one posture-flag value reads: relaxing, the secure default, or refused. */
const readPostureFlag = (value: string | undefined): 'relaxed' | 'secure' | 'invalid' => {
  const trimmed = (value ?? '').trim()
  if (trimmed === '') return 'secure'
  return /^(?:1|true)$/i.test(trimmed) ? 'relaxed' : 'invalid'
}

/** The one predicate every read site of a posture flag goes through. */
const isFlagSet = (flag: PostureFlag): boolean => readPostureFlag(env[flag]) === 'relaxed'

/**
 * The boot refusal for a posture flag holding a value that is neither `1`,
 * `true` nor empty, or `undefined` when both flags are usable.
 *
 * ONE line naming the variable, the value in double quotes and the accepted
 * values, so an operator who wrote `0` meaning "off" learns on the first boot
 * that the variable is switched off by removing it. Pure in `source` so the
 * server boot and `sovrium init --from-url` refuse with the same words.
 */
export const validatePostureFlags = (
  source: Readonly<Record<string, string | undefined>> = env
): string | undefined => {
  const refused = (Object.keys(POSTURE_FLAGS) as readonly PostureFlag[]).find(
    (flag) => readPostureFlag(source[flag]) === 'invalid'
  )
  if (refused === undefined) return undefined
  return `${refused} must be 1 or true to ${POSTURE_FLAGS[refused]}, or unset; "${source[refused] ?? ''}" is not accepted.`
}

/**
 * Master insecure opt-out (`SOVRIUM_ALLOW_INSECURE=1` or `true`). When set, every
 * narrower control relaxes: insecure cookies + CSRF off + private outbound
 * allowed. Intended for trusted private/local deployments where the operator has
 * explicitly accepted the relaxed posture. It no longer governs the encryption
 * key — there is nothing left to relax there.
 */
export const isInsecureOptOut = (): boolean => isFlagSet('SOVRIUM_ALLOW_INSECURE')

/**
 * The narrow private-outbound opt-out ALONE (`SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1`
 * or `true`), without the master flag: what the plain-`http` rule for a
 * private host reads in `init --from-url` and its redirect follower.
 */
export const isPrivateOutboundOptIn = (): boolean => isFlagSet('SOVRIUM_ALLOW_PRIVATE_OUTBOUND')

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
 * {@link isLoopbackOrigin}, which decides whether the relaxed posture may
 * reflect a CORS origin, parses the origin and asks THIS function about its
 * hostname, so the two cannot drift.
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
 * Whether `origin` is a plain-HTTP loopback origin (`http://localhost:3000`,
 * `http://127.0.0.1`, `http://[::1]:5173`).
 *
 * The origin is PARSED and its hostname compared exactly against the loopback
 * set, never matched by prefix: `http://localhost.evil.com` starts with
 * `http://localhost` and is a public host anyone can register.
 */
export const isLoopbackOrigin = (origin: string): boolean => {
  try {
    const parsed = new URL(origin)
    return parsed.protocol === 'http:' && parsed.hostname !== '' && isLoopbackHost(parsed.hostname)
  } catch {
    return false
  }
}

/**
 * The host of the declared canonical origin (`BASE_URL`), or `undefined` when
 * it is unset or not a URL.
 */
export const resolveCanonicalHost = (): string | undefined => parseHostFromUrl(env['BASE_URL'])

/**
 * Resolve the effective canonical hostname used to decide transport posture.
 * Precedence (the declared public origin first):
 *   1. the host of a configured `BASE_URL` canonical origin,
 *   2. `bindHost` (the `ServerConfig.hostname` the socket actually bound),
 *   3. the `HOSTNAME` env var,
 *   4. `localhost` (the dev default).
 *
 * `BASE_URL` outranks the bind because it is what browsers reach: behind a
 * reverse proxy the socket binds loopback while the public origin is https,
 * and the posture — and the warnings that name it — must follow the origin.
 * See the HARNESS NOTE.
 */
export const resolveBindHostname = (bindHost?: string): string => {
  const baseUrlHost = resolveCanonicalHost()
  if (baseUrlHost !== undefined) return baseUrlHost
  if (bindHost !== undefined && bindHost !== '') return bindHost
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
export const isTransportRelaxed = (): boolean =>
  isInsecureOptOut() || isLoopbackHost(resolveBindHostname())

/**
 * SSRF guarding is ALWAYS ON. It relaxes only under the narrow
 * `SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1` (or `true`) opt-out (or the master
 * `SOVRIUM_ALLOW_INSECURE`). Crucially this is INDEPENDENT of the bind host —
 * a loopback-bound dev server still blocks private outbound targets unless the
 * operator opts in. The E2E harness sets the opt-out in `global-setup.ts` so
 * the webhook/http suites can reach `127.0.0.1:42xx`.
 */
export const isSsrfRelaxed = (): boolean => isInsecureOptOut() || isPrivateOutboundOptIn()

// There is no encryption-key posture here: no "key missing" predicate and no
// opt-in to a deterministic built-in key. The key is provisioned per install
// (`infrastructure/crypto/root-secret.ts`) — env var, else
// `<dataDir>/encryption-key`, else generate-and-persist — so there is no
// missing-key state to predicate on and no opt-out to grant.
//
// A built-in key would be public: all of `src/` is mirrored to a public
// repository and compiled into every shipped binary. The one refusal left — an
// unwritable data directory — lives in the root-secret module, beside the write
// it describes.
