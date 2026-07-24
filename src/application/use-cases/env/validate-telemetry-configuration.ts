/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { parseTelemetryConfig } from '@/domain/models/env/telemetry/telemetry'

export class TelemetryConfigurationError extends Data.TaggedError('TelemetryConfigurationError')<{
  readonly message: string
}> {}

export const validateTelemetryConfiguration = (
  env: Readonly<Record<string, string | undefined>> = process.env
): Effect.Effect<void, TelemetryConfigurationError> =>
  Effect.try({
    try: () => parseTelemetryConfig(env),
    catch: (error) =>
      new TelemetryConfigurationError({
        message: error instanceof Error ? error.message : String(error),
      }),
  }).pipe(Effect.asVoid)
