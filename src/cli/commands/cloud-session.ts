/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What `sovrium login` and `sovrium deploy` share: the stored sign-in, the
 * rules for reaching a Sovrium cloud, and the one way both call it.
 *
 * ### The sign-in file
 *
 * `~/.sovrium/credentials.json` — `{ host, apiKey, keyId, createdAt }`, one
 * per machine, owner read/write only. `0600` is asserted after the write
 * rather than trusted to `mode` (masked by umask, applied only on creation),
 * and every READ refuses a file other users can read, naming the `chmod` that
 * fixes it: a key that has already been readable by others is the operator's
 * call to keep, not the CLI's.
 *
 * ### Reaching a cloud
 *
 * `https` only. Plain `http` is accepted for a private or loopback host under
 * `SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1` — both conditions, as `init --from-url`
 * reads them — because the API key travels in every request.
 * `SOVRIUM_DISABLE_NETWORK=1` refuses before any request. Redirects are never
 * followed: a redirect would carry the key wherever the answer points.
 */

import { existsSync } from 'node:fs'
import { chmod, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { Console, Data, Effect, Option, Schema } from 'effect'
import {
  isPrivateOutboundHost,
  validateOutboundUrl,
} from '@/infrastructure/egress/validate-outbound-url'
import { withFetchStallTimeout } from '@/infrastructure/egress/with-fetch-timeout'
import { printFailure } from '@/infrastructure/logging/cli-output'
import {
  isPrivateOutboundOptIn,
  validatePostureFlags,
} from '@/infrastructure/process/security-posture'

/** The cloud `sovrium login` signs in to when `--host` is not given. */
export const DEFAULT_CLOUD_HOST = 'https://cloud.sovrium.com'

/** Owner read/write, nothing for anyone else. */
const CREDENTIALS_FILE_MODE = 0o600

/** Inactivity deadline of a small JSON call: no byte for this long and it is abandoned. */
const REQUEST_STALL_MS = 15_000

/**
 * A refusal the command prints and exits 1 on. `headline` names the constraint
 * and what did not happen; `guidance` the next action.
 */
export class CliRefusal extends Data.TaggedError('CliRefusal')<{
  readonly headline: string
  readonly guidance: string
  readonly detail?: readonly string[]
}> {}

/** The cloud did not answer: refused connection, DNS, TLS, or a stall. */
class CloudUnreachable extends Data.TaggedError('CloudUnreachable')<{
  readonly host: string
  readonly cause: unknown
}> {}

/** The stored sign-in, exactly as `sovrium login` writes it. */
const storedCredentialsSchema = Schema.Struct({
  host: Schema.String.check(Schema.isMinLength(1)),
  apiKey: Schema.String.check(Schema.isMinLength(1)),
  keyId: Schema.String.check(Schema.isMinLength(1)),
  createdAt: Schema.String,
})

export type StoredCredentials = Schema.Schema.Type<typeof storedCredentialsSchema>

/** `~/.sovrium/credentials.json`, resolved against the current home directory. */
export const credentialsPath = (): string => join(homedir(), '.sovrium', 'credentials.json')

/**
 * Whether permission bits leave the file to its owner alone. Windows has no
 * such bits — every file reads as `0o666` there — so the check is POSIX only.
 *
 * @public
 */
export const isOwnerOnly = (mode: number, platform: string = process.platform): boolean =>
  platform === 'win32' || (mode & 0o077) === 0

const unreadable = (path: string, cause: unknown): CliRefusal =>
  new CliRefusal({
    headline: `Sovrium could not read the sign-in at ${path}.`,
    detail: [cause instanceof Error ? cause.message : String(cause)],
    guidance: "Check the file's permissions, or run 'sovrium login' again.",
  })

/**
 * The stored sign-in, or `undefined` when this machine has none. Refuses a
 * file other users can read, and one `sovrium login` did not write.
 */
export const readCredentials: Effect.Effect<StoredCredentials | undefined, CliRefusal> = Effect.gen(
  function* () {
    const path = credentialsPath()
    if (!existsSync(path)) return undefined
    const info = yield* Effect.tryPromise({
      try: () => stat(path),
      catch: (cause) => unreadable(path, cause),
    })
    if (!isOwnerOnly(info.mode)) {
      return yield* new CliRefusal({
        headline: `${path} can be read by other users of this machine, so the sign-in in it is refused.`,
        guidance: `Run 'chmod 600 ${path}', then run the command again.`,
      })
    }
    const text = yield* Effect.tryPromise({
      try: () => readFile(path, 'utf8'),
      catch: (cause) => unreadable(path, cause),
    })
    const decoded = yield* Effect.try({
      try: () => JSON.parse(text) as unknown,
      catch: (cause) => unreadable(path, cause),
    }).pipe(Effect.flatMap(Schema.decodeUnknownEffect(storedCredentialsSchema)))
    return decoded
  }
).pipe(
  Effect.catchTag('SchemaError', () =>
    Effect.fail(
      new CliRefusal({
        headline: `${credentialsPath()} is not a sign-in 'sovrium login' wrote.`,
        guidance: "Run 'sovrium login' to sign in again; it replaces the file.",
      })
    )
  )
)

/** Write the sign-in owner-only, replacing any earlier one, and prove the mode. */
export const writeCredentials = (
  credentials: StoredCredentials
): Effect.Effect<string, CliRefusal> => {
  const path = credentialsPath()
  return Effect.tryPromise({
    try: async () => {
      await mkdir(dirname(path), { recursive: true, mode: 0o700 })
      await writeFile(path, `${JSON.stringify(credentials, undefined, 2)}\n`, {
        mode: CREDENTIALS_FILE_MODE,
        encoding: 'utf8',
      })
      // `mode` applies only on creation and is masked by umask, so the bits are
      // set explicitly — and then read back rather than hoped for.
      await chmod(path, CREDENTIALS_FILE_MODE)
      return (await stat(path)).mode
    },
    catch: (cause) =>
      new CliRefusal({
        headline: `Sovrium could not write the sign-in to ${path}.`,
        detail: [cause instanceof Error ? cause.message : String(cause)],
        guidance: 'Check that your home directory is writable, then run the command again.',
      }),
  }).pipe(
    Effect.flatMap((mode) =>
      isOwnerOnly(mode)
        ? Effect.succeed(path)
        : Effect.tryPromise({ try: () => rm(path, { force: true }), catch: () => undefined }).pipe(
            // The refusal that follows is what the operator acts on.
            // effect-swallow: removing the over-readable file is best effort
            Effect.ignore,
            Effect.andThen(
              Effect.fail(
                new CliRefusal({
                  headline: `${path} could not be made readable by you alone, so the sign-in was not kept.`,
                  guidance: 'Check the permissions of ~/.sovrium, then run the command again.',
                })
              )
            )
          )
    )
  )
}

/** Delete the stored sign-in. */
export const removeCredentials: Effect.Effect<void, CliRefusal> = Effect.tryPromise({
  try: () => rm(credentialsPath(), { force: true }),
  catch: (cause) => unreadable(credentialsPath(), cause),
})

/**
 * Refuse before any request when the network is off, or when a posture flag
 * carries a value nobody can read as on or off.
 */
export const assertNetworkAllowed = (command: string): Effect.Effect<void, CliRefusal> => {
  const posture = validatePostureFlags()
  if (posture !== undefined) {
    return Effect.fail(
      new CliRefusal({ headline: posture, guidance: 'Fix the variable, then run it again.' })
    )
  }
  if (process.env['SOVRIUM_DISABLE_NETWORK'] === '1') {
    return Effect.fail(
      new CliRefusal({
        headline: `sovrium ${command} needs the network, and SOVRIUM_DISABLE_NETWORK is set — nothing was sent.`,
        guidance: `Unset SOVRIUM_DISABLE_NETWORK to run 'sovrium ${command}'.`,
      })
    )
  }
  return Effect.void
}

/**
 * The cloud's origin, or a refusal: not a URL, not `https` (save a private or
 * loopback host under `SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1`), or a target the
 * outbound guard refuses.
 */
export const resolveCloudOrigin = (raw: string): Effect.Effect<URL, CliRefusal> => {
  const parsed = URL.parse(raw)
  if (parsed === null || (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')) {
    return Effect.fail(
      new CliRefusal({
        headline: `"${raw}" is not the address of a Sovrium cloud — nothing was sent.`,
        guidance: 'Give its https:// address, for example https://cloud.sovrium.com.',
      })
    )
  }
  const plainHttpOk =
    parsed.protocol === 'http:' &&
    isPrivateOutboundOptIn() &&
    isPrivateOutboundHost(parsed.hostname)
  if (parsed.protocol === 'http:' && !plainHttpOk) {
    return Effect.fail(
      new CliRefusal({
        headline: `${raw} is not an https:// address, and an API key never crosses the network in clear — nothing was sent.`,
        guidance:
          "Use the cloud's https:// address. Plain http is accepted only for a private or loopback address, with SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1.",
      })
    )
  }
  const validation = validateOutboundUrl(parsed.origin)
  if (!validation.ok) {
    return Effect.fail(
      new CliRefusal({
        headline: `${parsed.host} is a ${validation.issue.reason} address, which the outbound guard refuses — nothing was sent.`,
        guidance: 'Set SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1 to reach a cloud on your own network.',
      })
    )
  }
  return Effect.succeed(new URL(parsed.origin))
}

/** The status and parsed JSON body of an answer; `body` is `undefined` when it is not JSON. */
export interface CloudAnswer {
  readonly status: number
  readonly body: unknown
}

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

/**
 * One request to the cloud, never retried and never redirected. The deadline
 * is an inactivity one (`withFetchStallTimeout`): an upload on a slow link may
 * take minutes, a peer that stops answering does not hold the command.
 */
export const callCloud = (
  url: URL,
  init: Readonly<Omit<RequestInit, 'signal' | 'redirect'>>,
  stallMs: number = REQUEST_STALL_MS
): Effect.Effect<CloudAnswer, CloudUnreachable> =>
  Effect.tryPromise({
    try: () =>
      withFetchStallTimeout(url, { ...init, redirect: 'manual' }, stallMs, async (response) => ({
        status: response.status,
        body: parseJson(await response.text()),
      })),
    catch: (cause) => new CloudUnreachable({ host: url.host, cause }),
  })

/** ONE line naming the host the command could not reach, and what did not happen. */
export const describeUnreachable =
  (outcome: string) =>
  (error: CloudUnreachable): CliRefusal =>
    new CliRefusal({
      headline: `Could not reach ${error.host} — ${outcome}.`,
      guidance: 'Check the address and your connection, then run the command again.',
    })

/** A record read from the cloud's records API: its `fields`, whatever their shape. */
const cloudRecordSchema = Schema.Struct({ fields: Schema.Record(Schema.String, Schema.Unknown) })

/**
 * One read of a record the cloud keeps for a command — a deployment, a seed
 * run — at `GET /api/tables/<table>/records/<id>`, its fields decoded by
 * `decode`. Anything but a `200` that decodes is the refusal naming the record.
 */
export const readCloudRecord = <A>(options: {
  readonly origin: URL
  readonly apiKey: string
  readonly table: string
  readonly id: string
  /** The record as the developer reads it, for example `deployment <id>`. */
  readonly label: string
  readonly decode: (fields: Readonly<Record<string, unknown>>) => Option.Option<A>
  /** What the record's owner may still be doing, said when the cloud is unreachable. */
  readonly stillRunning: string
  readonly guidance: string
}): Effect.Effect<A, CliRefusal> =>
  Effect.gen(function* () {
    const { origin, id } = options
    const path = `/api/tables/${options.table}/records/${encodeURIComponent(id)}`
    const answer = yield* callCloud(new URL(path, origin), {
      method: 'GET',
      headers: { 'x-api-key': options.apiKey },
    }).pipe(Effect.mapError(describeUnreachable(options.stillRunning)))
    const fields = Option.flatMap(
      Schema.decodeUnknownOption(cloudRecordSchema)(answer.body),
      (record) => options.decode(record.fields)
    )
    if (answer.status === 200 && Option.isSome(fields)) return fields.value
    return yield* new CliRefusal({
      headline: `Sovrium could not read ${options.label} on ${origin.origin} (HTTP ${answer.status}).`,
      guidance: options.guidance,
    })
  })

/** Print a line to stdout. */
export const say = (line: string): Effect.Effect<void> => Console.log(line)

/**
 * Run a command program at the CLI's edge: a refusal is printed in the CLI's
 * failure shape and ends the process with exit 1.
 */
export const runCliProgram = async (program: Effect.Effect<void, CliRefusal>): Promise<void> => {
  const result = await Effect.runPromise(Effect.result(program))
  if (result._tag === 'Success') return
  const { headline, guidance, detail } = result.failure
  printFailure({ headline, guidance, ...(detail === undefined ? {} : { detail }) })
  process.exit(1)
}
