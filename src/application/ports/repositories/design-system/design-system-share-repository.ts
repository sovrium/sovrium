/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'

/** Database error for design-system share operations. */
export class DesignSystemShareDatabaseError extends Data.TaggedError(
  'DesignSystemShareDatabaseError'
)<{
  readonly cause: unknown
}> {}

/**
 * One share row as the application layer sees it.
 *
 * There is no `token` and no `tokenHash` on this shape, and that is the port's
 * main job: the plaintext exists only inside the mint use case, and the digest
 * exists only inside the repository. A field absent from the record cannot be
 * serialised into a list response by accident, which is the leak
 * `[internal ref]` exists to catch.
 */
export interface DesignSystemShareRecord {
  readonly id: string
  readonly createdAt: Date
  readonly createdBy?: string | undefined
  readonly revokedAt?: Date | undefined
}

/**
 * `system.design_system_shares` port — mint, list, resolve, revoke.
 *
 * Backs the four surfaces [internal ref] A3 Part 2 authorises. The lookup is BY DIGEST
 * and only ever returns a row that is not revoked, so a revoked token and an
 * unknown one are indistinguishable to every caller above this line — which is
 * what makes the anti-enumeration 404 (standing rule S1) structural rather than
 * a branch a handler has to remember to write.
 */
export class DesignSystemShareRepository extends Context.Service<
  DesignSystemShareRepository,
  {
    /**
     * Persist a new share. The caller hashes the plaintext with SHA-256 BEFORE
     * invoking this method — the port is digest-only, exactly like
     * `BootstrapTokenRepository`.
     */
    readonly create: (input: {
      readonly appName: string
      readonly tokenHash: string
      readonly createdBy?: string | undefined
    }) => Effect.Effect<DesignSystemShareRecord, DesignSystemShareDatabaseError>

    /** Every share for this app that has not been revoked, newest first. */
    readonly listActive: (
      appName: string
    ) => Effect.Effect<ReadonlyArray<DesignSystemShareRecord>, DesignSystemShareDatabaseError>

    /** The live share bearing this digest, or `undefined` for a miss OR a revocation. */
    readonly findActiveByTokenHash: (
      appName: string,
      tokenHash: string
    ) => Effect.Effect<DesignSystemShareRecord | undefined, DesignSystemShareDatabaseError>

    /**
     * Stamp `revoked_at`. Returns `false` when no live row carried that id, so
     * the handler can answer 404 without a second read.
     */
    readonly revoke: (
      appName: string,
      id: string
    ) => Effect.Effect<boolean, DesignSystemShareDatabaseError>
  }
>()('DesignSystemShareRepository') {}
