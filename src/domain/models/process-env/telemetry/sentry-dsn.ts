/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Sentry DSN parsing for the observability-export feature
 * ([internal ref] / -PERFORMANCE).
 *
 * A Sentry DSN is `<scheme>://<public_key>@<host>[:port]/<project_id>`. The
 * public key authenticates the ingest request (via the `X-Sentry-Auth` header)
 * and the project id selects the destination project; together they derive the
 * envelope-ingest endpoint `POST <scheme>://<host>[:port]/api/<project_id>/envelope/`.
 *
 * Pure, dependency-free parsing (mirrors `parseSqliteUrl` in
 * `database/database-dialect.ts`): a set-but-malformed DSN throws so the boot
 * validator (`validateTelemetryConfiguration`) can abort loudly, naming the
 * offending variable. An unset DSN is handled one level up in
 * `parseTelemetryConfig` (unset → silently off).
 */

/** A parsed Sentry DSN with its derived envelope-ingest endpoint. */
export interface SentryDsn {
  /** URL scheme without the trailing colon, e.g. `https`. */
  readonly scheme: string
  /** The DSN public key (used as `sentry_key` in the `X-Sentry-Auth` header). */
  readonly publicKey: string
  /** Destination host, e.g. `[internal ref]` — the banner renders this only. */
  readonly host: string
  /** Optional explicit port. */
  readonly port?: number
  /** Numeric project id (kept as a string, exactly as it appears in the DSN path). */
  readonly projectId: string
  /** Derived ingest endpoint: `<scheme>://<host>[:port]/api/<project_id>/envelope/`. */
  readonly envelopeUrl: string
}

/** Grammar-reminder message reused for every malformed-DSN failure. */
const invalidDsnMessage = (raw: string): string =>
  `Invalid Sentry DSN "${raw}" — expected <scheme>://<public_key>@<host>[:port]/<project_id>`

/**
 * Parse `raw` into a {@link SentryDsn}, or throw when it does not match the DSN
 * grammar. The throw is intentional (fail-loud) — callers that need a
 * "silently off when unset" contract must guard on emptiness first.
 */
export const parseSentryDsn = (raw: string): SentryDsn => {
  const url = toUrl(raw)
  const publicKey = url.username
  const projectId = url.pathname.replace(/^\/+/, '').split('/')[0] ?? ''
  const isHttp = url.protocol === 'http:' || url.protocol === 'https:'

  if (!isHttp || publicKey === '' || projectId === '') {
    // eslint-disable-next-line functional/no-throw-statements -- fail-loud: surface the bad DSN at boot (mirrors parseSqliteUrl)
    throw new Error(invalidDsnMessage(raw))
  }

  const scheme = url.protocol.replace(':', '')
  const host = url.hostname
  const port = url.port === '' ? undefined : Number(url.port)
  const authority = port === undefined ? host : `${host}:${port}`
  const envelopeUrl = `${scheme}://${authority}/api/${projectId}/envelope/`

  return {
    scheme,
    publicKey,
    host,
    ...(port === undefined ? {} : { port }),
    projectId,
    envelopeUrl,
  }
}

/** Wrap `new URL` so a non-URL DSN throws the grammar-reminder message. */
// eslint-disable-next-line functional/prefer-immutable-types -- URL is an intrinsically mutable platform class
const toUrl = (raw: string): URL => {
  try {
    return new URL(raw)
  } catch {
    // eslint-disable-next-line functional/no-throw-statements -- fail-loud: surface the bad DSN at boot
    throw new Error(invalidDsnMessage(raw))
  }
}
