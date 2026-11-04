/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { InvalidEnvVarError } from '@/application/errors/invalid-env-var-error'
import { InvalidOperatorTimezoneError } from '@/application/errors/invalid-operator-timezone-error'
import { ProcessEnv } from '@/application/ports/services/process-env'
import { validateRequiredEnvVars } from '@/application/use-cases/config/validate-required-env-vars'
import { countDatabaseListeners } from '@/domain/models/app/app-database-listeners-service'
import { scimTokenRefusal } from '@/domain/models/app/auth/scim-service'
import { browserHoldRefusals } from '@/domain/models/app/automations/actions/browser/browser-run-validation'
import { hostActionsBootRefusal } from '@/domain/models/app/automations/actions/instance/host-actions-gate-validation'
import { buildEnvLookup, resolveSecretInString } from '@/domain/models/app/env-reference-service'
import { parseApiIpRateLimit } from '@/domain/models/process-env/api-ip-rate-limit'
import {
  parseSovriumAutomationDefaultTimeoutMs,
  parseSovriumAutomationRunRetentionDays,
} from '@/domain/models/process-env/automations'
import { browserBootRefusal, parseBrowserEnv } from '@/domain/models/process-env/browser'
import { CORS_ORIGINS_VARIABLE, parseCorsOrigins } from '@/domain/models/process-env/cors'
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
import { parseFrameAncestors, previewTokenRefusal } from '@/domain/models/process-env/preview'
import { parseRateLimitWindowSeconds } from '@/domain/models/process-env/rate-limit-window'
import { parseRecordsRateLimits } from '@/domain/models/process-env/records-rate-limits'
import { parseRendererEnv } from '@/domain/models/process-env/renderer'
import {
  parseSovriumBindHost,
  parseSovriumIdleExitSeconds,
  parseSovriumRequestIdleTimeoutSeconds,
  parseSovriumListenUnix,
  parseSovriumLogFormat,
  parseSovriumStrictPort,
} from '@/domain/models/process-env/server-lifecycle'
import {
  missingOtpSecretRefusal,
  parseSignatureEnv,
  signatureEnvRefusal as sealEnvRefusal,
} from '@/domain/models/process-env/signatures'
import { parseSovriumTimezone } from '@/domain/models/process-env/timezone'
import type { MissingRequiredEnvVarError } from '@/application/errors/missing-required-env-var-error'
import type { App } from '@/domain/models/app'

/**
 * A boot gate from a check that names its refusal: `undefined` lets the boot
 * through, a sentence refuses it. A parser that throws inside `check` refuses
 * the boot the same way, with its own message.
 *
 * The refusal travels as an `Error` cause, the shape every parser's refusal
 * already has, so the boot prints the same sentence whichever road it took.
 */
const refuseWhen = (check: () => string | undefined): Effect.Effect<void, InvalidEnvVarError> =>
  Effect.try({ try: check, catch: (error) => new InvalidEnvVarError(error) }).pipe(
    Effect.flatMap((refusal) =>
      refusal === undefined ? Effect.void : Effect.fail(new InvalidEnvVarError(new Error(refusal)))
    )
  )

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
  ProcessEnv.pipe(
    Effect.flatMap((env) =>
      refuseWhen(() => {
        if (parseDatabaseDialectConfig(env).dialect !== 'postgres') return undefined
        const planned = planDatabaseConnections({
          poolMax: resolveDatabasePoolMax(env),
          listeners: countDatabaseListeners(validatedApp),
        })
        return planned.ok ? undefined : describeDatabaseConnectionRefusal(planned.refusal)
      })
    ),
    Effect.withSpan('server.refuse-undersized-database-budget')
  )

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
  validatedApp: App,
  env: Readonly<Record<string, string | undefined>>
): Effect.Effect<void, InvalidEnvVarError> => refuseWhen(() => browserRefusal(validatedApp, env))

/**
 * The framing list, the cross-origin list and the preview token: a
 * malformed origin, a blank list or a short token refuses the start with the
 * sentence the manual quotes. An empty token is unset, like every other
 * `SOVRIUM_*` variable; the token's refusal never carries the value or its
 * length.
 */
