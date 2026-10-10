/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  allowedConnectSources,
  hostOf,
  isAllowedHost,
} from '@/domain/models/app/automations/actions/browser/browser-host-service'
import { validateOutboundUrl } from '@/infrastructure/egress/validate-outbound-url'

/**
 * The browser guard's decisions ([internal ref] D3): what a request the page makes
 * may do, and what a document it loads is served with.
 *
 * On Chrome every request pauses (`Fetch.enable` on `*`) and gets exactly one
 * of these answers. A request passes only when its host is on `allowedHosts`
 * AND the outbound guard accepts the address (no private network unless the
 * operator allows it). A document is re-served with a policy that closes the
 * three routes `Fetch` cannot see — WebSockets, service workers, new windows —
 * and a frame from another origin is refused outright, because its own
 * requests would bypass the page's interception.
 *
 * Pure: the session adapter turns each decision into its CDP command.
 */

/** Why an address is refused, for the step's error. */
export type AddressRefusal =
  | { readonly kind: 'host'; readonly url: string }
  | { readonly kind: 'private'; readonly url: string; readonly reason: string }

/** Whether `url` may be requested, or why not. Schemes with no network (`data:`, `blob:`, `about:`) pass. */
export const addressRefusal = (
  url: string,
  allowedHosts: readonly string[]
): AddressRefusal | undefined => {
  if (/^(data|blob|about):/i.test(url)) return undefined
  if (!isAllowedHost(url, allowedHosts)) return { kind: 'host', url }
  const verdict = validateOutboundUrl(url)
  return verdict.ok ? undefined : { kind: 'private', url, reason: verdict.issue.reason }
}

/** Reasons the outbound guard gives for an address that is no network address at all. */
const NOT_AN_ADDRESS: ReadonlySet<string> = new Set(['unsupported-protocol', 'invalid-url'])

/** The step error for a refused address: `host_not_allowed: …`, naming what to change. */
export const describeAddressRefusal = (
  refusal: AddressRefusal,
  allowedHosts: readonly string[]
): string => {
  if (refusal.kind === 'host') {
    return `host_not_allowed: ${refusal.url} is on ${hostOf(refusal.url)}, which is not in allowedHosts (${allowedHosts.join(', ')})`
  }
  return NOT_AN_ADDRESS.has(refusal.reason)
    ? `host_not_allowed: ${refusal.url} is not an http or https address (${refusal.reason}); browser runs request nothing else`
    : `host_not_allowed: ${refusal.url} is a private-network address (${refusal.reason}); browser runs reach private networks only when the operator sets SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1`
}

/** The paused request, as the decision reads it. */
export interface PausedRequest {
  readonly url: string
  readonly resourceType: string
  readonly frameId: string | undefined
  /** Set at the response stage. */
  readonly status: number | undefined
  readonly headers: readonly { readonly name: string; readonly value: string }[]
}

/** What the page session knows when it decides. */
export interface GuardContext {
  readonly allowedHosts: readonly string[]
  readonly mainFrameId: string | undefined
  /** The origin of the document the top frame shows (or is navigating to). */
  readonly topOrigin: string | undefined
}

export type GuardDecision =
  | { readonly kind: 'continue' }
  | { readonly kind: 'fail'; readonly refusal?: AddressRefusal; readonly crossOriginFrame?: true }
  /** A document re-served with the browser policy added to its headers. */
  | { readonly kind: 'serve' }
  /** A response that is not a page (a download, a file): failed, and reported for a top frame. */
  | { readonly kind: 'not-document'; readonly topFrame: boolean }

const originOf = (url: string): string | undefined => {
  try {
    return new URL(url).origin
  } catch {
    return undefined
  }
}

const headerOf = (request: PausedRequest, name: string): string =>
  request.headers.find((header) => header.name.toLowerCase() === name)?.value ?? ''

