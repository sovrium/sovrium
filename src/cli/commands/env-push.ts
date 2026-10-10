/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Sending a hosted app the variables of a file the developer named — what
 * `sovrium env push` does, and `sovrium deploy --env <file>` does first.
 *
 * Only the names the config declares are sent; a name the platform sets
 * itself is skipped and one the config does not declare is ignored, both
 * listed. Every value is checked with the cloud's own rules before anything
 * leaves the machine, so a value that would reach the app altered is refused
 * by name. Values are secret unless named with `--plain`; a variable already
 * set is left as it is unless `overwrite`. Nothing here ever prints a value.
 *
 * Wire contract: `src/domain/models/api/automations/cloud/app-env.ts`.
 */

import { readFile } from 'node:fs/promises'
import { Effect, Option, Schema } from 'effect'
import { parseDotenvText } from '@/domain/kernel/config-parsing/dotenv-text'
import {
  PLATFORM_ENV_NAME_PATTERN,
  appEnvResultsResponseSchema,
  envValueProblem,
} from '@/domain/models/api/automations/cloud/app-env'
import { inflect } from '@/infrastructure/logging/cli-output'
import { CliRefusal, callCloud, describeUnreachable, say } from './cloud-session'
import type { SignedInCloud } from './cloud-sign-in'
import type { DotenvEntry } from '@/domain/kernel/config-parsing/dotenv-text'
import type { AppEnvResult, AppEnvVar } from '@/domain/models/api/automations/cloud/app-env'

/** What a push sends, and what it leaves out. Names only, save `send`. */
export interface PushPlan {
  readonly send: readonly AppEnvVar[]
  /** Names the platform sets itself. */
  readonly skipped: readonly string[]
  /** Names the config does not declare. */
  readonly ignored: readonly string[]
}

/** The variables of `path`, or the refusal naming the line it could not read. */
export const readEnvFile = (path: string): Effect.Effect<readonly DotenvEntry[], CliRefusal> =>
  Effect.gen(function* () {
    const text = yield* Effect.tryPromise({
      try: () => readFile(path, 'utf8'),
      catch: (cause) =>
        new CliRefusal({
          headline: `Sovrium could not read the variables file ${path} — nothing was sent.`,
          detail: [cause instanceof Error ? cause.message : String(cause)],
          guidance: 'Check the path, then run the command again.',
        }),
    })
    const read = parseDotenvText(text)
    if (read.problems.length > 0) {
      return yield* new CliRefusal({
        headline: `${path} is not a variables file Sovrium can read — nothing was sent.`,
        detail: [...read.problems],
        guidance: "Write one NAME=value per line ('#' starts a comment), then run it again.",
      })
    }
    return read.entries
  })

/** Sort the file's variables into sent, skipped (platform) and ignored (undeclared). */
const planPush = (
  entries: readonly DotenvEntry[],
  declared: readonly string[],
  plain: readonly string[]
): PushPlan => {
  const platform = entries.filter((entry) => PLATFORM_ENV_NAME_PATTERN.test(entry.name))
  const rest = entries.filter((entry) => !PLATFORM_ENV_NAME_PATTERN.test(entry.name))
  return {
    send: rest
      .filter((entry) => declared.includes(entry.name))
      .map((entry) => ({
        name: entry.name,
        value: entry.value,
        ...(plain.includes(entry.name) ? { secret: false } : {}),
      })),
    skipped: platform.map((entry) => entry.name),
    ignored: rest.filter((entry) => !declared.includes(entry.name)).map((entry) => entry.name),
  }
}

/** Refuse the whole push when one value would reach the app altered, naming each — never the value. */
const refuseAlteredValues = (send: readonly AppEnvVar[]): Effect.Effect<void, CliRefusal> => {
  const problems = send.flatMap((variable) => {
    const problem = envValueProblem(variable.value)
    return problem === undefined ? [] : [`${variable.name}: ${problem}`]
  })
  if (problems.length === 0) return Effect.void
  return Effect.fail(
    new CliRefusal({
      headline: `${inflect(problems.length, 'value')} would be refused or reach the app altered — nothing was sent.`,
      detail: problems,
      guidance:
        'Write each value as it should arrive (one line, no quotes around it, no blank at either end), then run it again.',
    })
  )
}

