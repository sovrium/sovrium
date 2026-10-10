/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium login [--host <url>] [--api-key <key>] [--device] [--status] [--logout]`
 *
 * Sign the CLI in to a Sovrium cloud and keep an API key of the user's in
 * `~/.sovrium/credentials.json` (see `cloud-session.ts` for the file and the
 * transport rules).
 *
 * The mode, in order: `--api-key` pastes a key; `--device` uses a code; a
 * machine with no browser of its own (`browser-launch.ts`) uses a code; any
 * other signs in with one click (`login-loopback.ts`). `--open` is accepted
 * and changes nothing.
 *
 * - **Browser** (one click or a code): the device grant, redeemed at
 *   `POST /api/auth/device/api-key` until it is approved, denied or expired.
 *   The CLI never holds a session: the cloud mints the key.
 * - **Paste** (`--api-key`): the key is checked once with
 *   `GET /api/auth/get-session`, whose `session.id` is the key's id.
 * - **`--status`** reads the sign-in in use, the file or `SOVRIUM_API_KEY` —
 *   no network, never the key.
 * - **`--logout`** revokes the key on the cloud, then deletes the file.
 *
 * Every answer is decoded through the auth wire contract before it is read.
 */

import { Effect, Option, Schema } from 'effect'
import { isHeadless } from '@/cli/runtime/browser-launch'
import { getFlagValue } from '@/cli/runtime/flag-vocabulary'
import { getSessionResponseSchema } from '@/domain/models/api/auth/auth'
import {
  CliRefusal,
  DEFAULT_CLOUD_HOST,
  assertNetworkAllowed,
  callCloud,
  credentialsPath,
  describeUnreachable,
  readCredentials,
  removeCredentials,
  resolveCloudOrigin,
  runCliProgram,
  say,
  writeCredentials,
} from './cloud-session'
import { API_KEY_VARIABLE, keySource, readSignIn } from './cloud-sign-in'
import { signInOneClick, signInWithCode } from './login-loopback'
import type { StoredCredentials } from './cloud-session'

const jsonHeaders = { 'Content-Type': 'application/json' } as const

const notSignedIn = (): CliRefusal =>
  new CliRefusal({
    headline: `Not signed in — there is no sign-in at ${credentialsPath()}.`,
    guidance: "Run 'sovrium login' to sign in to a Sovrium cloud.",
  })

/** Who an API key belongs to, or `undefined` when the cloud does not accept it. */
const whoIs = (origin: URL, apiKey: string) =>
  callCloud(new URL('/api/auth/get-session', origin), {
    method: 'GET',
    headers: { 'x-api-key': apiKey },
  }).pipe(
    Effect.map((answer) =>
      answer.status === 200
        ? Option.getOrUndefined(Schema.decodeUnknownOption(getSessionResponseSchema)(answer.body))
        : undefined
    )
  )

/** Store the sign-in and name who it is. */
const keepSignIn = (credentials: StoredCredentials, name: string | null | undefined) =>
  writeCredentials(credentials).pipe(
    Effect.andThen(
      say(
        name == null || name === ''
          ? `Signed in to ${credentials.host}.`
          : `Signed in to ${credentials.host} as ${name}.`
      )
    )
  )

/** `--status`: the key in use and where it came from — never the key, never the network. */
const showStatus = Effect.gen(function* () {
  const signIn = yield* readSignIn
  if (signIn === undefined) return yield* notSignedIn()
  yield* say(`Signed in to ${signIn.host}`)
  if (signIn.source === 'environment') return yield* say(`  Key from ${API_KEY_VARIABLE}`)
  yield* say(`  Key id   ${signIn.keyId ?? ''}`)
  yield* say(`  Since    ${(signIn.createdAt ?? '').slice(0, 10)}`)
  yield* say(`  Key from ${credentialsPath()}`)
})

/** `--logout`: revoke the key on the cloud, then forget it here. */
const signOut = Effect.gen(function* () {
  if ((yield* keySource) === 'environment') {
    return yield* new CliRefusal({
      headline: `The key in use comes from ${API_KEY_VARIABLE}, so it was neither revoked nor deleted.`,
      guidance: `Unset ${API_KEY_VARIABLE} to stop using it, and revoke it in the cloud's account page if it should no longer work.`,
    })
  }
  yield* assertNetworkAllowed('login --logout')
  const stored = yield* readCredentials
  if (stored === undefined) return yield* notSignedIn()
  const origin = yield* resolveCloudOrigin(stored.host)
  const answer = yield* callCloud(new URL('/api/auth/api-key/delete', origin), {
    method: 'POST',
    headers: { ...jsonHeaders, 'x-api-key': stored.apiKey },
    body: JSON.stringify({ keyId: stored.keyId }),
  }).pipe(Effect.mapError(describeUnreachable('the sign-in was kept')))
  // A key the cloud no longer accepts is already revoked: forgetting it is all that is left.
  const alreadyRevoked = answer.status === 401 || answer.status === 404
  if (answer.status !== 200 && !alreadyRevoked) {
    return yield* new CliRefusal({
      headline: `${origin.origin} did not revoke the key (HTTP ${answer.status}) — the sign-in was kept.`,
      guidance:
        "Run 'sovrium login --logout' again, or revoke the key in the cloud's account page.",
    })
  }
  yield* removeCredentials
  yield* say(
    alreadyRevoked
      ? `Signed out of ${origin.origin} (the key was already revoked there).`
      : `Signed out of ${origin.origin}.`
  )
})

