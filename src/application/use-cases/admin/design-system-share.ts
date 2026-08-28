/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The revocable public share link over the design system — [internal ref] amendment
 * A3 Part 2.
 *
 * Four operations, one table: mint a token, list the live shares, resolve a
 * token an anonymous reader presented, revoke a share. The projection the
 * reader is served is NOT built here — it is `buildDesignSystem(app)`, the same
 * generator the two A2 exports read, because a second serializer for the
 * anonymous path would be a second place to leak and the `.strict()` contract
 * would not be guarding it.
 *
 * ─── THE TOKEN: 256 BITS, DIGEST AT REST, PLAINTEXT RETURNED ONCE ───────────
 *
 * A3 names exactly one precedent — "the pattern `bootstrap-token.ts`
 * established and justified": `randomBytes(32).toString('hex')`, SHA-256 hex
 * digest persisted, plaintext handed back to the caller and never logged.
 *
 * The two crypto helpers below are spelled out here rather than imported from
 * `use-cases/auth/bootstrap-token.ts`. That is deliberate: importing them would
 * drag an admin-console use case into the auth module's dependency graph (the
 * `Auth` service, `AuthRepository`, Better Auth's `createUser`) for the sake of
 * two one-line calls into `node:crypto`. Coupling two unrelated use cases costs
 * more than restating `randomBytes(32)` does.
 *
 * `src/domain/utils/share-link-helpers.ts` is deliberately NOT used. Its
 * `generateShareToken` is `randomBytes(24)` — 192 bits, adequate on the merits
 * but a gratuitous divergence from the pattern A3 names — and its docblock
 * promises uniqueness via "the schema's UNIQUE index on `token`", a constraint
 * on the PLAINTEXT that contradicts digest-only storage outright. Its table was
 * never created and it has no caller outside its own unit test; inheriting it
 * would import the contradiction along with the eight bytes.
 *
 * ─── WHY THE PLAINTEXT IS NEVER LOGGED, AND WHY THAT IS NOT ASSERTED HERE ───
 *
 * The plaintext is returned to the caller and referenced nowhere else in this
 * module — no `logInfo`, no error payload, no metadata field on the audit
 * entry. The HTTP-observable half of that promise is covered by
 * `[internal ref]`; the log half has no fixture that could observe it,
 * so it is a property of this file rather than of a spec.
 */

import { createHash, randomBytes } from 'node:crypto'
import { Effect } from 'effect'
import {
  DesignSystemShareRepository,
  type DesignSystemShareDatabaseError,
  type DesignSystemShareRecord,
} from '@/application/ports/repositories/design-system/design-system-share-repository'

/** The fixed, non-configurable base path a design-system share is served at. */
export const DESIGN_SYSTEM_SHARE_PREFIX = '/s/design-system/'

/** SHA-256 hex digest of a UTF-8 plaintext token. */
export const hashDesignSystemShareToken = (plaintext: string): string =>
  createHash('sha256').update(plaintext, 'utf8').digest('hex')

/** A fresh 256-bit (64 hex char) cryptographically random token. */
export const generateDesignSystemShareToken = (): string => randomBytes(32).toString('hex')

/** The reader URL a minted token resolves at, relative to the instance root. */
export const designSystemShareUrl = (token: string): string =>
  `${DESIGN_SYSTEM_SHARE_PREFIX}${token}`

/** What a mint returns: the row, plus the plaintext the caller must show once. */
export interface MintedDesignSystemShare {
  readonly share: DesignSystemShareRecord
  /** The plaintext. Emitted to the operator exactly once and never persisted. */
  readonly token: string
}

/**
 * Mint a share: generate a token, persist only its digest, return both.
 *
 * The digest is computed before the write and the plaintext never enters the
 * repository call, so there is no code path on which the secret reaches the
 * database even if the row shape later grows a column.
 */
export const mintDesignSystemShare = (input: {
  readonly appName: string
  readonly createdBy?: string | undefined
}): Effect.Effect<
  MintedDesignSystemShare,
  DesignSystemShareDatabaseError,
  DesignSystemShareRepository
> =>
  Effect.gen(function* () {
    const repository = yield* DesignSystemShareRepository
    const token = generateDesignSystemShareToken()
    const share = yield* repository.create({
      appName: input.appName,
      tokenHash: hashDesignSystemShareToken(token),
      ...(input.createdBy === undefined ? {} : { createdBy: input.createdBy }),
    })
    return { share, token }
  })

/** Every live share for this app, newest first. Metadata only, by construction. */
export const listDesignSystemShares = (
  appName: string
): Effect.Effect<
  ReadonlyArray<DesignSystemShareRecord>,
  DesignSystemShareDatabaseError,
  DesignSystemShareRepository
> =>
  Effect.gen(function* () {
    const repository = yield* DesignSystemShareRepository
    return yield* repository.listActive(appName)
  })

/**
 * Resolve a plaintext token an anonymous reader presented.
 *
 * `undefined` covers a token that never existed, a token that was revoked, and
 * a string that is not a token at all — one answer for all three, which is what
 * lets the route emit one 404 body and confirm nothing (standing rule S1).
 */
export const resolveDesignSystemShare = (
  appName: string,
  token: string
): Effect.Effect<
  DesignSystemShareRecord | undefined,
  DesignSystemShareDatabaseError,
  DesignSystemShareRepository
> =>
  Effect.gen(function* () {
    const repository = yield* DesignSystemShareRepository
    return yield* repository.findActiveByTokenHash(appName, hashDesignSystemShareToken(token))
  })

/** Revoke a share. `false` when no live share carried that id. */
export const revokeDesignSystemShare = (
  appName: string,
  id: string
): Effect.Effect<boolean, DesignSystemShareDatabaseError, DesignSystemShareRepository> =>
  Effect.gen(function* () {
    const repository = yield* DesignSystemShareRepository
    return yield* repository.revoke(appName, id)
  })
