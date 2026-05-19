/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export class NotificationPreferenceDatabaseError extends Data.TaggedError(
  'NotificationPreferenceDatabaseError'
)<{
  readonly cause: unknown
}> {}

export type ChannelToggles = Readonly<Record<string, boolean>>

export class NotificationPreferenceRepository extends Context.Tag(
  'NotificationPreferenceRepository'
)<
  NotificationPreferenceRepository,
  {
    readonly findByUser: (
      userId: string
    ) => Effect.Effect<readonly Record<string, unknown>[], NotificationPreferenceDatabaseError>
    readonly findByUserAndEvent: (input: {
      readonly userId: string
      readonly eventType: string
    }) => Effect.Effect<Record<string, unknown> | undefined, NotificationPreferenceDatabaseError>
    readonly upsert: (input: {
      readonly userId: string
      readonly eventType: string
      readonly channels: ChannelToggles
      readonly enabled?: boolean
    }) => Effect.Effect<Record<string, unknown>, NotificationPreferenceDatabaseError>
  }
>() {}