/** A response a browser shows as a page, rather than saves. */
const isPageResponse = (request: PausedRequest): boolean => {
  if (/^\s*attachment/i.test(headerOf(request, 'content-disposition'))) return false
  const type = headerOf(request, 'content-type').toLowerCase()
  return type === '' || type.includes('html') || type.includes('xml')
}

/** The answer at the response stage: a document is re-served, a file is refused. */
const decideResponse = (
  request: PausedRequest,
  status: number,
  topFrame: boolean
): GuardDecision => {
  const redirect = status >= 300 && status < 400
  if (request.resourceType !== 'Document' || redirect) return { kind: 'continue' }
  return isPageResponse(request) ? { kind: 'serve' } : { kind: 'not-document', topFrame }
}

/** Whether a request is a frame document from another origin than the top one. */
const isCrossOriginFrame = (request: PausedRequest, topFrame: boolean, topOrigin?: string) =>
  request.resourceType === 'Document' &&
  !topFrame &&
  /^https?:/i.test(request.url) &&
  originOf(request.url) !== topOrigin

/** Decide one paused request. */
export const decideRequest = (request: PausedRequest, context: GuardContext): GuardDecision => {
  const topFrame = request.frameId === undefined || request.frameId === context.mainFrameId
  if (request.status !== undefined) return decideResponse(request, request.status, topFrame)
  const refusal = addressRefusal(request.url, context.allowedHosts)
  if (refusal !== undefined) return { kind: 'fail', refusal }
  if (isCrossOriginFrame(request, topFrame, context.topOrigin)) {
    return { kind: 'fail', crossOriginFrame: true }
  }
  return { kind: 'continue' }
}

/**
 * The `allowedHosts` a page may open a connection to. A WebSocket is never
 * paused by the request interception, so `connect-src` is its only gate, and an
 * entry naming a private-network address (`10.0.0.5`, `localhost`, a sub-domain
 * of `localhost`) is dropped from it unless the operator allows private
 * outbound calls — the rule a `goto` and every paused request already meet. A
 * NAME that resolves to a private address is not caught here.
 */
const connectableHosts = (allowedHosts: readonly string[]): readonly string[] =>
  allowedHosts.filter(
    (entry) => validateOutboundUrl(`http://${entry.trim().replace(/^\*\./, 'a.')}/`).ok
  )

/**
 * The policy every document is served with: the page may talk only to
 * `allowedHosts` (`connect-src` covers fetch, beacons and WebSockets), may run
 * no worker, and opens no window. A policy only ever tightens the site's own.
 *
 * `sockets: false` — while a browser agent's submission gate holds sends
 * — leaves `ws:` and `wss:` out of `connect-src`, so the
 * page opens no WebSocket at all: what a socket sends cannot be held message by
 * message, and `Fetch` never pauses its upgrade.
 */
export const browserDocumentPolicy = (
  allowedHosts: readonly string[],
  options: { readonly sockets: boolean } = { sockets: true }
): string => {
  const sources = allowedConnectSources(connectableHosts(allowedHosts))
    .split(' ')
    .filter((source) => source !== '' && (options.sockets || !/^wss?:/i.test(source)))
    .join(' ')
  return `connect-src ${sources === '' ? "'none'" : sources}; worker-src 'none'; sandbox allow-scripts allow-forms allow-same-origin allow-modals`
}

/** Response headers a re-served body no longer matches. */
const DROPPED_HEADERS: ReadonlySet<string> = new Set([
  'content-length',
  'content-encoding',
  'transfer-encoding',
])

/** The headers a re-served document goes out with: its own, plus the policy. */
export const servedHeaders = (
  headers: readonly { readonly name: string; readonly value: string }[],
  allowedHosts: readonly string[],
  options: { readonly sockets: boolean } = { sockets: true }
): readonly { readonly name: string; readonly value: string }[] => [
  ...headers.filter((header) => !DROPPED_HEADERS.has(header.name.toLowerCase())),
  { name: 'Content-Security-Policy', value: browserDocumentPolicy(allowedHosts, options) },
]
