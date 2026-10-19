/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Option } from 'effect'
import {
  isStorageObjectNotFound,
  StorageService,
  UNATTRIBUTED_BUCKET,
} from '@/application/ports/services/storage-service'
import { CALLER_REFUSAL } from './record-caller-gate'
import {
  catalogBucket,
  reportOutage,
  starterStanding,
  type StarterGateRequirements,
} from './starter-file-gate'
import type { AutomationContext } from './shared'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { BucketBinding } from '@/application/ports/services/storage-service'
import type { App } from '@/domain/models/app'

/**
 * WRITING OVER A STORED KEY, IN A RUN SOMEONE STARTED BY HAND: a run whose
 * starter is not admin-equivalent writes over no file it did not write itself.
 * The read and removal decisions live in `starter-file-gate.ts`.
 */

type Storage = Effect.Success<typeof StorageService>

/**
 * Whether a write at `key` would land on another stored spelling of it (Unicode
 * NFC, or letter case where the store folds it): the store refuses such a
 * write, so the gate refuses it first, in the one shape every refusal takes. A
 * store that cannot answer counts as taken.
 */
const landsOnOtherSpelling = (storage: Storage, key: string) =>
  storage.findOtherSpelling(key).pipe(
    Effect.map(Option.isSome),
    Effect.tapCause(reportOutage(key)),
    // effect-swallow: an unanswered spelling read refuses the write; the outage was logged just above.
    Effect.orElseSucceed(() => true)
  )

/**
 * What a write at `key` would find: `free` (nothing, under any spelling), an
 * object `stored` there (catalogued or not), or `taken` — another stored
 * spelling of it, or a store that cannot answer.
 */
const probeKey = (storage: Storage, key: string) =>
  Effect.gen(function* () {
    const stat = yield* Effect.result(
      storage.statObject(key).pipe(Effect.tapCause(reportOutage(key)))
    )
    if (stat._tag === 'Success') return 'stored' as const
    if (!isStorageObjectNotFound(stat.failure)) return 'taken' as const
    return (yield* landsOnOtherSpelling(storage, key)) ? ('taken' as const) : ('free' as const)
  })

/**
 * Whether anything is stored at `key` as a write there would find it: an
 * object in the store, catalogued or not, or another stored spelling of it. A
 * store that cannot answer counts as holding something. Every run's
 * `ifExists: suffix` probes its numbered names with it.
 */
export const storeHoldsKey = (key: string): Effect.Effect<boolean, never, StorageService> =>
  Effect.gen(function* () {
    return (yield* probeKey(yield* StorageService, key)) !== 'free'
  }).pipe(Effect.withSpan('automations.store-holds-key'))

/**
 * Why `automation`'s run may write at a key, or why it may not:
 *
 * - `open` — a run nobody started, or an admin-equivalent starter: today's
 *   overwrite semantics, nothing is judged;
 * - `free` — nothing is stored there (under any spelling): the write is
 *   create-only, so a file stored there in the meantime is kept;
 * - `own` — the file there is one this very run wrote (`writtenFiles`), in the
 *   bucket the catalog records it in, or in none: the write replaces it;
 * - `refused` — anything else, and a store or catalog that cannot answer.
 *
 * The rule is the run's own writes, never who stored the file before.
 */
export type OverwriteVerdict =
  | { readonly kind: 'open' | 'free' | 'own' }
  | { readonly kind: 'refused'; readonly refusal: string }

const REFUSED: OverwriteVerdict = { kind: 'refused', refusal: CALLER_REFUSAL }

/** The {@link OverwriteVerdict} of `automation`'s run for a write at `key`. */
export const starterOverwriteVerdict =
  (app: App, automation: AutomationContext) =>
  (key: string): Effect.Effect<OverwriteVerdict, never, StarterGateRequirements> =>
    Effect.gen(function* () {
      const standing = yield* starterStanding(app, automation)
      if (standing.kind === 'open') return { kind: 'open' } as const
      const storage = yield* StorageService
      const found = yield* probeKey(storage, key)
      if (found === 'free') return { kind: 'free' } as const
      if (found === 'taken') return REFUSED
      const bucket = yield* catalogBucket(storage, key)
      const ownWrite =
        bucket !== null && automation.writtenFiles?.has(bucket ?? UNATTRIBUTED_BUCKET, key) === true
      return ownWrite ? ({ kind: 'own' } as const) : REFUSED
    }).pipe(Effect.withSpan('automations.starter-overwrite-verdict'))

/**
 * Whether a key already holding a file is `automation`'s run's to replace or
 * reuse, beyond the per-automation rule its caller applies: always when its
 * standing is open, otherwise only when this very run wrote it there
 * (`writtenFiles`) — an earlier run's file, its starter's own included, is taken.
 */
export const runMayRetakeKey = (
  app: App,
  automation: AutomationContext,
  binding: BucketBinding,
  key: string
): Effect.Effect<boolean, never, AuthRepository> =>
  starterStanding(app, automation).pipe(
    Effect.map(
      (standing) => standing.kind === 'open' || automation.writtenFiles?.has(binding, key) === true
    ),
    Effect.withSpan('automations.run-may-retake-key')
  )

/**
 * `placed`, unless `automation`'s run may not write over what `key` holds:
 * then the refusal. `createOnly` says whether the write must replace nothing
 * (the key was found free in a judged run).
 */
export const unlessKeyTaken = <A>(
  app: App,
  automation: AutomationContext,
  key: string,
  placed: A
): Effect.Effect<
  (A & { readonly createOnly: boolean }) | { readonly refusal: string },
  never,
  StarterGateRequirements
> =>
  starterOverwriteVerdict(
    app,
    automation
  )(key).pipe(
    Effect.map((verdict) =>
      verdict.kind === 'refused'
        ? { refusal: verdict.refusal }
        : { ...placed, createOnly: verdict.kind === 'free' }
    ),
    Effect.withSpan('automations.unless-key-taken')
  )
