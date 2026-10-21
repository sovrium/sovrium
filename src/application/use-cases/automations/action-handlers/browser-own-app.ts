/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Whether a browser step's pages loaded anything from the app itself.
 *
 * A picture of a page the app serves shows what the app already holds —
 * records, stored files embedded in the page — so it is not bytes the run
 * brought in, and a step writing as nobody may not attach it. The taint is
 * sticky: once any page of the session requested the app's own origin
 * (`BASE_URL`, the address the server listens on, any name of this machine for
 * it, any address of the machine when it listens on all of them) or a
 * URL that serves one of the app's stored files (`own-file-url.ts`), every
 * later picture of the step carries it, across a confirmation too. Pictures
 * taken before the first such request keep their standing.
 */

import { Effect, Ref } from 'effect'
import { ServerOrigin } from '@/application/ports/services/server-origin'
import { isAllowedHost } from '@/domain/models/app/automations/actions/browser/browser-host-service'
import { httpUrlOf, ownStoredKeyOfUrl } from './own-file-url'
import { noteStepFileInput, stepFileInputs } from './step-file-inputs'
import type { AutomationContext } from './shared'
import type { BrowserSession } from '@/application/ports/services/browser-driver'
import type { StorageService } from '@/application/ports/services/storage-service'

/**
 * Whether `hostname` names this machine on any listening address: a loopback
 * name (`localhost`, a `.localhost` name, `127.0.0.0/8`, `::1`, an IPv4-mapped
 * loopback) or the unspecified address (`0.0.0.0`, `::`), which a browser
 * reaches as the machine itself. Read as the URL parser writes hostnames.
 */
const isThisMachine = (hostname: string): boolean =>
  hostname === 'localhost' ||
  hostname.endsWith('.localhost') ||
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
  hostname === '0.0.0.0' ||
  hostname === '[::1]' ||
  hostname === '[::]' ||
  /^\[::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}\]$/.test(hostname)

/** Whether `hostname` is the unspecified address, which listens on every address of the machine. */
const isUnspecified = (hostname: string): boolean => hostname === '0.0.0.0' || hostname === '[::]'

/** Whether `hostname` is an address literal rather than a name. */
const isAddressLiteral = (hostname: string): boolean =>
  /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) || hostname.startsWith('[')

/**
 * A URL's hostname as a resolver reads it: a name written with its final dot
 * (`localhost.`, `app.example.`) names the same host as without it.
 */
const hostnameOf = (url: Readonly<URL>): string =>
  url.hostname.endsWith('.') ? url.hostname.slice(0, -1) : url.hostname

/** A URL's port, the scheme's default written out. */
const portOf = (url: Readonly<URL>): string =>
  url.port !== '' ? url.port : url.protocol === 'https:' ? '443' : '80'

/** `text`'s origin, a name of this machine read as `localhost`; `undefined` when it is no http(s) URL. */
export const comparableOrigin = (text: string): string | undefined => {
  const url = httpUrlOf(text)
  if (url === undefined) return undefined
  const hostname = hostnameOf(url)
  const host = isThisMachine(hostname) ? 'localhost' : hostname
  return `${url.protocol}//${host}:${portOf(url)}`
}

/**
 * Whether `url` is on one of `own` origins. A server listening on the
 * unspecified address answers on every address of the machine, its network
 * interfaces included, so any address literal on its scheme and port is its
 * own; a NAME resolving to one of them is not caught here.
 */
export const isOnOwnOrigin = (url: string, own: readonly string[]): boolean => {
  const target = httpUrlOf(url)
  const origin = comparableOrigin(url)
  if (target === undefined || origin === undefined) return false
  return own.some((candidate) => {
    if (comparableOrigin(candidate) === origin) return true
    const listener = httpUrlOf(candidate)
    return (
      listener !== undefined &&
      isUnspecified(hostnameOf(listener)) &&
      isAddressLiteral(hostnameOf(target)) &&
      listener.protocol === target.protocol &&
      portOf(listener) === portOf(target)
    )
  })
}

