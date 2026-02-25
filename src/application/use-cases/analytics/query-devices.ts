/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AnalyticsRepository } from '../../ports/repositories/analytics-repository'
import type {
  AnalyticsDatabaseError,
  DeviceBreakdown,
} from '../../ports/repositories/analytics-repository'

export interface QueryDevicesInput {
  readonly appName: string
  readonly from: Date
  readonly to: Date
}

/**
 * Query device, browser, and OS breakdown.
 */
export const queryDevices = (
  input: QueryDevicesInput
): Effect.Effect<DeviceBreakdown, AnalyticsDatabaseError, AnalyticsRepository> =>
  Effect.gen(function* () {
    const repo = yield* AnalyticsRepository

    return yield* repo.getDevices({
      appName: input.appName,
      from: input.from,
      to: input.to,
      granularity: 'day',
    })
  })
