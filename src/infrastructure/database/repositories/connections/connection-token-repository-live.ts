/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, desc, eq } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  ConnectionTokenDatabaseError,
  ConnectionTokenRepository,
  SentinelTokenInProductionError,
  type ConnectionAppTokenPlaintext,
  type ConnectionTokenPlaintext,
  type ConnectionUserSummary,
} from '@/application/ports/repositories/connections/connection-token-repository'
import { isSentinelAccessToken } from '@/infrastructure/connections/sentinel-tokens'
import {
  currentTokenKeyId,
  decryptToken,
  encryptToken,
  envelopeKeyId,
} from '@/infrastructure/crypto/token-encrypt'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import {
  connectionAppTokens as connectionAppTokensPg,
  connectionTokens as connectionTokensPg,
} from '@/infrastructure/database/drizzle/schema/connection'
import {
  connectionAppTokens as connectionAppTokensSqlite,
  connectionTokens as connectionTokensSqlite,
} from '@/infrastructure/database/drizzle/schema-sqlite/connection'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { isEncryptionKeyMismatch } from '@/infrastructure/errors/encryption-key-mismatch-error'
import { isProduction } from '@/infrastructure/utils/env'

const connectionTokens = resolveDialectSchema(connectionTokensPg, connectionTokensSqlite)
const connectionAppTokens = resolveDialectSchema(connectionAppTokensPg, connectionAppTokensSqlite)

/** Wrap a DB promise, adapting failures to ConnectionTokenDatabaseError. */
const wrap = makeDbWrap((cause) => new ConnectionTokenDatabaseError({ cause }))

/**
 * Connection Token Repository Implementation (Drizzle).
 *
 * Encrypts on write, decrypts on read. The `access_token` and
 * `refresh_token` columns store base64-JSON envelopes (`v1:{...}`)
 * produced by `crypto/token-encrypt.ts`. Callers above the repo see
 * plaintext via the `ConnectionTokenPlaintext` shape.
 *
 * Upsert is a single INSERT ... ON CONFLICT DO UPDATE keyed on the
 * `(connection_id, user_id)` unique index (audit H3). Two concurrent
 * OAuth callbacks for the same user resolve to exactly one row.
 */
/**
 * Defense-in-depth guard: refuse to persist a sentinel-shaped
 * access token when running in production. Returns the error to fail
 * with, or `undefined` to proceed. Pure; takes the production check as
 * an injected predicate so unit tests can drive both branches without
 * touching `process.env`.
 *
 * @internal — exported for unit tests; production callers go through
 * `upsertForUser` which composes this guard into the Effect.
 */
export const checkSentinelGuard = (
  input: Readonly<{
    connectionId: string
    /** Absent for an `app`-scoped (shared) write — it has no user by design. */
    userId?: string
    accessToken: string
    isProductionEnv: () => boolean
  }>
): Readonly<SentinelTokenInProductionError> | undefined => {
  if (!input.isProductionEnv()) return undefined
  if (!isSentinelAccessToken(input.accessToken)) return undefined
  return new SentinelTokenInProductionError({
    connectionId: input.connectionId,
    userId: input.userId,
  })
}

const decodeRow = (row: Readonly<Record<string, unknown>>): ConnectionTokenPlaintext => {
  const refreshEnvelope = row['refreshToken'] as string | null | undefined
  const expiresAt = row['expiresAt'] as Date | null | undefined
  return {
    id: String(row['id']),
    connectionId: String(row['connectionId']),
    userId: String(row['userId']),
    accessToken: decryptToken(String(row['accessToken'])),
    refreshToken:
      typeof refreshEnvelope === 'string' && refreshEnvelope !== ''
        ? decryptToken(refreshEnvelope)
        : undefined,
    expiresAt: expiresAt instanceof Date ? expiresAt : undefined,
    createdAt: row['createdAt'] as Date,
    updatedAt: row['updatedAt'] as Date,
  }
}

