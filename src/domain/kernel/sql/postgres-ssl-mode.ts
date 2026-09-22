/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pin the TLS verification guarantee of a PostgreSQL connection string across
 * the `pg@9` / `pg-connection-string@3` major bump.
 *
 * Why this exists
 * ---------------
 * `pg-connection-string@2.x` treats `sslmode=prefer`, `require`, and `verify-ca`
 * as aliases for `verify-full`, and says so at runtime with a one-shot process
 * warning that reads like a vulnerability report but is the opposite — the
 * aliasing makes the connection STRICTER than the string asks for. Traced end to
 * end in v2.14.0: a present `sslmode` sets `config.ssl = {}`, the alias branch
 * warns but assigns nothing, and `pg` then merges that empty object into the TLS
 * options — so `rejectUnauthorized` keeps its default of `true` and `pg` sets
 * `servername`, giving full chain plus hostname verification.
 *
 * In v3 those same modes adopt libpq semantics, where `prefer` and `require`
 * perform **no verification at all**. The warning is therefore not noise about
 * today; it announces that a routine dependency bump will silently downgrade
 * every deployment that relies on the current behaviour, with no code change to
 * review.
 *
 * Contract
 * --------
 * Rewrite the three aliased modes to an explicit `verify-full`. That is a
 * behavioural no-op today and keeps the identical guarantee after the bump — it
 * is the only rewrite that does not change an existing deployment's security
 * posture in one direction or the other.
 *
 *   - `sslmode=prefer|require|verify-ca` → `sslmode=verify-full`
 *   - `sslmode=verify-full`             → unchanged (idempotent)
 *   - `sslmode=disable|no-verify`       → unchanged (deliberate operator relaxations)
 *   - `uselibpqcompat=true` present     → unchanged (explicit opt-in to libpq semantics)
 *   - no `sslmode`, or a non-PostgreSQL / malformed string → unchanged
 *
 * This cannot break an operator whose connection works today: anyone pointing at
 * a private-CA or self-signed PostgreSQL is ALREADY forced onto `no-verify` or
 * `disable`, precisely because `require` already means `verify-full`. Those two
 * modes are passed through untouched.
 *
 * Matching is case-sensitive on purpose. `pg-connection-string` compares the
 * mode against lowercase literals with `===`, so `sslmode=REQUIRE` never reaches
 * its alias branch in either version; leaving it alone mirrors the parser
 * exactly, which is the whole point of this function.
 *
 * Implementation note — the password
 * ----------------------------------
 * Only the query segment after the first `?` is ever rebuilt, and it is rebuilt
 * by `split('&')` / `join('&')`, which round-trips byte-for-byte. Everything
 * before the `?` — including the userinfo carrying the password — is returned as
 * a raw slice of the input. Round-tripping through `new URL().toString()` would
 * re-encode reserved characters in the password and break authentication, so it
 * is deliberately avoided here.
 */

/** The three modes `pg-connection-string@2.x` silently upgrades to `verify-full`. */
const ALIASED_SSL_MODES: ReadonlySet<string> = new Set(['prefer', 'require', 'verify-ca'])

/** Connection-string schemes `pg` accepts; anything else is left untouched. */
const POSTGRES_SCHEMES: readonly string[] = ['postgres://', 'postgresql://']

const SSL_MODE_PREFIX = 'sslmode='

/** Operator opt-in to libpq semantics — honoured verbatim, never rewritten. */
const LIBPQ_COMPAT_OPT_IN = 'uselibpqcompat=true'

export const pinPostgresSslMode = (databaseUrl: string): string => {
  if (!POSTGRES_SCHEMES.some((scheme) => databaseUrl.startsWith(scheme))) return databaseUrl

  const separator = databaseUrl.indexOf('?')
  if (separator === -1) return databaseUrl

  // Keep everything up to and including the `?` as an untouched raw slice — the
  // password lives in there.
  const prefix = databaseUrl.slice(0, separator + 1)
  const pairs = databaseUrl.slice(separator + 1).split('&')

  if (pairs.includes(LIBPQ_COMPAT_OPT_IN)) return databaseUrl

  return (
    prefix +
    pairs
      .map((pair) =>
        pair.startsWith(SSL_MODE_PREFIX) &&
        ALIASED_SSL_MODES.has(pair.slice(SSL_MODE_PREFIX.length))
          ? `${SSL_MODE_PREFIX}verify-full`
          : pair
      )
      .join('&')
  )
}
