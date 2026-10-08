/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium login [--host <url>] [--api-key <key>] [--open] [--status] [--logout]`
 *
 * Sign the CLI in to a Sovrium cloud and keep an API key of the user's in
 * `~/.sovrium/credentials.json` (see `cloud-session.ts` for the file and the
 * transport rules).
 *
 * - **Device flow** (default): `POST /api/auth/device/code`, print the approval
 *   link and the code, then redeem it at `POST /api/auth/device/api-key` every
 *   `interval` seconds — five more after a `slow_down` — until it is approved,
 *   denied or expired. The CLI never holds a session: the cloud mints the key.
 * - **Paste** (`--api-key`): the key is checked once with
 *   `GET /api/auth/get-session`, whose `session.id` is the key's id.
 * - **`--status`** reads the file alone — no network, never the key.
 * - **`--logout`** revokes the key on the cloud, then deletes the file.
 *
 * Every answer is decoded through the auth wire contract before it is read.
 */

import { spawn } from 'node:child_process'
import { Effect, Option, Schema } from 'effect'
import { getFlagValue } from '@/cli/runtime/flag-vocabulary'
import {
  SOVRIUM_CLI_CLIENT_ID,
  deviceApiKeyErrorSchema,
  deviceApiKeyResponseSchema,
  deviceCodeResponseSchema,
  getSessionResponseSchema,
} from '@/domain/models/api/auth/auth'
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
import type { StoredCredentials } from './cloud-session'
import type { DeviceCodeRequest } from '@/domain/models/api/auth/auth'

/** Extra wait the RFC asks for after a `slow_down`. */
const SLOW_DOWN_STEP_SECONDS = 5

const jsonHeaders = { 'Content-Type': 'application/json' } as const

/** The body that starts the device flow: the CLI names itself, nothing else. */
const DEVICE_CODE_REQUEST: DeviceCodeRequest = { client_id: SOVRIUM_CLI_CLIENT_ID }

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

/** `--status`: the file alone, never the key, never the network. */
const showStatus = Effect.gen(function* () {
  const stored = yield* readCredentials
  if (stored === undefined) return yield* notSignedIn()
  yield* say(`Signed in to ${stored.host}`)
  yield* say(`  Key id   ${stored.keyId}`)
  yield* say(`  Since    ${stored.createdAt.slice(0, 10)}`)
})

/** `--logout`: revoke the key on the cloud, then forget it here. */
const signOut = Effect.gen(function* () {
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
 * The approval page, always on the cloud being signed in to: the path and
 * query the cloud named, on the origin the CLI reached. The person is never
 * sent to another site to approve a code, and a cloud whose own idea of its
 * address is wrong (a proxy, an unset `BASE_URL`) still prints a link that
 * opens.
 *
 * @public
 */
export const approvalLink = (origin: URL, verificationUri: string): string => {
  const named = URL.parse(verificationUri, origin)
  return named === null
    ? new URL('/device', origin).href
    : new URL(`${named.pathname}${named.search}`, origin).href
}

/** Best effort: open the approval page in the default browser. */
const openInBrowser = (url: string): void => {
  const opener =
    process.platform === 'darwin'
      ? ['open', url]
      : process.platform === 'win32'
        ? ['cmd', '/c', 'start', '', url]
        : ['xdg-open', url]
  try {
    const [command = 'open', ...args] = opener
    spawn(command, args, { stdio: 'ignore', detached: true })
      .on('error', () => undefined)
      .unref()
  } catch {
    // The link is printed either way; a missing opener is not a failure.
  }
}

const deviceRefusal = (error: string, origin: URL): CliRefusal => {
  const again = "Run 'sovrium login' again for a new code."
  switch (error) {
    case 'access_denied':
      return new CliRefusal({
        headline: 'The code was denied in the browser — nothing was stored.',
        guidance: again,
      })
    case 'expired_token':
      return new CliRefusal({
        headline: 'The code expired before anyone approved it — nothing was stored.',
        guidance: again,
      })
    default:
      return new CliRefusal({
        headline: `${origin.origin} no longer recognises this code — nothing was stored.`,
        guidance: again,
      })
  }
}

/**
 * Redeem the device code until it is approved, denied or expired. Recursive so
 * the interval is a parameter rather than mutable state.
 */
const redeem = (
  origin: URL,
  deviceCode: string,
  intervalSeconds: number,
  deadline: number
): Effect.Effect<{ readonly key: string; readonly keyId: string }, CliRefusal> =>
  Effect.gen(function* () {
    if (Date.now() > deadline) return yield* deviceRefusal('expired_token', origin)
    yield* Effect.sleep(`${intervalSeconds} seconds`)
    const answer = yield* callCloud(new URL('/api/auth/device/api-key', origin), {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ device_code: deviceCode, client_id: SOVRIUM_CLI_CLIENT_ID }),
    }).pipe(Effect.mapError(describeUnreachable('nothing was stored')))
    const minted = Schema.decodeUnknownOption(deviceApiKeyResponseSchema)(answer.body)
    if (answer.status === 200 && Option.isSome(minted)) return minted.value
    const refused = Schema.decodeUnknownOption(deviceApiKeyErrorSchema)(answer.body)
    if (Option.isNone(refused)) {
      return yield* new CliRefusal({
        headline: `${origin.origin} answered the sign-in with HTTP ${answer.status} — nothing was stored.`,
        guidance: "Run 'sovrium login' again; if it persists, the cloud may be misconfigured.",
      })
    }
    const { error } = refused.value
    if (error === 'authorization_pending') {
      return yield* redeem(origin, deviceCode, intervalSeconds, deadline)
    }
    if (error === 'slow_down') {
      return yield* redeem(origin, deviceCode, intervalSeconds + SLOW_DOWN_STEP_SECONDS, deadline)
    }
    return yield* deviceRefusal(error, origin)
  })

/** The device flow: a code approved in the browser, redeemed for an API key. */
const signInWithBrowser = (origin: URL, openBrowser: boolean) =>
  Effect.gen(function* () {
    const answer = yield* callCloud(new URL('/api/auth/device/code', origin), {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(DEVICE_CODE_REQUEST),
    }).pipe(Effect.mapError(describeUnreachable('nothing was stored')))
    const code = Schema.decodeUnknownOption(deviceCodeResponseSchema)(answer.body)
    if (answer.status !== 200 || Option.isNone(code)) {
      return yield* new CliRefusal({
        headline: `${origin.origin} does not offer browser sign-in (HTTP ${answer.status}) — nothing was stored.`,
        guidance:
          "Check the address, or sign in with an API key you created there: 'sovrium login --api-key <key>'.",
      })
    }
    const issued = code.value
    const link = approvalLink(origin, issued.verification_uri_complete ?? issued.verification_uri)
    // One write: a reader of the output sees the link and the code together.
    yield* say(
      [
        `To sign in, open ${link}`,
        `and confirm the code ${issued.user_code}.`,
        'Waiting for approval…',
      ].join('\n')
    )
    if (openBrowser) openInBrowser(link)
    const minted = yield* redeem(
      origin,
      issued.device_code,
      issued.interval,
      Date.now() + issued.expires_in * 1000
    )
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
      return yield* signInWithBrowser(origin, argv.includes('--open'))
    })
  )
}
