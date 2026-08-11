/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { parseTelemetryConfig } from '@/domain/models/env/telemetry/telemetry'

/**
 * Boot-time telemetry misconfiguration (a set-but-malformed gate variable).
 * The `message` names the offending variable (`SENTRY_DSN`,
 * `SENTRY_TRACES_SAMPLE_RATE`, …) so the operator can fix the typo immediately.
 */
export class TelemetryConfigurationError extends Data.TaggedError('TelemetryConfigurationError')<{
  readonly message: string
}> {}

/**
 * Fail-loud telemetry validation, run at boot right after
 * `validateRequiredEnvVars`. Parsing the telemetry env resolves every unset
 * gate to off (sovereignty default) and throws on a set-but-malformed value —
 * we surface that throw as a typed, boot-aborting `TelemetryConfigurationError`
 * so a misconfiguration stops the boot with an actionable message BEFORE the
 * port binds (never a half-started server).
 *
 * Unset ≠ malformed: an unset (or empty-string) variable is silently off; only
 * a set-but-invalid one aborts.
 */
export const validateTelemetryConfiguration = (
  env: Readonly<Record<string, string | undefined>> = process.env
): Effect.Effect<void, TelemetryConfigurationError> =>
  Effect.try({
    // Parsing IS the validation: it throws on a malformed DSN / out-of-range
    // sample rate. The resolved config is (re)parsed and memoized later by infra.
    try: () => parseTelemetryConfig(env),
    catch: (error) =>
      new TelemetryConfigurationError({
        message: error instanceof Error ? error.message : String(error),
      }),
  }).pipe(Effect.asVoid)