/** `--api-key <key>`: check the key once, then keep it. */
const signInWithKey = (origin: URL, apiKey: string) =>
  Effect.gen(function* () {
    const session = yield* whoIs(origin, apiKey).pipe(
      Effect.mapError(describeUnreachable('nothing was stored'))
    )
    if (session === undefined) {
      return yield* new CliRefusal({
        headline: `${origin.origin} did not accept this API key — nothing was stored.`,
        guidance:
          "Check the key, or run 'sovrium login' without --api-key to approve a code in your browser.",
      })
    }
    yield* keepSignIn(
      {
        host: origin.origin,
        apiKey,
        keyId: session.session.id,
        createdAt: new Date().toISOString(),
      },
      session.user.name
    )
  })

/**
 * Sign in in the browser and keep the key: one click by default, a code with
 * `--device` or where this machine has no browser of its own — and then the
 * page still opens by itself when a browser is there to open it.
 */
const signInWithBrowser = (origin: URL, device: boolean) =>
  Effect.gen(function* () {
    const headless = isHeadless()
    const minted = yield* device || headless
      ? signInWithCode(origin, !headless)
      : signInOneClick(origin)
    const session = yield* whoIs(origin, minted.key).pipe(
      // The key is minted and about to be stored; the name only completes the closing line.
      // effect-swallow: a sign-in is not refused for lacking the user's name
      Effect.orElseSucceed(() => undefined)
    )
    yield* keepSignIn(
      {
        host: origin.origin,
        apiKey: minted.key,
        keyId: minted.keyId,
        createdAt: new Date().toISOString(),
      },
      session?.user.name
    )
  })

/** Handle `sovrium login`. Exits 1 on any refusal; returns on success. */
export const handleLoginCommand = async (argv: readonly string[]): Promise<void> => {
  if (argv.includes('--status')) return runCliProgram(showStatus)
  if (argv.includes('--logout')) return runCliProgram(signOut)
  const apiKey = getFlagValue(argv, '--api-key')
  return runCliProgram(
    Effect.gen(function* () {
      if (argv.includes('--api-key') && (apiKey === undefined || apiKey.startsWith('--'))) {
        return yield* new CliRefusal({
          headline: '--api-key needs the key after it — nothing was stored.',
          guidance: "Run 'sovrium login --api-key <key>', or 'sovrium login' to use your browser.",
        })
      }
      yield* assertNetworkAllowed('login')
      const origin = yield* resolveCloudOrigin(getFlagValue(argv, '--host') ?? DEFAULT_CLOUD_HOST)
      if (apiKey !== undefined) return yield* signInWithKey(origin, apiKey)
      // `--open` is still accepted, and changes nothing: the browser opens by default.
      return yield* signInWithBrowser(origin, argv.includes('--device'))
    })
  )
}
