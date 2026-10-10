/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two browser sign-ins of `sovrium login`, both on the cloud's device
 * grant, both ending in an API key minted by the cloud:
 *
 * - **One click** (the default on a machine with its own browser): the CLI
 *   listens on `127.0.0.1` on a port the system picks, names that listener in
 *   `POST /api/auth/device/code`, and opens the approval page. The person
 *   decides there, the browser returns to `GET /callback` with a single-use
 *   code, and the CLI redeems the device code with it. A cloud that promises
 *   the return answers with the `Sovrium-Device-Return: loopback` header; one
 *   that does not (it predates the return and dropped the field) is told apart
 *   by its absence, and the CLI continues with the code it was just issued.
 * - **A code** (`--device`, or no browser here): print the page and the code,
 *   open the page when this machine has a browser, and poll.
 *
 * Either way the CLI keeps polling without a code, so a denial, an expiry or
 * an approval on an older approval page (which never sends the browser back)
 * all end the command.
 */

import { hostname } from 'node:os'
import { Data, Deferred, Effect, Option, Schema } from 'effect'
import { openInBrowser } from '@/cli/runtime/browser-launch'
import {
  DEVICE_NAME_MAX_LENGTH,
  DEVICE_RETURN_HEADER,
  DEVICE_RETURN_LOOPBACK,
  SOVRIUM_CLI_CLIENT_ID,
  deviceApiKeyErrorSchema,
  deviceApiKeyResponseSchema,
  deviceCodeResponseSchema,
} from '@/domain/models/api/auth/auth'
import { withFetchStallTimeout } from '@/infrastructure/egress/with-fetch-timeout'
import { CliRefusal, callCloud, describeUnreachable, say } from './cloud-session'
import { approvedPage, deniedPage, emptyReturnPage, pageHeaders } from './login-loopback-pages'
import type { DeviceCodeRequest, DeviceCodeResponse } from '@/domain/models/api/auth/auth'

/** The key the cloud minted, as the CLI stores it. */
export interface MintedKey {
  readonly key: string
  readonly keyId: string
}

/** Which sign-in a refusal ends, so its guidance names the way forward. */
type SignInMode = 'one-click' | 'code'

/** Extra wait the RFC asks for after a `slow_down`. */
const SLOW_DOWN_STEP_SECONDS = 5

/** Inactivity deadline of the code request, as for every small cloud call. */
const REQUEST_STALL_MS = 15_000

const jsonHeaders = { 'Content-Type': 'application/json' } as const

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

/**
 * The quiet reference a one-click sign-in prints, for an approval page that
 * still shows a code: the code in two halves, so it is not a code to confirm.
 *
 * @public
 */
export const requestReference = (userCode: string): string => {
  const half = Math.floor(userCode.length / 2)
  return `(request ${userCode.slice(0, half)}-${userCode.slice(half)})`
}

/** This machine, as it names itself on the approval page; `undefined` when it has no name. */
const deviceName = (): string | undefined => {
  const name = hostname().trim().slice(0, DEVICE_NAME_MAX_LENGTH)
  return name === '' ? undefined : name
}

const deviceRefusal = (error: string, origin: URL, mode: SignInMode): CliRefusal => {
  const again =
    mode === 'one-click'
      ? "Run 'sovrium login' again, or 'sovrium login --device' if your browser cannot reach this machine."
      : "Run 'sovrium login' again for a new code."
  switch (error) {
    case 'access_denied':
      return new CliRefusal({
        headline:
          mode === 'one-click'
            ? 'The sign-in was denied in the browser — nothing was stored.'
            : 'The code was denied in the browser — nothing was stored.',
        guidance: again,
      })
    case 'expired_token':
      return new CliRefusal({
        headline:
          mode === 'one-click'
            ? 'The sign-in request expired before the browser came back — nothing was stored.'
            : 'The code expired before anyone approved it — nothing was stored.',
        guidance: again,
      })
    default:
      return new CliRefusal({
        headline: `${origin.origin} no longer recognises this sign-in request — nothing was stored.`,
        guidance: again,
      })
  }
}

/** One redemption attempt, and the attempts after it. */
interface Redemption {
  readonly origin: URL
  readonly deviceCode: string
  /** The return code the browser carried back; absent while polling. */
  readonly code?: string
  readonly intervalSeconds: number
  /** The wait before this attempt. */
  readonly delaySeconds: number
  readonly deadline: number
  readonly mode: SignInMode
}

