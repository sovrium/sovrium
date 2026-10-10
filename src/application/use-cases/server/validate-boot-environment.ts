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
import { countDatabaseListeners } from '@/domain/models/app/app-database-listeners-service'
import { browserHoldRefusals } from '@/domain/models/app/automations/actions/browser/browser-run-validation'
import { hostActionsBootRefusal } from '@/domain/models/app/automations/actions/instance/host-actions-gate-validation'
import { parseApiIpRateLimit } from '@/domain/models/process-env/api-ip-rate-limit'
import {
  parseSovriumAutomationDefaultTimeoutMs,
  parseSovriumAutomationRunRetentionDays,
} from '@/domain/models/process-env/automations'
import { browserBootRefusal, parseBrowserEnv } from '@/domain/models/process-env/browser'
import {
  describeDatabaseConnectionRefusal,
  planDatabaseConnections,
} from '@/domain/models/process-env/database/database-connection-plan'
import {
  parseDatabaseDialectConfig,
  resolveDatabasePoolMax,
} from '@/domain/models/process-env/database/database-dialect'
import { parseSovriumDevClock } from '@/domain/models/process-env/dev-clock'
import { parseEmailTransport } from '@/domain/models/process-env/email-transport'
import {
  parseSovriumBundlePublicKeys,
  parseSovriumHostActions,
} from '@/domain/models/process-env/host-actions'
import {
  parseSovriumAutomationAutopause,
  parseSovriumNotifyAutomations,
  parseSovriumNotifyDigest,
  parseSovriumNotifyDigestCron,
  parseSovriumNotifyTo,
} from '@/domain/models/process-env/notifications'
import { parseRateLimitWindowSeconds } from '@/domain/models/process-env/rate-limit-window'
import { parseRendererEnv } from '@/domain/models/process-env/renderer'
import {
  parseSovriumBindHost,
  parseSovriumIdleExitSeconds,
  parseSovriumListenUnix,
  parseSovriumLogFormat,
  parseSovriumStrictPort,
} from '@/domain/models/process-env/server-lifecycle'
import { parseSovriumTimezone } from '@/domain/models/process-env/timezone'
import type { MissingRequiredEnvVarError } from '@/application/errors/missing-required-env-var-error'
import type { App } from '@/domain/models/app'

/**
 * `DATABASE_POOL_MAX` is the instance's whole PostgreSQL footprint: a value
 * that cannot leave the request pool one connection, after the maintenance slot
 * and the AI listeners this app opens, stops the boot here rather than starving
 * the pool or exceeding the limit the operator sized it for. SQLite has no pool.
 *
 * Also run by the composition root BEFORE it builds the service layers: the
 * storage layer checks the database as it is built, and a boot this check
 * refuses should open no connection at all.
 */
export const refuseUndersizedDatabaseBudget = (
  validatedApp: App
): Effect.Effect<void, InvalidEnvVarError> =>
  Effect.try({
    try: () => {
      if (parseDatabaseDialectConfig().dialect !== 'postgres') return
      const planned = planDatabaseConnections({
        poolMax: resolveDatabasePoolMax(),
        listeners: countDatabaseListeners(validatedApp),
      })
      // eslint-disable-next-line functional/no-throw-statements -- turned into the boot refusal by the catch below.
      if (!planned.ok) throw new Error(describeDatabaseConnectionRefusal(planned.refusal))
    },
    catch: (error) => new InvalidEnvVarError(error),
  }).pipe(Effect.withSpan('server.refuse-undersized-database-budget'))

/**
 * Why the `BROWSER_*` configuration refuses the boot ([internal ref] D1, D2), or
 * `undefined`: an invalid value, a conflict with the document renderer's one
 * Chrome, WebKit outside the desktop app, or a `confirm` that would hold the
 * browser longer than `BROWSER_HOLD_MAX_MS`.
 */
const browserRefusal = (
  validatedApp: App,
  env: Readonly<Record<string, string | undefined>>
): string | undefined => {
  const parsed = parseBrowserEnv(env)
  if (!parsed.ok) return parsed.error
  const renderer = parseRendererEnv(env)
  const conflict = browserBootRefusal({
    config: parsed.config,
    renderer: renderer.ok ? renderer.config : undefined,
    platform: process.platform,
  })
  return conflict ?? browserHoldRefusals(validatedApp, parsed.config.holdMaxMs)[0]
}

/** {@link browserRefusal} as the boot refusal. */
const refuseBrowserMisconfiguration = (
  validatedApp: App
): Effect.Effect<void, InvalidEnvVarError> =>
  Effect.try({
    try: () => {
      const refusal = browserRefusal(validatedApp, process.env)
      // eslint-disable-next-line functional/no-throw-statements -- turned into the boot refusal by the catch below.
      if (refusal !== undefined) throw new Error(refusal)
    },
    catch: (error) => new InvalidEnvVarError(error),
  })

/** What {@link validateBootEnvironment} refuses a boot with. */
export type BootEnvironmentError =
  MissingRequiredEnvVarError | InvalidOperatorTimezoneError | InvalidEnvVarError

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
          parseSovriumAutomationRunRetentionDays(process.env),
          parseApiIpRateLimit(process.env),
          parseRateLimitWindowSeconds(process.env),
          parseSovriumDevClock(process.env),
          parseEmailTransport(process.env),
          parseSovriumBundlePublicKeys(process.env),
          parseSovriumStrictPort(process.env),
          parseSovriumBindHost(process.env),
          parseSovriumListenUnix(process.env),
          parseSovriumIdleExitSeconds(process.env),
          parseSovriumLogFormat(process.env),
        ],
        catch: (error) => new InvalidEnvVarError(error),
      })
    ),
    // The `instance/*` operator gate, boot half: an instance step without the
    // switch, or code with it, refuses before the port binds.
    Effect.andThen(
      Effect.try({
        try: () => {
          const refusal = hostActionsBootRefusal(validatedApp, parseSovriumHostActions(process.env))
          // eslint-disable-next-line functional/no-throw-statements -- turned into the boot refusal by the catch below.
          if (refusal !== undefined) throw new Error(refusal)
        },
        catch: (error) => new InvalidEnvVarError(error),
      })
    ),
    // The browser automation switch: its conflicts with the renderer, and holds past its limit.
    Effect.andThen(refuseBrowserMisconfiguration(validatedApp)),
    Effect.andThen(refuseUndersizedDatabaseBudget(validatedApp)),
    Effect.asVoid,
    Effect.withSpan('server.validate-boot-environment')
  )
