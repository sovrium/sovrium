/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export class AutomationDigestDatabaseError extends Data.TaggedError(
  'AutomationDigestDatabaseError'
)<{
  readonly cause: unknown
}> {}

export interface DigestReleaseSort {
  readonly field: string
  readonly direction: 'asc' | 'desc'
}

export class AutomationDigestRepository extends Context.Tag('AutomationDigestRepository')<
  AutomationDigestRepository,
  {
    readonly findOrCreateActiveBucket: (input: {
      readonly automationId: string
      readonly digestKey: string
    }) => Effect.Effect<string, AutomationDigestDatabaseError>

    readonly addItem: (input: {
      readonly bucketId: string
      readonly item: unknown
      readonly dedupeKey?: string
    }) => Effect.Effect<number, AutomationDigestDatabaseError>

    readonly release: (input: {
      readonly automationId: string
      readonly digestKey: string
      readonly sort?: DigestReleaseSort
      readonly limit?: number
    }) => Effect.Effect<readonly unknown[], AutomationDigestDatabaseError>
  }
>() {}