/**
 * Redeem the device code until it is approved, denied or expired. Recursive so
 * the interval is a parameter rather than mutable state.
 */
const redeem = (plan: Redemption): Effect.Effect<MintedKey, CliRefusal> =>
  Effect.gen(function* () {
    const { origin, deviceCode, code, intervalSeconds, deadline, mode } = plan
    if (Date.now() > deadline) return yield* deviceRefusal('expired_token', origin, mode)
    if (plan.delaySeconds > 0) yield* Effect.sleep(`${plan.delaySeconds} seconds`)
    const answer = yield* callCloud(new URL('/api/auth/device/api-key', origin), {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        device_code: deviceCode,
        client_id: SOVRIUM_CLI_CLIENT_ID,
        ...(code === undefined ? {} : { code }),
      }),
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
      return yield* redeem({ ...plan, delaySeconds: intervalSeconds })
    }
    if (error === 'slow_down') {
      const slower = intervalSeconds + SLOW_DOWN_STEP_SECONDS
      return yield* redeem({ ...plan, intervalSeconds: slower, delaySeconds: slower })
    }
    return yield* deviceRefusal(error, origin, mode)
  })

/** Polling without a code, from the first interval to the code's expiry. */
const poll = (origin: URL, issued: DeviceCodeResponse, mode: SignInMode) =>
  redeem({
    origin,
    deviceCode: issued.device_code,
    intervalSeconds: issued.interval,
    delaySeconds: issued.interval,
    deadline: Date.now() + issued.expires_in * 1000,
    mode,
  })

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

/**
 * `POST /api/auth/device/code`, and whether the cloud promised to send the
 * browser back. Not `callCloud`, which reads no header; the transport is the
 * same — one request, never redirected, an inactivity deadline.
 */
const requestCode = (origin: URL, request: DeviceCodeRequest) =>
  Effect.gen(function* () {
    const answer = yield* Effect.tryPromise({
      try: () =>
        withFetchStallTimeout(
          new URL('/api/auth/device/code', origin),
          {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify(request),
            redirect: 'manual',
          },
          REQUEST_STALL_MS,
          async (response) => ({
            status: response.status,
            body: parseJson(await response.text()),
            returns: response.headers.get(DEVICE_RETURN_HEADER) === DEVICE_RETURN_LOOPBACK,
          })
        ),
      catch: () =>
        new CliRefusal({
          headline: `Could not reach ${origin.host} — nothing was stored.`,
          guidance: 'Check the address and your connection, then run the command again.',
        }),
    })
    const issued = Schema.decodeUnknownOption(deviceCodeResponseSchema)(answer.body)
    if (answer.status !== 200 || Option.isNone(issued)) {
      return yield* new CliRefusal({
        headline: `${origin.origin} does not offer browser sign-in (HTTP ${answer.status}) — nothing was stored.`,
        guidance:
          "Check the address, or sign in with an API key you created there: 'sovrium login --api-key <key>'.",
      })
    }
    return { issued: issued.value, returns: answer.returns }
  })

const linkOf = (origin: URL, issued: DeviceCodeResponse): string =>
  approvalLink(origin, issued.verification_uri_complete ?? issued.verification_uri)

/** The code flow on a code already issued: print it, open the page when asked, poll. */
const continueWithCode = (origin: URL, issued: DeviceCodeResponse, openBrowser: boolean) =>
  Effect.gen(function* () {
    const link = linkOf(origin, issued)
    // One write: a reader of the output sees the link and the code together.
    yield* say(
      [
        `To sign in, open ${link}`,
        `and confirm the code ${issued.user_code}.`,
        'Waiting for approval…',
      ].join('\n')
    )
    if (openBrowser) yield* Effect.sync(() => openInBrowser(link))
    return yield* poll(origin, issued, 'code')
  })

/** The code flow: `--device`, or a machine with no browser of its own. */
export const signInWithCode = (
  origin: URL,
  openBrowser: boolean
): Effect.Effect<MintedKey, CliRefusal> =>
  requestCode(origin, { client_id: SOVRIUM_CLI_CLIENT_ID }).pipe(
    Effect.flatMap(({ issued }) => continueWithCode(origin, issued, openBrowser))
  )

/** What the browser brought back to the listener. */
type BrowserReturn = { readonly code: string } | { readonly error: string }

