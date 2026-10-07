/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { InvalidEnvVarError } from '@/application/errors/invalid-env-var-error'
import { InvalidOperatorTimezoneError } from '@/application/errors/invalid-operator-timezone-error'
import { validateRequiredEnvVars } from '@/application/use-cases/env/validate-required-env-vars'
import { parseApiIpRateLimit } from '@/domain/models/process-env/api-ip-rate-limit'
import { parseSovriumAutomationDefaultTimeoutMs } from '@/domain/models/process-env/automations'
import { parseSovriumDevClock } from '@/domain/models/process-env/dev-clock'
import { parseEmailTransport } from '@/domain/models/process-env/email-transport'
import {
  parseSovriumAutomationAutopause,
  parseSovriumNotifyAutomations,
  parseSovriumNotifyDigest,
  parseSovriumNotifyDigestCron,
  parseSovriumNotifyTo,
} from '@/domain/models/process-env/notifications'
import { parseRateLimitWindowSeconds } from '@/domain/models/process-env/rate-limit-window'
import { parseSovriumTimezone } from '@/domain/models/process-env/timezone'
import type { MissingRequiredEnvVarError } from '@/application/errors/missing-required-env-var-error'
import type { App } from '@/domain/models/app'

/**
 * The boot-time environment gates that need nothing but the environment and the
 * decoded config: every `required` app env var is present, and the operator
 * timezone names a real zone.
 *
 * The timezone gate is here because every boundary re-reads `SOVRIUM_TIMEZONE`
 * (cron registration, formatters, retention sweeps): an unknown zone must stop
 * the boot before the port binds, naming the variable and the value, rather
 * than surface later inside a scheduler or a response.
 *
 * The operator-email variables are here for the same reason: a mistyped
 * kill switch or recipient would otherwise be discovered only when an alert
 * failed to arrive. So is the default run timeout of an automation, which would
 * otherwise be discovered only when a run was stopped, the per-address API
 * ceiling, which would otherwise be discovered only when users were refused,
 * the rate-limit window, whose bad value would switch every limit off, and the
 * email transport, whose missing key would lose every message at its first send.
 */
/** What {@link validateBootEnvironment} refuses a boot with. */
export type BootEnvironmentError =
  MissingRequiredEnvVarError | InvalidOperatorTimezoneError | InvalidEnvVarError

export const validateBootEnvironment = (
  validatedApp: App
): Effect.Effect<void, BootEnvironmentError> =>
  validateRequiredEnvVars(validatedApp.env, process.env).pipe(
    Effect.andThen(
      Effect.try({
        try: () => parseSovriumTimezone(process.env),
        catch: (error) => new InvalidOperatorTimezoneError(error),
      })
    ),
    Effect.andThen(
      Effect.try({
        try: () => [
          parseSovriumNotifyAutomations(process.env),
          parseSovriumNotifyTo(process.env),
          parseSovriumAutomationAutopause(process.env),
          parseSovriumNotifyDigest(process.env),
          parseSovriumNotifyDigestCron(process.env),
          parseSovriumAutomationDefaultTimeoutMs(process.env),
          parseApiIpRateLimit(process.env),
          parseRateLimitWindowSeconds(process.env),
          parseSovriumDevClock(process.env),
          parseEmailTransport(process.env),
        ],
        catch: (error) => new InvalidEnvVarError(error),
      })
    ),
    Effect.asVoid,
    Effect.withSpan('server.validate-boot-environment')
  )