const column = (word: string): string => `  ${word.padEnd(10)} `

/** The lines naming what was left out. */
const sayLeftOut = (plan: PushPlan): Effect.Effect<void> =>
  Effect.forEach(
    [
      ...plan.skipped.map((name) => `${column('skipped')}${name} (set by the platform)`),
      ...plan.ignored.map((name) => `${column('ignored')}${name} (not declared in the config)`),
    ],
    say,
    { discard: true }
  )

/**
 * The push a file gives: sorted (see {@link planPush}), what was left out
 * printed, and every value checked — so a value that would reach the app
 * altered is refused before the developer is asked anything, and before
 * anything is sent.
 */
export const preparePush = (
  entries: readonly DotenvEntry[],
  declared: readonly string[],
  plain: readonly string[]
): Effect.Effect<PushPlan, CliRefusal> =>
  Effect.gen(function* () {
    const plan = planPush(entries, declared, plain)
    yield* sayLeftOut(plan)
    yield* refuseAlteredValues(plan.send)
    return plan
  })

/** What sending would do to each name, given the names already set: shown before asking. */
export const sayPreview = (
  plan: PushPlan,
  setNames: readonly string[],
  overwrite: boolean
): Effect.Effect<void> =>
  Effect.forEach(
    plan.send.map((variable) =>
      !setNames.includes(variable.name)
        ? `${column('to add')}${variable.name}`
        : overwrite
          ? `${column('to replace')}${variable.name}`
          : `${column('to keep')}${variable.name} (already set; --overwrite replaces it)`
    ),
    say,
    { discard: true }
  )

const resultLine = (result: AppEnvResult): string => {
  if (result.result === 'unchanged') {
    return `${column('unchanged')}${result.name} (already set; --overwrite replaces it)`
  }
  if (result.result === 'refused') {
    return `${column('refused')}${result.name} (${result.reason ?? 'no reason given'})`
  }
  return `${column(result.result)}${result.name}`
}

/** One call to the app's variables webhook, decoded. */
export const callAppEnv = (
  cloud: SignedInCloud,
  appId: string,
  body: Readonly<Record<string, unknown>>,
  outcome: string
): Effect.Effect<readonly AppEnvResult[], CliRefusal> =>
  Effect.gen(function* () {
    const url = new URL('/api/automations/app-env/webhook', cloud.origin)
    url.searchParams.set('app', appId)
    const answer = yield* callCloud(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': cloud.apiKey },
      body: JSON.stringify(body),
    }).pipe(Effect.mapError(describeUnreachable(outcome)))
    const decoded = Schema.decodeUnknownOption(appEnvResultsResponseSchema)(answer.body)
    if (answer.status === 200 && Option.isSome(decoded)) return decoded.value.results
    return yield* new CliRefusal({
      headline: `${cloud.origin.origin} refused to change the app's variables (HTTP ${answer.status}) — ${outcome}.`,
      guidance:
        answer.status === 404
          ? 'Check that the app is yours and that the cloud offers app variables, then run it again.'
          : 'Run the command again; if it persists, the cloud may be misconfigured.',
    })
  })

/**
 * Send a plan {@link preparePush} gave, print one line per name, and return
 * the names now set on the app. A name the cloud refused fails the push after
 * every result is printed.
 */
export const sendPlan = (
  cloud: SignedInCloud,
  appId: string,
  plan: PushPlan,
  overwrite: boolean
): Effect.Effect<readonly string[], CliRefusal> =>
  Effect.gen(function* () {
    if (plan.send.length === 0) {
      yield* say('No variable to send: the file holds none the config declares.')
      return []
    }
    const results = yield* callAppEnv(
      cloud,
      appId,
      { vars: plan.send, ...(overwrite ? { overwrite: true } : {}) },
      'nothing was sent'
    )
    yield* Effect.forEach(results.map(resultLine), say, { discard: true })
    const refused = results.filter((result) => result.result === 'refused')
    if (refused.length > 0) {
      return yield* new CliRefusal({
        headline: `${cloud.origin.origin} refused ${inflect(refused.length, 'variable')}; the others above were kept.`,
        guidance: 'Fix the variables it names, then push them again.',
      })
    }
    return results.map((result) => result.name)
  })
