/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export class CloudQuotaDatabaseError extends Data.TaggedError('CloudQuotaDatabaseError')<{
  readonly cause: unknown
}> {}

export class CloudQuotaRepository extends Context.Tag('CloudQuotaRepository')<
  CloudQuotaRepository,
  {
    readonly applyTier: (
      appSlug: string,
      containerSize: string,
      cpuLimit: number
    ) => Effect.Effect<void, CloudQuotaDatabaseError>
  }
>() {}