/** Decode a shared (`app`-scoped) row, decrypting both envelopes. */
const decodeAppRow = (row: Readonly<Record<string, unknown>>): ConnectionAppTokenPlaintext => {
  const refreshEnvelope = row['refreshToken'] as string | null | undefined
  const expiresAt = row['expiresAt'] as Date | null | undefined
  return {
    id: String(row['id']),
    connectionId: String(row['connectionId']),
    accessToken: decryptToken(String(row['accessToken'])),
    refreshToken:
      typeof refreshEnvelope === 'string' && refreshEnvelope !== ''
        ? decryptToken(refreshEnvelope)
        : undefined,
    expiresAt: expiresAt instanceof Date ? expiresAt : undefined,
    createdAt: row['createdAt'] as Date,
    updatedAt: row['updatedAt'] as Date,
  }
}

/**
 * Would adopting this stored envelope as a shared credential resurrect a TEST
 * SENTINEL?
 *
 * The seeder only ever writes sentinels for `scope: 'user'` connections, so on
 * an app-scoped connection this should never fire — it is the belt to the
 * seeder's braces, because a sentinel promoted to shared status would make
 * every automation in the installation look connected while injecting a token
 * no provider will accept.
 *
 * An envelope this process CANNOT decrypt is deliberately treated as
 * adoptable. That is the pre-upgrade install whose key has since rotated —
 * exactly the population the adoption exists for — and refusing there would
 * withhold the repair from the only people who need it. A sentinel is a
 * test-only artifact and can never be the unreadable case in practice.
 */
const isSentinelEnvelope = (envelope: string): boolean => {
  try {
    return isSentinelAccessToken(decryptToken(envelope))
  } catch {
    return false
  }
}

/**
 * Is this stored envelope unreadable under the key this process holds?
 *
 * Two envelope shapes, two honest answers:
 *
 *   - `v2:` declares a key fingerprint, so comparing it answers the question
 *     with no cryptography at all — a string scan per row rather than a cipher.
 *   - `v1:` predates the fingerprint and declares nothing. The only truthful
 *     test is to try: one AES-GCM open against an already-derived key. Skipping
 *     these would stay silent for precisely the population most at risk — an
 *     install that upgraded and then changed its key — while calling them all
 *     foreign would cry wolf on every install that has ever upgraded.
 *
 * A row that fails for any reason OTHER than the key (a truncated or hand-edited
 * envelope) is not counted: the warning names a cause, and naming the wrong one
 * sends the operator to re-authorize users whose tokens were never the problem.
 */
const isUnreadableUnderCurrentKey = (envelope: string, currentKeyId: string): boolean => {
  const declared = envelopeKeyId(envelope)
  if (declared !== undefined) return declared !== currentKeyId
  try {
    // eslint-disable-next-line functional/no-expression-statements -- probe: the return value is irrelevant, only whether it throws
    decryptToken(envelope)
    return false
  } catch (error) {
    return isEncryptionKeyMismatch(error)
  }
}

/**
 * Count stored token rows that this deployment's key cannot read.
 *
 * Best-effort by construction: a failure here must never keep a server down, so
 * it resolves to `0`. Feeds the boot ⚠ described in [internal ref].
 */
export const countTokensEncryptedWithAnotherKey = async (): Promise<number> => {
  try {
    const rows = await db
      .select({ accessToken: connectionTokens.accessToken })
      .from(connectionTokens)
    const current = currentTokenKeyId()
    return rows.filter((row) => isUnreadableUnderCurrentKey(String(row.accessToken), current))
      .length
  } catch {
    return 0
  }
}

