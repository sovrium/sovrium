/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which API key a cloud command signs with, and for which cloud.
 *
 * Two sources, in this order:
 *
 * 1. **`SOVRIUM_API_KEY`** — the CI case, where nothing is written to disk. The
 *    key belongs to `SOVRIUM_HOST`, or to `https://cloud.sovrium.com` when that
 *    is unset. The sign-in file is not read at all.
 * 2. **`~/.sovrium/credentials.json`** — what `sovrium login` writes.
 *
 * Either way a key is only ever sent to the cloud it belongs to: `--host`
 * naming another one is refused as "not signed in there", never answered by
 * sending the key anyway.
 */

import { Effect } from 'effect'
import { readValueFlag } from '@/cli/runtime/flag-vocabulary'
import {
  CliRefusal,
  DEFAULT_CLOUD_HOST,
  readCredentials,
  resolveCloudOrigin,
} from './cloud-session'

/** The variable that carries an API key instead of the sign-in file. */
export const API_KEY_VARIABLE = 'SOVRIUM_API_KEY'

/** The cloud the key in {@link API_KEY_VARIABLE} belongs to. */
export const HOST_VARIABLE = 'SOVRIUM_HOST'

/** Where the key in use came from: the environment, or the file `sovrium login` wrote. */
export type KeySource = 'environment' | 'file'

/** The key a command signs with, the cloud it belongs to, and where it came from. */
export interface SignIn {
  readonly host: string
  readonly apiKey: string
  readonly source: KeySource
  /** Set for a key from the file; the environment carries none. */
  readonly keyId?: string
  readonly createdAt?: string
}

/** The key in the environment, when one is set; an empty value counts as unset. */
const environmentSignIn = (
  env: Readonly<Record<string, string | undefined>>
): SignIn | undefined => {
  const apiKey = env[API_KEY_VARIABLE]
  if (apiKey === undefined || apiKey === '') return undefined
  const host = env[HOST_VARIABLE]
  return {
    host: host === undefined || host === '' ? DEFAULT_CLOUD_HOST : host,
    apiKey,
    source: 'environment',
  }
}

/**
 * The key in use, or `undefined` when this machine has none: the environment
 * first, then the sign-in file. Offline.
 */
export const readSignIn: Effect.Effect<SignIn | undefined, CliRefusal> = Effect.suspend(() => {
  const fromEnvironment = environmentSignIn(process.env)
  if (fromEnvironment !== undefined) return Effect.succeed(fromEnvironment)
  return Effect.map(readCredentials, (stored) =>
    stored === undefined ? undefined : { ...stored, source: 'file' as const }
  )
})

/**
 * Where the key in use comes from, or `undefined` when there is none — what
 * `sovrium login --status` prints, without ever printing the key.
 */
export const keySource: Effect.Effect<KeySource | undefined, CliRefusal> = Effect.map(
  readSignIn,
  (signIn) => signIn?.source
)

/** A signed-in cloud: where it is and the key every call carries. */
export interface SignedInCloud {
  readonly origin: URL
  readonly apiKey: string
}

const signInFirst = (origin: URL): CliRefusal =>
  new CliRefusal({
    headline: `This machine is not signed in to ${origin.origin} — nothing was built or sent.`,
    guidance: `Run 'sovrium login --host ${origin.origin}' first, or set ${API_KEY_VARIABLE} to a key of that cloud.`,
  })

/**
 * The cloud a command targets (`--host <url>` or `--host=<url>`, else the one
 * the key belongs to) and the key for it, or the refusal telling the developer
 * to sign in there. A `--host` given no address is refused, not defaulted.
 */
export const signedInCloud = (argv: readonly string[]): Effect.Effect<SignedInCloud, CliRefusal> =>
  Effect.gen(function* () {
    const host = readValueFlag(argv, '--host')
    if (host.given && host.value === undefined) {
      return yield* new CliRefusal({
        headline: '--host is given no address — nothing was sent.',
        guidance: 'Write --host <url>, for example --host https://cloud.sovrium.com.',
      })
    }
    const signIn = yield* readSignIn
    const target = host.value ?? signIn?.host
    if (target === undefined) return yield* signInFirst(new URL(DEFAULT_CLOUD_HOST))
    const origin = yield* resolveCloudOrigin(target)
    // A key for one cloud is never sent to another.
    if (signIn === undefined || URL.parse(signIn.host)?.origin !== origin.origin) {
      return yield* signInFirst(origin)
    }
    return { origin, apiKey: signIn.apiKey }
  })
