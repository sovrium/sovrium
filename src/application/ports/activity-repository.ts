/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'
import type { UserSession } from '@/application/ports/user-session'
import type { SessionContextError } from '@/domain/errors'
import type { Effect } from 'effect'

/**
 * Activity history entry with user metadata
 */
export interface ActivityHistoryEntry {
  readonly action: string
  readonly createdAt: Date
  readonly changes: unknown
  readonly user:
    | {
        readonly id: string
        readonly name: string
        readonly email: string
        readonly image: string | null
      }
    | undefined
}

/**
 * Activity Repository Port
 */
export class ActivityRepository extends Context.Tag('ActivityRepository')<
  ActivityRepository,
  {
    readonly getRecordHistory: (config: {
      readonly session: Readonly<UserSession>
      readonly tableName: string
      readonly recordId: string
    }) => Effect.Effect<readonly ActivityHistoryEntry[], SessionContextError>
  }
>() {}
