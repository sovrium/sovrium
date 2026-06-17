/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export class CloudHostRegistryDatabaseError extends Data.TaggedError(
  'CloudHostRegistryDatabaseError'
)<{
  readonly cause: unknown
}> {}

export interface CloudHostRegistryRecord {
  readonly effect: string
  readonly target: string
  readonly status?: string
  readonly configRef?: string
  readonly port?: number
  readonly containerSize?: string
  readonly version?: string
  readonly lines?: number
}

export class CloudHostRegistryRepository extends Context.Tag('CloudHostRegistryRepository')<
  CloudHostRegistryRepository,
  {
    readonly record: (
      input: CloudHostRegistryRecord
    ) => Effect.Effect<void, CloudHostRegistryDatabaseError>
  }
>() {}
