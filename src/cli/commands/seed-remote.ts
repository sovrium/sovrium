/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium seed --app <slug> | --remote` — seed an app hosted on a Sovrium
 * cloud, and the seed `sovrium deploy --seed` runs once a deployment is live.
 *
 * No row leaves this machine. The cloud records a seed run of the app's LIVE
 * deployment, whose bundle already carries the `seed/` folder; the machine
 * hosting the app loads it with this same seeder, as the app (`instance/seed`).
 * Nothing on this machine is opened: no config is loaded and no database
 * migrated — the branch is taken before either.
 *
 * ### Which app
 *
 * `--app <slug>`; else, under `--remote`, the project's link file when it was
 * written for the signed-in cloud. A plain `sovrium seed` never comes here, so
 * a linked project still seeds locally unless asked. The address is never
 * derived from the config `name`: seeding the wrong hosted app is not a guess
 * worth making.
 *
 * ### The exchange
 *
 * 1. `POST /api/automations/seed/webhook` with the key — `seedRunRequestSchema`,
 *    answered `201` `seedRunResponseSchema` or refused `seedRunRefusalSchema`.
 *    A `404` that is not `unknown-app` is a cloud released before seeding.
 * 2. `GET /api/tables/seed_runs/records/:id` every 2 seconds for up to 10
 *    minutes, printing each state once, and `Backup taken: <key>` once a
 *    `replace`'s backup is recorded; `done` prints the report's lines as the
 *    local command prints them, `failed` the host's error.
 */

import { join } from 'node:path'
import { Effect, Option, Schema } from 'effect'
import { askLine, confirmOrFail, isInteractive } from '@/cli/runtime/confirm-prompt'
import { getFlagValue } from '@/cli/runtime/flag-vocabulary'
import {
  seedRunRecordFieldsSchema,
  seedRunRefusalSchema,
  seedRunRequestSchema,
  seedRunResponseSchema,
} from '@/domain/models/api/automations/cloud/seed-run'
import { SEED_MODES, parseSeedMode, pinRunAtToDay } from '@/domain/models/seed'
import { explicitAddress, readLink } from './cloud-app-lookup'
import {
  CliRefusal,
  assertNetworkAllowed,
  callCloud,
  describeUnreachable,
  readCloudRecord,
  runCliProgram,
  say,
} from './cloud-session'
import { signedInCloud } from './cloud-sign-in'
import { report } from './seed-report'
import type { SignedInCloud } from './cloud-sign-in'
import type {
  SeedRunRecordFields,
  SeedRunRequest,
  SeedRunStatus,
} from '@/domain/models/api/automations/cloud/seed-run'

/** How often the seed run is read while the command waits. */
const POLL_INTERVAL_MS = 2000

/** How long the command waits for `done` or `failed`. */
const WAIT_LIMIT_MS = 10 * 60 * 1000

/** Flags that only mean something to a seed of this machine. */
const LOCAL_ONLY_FLAGS = ['--dir', '--as', '--request', '--report'] as const

/** `--flag`, or `--flag=value`, as the command line gave it. */
const namesFlag = (arg: string, flag: string): boolean => arg === flag || arg.startsWith(`${flag}=`)

/**
 * Whether the command line names a hosted app: `--app`, or `--remote` — in
 * either spelling, `--app=<slug>` included. Read wide on purpose: a hosted seed
 * misread as a local one would write the rows meant for the cloud into this
 * machine's database, a `replace` deleting them first.
 */
export const isRemoteSeed = (argv: readonly string[]): boolean =>
  argv.some((arg) => namesFlag(arg, '--app') || namesFlag(arg, '--remote'))

/**
 * The flags a hosted seed reads by their next token, refused when written
 * `--flag=value` or given no value — rather than read as absent. `--app` and
 * `--host` are read in both spellings, by the readers every cloud command
 * shares, which refuse them given no value.
 */
const VALUE_FLAGS = ['--confirm', '--mode', '--table', '--today'] as const

/** What the remote branch reads from the command line. */
export interface RemoteSeedOptions {
  readonly configFile: string | undefined
  readonly mode: string | undefined
  readonly tables: readonly string[]
  readonly dryRun: boolean
  readonly today?: string | undefined
  readonly argv: readonly string[]
}

const nothingSent = (headline: string, guidance: string): CliRefusal =>
  new CliRefusal({ headline: `${headline} — nothing was sent.`, guidance })

/**
 * Why the command line cannot be read as a seed of a hosted app: a flag of a
 * local seed, a value flag written `--flag=value`, or one given no value.
 */
const unreadableFlags = (argv: readonly string[]): CliRefusal | undefined => {
  const local = LOCAL_ONLY_FLAGS.filter((flag) => argv.some((arg) => namesFlag(arg, flag)))
  if (local.length > 0) {
    return nothingSent(
      `${local.join(', ')} only apply to a seed of this machine, not of a hosted app`,
      'Drop them, or seed this machine with a plain sovrium seed.'
    )
  }
  const joined = VALUE_FLAGS.find((flag) => argv.some((arg) => arg.startsWith(`${flag}=`)))
  if (joined !== undefined) {
    return nothingSent(
      `${joined}=… is not read by a seed of a hosted app`,
      `Write it ${joined} <value>, with a space.`
    )
  }
  const bare = VALUE_FLAGS.find((flag) => {
    const next = argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : 'absent'
    return next === undefined || next.startsWith('-')
  })
  return bare === undefined
    ? undefined
    : nothingSent(`${bare} is given no value`, `Write it ${bare} <value>.`)
}

/** The flags a hosted seed reads, checked before anything leaves the machine. */
const requestOptions = (options: RemoteSeedOptions) =>
  Effect.gen(function* () {
    const unreadable = unreadableFlags(options.argv)
    if (unreadable !== undefined) return yield* unreadable
    const mode = parseSeedMode(options.mode)
    if (mode === undefined) {
      return yield* nothingSent(
        `--mode "${String(options.mode)}" is not a seed mode`,
        `Use one of ${SEED_MODES.join(', ')}.`
      )
    }
    const { today } = options
    if (today !== undefined && pinRunAtToDay(today, new Date()) === undefined) {
      return yield* nothingSent(
        `--today "${today}" is not a calendar day`,
        'Write it YYYY-MM-DD, for example 2026-09-24.'
      )
    }
    return {
      mode,
      ...(options.tables.length > 0 ? { tables: options.tables } : {}),
      ...(today === undefined ? {} : { today }),
      dryRun: options.dryRun,
    }
  })

/** `--app`, else the link `--remote` reads for this cloud, else the refusal pointing at `--app`. */
const hostedApp = (options: RemoteSeedOptions, cloud: SignedInCloud) =>
  Effect.gen(function* () {
    const explicit = yield* explicitAddress(options.argv)
    if (explicit !== undefined) return explicit
    const link = yield* readLink(options.configFile ?? join(process.cwd(), 'app.yaml'))
    if (link !== undefined && URL.parse(link.host)?.origin === cloud.origin.origin) return link.app
    return yield* nothingSent(
      `This project is not linked to an app on ${cloud.origin.origin}`,
      "Name the app with --app <slug>, or run 'sovrium deploy' once to link the project."
    )
  })

/** A replace: the address typed back, at a terminal or as `--confirm`. */
const confirmReplace = (argv: readonly string[], slug: string, host: string) =>
  Effect.gen(function* () {
    const given = getFlagValue(argv, '--confirm')
    if (given !== undefined && given !== slug) {
      return yield* nothingSent(
        `--confirm ${given} does not name the app being replaced, ${slug}`,
        `Pass --confirm ${slug} to delete its rows and seed it again.`
      )
    }
    const unconfirmed = nothingSent(
      `A replace deletes every row of ${slug} on ${host} before seeding it, so its address must be typed back`,
      `In a script, pass --yes --confirm ${slug}.`
    )
    if (given !== undefined && argv.includes('--yes')) return slug
    if (!isInteractive()) return yield* unconfirmed
    const typed = yield* askLine(
      `Type ${slug} to replace its rows on ${host} (a backup is taken first):`
    )
    return typed?.trim() === slug ? slug : yield* unconfirmed
  })

/**
 * The confirmation a hosted seed needs: none for a dry run, the typed address
 * for a replace, a yes otherwise. Returns what the request carries as `confirm`:
 * the cloud wants it on every replace, and a dry run, which deletes nothing,
 * carries the address without asking for it.
 */
const confirmSeed = (
  argv: readonly string[],
  request: { readonly mode: string; readonly dryRun: boolean },
  slug: string,
  host: string
) => {
  if (request.dryRun) return Effect.succeed(request.mode === 'replace' ? slug : undefined)
  if (request.mode === 'replace') return confirmReplace(argv, slug, host)
  return confirmOrFail({
    yes: argv.includes('--yes'),
    question: `Seed ${slug} on ${host} (mode ${request.mode})?`,
    enterMeansYes: false,
    refusal: nothingSent(
      `Seeding ${slug} on ${host} was not confirmed`,
      'Answer y at the question, or pass --yes in a script.'
    ),
  }).pipe(Effect.as(undefined))
}

/** Why the cloud refused the seed request, as the developer reads it. */
const refusalOf = (status: number, body: unknown, request: SeedRunRequest, host: string) => {
  const refusal = Option.getOrUndefined(Schema.decodeUnknownOption(seedRunRefusalSchema)(body))
  if (status === 404 && refusal?.error === 'unknown-app') {
    return new CliRefusal({
      headline: `No app ${request.app} on your account at ${host}.`,
      guidance: 'Check the address given with --app; nothing was seeded.',
    })
  }
  if (status === 404) {
    return new CliRefusal({
      headline: `This cloud cannot seed hosted apps yet (${host}).`,
      guidance:
        'Nothing was seeded, on the cloud or on this machine. Try again once it is updated.',
    })
  }
  if (status === 401) {
    return new CliRefusal({
      headline: `${host} did not accept the API key in use — nothing was seeded.`,
      guidance: "Run 'sovrium login' to sign in again.",
    })
  }
  return new CliRefusal({
    headline: refusal?.message ?? `${host} refused the seed of ${request.app} (HTTP ${status}).`,
    guidance: 'Nothing was recorded or seeded; run the command again once that is settled.',
  })
}

/** Ask the cloud for a seed run; its id and first status, or the refusal. */
const requestSeedRun = (cloud: SignedInCloud, request: SeedRunRequest) =>
  Effect.gen(function* () {
    const body = yield* Schema.encodeEffect(seedRunRequestSchema)(request).pipe(
      Effect.mapError((issue) =>
        nothingSent(
          `The seed request would not be valid (${issue.message})`,
          'Fix the flag it names.'
        )
      )
    )
    const answer = yield* callCloud(new URL('/api/automations/seed/webhook', cloud.origin), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': cloud.apiKey },
      body: JSON.stringify(body),
    }).pipe(Effect.mapError(describeUnreachable('nothing was seeded')))
    const accepted = Schema.decodeUnknownOption(seedRunResponseSchema)(answer.body)
    if ((answer.status === 200 || answer.status === 201) && Option.isSome(accepted)) {
      return accepted.value
    }
    return yield* refusalOf(answer.status, answer.body, request, cloud.origin.origin)
  })

/** A `json` column a driver handed back as text, parsed; anything else as it came. */
const parsedJson = (value: unknown): unknown => {
  if (typeof value !== 'string') return value
  return Option.getOrElse(Option.liftThrowable(() => JSON.parse(value) as unknown)(), () => value)
}

/** One read of the seed run record. */
const readSeedRun = (cloud: SignedInCloud, id: string) =>
  readCloudRecord({
    origin: cloud.origin,
    apiKey: cloud.apiKey,
    table: 'seed_runs',
    id,
    label: `seed run ${id}`,
    decode: (fields) =>
      Schema.decodeUnknownOption(seedRunRecordFieldsSchema)({
        ...fields,
        report: parsedJson(fields['report']),
      }),
    stillRunning: `seed run ${id} may still be in progress there`,
    guidance: 'The seed may still run; check the app in the cloud.',
  })

/** What the command has printed so far: the last state, and whether the backup line went out. */
interface Printed {
  readonly status: SeedRunStatus
  readonly backup: boolean
}

/** The lines a read adds: its state when it changed, and the backup once. */
const progressOf = (id: string, printed: Printed, fields: SeedRunRecordFields) => {
  const backupKey = fields.backup_key ?? undefined
  return [
    ...(fields.status === printed.status || fields.status === 'done' || fields.status === 'failed'
      ? []
      : [`Seed run ${id}: ${fields.status}`]),
    ...(backupKey === undefined || backupKey === '' || printed.backup
      ? []
      : [`Backup taken: ${backupKey}`]),
  ]
}

/**
 * Read the seed run until it is `done` or `failed`, printing what changed.
 * Recursive so what was last printed is a parameter.
 */
const followSeedRun = (
  cloud: SignedInCloud,
  run: { readonly id: string; readonly deadline: number },
  printed: Printed
): Effect.Effect<void, CliRefusal> =>
  Effect.gen(function* () {
    const fields = yield* readSeedRun(cloud, run.id)
    const lines = progressOf(run.id, printed, fields)
    yield* Effect.forEach(lines, say, { discard: true })
    const now: Printed = {
      status: fields.status,
      backup: printed.backup || lines.some((line) => line.startsWith('Backup taken:')),
    }
    if (fields.status === 'done') {
      return yield* Effect.sync(() => report(fields.report?.lines ?? []))
    }
    if (fields.status === 'failed') {
      return yield* new CliRefusal({
        headline: `Seed run ${run.id} failed on ${cloud.origin.origin}.`,
        detail: (fields.error ?? 'The host recorded no reason.').split('\n'),
        guidance: "Fix what it names, then run 'sovrium seed' again.",
      })
    }
    if (Date.now() > run.deadline) {
      return yield* new CliRefusal({
        headline: `Seed run ${run.id} is still ${fields.status} after 10 minutes; the command stopped waiting.`,
        guidance: 'The seed may still finish; check the app in the cloud.',
      })
    }
    yield* Effect.sleep(POLL_INTERVAL_MS)
    return yield* followSeedRun(cloud, run, now)
  })

/** Ask for a seed run of `request.app` and follow it to its end. */
export const seedHostedApp = (cloud: SignedInCloud, request: SeedRunRequest) =>
  Effect.gen(function* () {
    const accepted = yield* requestSeedRun(cloud, request)
    const id = accepted.seedRunId
    yield* say(`Seed run ${id}: ${accepted.status}`)
    yield* followSeedRun(
      cloud,
      { id, deadline: Date.now() + WAIT_LIMIT_MS },
      { status: accepted.status, backup: false }
    )
  })

/**
 * The seed `sovrium deploy --seed` runs once the deployment is live: if-empty,
 * already confirmed by the flag. Any refusal says the app is deployed anyway.
 */
export const seedAfterDeploy = (cloud: SignedInCloud, app: string) =>
  seedHostedApp(cloud, { app, mode: 'if-empty' }).pipe(
    Effect.mapError(
      (refusal) =>
        new CliRefusal({
          ...refusal,
          headline: `Deployed, but not seeded: ${refusal.headline}`,
        })
    )
  )

const remoteSeed = (options: RemoteSeedOptions) =>
  Effect.gen(function* () {
    const { argv } = options
    yield* explicitAddress(argv)
    const asked = yield* requestOptions(options)
    yield* assertNetworkAllowed('seed')
    const cloud = yield* signedInCloud(argv)
    const app = yield* hostedApp(options, cloud)
    const confirm = yield* confirmSeed(argv, asked, app, cloud.origin.origin)
    yield* seedHostedApp(cloud, { app, ...asked, ...(confirm === undefined ? {} : { confirm }) })
  })

/** Handle `sovrium seed --app | --remote`. Exits 1 on any refusal; returns on success. */
export const handleRemoteSeed = async (options: RemoteSeedOptions): Promise<void> =>
  runCliProgram(remoteSeed(options))
