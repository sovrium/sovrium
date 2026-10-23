/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect, Option } from 'effect'
import { AppSelfSeeder } from '@/application/ports/services/app-self-seeder'
import { APP_SEED_MODES, type AppSeedMode } from '@/domain/models/app/automations/actions/app/seed'
import {
  INSTANCE_SEED_TABLE_PATTERN,
  INSTANCE_SEED_TODAY_PATTERN,
} from '@/domain/models/app/automations/actions/instance/seed'
import {
  SOVRIUM_SELF_SEED_VAR,
  parseSovriumSelfSeed,
  selfSeedGateAllows,
  type SelfSeedGate,
} from '@/domain/models/process-env/self-seed'
import { logError } from '@/infrastructure/logging/logger'
import { actionAttributes } from './shared'
import type { ActionHandler, ActionOutcome } from './shared'
import type { AppSelfSeedError } from '@/application/ports/services/app-self-seeder'

/**
 * `app/seed` — seed the app's own data from its own seed files, or reset the
 * whole app to them, through the seeder `sovrium seed` runs, in this process.
 *
 * The switch is checked FIRST, before a prop is read. The boot already left
 * out every automation whose step the switch does not allow, so a step that
 * reaches here past it came another way — a code action's
 * `context.actions.app.seed(...)`, an action template — and is refused with
 * the same reason. Then every prop is re-checked, since a templated one, a loop
 * item or a code call arrives as whatever it resolved to.
 */

class AppSeedRefusal extends Data.TaggedError('AppSeedRefusal')<{ readonly message: string }> {}

const refuse = (message: string) => Effect.fail(new AppSeedRefusal({ message }))

const propsOf = (action: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> => {
  const raw = action['props']
  return raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
}

/** A prop left out, or a template that resolved to nothing. */
const isAbsent = (value: unknown): boolean => value === undefined || value === null || value === ''

const modeOf = (value: unknown) =>
  typeof value === 'string' && (APP_SEED_MODES as readonly string[]).includes(value)
    ? Effect.succeed(value as AppSeedMode)
    : refuse(`app/seed: mode must be one of ${APP_SEED_MODES.join(', ')} (got ${String(value)})`)

/** The switch, read now: the variable is the host's, never the config's. Off refuses every step. */
const switchOf = () => {
  const gate = parseSovriumSelfSeed(process.env)
  return gate === 'off'
    ? refuse(`app/seed is disabled; set ${SOVRIUM_SELF_SEED_VAR} on the host to switch it on`)
    : Effect.succeed(gate)
}

/** The switch's verdict on `mode`. */
const gateOf = (gate: SelfSeedGate, mode: AppSeedMode) =>
  selfSeedGateAllows(gate, mode)
    ? Effect.void
    : refuse(
        `app/seed: mode '${mode}' deletes rows, and ${SOVRIUM_SELF_SEED_VAR} allows it only when set to reset`
      )

const tablesOf = (value: unknown, mode: AppSeedMode) => {
  if (isAbsent(value)) return Effect.succeedNone
  if (mode === 'reset') {
    return refuse("app/seed: mode 'reset' covers every table of the app; remove `tables`")
  }
  return Array.isArray(value) &&
    value.length > 0 &&
    value.every((name) => typeof name === 'string' && INSTANCE_SEED_TABLE_PATTERN.test(name))
    ? Effect.succeedSome(value as readonly string[])
    : refuse('app/seed: tables must be a list of table names')
}

const todayOf = (value: unknown) => {
  if (isAbsent(value)) return Effect.succeedNone
  return typeof value === 'string' && INSTANCE_SEED_TODAY_PATTERN.test(value)
    ? Effect.succeedSome(value)
    : refuse(`app/seed: today must be a day written YYYY-MM-DD (got ${String(value)})`)
}

const dryRunOf = (value: unknown) => {
  if (isAbsent(value) || value === false || value === 'false') return Effect.succeed(false)
  return value === true || value === 'true'
    ? Effect.succeed(true)
    : refuse(`app/seed: dryRun must be true or false (got ${String(value)})`)
}

export const handleAppSeed: ActionHandler = (action, app) =>
  Effect.gen(function* () {
    const gate = yield* switchOf()
    const props = propsOf(action)
    const mode = yield* modeOf(props['mode'])
    yield* gateOf(gate, mode)
    const tables = yield* tablesOf(props['tables'], mode)
    const today = yield* todayOf(props['today'])
    const dryRun = yield* dryRunOf(props['dryRun'])
    const seeder = yield* AppSelfSeeder
    const report = yield* seeder
      .run({
        app,
        mode,
        dryRun,
        ...Option.match(tables, { onNone: () => ({}), onSome: (names) => ({ tables: names }) }),
        ...Option.match(today, { onNone: () => ({}), onSome: (day) => ({ today: day }) }),
      })
      .pipe(
        // Logged with its cause before the catch below turns it into the step's failure.
        Effect.tapCause((cause) =>
          Effect.sync(() => logError(`[automations] app/seed (${mode}) did not complete`, cause))
        )
      )
    return { status: 'success', output: { ...report } } satisfies ActionOutcome
  }).pipe(
    Effect.catch((error: Readonly<AppSeedRefusal | AppSelfSeedError>) =>
      Effect.succeed<ActionOutcome>({ status: 'failure', error: error.message, retryable: false })
    ),
    Effect.withSpan('automations.handle-app-seed', { attributes: actionAttributes(action) })
  )