const refusePreviewMisconfiguration = (
  env: Readonly<Record<string, string | undefined>>
): Effect.Effect<void, InvalidEnvVarError> =>
  refuseWhen(() => {
    const framing = parseFrameAncestors(env['SOVRIUM_FRAME_ANCESTORS'])
    const crossOrigin = parseCorsOrigins(env[CORS_ORIGINS_VARIABLE])
    const token = env['SOVRIUM_PREVIEW_TOKEN']
    return framing._tag === 'Refused'
      ? framing.message
      : crossOrigin._tag === 'Refused'
        ? crossOrigin.message
        : previewTokenRefusal(token === '' ? undefined : token)
  })

/** {@link scimTokenRefusal} for the app's declared `auth.scim`, read from `env`. */
const scimTokenRefusalOf = (
  validatedApp: App,
  env: Readonly<Record<string, string | undefined>>
): string | undefined => {
  const token = validatedApp.auth?.scim?.token
  if (token === undefined) return undefined
  return scimTokenRefusal(
    token,
    resolveSecretInString(token, buildEnvLookup(validatedApp.env, env))
  )
}

/**
 * Why the `SIGNATURE_*` variables refuse the boot, or `undefined`: an invalid
 * value, a seal key without its chain (or the reverse), or a flow declaring
 * `verify` with no code secret to derive its codes from.
 */
const signatureEnvRefusal = (
  validatedApp: App,
  env: Readonly<Record<string, string | undefined>>
): string | undefined => {
  const parsed = parseSignatureEnv(env)
  if (!parsed.ok) return parsed.error
  // A seal key the seal cannot sign with, or a chain that is not its own.
  const seal = sealEnvRefusal(env)
  if (seal !== undefined) return seal
  const verifying = (validatedApp.signatures ?? [])
    .filter((flow) => flow.verify !== undefined)
    .map((flow) => flow.name)
  return missingOtpSecretRefusal(parsed.config, verifying)
}

/**
 * Every operator variable whose parser throws on a bad value, read once at boot so
 * the first invalid one refuses the start naming the variable.
 */
const parseOperatorEnvVars = (
  env: Readonly<Record<string, string | undefined>>
): Effect.Effect<void, InvalidEnvVarError> =>
  Effect.try({
    try: () => [
      parseSovriumNotifyAutomations(env),
      parseSovriumNotifyTo(env),
      parseSovriumAutomationAutopause(env),
      parseSovriumNotifyDigest(env),
      parseSovriumNotifyDigestCron(env),
      parseSovriumAutomationDefaultTimeoutMs(env),
      parseSovriumAutomationRunRetentionDays(env),
      parseApiIpRateLimit(env),
      parseRateLimitWindowSeconds(env),
      parseRecordsRateLimits(env),
      parseSovriumDevClock(env),
      parseEmailTransport(env),
      parseSovriumBundlePublicKeys(env),
      parseSovriumStrictPort(env),
      parseSovriumBindHost(env),
      parseSovriumListenUnix(env),
      parseSovriumIdleExitSeconds(env),
      parseSovriumRequestIdleTimeoutSeconds(env),
      parseSovriumLogFormat(env),
    ],
    catch: (error) => new InvalidEnvVarError(error),
  }).pipe(Effect.asVoid)

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
  ProcessEnv.pipe(
    Effect.flatMap((env) =>
      validateRequiredEnvVars(validatedApp.env).pipe(
        Effect.andThen(
          Effect.try({
            try: () => parseSovriumTimezone(env),
            catch: (error) => new InvalidOperatorTimezoneError(error),
          })
        ),
        Effect.andThen(parseOperatorEnvVars(env)),
        // The `instance/*` operator gate, boot half: an instance step without the
        // switch, or code with it, refuses before the port binds.
        Effect.andThen(
          refuseWhen(() => hostActionsBootRefusal(validatedApp, parseSovriumHostActions(env)))
        ),
        // The browser automation switch: its conflicts with the renderer, and holds past its limit.
        Effect.andThen(refuseBrowserMisconfiguration(validatedApp, env)),
        Effect.andThen(refusePreviewMisconfiguration(env)),
        // A SCIM token short enough to guess stops the start.
        Effect.andThen(refuseWhen(() => scimTokenRefusalOf(validatedApp, env))),
        // A signing seal half set or unusable, or a verifying flow with no code secret, stops the start.
        Effect.andThen(refuseWhen(() => signatureEnvRefusal(validatedApp, env))),
        Effect.andThen(refuseUndersizedDatabaseBudget(validatedApp)),
        Effect.asVoid
      )
    ),
    Effect.withSpan('server.validate-boot-environment')
  )