/** The listener answers one route, `GET /callback`; everything else is a 404. */
const answerBrowser =
  (returned: Deferred.Deferred<BrowserReturn>) =>
  (request: Request): Response => {
    const url = new URL(request.url)
    if (request.method !== 'GET' || url.pathname !== '/callback') {
      return new Response('Not found', { status: 404, headers: pageHeaders })
    }
    const code = url.searchParams.get('code')
    const error = url.searchParams.get('error')
    if (code !== null && code !== '') {
      Deferred.doneUnsafe(returned, Effect.succeed({ code }))
      return approvedPage()
    }
    if (error !== null && error !== '') {
      Deferred.doneUnsafe(returned, Effect.succeed({ error }))
      return deniedPage()
    }
    return emptyReturnPage()
  }

/** How long the listener lets the page it just answered reach the browser before it closes. */
const LISTENER_DRAIN = '1 second'

type Listener = ReturnType<typeof Bun.serve>

/** The graceful close of the listener did not finish. */
class ListenerDrainFailed extends Data.TaggedError('ListenerDrainFailed')<{
  readonly cause: unknown
}> {}

/**
 * Close the listener: first gracefully, so the result page the browser is
 * still receiving is delivered, then for good once the drain is over.
 */
const closeListener = (server: Listener) =>
  Effect.tryPromise({
    try: () => server.stop(),
    catch: (cause) => new ListenerDrainFailed({ cause }),
  }).pipe(
    Effect.timeout(LISTENER_DRAIN),
    // effect-swallow: a listener that would not drain is closed by force on the next line
    Effect.ignore,
    Effect.andThen(Effect.sync(() => void server.stop(true)))
  )

/** `Bun.serve` on `127.0.0.1`, a port the system picks; `undefined` when it cannot listen. */
const listen = (returned: Deferred.Deferred<BrowserReturn>) =>
  Effect.acquireRelease(
    Effect.sync((): Listener | undefined => {
      try {
        return Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: answerBrowser(returned) })
      } catch {
        return undefined
      }
    }),
    (server) => (server === undefined ? Effect.void : closeListener(server))
  )

/**
 * Wait for whichever ends the sign-in first: the browser coming back to the
 * listener, or the poll (a denial, an expiry, or an approval on a page that
 * never sends the browser back). Once the browser is back the poll stops, and
 * the code is redeemed one interval after it: the poll has just touched the
 * request, and the cloud would answer an earlier redemption `slow_down`.
 */
const awaitReturn = (
  origin: URL,
  issued: DeviceCodeResponse,
  returned: Deferred.Deferred<BrowserReturn>
) =>
  Effect.raceFirst(
    Deferred.await(returned),
    poll(origin, issued, 'one-click').pipe(Effect.map((minted) => ({ minted })))
  ).pipe(
    Effect.flatMap((outcome) => {
      if ('minted' in outcome) return Effect.succeed(outcome.minted)
      if ('error' in outcome) return Effect.fail(deviceRefusal(outcome.error, origin, 'one-click'))
      return redeem({
        origin,
        deviceCode: issued.device_code,
        code: outcome.code,
        intervalSeconds: issued.interval,
        delaySeconds: issued.interval,
        deadline: Date.now() + issued.expires_in * 1000,
        mode: 'one-click',
      })
    })
  )

/** One click in the browser, back to a listener on this machine. */
export const signInOneClick = (origin: URL): Effect.Effect<MintedKey, CliRefusal> =>
  Effect.scoped(
    Effect.gen(function* () {
      const returned = yield* Deferred.make<BrowserReturn>()
      const server = yield* listen(returned)
      if (server === undefined) return yield* signInWithCode(origin, true)
      const name = deviceName()
      const { issued, returns } = yield* requestCode(origin, {
        client_id: SOVRIUM_CLI_CLIENT_ID,
        redirect_uri: `http://127.0.0.1:${server.port}/callback`,
        ...(name === undefined ? {} : { device_name: name }),
      })
      if (!returns) {
        yield* say(`${origin.origin} does not offer one-click sign-in — confirm a code instead.`)
        return yield* continueWithCode(origin, issued, true)
      }
      const link = linkOf(origin, issued)
      yield* say(
        [
          `Opening ${link} in your browser…`,
          requestReference(issued.user_code),
          'Waiting for approval…',
        ].join('\n')
      )
      yield* Effect.sync(() => openInBrowser(link))
      return yield* awaitReturn(origin, issued, returned)
    })
  )
