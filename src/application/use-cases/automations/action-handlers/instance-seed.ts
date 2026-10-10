/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Option, Schema } from 'effect'
import {
  InstanceSupervisor,
  InstanceSupervisorError,
} from '@/application/ports/services/instance-supervisor'
import { seedReportSchema } from '@/domain/models/api/automations/cloud/seed-run'
import {
  INSTANCE_SEED_MODES,
  INSTANCE_SEED_TABLE_PATTERN,
  INSTANCE_SEED_TODAY_PATTERN,
} from '@/domain/models/app/automations/actions/instance/seed'
import { withholdInvitationLinks } from '@/domain/models/seed/invitation-lines'
import { instanceHandler, slugOf, unitJobTimeout } from './instance'

/**
 * `instance/seed` — load a supervised app's seed data from the release it
 * runs, as the app, through its one-shot unit `sovrium-seed@<slug>.service`.
 *
 * The step writes no row itself: the app's data belongs to the app's own system
 * user, and the rows are written by `sovrium seed` run by that unit, so the seed
 * is as silent as on a laptop. Its props are re-checked here as the request
 * file the unit reads — a templated prop or a code call arrives as whatever it
 * resolved to — and the unit's report comes back as the step's output, with the
 * revision it was loaded from. The output is kept in the run history, so an
 * invitation link is withheld from it even if the seeder printed one: the
 * counts and the email stay, the token does not.
 */

const refuse = (message: string) => Effect.fail(new InstanceSupervisorError({ message }))

/** A prop left out, or a template that resolved to nothing. */
const isAbsent = (value: unknown): boolean => value === undefined || value === null || value === ''

/** `mode`: one of the seeder's modes; absent or empty is `if-empty`. */
const modeOf = (value: unknown) => {
  if (isAbsent(value)) return Effect.succeed('if-empty')
  return typeof value === 'string' && (INSTANCE_SEED_MODES as readonly string[]).includes(value)
    ? Effect.succeed(value)
    : refuse(
        `instance: mode must be one of ${INSTANCE_SEED_MODES.join(', ')} (got ${String(value)})`
      )
}

/** `tables`: table names, at least one; absent (none) means every table with a seed file. */
const tablesOf = (value: unknown) => {
  if (isAbsent(value)) return Effect.succeedNone
  return Array.isArray(value) &&
    value.length > 0 &&
    value.every((name) => typeof name === 'string' && INSTANCE_SEED_TABLE_PATTERN.test(name))
    ? Effect.succeedSome(value as readonly string[])
    : refuse('instance: tables must be a list of table names')
}

/** `today`: a day written YYYY-MM-DD; absent (none) is the day the run happens. */
const todayOf = (value: unknown) => {
  if (isAbsent(value)) return Effect.succeedNone
  return typeof value === 'string' && INSTANCE_SEED_TODAY_PATTERN.test(value)
    ? Effect.succeedSome(value)
    : refuse(`instance: today must be a day written YYYY-MM-DD (got ${String(value)})`)
}

/** `dryRun`: true or false, as a boolean or the text a template resolved to. */
const dryRunOf = (value: unknown) => {
  if (isAbsent(value) || value === false || value === 'false') {
    return Effect.succeed(false)
  }
  return value === true || value === 'true'
    ? Effect.succeed(true)
    : refuse(`instance: dryRun must be true or false (got ${String(value)})`)
}

/** The request file the seed unit reads — what `sovrium seed --request` takes. */
const requestOf = (props: Readonly<Record<string, unknown>>) =>
  Effect.gen(function* () {
    const mode = yield* modeOf(props['mode'])
    const tables = yield* tablesOf(props['tables'])
    const today = yield* todayOf(props['today'])
    const dryRun = yield* dryRunOf(props['dryRun'])
    return {
      mode,
      ...Option.match(tables, { onNone: () => ({}), onSome: (names) => ({ tables: names }) }),
      ...Option.match(today, { onNone: () => ({}), onSome: (day) => ({ today: day }) }),
      dryRun,
    }
  })

/** The `{ error }` the seeder leaves in place of a report when it refused. */
const refusalIn = (report: unknown): string | undefined => {
  if (report === null || typeof report !== 'object') return undefined
  const { error } = report as { readonly error?: unknown }
  return typeof error === 'string' && error !== '' ? error : undefined
}

export const handleInstanceSeed = instanceHandler('seed', (props, action) =>
  Effect.gen(function* () {
    const slug = yield* slugOf(props)
    const request = yield* requestOf(props)
    const supervisor = yield* InstanceSupervisor
    const { report, unitError } = yield* supervisor.seed(slug, request, unitJobTimeout(action))
    // The seeder's own words first: the unit's exit status says only that it failed.
    const refused = refusalIn(report)
    if (refused !== undefined) return yield* refuse(refused)
    const decoded = Schema.decodeUnknownOption(seedReportSchema)(report)
    if (Option.isNone(decoded)) {
      return yield* refuse(unitError ?? `instance: sovrium-seed@${slug}.service left no report`)
    }
    const release = yield* supervisor.readRelease(slug)
    return {
      ...decoded.value,
      lines: withholdInvitationLinks(decoded.value.lines),
      ...(release === undefined ? {} : { revision: release.revision }),
    }
  })
)