export const ConnectionTokenRepositoryLive = Layer.succeed(ConnectionTokenRepository, {
  findForUser: ({ connectionId, userId }) =>
    wrap(async () => {
      const rows = await db
        .select()
        .from(connectionTokens)
        .where(
          and(eq(connectionTokens.connectionId, connectionId), eq(connectionTokens.userId, userId))
        )
        .limit(1)
      return rows[0] !== undefined ? decodeRow(rows[0] as Record<string, unknown>) : undefined
    }),

  upsertForUser: ({ connectionId, userId, accessToken, refreshToken, expiresAt }) =>
    Effect.gen(function* () {
      // Defense-in-depth: refuse to persist a sentinel-shaped
      // access token in production. The seeder no-ops at NODE_ENV ===
      // 'production' (see runSeedTestConnectionTokens), but if NODE_ENV is
      // unset (a fail-open scenario in some deployment platforms), the
      // seeder would still run. This repository-side check is the second
      // line of defense — even with a misconfigured environment, a
      // sentinel cannot reach the production database via this method.
      // Real OAuth providers never hand back tokens ending in
      // '.signature-placeholder', so a true positive only occurs when
      // someone has tried to inject a test sentinel.
      const guardError = checkSentinelGuard({
        connectionId,
        userId,
        accessToken,
        isProductionEnv: isProduction,
      })
      if (guardError !== undefined) {
        return yield* guardError
      }

      return yield* wrap(async () => {
        const accessEnvelope = encryptToken(accessToken)
        const refreshEnvelope =
          refreshToken !== undefined && refreshToken !== '' ? encryptToken(refreshToken) : undefined

        const valuesForWrite = {
          accessToken: accessEnvelope,
          ...(refreshEnvelope !== undefined ? { refreshToken: refreshEnvelope } : {}),
          ...(expiresAt !== undefined ? { expiresAt } : {}),
        }

        // Single statement, atomic against the
        // (connection_id, user_id) unique index. updatedAt is bumped via
        // the schema's $onUpdate so we don't need to set it explicitly.
        const [row] = await db
          .insert(connectionTokens)
          .values({ connectionId, userId, ...valuesForWrite })
          .onConflictDoUpdate({
            target: [connectionTokens.connectionId, connectionTokens.userId],
            set: valuesForWrite,
          })
          .returning()
        if (row === undefined) {
          // eslint-disable-next-line functional/no-throw-statements -- defensive; INSERT...RETURNING never returns zero rows for a successful write
          throw new Error('connection_tokens upsert returned no row')
        }
        return decodeRow(row as Record<string, unknown>)
      })
    }),

  deleteForUser: ({ connectionId, userId }) =>
    wrap(async () => {
      const deleted = await db
        .delete(connectionTokens)
        .where(
          and(eq(connectionTokens.connectionId, connectionId), eq(connectionTokens.userId, userId))
        )
        .returning({ id: connectionTokens.id })
      return deleted.length > 0
    }),

  deleteForConnection: (connectionId) =>
    wrap(async () => {
      // Delete every operator's token row for this connection so an
      // `app`-scoped (shared) connection returns to the unconnected state
      // (`tokenCount === 0`). Parameter-bound on `connection_id` (S3).
      const deleted = await db
        .delete(connectionTokens)
        .where(eq(connectionTokens.connectionId, connectionId))
        .returning({ id: connectionTokens.id })
      return deleted.length
    }),

  countForConnection: (connectionId) =>
    wrap(async () => {
      const rows = await db
        .select({ id: connectionTokens.id })
        .from(connectionTokens)
        .where(eq(connectionTokens.connectionId, connectionId))
      return rows.length
    }),

  listUsersForConnection: ({ connectionId }) =>
    wrap(async () => {
      const rows = await db
        .select()
        .from(connectionTokens)
        .where(eq(connectionTokens.connectionId, connectionId))
      // Token-content filtering (sentinel detection, etc.) lives in the
      // injection path (`auth-headers.ts`); the listing endpoint
      // returns a row for every (connection_id, user_id) tuple that
      // exists in the database, leaving role-based exclusion (admins
      // don't authorize per-user-scope connections) to the API
      // handler — see `users-handler.ts` for that layer.
      const summaries: readonly ConnectionUserSummary[] = rows.map((row) => {
        const r = row as Record<string, unknown>
        const expires = r['expiresAt']
        return {
          userId: String(r['userId']),
          expiresAt: expires instanceof Date ? expires : undefined,
          createdAt: r['createdAt'] as Date,
          updatedAt: r['updatedAt'] as Date,
        }
      })
      return summaries
    }),

  // ── `app`-scoped (shared) credential ────────────────────────────────────────

  findForApp: ({ connectionId }) =>
    wrap(async () => {
      const rows = await db
        .select()
        .from(connectionAppTokens)
        .where(eq(connectionAppTokens.connectionId, connectionId))
        .limit(1)
      return rows[0] !== undefined ? decodeAppRow(rows[0] as Record<string, unknown>) : undefined
    }),

  upsertForApp: ({ connectionId, accessToken, refreshToken, expiresAt }) =>
    Effect.gen(function* () {
      // Same defense-in-depth as `upsertForUser`, and it matters
      // MORE here: a sentinel parked in the shared store would make every
      // automation in the installation look connected at once.
      const guardError = checkSentinelGuard({
        connectionId,
        accessToken,
        isProductionEnv: isProduction,
      })
      if (guardError !== undefined) {
        return yield* guardError
      }

      return yield* wrap(async () => {
        const accessEnvelope = encryptToken(accessToken)
        const refreshEnvelope =
          refreshToken !== undefined && refreshToken !== '' ? encryptToken(refreshToken) : undefined

        const valuesForWrite = {
          accessToken: accessEnvelope,
          ...(refreshEnvelope !== undefined ? { refreshToken: refreshEnvelope } : {}),
          ...(expiresAt !== undefined ? { expiresAt } : {}),
        }

        const [row] = await db
          .insert(connectionAppTokens)
          .values({ connectionId, ...valuesForWrite })
          .onConflictDoUpdate({
            target: [connectionAppTokens.connectionId],
            set: valuesForWrite,
          })
          .returning()
        if (row === undefined) {
          // eslint-disable-next-line functional/no-throw-statements -- defensive; INSERT...RETURNING never returns zero rows for a successful write
          throw new Error('connection_app_tokens upsert returned no row')
        }
        return decodeAppRow(row as Record<string, unknown>)
      })
    }),

  deleteForApp: ({ connectionId }) =>
    wrap(async () => {
      const deleted = await db
        .delete(connectionAppTokens)
        .where(eq(connectionAppTokens.connectionId, connectionId))
        .returning({ id: connectionAppTokens.id })
      return deleted.length > 0
    }),

  findAppSummary: ({ connectionId }) =>
    wrap(async () => {
      // Reads metadata only — never decrypts. The admin dashboard must render
      // on an install whose encryption key has rotated, and decrypting here
      // would turn that into a 500 on the very page that explains the problem.
      const rows = await db
        .select({
          expiresAt: connectionAppTokens.expiresAt,
          createdAt: connectionAppTokens.createdAt,
          updatedAt: connectionAppTokens.updatedAt,
        })
        .from(connectionAppTokens)
        .where(eq(connectionAppTokens.connectionId, connectionId))
        .limit(1)
      const row = rows[0] as Record<string, unknown> | undefined
      if (row === undefined) return undefined
      const expires = row['expiresAt']
      return {
        expiresAt: expires instanceof Date ? expires : undefined,
        createdAt: row['createdAt'] as Date,
        updatedAt: row['updatedAt'] as Date,
      }
    }),

  adoptLegacyUserTokenAsApp: ({ connectionId }) =>
    wrap(async () => {
      const existing = await db
        .select({ id: connectionAppTokens.id })
        .from(connectionAppTokens)
        .where(eq(connectionAppTokens.connectionId, connectionId))
        .limit(1)
      // A shared credential already exists — it wins, always. Overwriting it
      // from a per-user row could silently downgrade a freshly-authorized
      // shared token to a stale one.
      if (existing.length > 0) return false

      const legacy = await db
        .select({
          accessToken: connectionTokens.accessToken,
          refreshToken: connectionTokens.refreshToken,
          expiresAt: connectionTokens.expiresAt,
        })
        .from(connectionTokens)
        .where(eq(connectionTokens.connectionId, connectionId))
        .orderBy(desc(connectionTokens.updatedAt))
        .limit(1)
      const row = legacy[0] as Record<string, unknown> | undefined
      if (row === undefined) return false

      const accessEnvelope = String(row['accessToken'])
      if (isSentinelEnvelope(accessEnvelope)) return false

      const { refreshToken: refreshEnvelope, expiresAt } = row
      // Ciphertext moves VERBATIM — no decrypt, no re-encrypt. The adoption
      // therefore neither needs nor risks the encryption key, and the adopted
      // row is byte-identical to what the older build wrote.
      const inserted = await db
        .insert(connectionAppTokens)
        .values({
          connectionId,
          accessToken: accessEnvelope,
          ...(typeof refreshEnvelope === 'string' && refreshEnvelope !== ''
            ? { refreshToken: refreshEnvelope }
            : {}),
          ...(expiresAt instanceof Date ? { expiresAt } : {}),
        })
        .onConflictDoNothing({ target: [connectionAppTokens.connectionId] })
        .returning({ id: connectionAppTokens.id })
      return inserted.length > 0
    }),
})