/**
 * Whether `allowedHosts` lets a step open one of `own` origins. An entry names
 * a host and port without a scheme, so it is read on both schemes the way
 * `isOnOwnOrigin` reads a request (a name of this machine, the unspecified
 * listener); and each own origin is matched against the entries the way the
 * driver's guard matches a request (a wildcard entry covering it). Pure.
 */
export const allowsOwnAddress = (
  allowedHosts: readonly string[],
  own: readonly string[]
): boolean =>
  own.some((origin) => isAllowedHost(origin, allowedHosts)) ||
  allowedHosts.some((entry) =>
    ['http', 'https'].some((scheme) => isOnOwnOrigin(`${scheme}://${entry.trim()}/`, own))
  )

/** The origins the app answers on: its canonical address, and the one it listens on. */
const ownOrigins = Effect.gen(function* () {
  const origin = yield* ServerOrigin
  const listening = yield* origin.listening
  return [yield* origin.current, ...(listening === undefined ? [] : [listening])]
})

/** Whether one requested address is the app's own: its origin, or a URL of one of its files. */
export const isOwnAppAddress = (
  url: string,
  own: readonly string[]
): Effect.Effect<boolean, never, StorageService> =>
  (isOnOwnOrigin(url, own)
    ? Effect.succeed(true)
    : Effect.map(ownStoredKeyOfUrl(url), (key) => key !== undefined)
  ).pipe(Effect.withSpan('automations.browser-own-app-address'))

/**
 * Read what the session requested since the last look, and mark `seen` once
 * any of it was the app's own. Sticky: never cleared by a later look.
 */
export const observeOwnApp = (
  seen: Ref.Ref<boolean>,
  session: BrowserSession
): Effect.Effect<boolean, never, ServerOrigin | StorageService> =>
  Effect.gen(function* () {
    const requested = yield* session.takeRequested
    if (yield* Ref.get(seen)) return true
    const own = yield* ownOrigins
    const verdicts = yield* Effect.forEach(requested, (url) => isOwnAppAddress(url, own))
    const saw = verdicts.some(Boolean)
    if (saw) yield* Ref.set(seen, true)
    return saw
  }).pipe(Effect.withSpan('automations.browser-observe-own-app'))

/**
 * Where a browser step starts its reading: fresh, or — resuming after its
 * confirmation — with the file inputs it had noted and the taint it had,
 * kept by its pause (`parked-step-files.ts`). Answers the step's taint. A
 * resume that finds no reading kept (one stored by an older version, or one
 * that did not read back) starts tainted: what the step saw before its pause
 * cannot be told, so its pictures lend no standing. A step whose
 * `allowedHosts` names one of the app's own origins starts tainted too: its
 * pages may reach the app by roads the step does not watch (a WebSocket a
 * script opens, a sub-resource an engine does not report), so none of its
 * pictures lends standing, whatever page it shows.
 */
export const startStepReading = (
  automation: AutomationContext,
  resuming: boolean,
  allowedHosts: readonly string[]
): Effect.Effect<Ref.Ref<boolean>, never, ServerOrigin> =>
  Effect.gen(function* () {
    const parked = resuming ? automation.parkedStep?.take() : undefined
    yield* Effect.forEach(parked?.inputs ?? [], noteStepFileInput, { discard: true })
    const mayOpenOwnApp = allowsOwnAddress(allowedHosts, yield* ownOrigins)
    const keptTaint = resuming ? parked?.sawOwnApp !== false : false
    return yield* Ref.make(mayOpenOwnApp || keptTaint)
  }).pipe(Effect.withSpan('automations.browser-start-step-reading'))

/** Keep the step's reading with the run as it pauses in the step's middle. */
export const keepStepReading = (
  automation: AutomationContext,
  seenOwnApp: Ref.Ref<boolean>,
  session: BrowserSession
): Effect.Effect<void, never, ServerOrigin | StorageService> =>
  Effect.gen(function* () {
    const sawOwnApp = yield* observeOwnApp(seenOwnApp, session)
    const { inputs } = yield* stepFileInputs
    yield* Effect.sync(() => automation.parkedStep?.put({ inputs, sawOwnApp }))
  }).pipe(Effect.withSpan('automations.browser-keep-step-reading'))
