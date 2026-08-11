/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { symmetricDecrypt } from 'better-auth/crypto'
import { inArray } from 'drizzle-orm'
import { resolveAuthSecret } from '@/infrastructure/auth/auth-secret'
import { jwks as jwksPg } from '@/infrastructure/auth/better-auth/schema'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { jwks as jwksSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/auth-tables'

/**
 * Boot-time repair for JWT signing keys the current auth secret cannot read.
 *
 * Better Auth's JWT plugin stores an EdDSA signing key in `auth.jwks`, with the
 * private half symmetrically encrypted under the auth secret. Nothing revisits
 * that row when the secret changes, so the first request that needs to sign
 * anything throws `Failed to decrypt private key` and the endpoint answers 500 —
 * for a session that is otherwise perfectly valid. The failure is total (every
 * signing request) and its cause is invisible from outside the server log.
 *
 * That was a latent trap while `AUTH_SECRET` was something an operator set by
 * hand and rarely changed. Deriving it from the root secret makes the trap
 * reachable by accident: an install whose data directory is ephemeral
 * regenerates its root secret on restart, which rotates the derived auth secret,
 * which bricks every signing request. The connection-token survey warns about
 * the same hazard one table over; this closes the other half.
 *
 * WHY REGENERATE HERE AND REFUSE THERE. A connection token is user data — a
 * delegated credential to somebody's third-party account that only that user can
 * re-issue — so silently replacing it would destroy something irreplaceable, and
 * refusing loudly is the only honest answer. A JWKS row is derived key material
 * with no user data in it: dropping it costs exactly the validity of tokens
 * already signed with it, and Better Auth mints a fresh key on the next signing
 * request. Regenerating is therefore cheap and safe, and leaving the deployment
 * unable to serve any session is not.
 *
 * The cost is not zero, which is why it still warns: previously-issued JWTs stop
 * verifying against the published JWKS. In practice no live client depends on
 * them today — nothing in the schema declares an OAuth server, and the JWT
 * plugin is enabled for every auth-enabled app as a peer requirement of the
 * OAuth provider rather than because an app asked for it.
 */

const jwks = resolveDialectSchema(jwksPg, jwksSqlite)

/**
 * Run `work` with the event loop pinned open.
 *
 * This is not defensive noise — without it this module exits the process.
 *
 * The probe below awaits WebCrypto (`symmetricDecrypt` hashes the secret through
 * `crypto.subtle`), and it runs during BOOT, before the HTTP listener binds. At
 * that moment nothing else is holding the loop open, and Bun does not count a
 * pending WebCrypto operation as a handle that keeps the program alive: the
 * runtime concludes there is no work left and exits **0** while the digest is
 * still outstanding. It surfaces as `Server exited before starting (code 0)`,
 * with the boot log stopping mid-probe and no error anywhere — about the most
 * misleading shape a failure can take.
 *
 * A pending timer IS such a handle, so one is held for the duration and cleared
 * in `finally`. The same code runs fine once the listener is bound, which is why
 * every other WebCrypto call in the auth stack is unaffected.
 */
const withEventLoopKeptAlive = async <A>(work: () => Promise<A>): Promise<A> => {
  const keepAlive = setInterval(() => {}, 1000)
  try {
    return await work()
  } finally {
    // Release the handle; leaving it set would keep a finished process alive.
    clearInterval(keepAlive)
  }
}

/**
 * Can the current auth secret decrypt this row's private key?
 *
 * A row is only judged unreadable when the decryption itself fails. A row whose
 * `private_key` is not an encrypted payload at all — the shape Better Auth
 * writes under `jwks.disablePrivateKeyEncryption` — is left alone: it is
 * readable by construction, and deleting it would destroy a working key on a
 * deployment that deliberately opted out of encryption.
 */
const isReadable = async (privateKey: string, secret: string): Promise<boolean> => {
  try {
    const payload: unknown = JSON.parse(privateKey)
    if (typeof payload !== 'string') return true
    // eslint-disable-next-line functional/no-expression-statements -- a probe: the plaintext is irrelevant, only whether decryption succeeds
    await symmetricDecrypt({ key: secret, data: payload })
    return true
  } catch {
    return false
  }
}

/**
 * Drop every JWKS row the current auth secret cannot decrypt, returning how many
 * were dropped so the caller can tell the operator.
 *
 * Best-effort by construction: this runs on the boot path and a failure here must
 * never keep a server down, so it resolves to `0` — leaving the deployment no
 * worse off than before this repair existed.
 *
 * It deliberately does NOT delete unconditionally. Rows that still decrypt are
 * the signing keys currently in use, and removing those would rotate the keys of
 * a perfectly healthy deployment on every single boot.
 */
export const rekeyUnreadableJwks = async (): Promise<number> =>
  withEventLoopKeptAlive(async () => {
    try {
      const secret = resolveAuthSecret()
      const rows = await db.select({ id: jwks.id, privateKey: jwks.privateKey }).from(jwks)
      const verdicts = await Promise.all(
        rows.map(async (row) => ({
          id: String(row.id),
          readable: await isReadable(String(row.privateKey), secret),
        }))
      )
      const staleIds = verdicts.filter((verdict) => !verdict.readable).map((verdict) => verdict.id)
      if (staleIds.length === 0) return 0
      // eslint-disable-next-line functional/no-expression-statements -- the repair itself; Better Auth re-creates the key on the next signing request
      await db.delete(jwks).where(inArray(jwks.id, staleIds))
      return staleIds.length
    } catch {
      return 0
    }
  })
