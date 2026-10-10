/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { eventData, stringField, type CdpSend } from './browser-cdp'
import {
  decideRequest,
  servedHeaders,
  type AddressRefusal,
  type GuardDecision,
} from './browser-host-guard'
import { networkLockdownSource } from './browser-network-lockdown-runtime'
import { failRequest, gateRequest } from './browser-page-gate'
import { gatesSends } from './browser-send-gate'
import type { TypedSince } from './browser-send-gate'
import type {
  BrowserDialog,
  BrowserSend,
  BrowserSendGate,
} from '@/application/ports/services/browser-driver'

/**
 * What a browser session knows about its page while it runs, and the CDP
 * listeners that keep it current on Chrome ([internal ref] D3, D4, D6).
 *
 * The listeners are attached BEFORE the first navigation: an unanswered
 * `alert` wedges every later input and evaluation (measured), so the dialog
 * handler is not optional, and a request that pauses with nobody to answer it
 * never completes.
 */

/** The mutable state of one page. Mutable on purpose: event streams write it. */
export interface PageState {
  readonly view: Bun.WebView
  /** The CDP queue — `undefined` on WebKit, which has none. */
  readonly send: CdpSend | undefined
  readonly allowedHosts: readonly string[]
  mainFrameId: string | undefined
  topOrigin: string | undefined
  /** The top frame is loading a document. */
  loading: boolean
  /** Dialogs answered since the last step read them. */
  dialogs: readonly BrowserDialog[]
  /** A top-frame navigation the guard refused, since the last step read it. */
  refused: AddressRefusal | undefined
  /** A top-frame response that was a file rather than a page, since the last step read it. */
  notDocument: string | undefined
  closed: boolean
  /** The submission gate; its policy is `undefined` when nothing is gated. */
  readonly gate: SendGateState
}

/** A send held unanswered in the browser, with what continuing it needs. */
export interface HeldSend extends BrowserSend {
  readonly requestId: string
  readonly topDocument: boolean
}

/** What the submission gate keeps. Mutable on purpose: the request stream writes it. */
export interface SendGateState {
  readonly policy: BrowserSendGate | undefined
  /** The gesture in flight; `exempt` is settled by its first send. */
  gesture: { exempt: boolean | undefined } | undefined
  typed: TypedSince
  held: readonly HeldSend[]
  refused: readonly BrowserSend[]
  heldBack: readonly BrowserSend[]
  /** Requests a person released, so a 307/308 of one follows its release. */
  released: ReadonlySet<string>
}

/** A fresh page state. */
export const newPageState = (
  view: Bun.WebView,
  send: CdpSend | undefined,
  allowedHosts: readonly string[],
  policy?: BrowserSendGate
): PageState => ({
  view,
  send,
  allowedHosts,
  mainFrameId: undefined,
  topOrigin: undefined,
  loading: false,
  dialogs: [],
  refused: undefined,
  notDocument: undefined,
  closed: false,
  gate: {
    policy,
    gesture: undefined,
    typed: { secret: 0, plain: 0 },
    held: [],
    refused: [],
    heldBack: [],
    released: new Set(),
  },
})

const DIALOG_ANSWERS: Readonly<Record<BrowserDialog['dialog'], BrowserDialog['answer']>> = {
  alert: 'accepted',
  confirm: 'no',
  prompt: 'empty',
  beforeunload: 'accepted',
}

/** Answer every dialog the page opens, the same way on both backends ([internal ref] D3.5). */
const answerDialogs = (state: PageState, send: CdpSend): void => {
  state.view.addEventListener('Page.javascriptDialogOpening', (event: Event) => {
    const type = stringField(eventData(event), 'type') ?? 'alert'
    const dialog = (type in DIALOG_ANSWERS ? type : 'alert') as BrowserDialog['dialog']
    state.dialogs = [...state.dialogs, { dialog, answer: DIALOG_ANSWERS[dialog] }]
    const params =
      dialog === 'prompt' ? { accept: true, promptText: '' } : { accept: dialog !== 'confirm' }
    // Swallowed: the view closed while the dialog was open, so there is nothing left to
    // answer. A dialog left open by any other failure stalls the page, and the step's own
    // timeout reports it.
    void send('Page.handleJavaScriptDialog', params).catch(() => undefined)
  })
}

/** Follow whether the top frame is loading a document. */
const followLoading = (state: PageState): void => {
  state.view.addEventListener('Page.frameStartedLoading', (event: Event) => {
    if (stringField(eventData(event), 'frameId') === state.mainFrameId) state.loading = true
  })
  state.view.addEventListener('Page.frameStoppedLoading', (event: Event) => {
    if (stringField(eventData(event), 'frameId') === state.mainFrameId) state.loading = false
  })
  // A new page: what was typed on the last one no longer exempts anything.
  state.view.addEventListener('Page.frameNavigated', (event: Event) => {
    const frame = eventData(event)['frame'] as Readonly<Record<string, unknown>> | undefined
    if (frame !== undefined && frame['parentId'] === undefined) {
      state.gate.typed = { secret: 0, plain: 0 }
    }
  })
}

/** A paused request, as the guard and the gate read it. */
export interface Paused {
  readonly requestId: string
  readonly method: string
  readonly redirectedRequestId: string | undefined
  readonly url: string
  readonly resourceType: string
  readonly frameId: string | undefined
  readonly status: number | undefined
  readonly headers: readonly { readonly name: string; readonly value: string }[]
}

const pausedOf = (event: Event): Paused | undefined => {
  const data = eventData(event)
  const request = data['request'] as Readonly<Record<string, unknown>> | undefined
  const requestId = stringField(data, 'requestId')
  const url = stringField(request, 'url')
  if (requestId === undefined || url === undefined) return undefined
  const status = data['responseStatusCode']
  const headers = Array.isArray(data['responseHeaders'])
    ? (data['responseHeaders'] as { readonly name: string; readonly value: string }[])
    : []
  return {
    requestId,
    method: stringField(request, 'method') ?? 'GET',
    redirectedRequestId: stringField(data, 'redirectedRequestId'),
    url,
    resourceType: stringField(data, 'resourceType') ?? '',
    frameId: stringField(data, 'frameId'),
    status: typeof status === 'number' ? status : undefined,
    headers,
  }
}

/** Re-serve a document with the browser policy added; a body that cannot be read is failed. */
const serveDocument = async (state: PageState, send: CdpSend, paused: Paused): Promise<void> => {
  const sockets = !gatesSends(state.gate.policy)
  const { body, base64Encoded } = await send<{ body: string; base64Encoded: boolean }>(
    'Fetch.getResponseBody',
    { requestId: paused.requestId }
  )
  await send('Fetch.fulfillRequest', {
    requestId: paused.requestId,
    responseCode: paused.status,
    responseHeaders: servedHeaders(paused.headers, state.allowedHosts, { sockets }),
    body: base64Encoded ? body : Buffer.from(body).toString('base64'),
  })
}

/** Record what a step must hear about a request the guard refused. */
const recordRefusal = (
  state: PageState,
  decision: GuardDecision,
  paused: Paused,
  topFrame: boolean
): void => {
  if (decision.kind === 'not-document' && decision.topFrame) state.notDocument = paused.url
  const topDocument = topFrame && paused.resourceType === 'Document'
  if (decision.kind === 'fail' && decision.refusal !== undefined && topDocument) {
    state.refused = decision.refusal
  }
}

/** Answer one paused request, recording what a step must hear about. */
const answerPaused = async (state: PageState, send: CdpSend, paused: Paused): Promise<void> => {
  const topFrame = paused.frameId === undefined || paused.frameId === state.mainFrameId
  const decision = decideRequest(paused, {
    allowedHosts: state.allowedHosts,
    mainFrameId: state.mainFrameId,
    topOrigin: state.topOrigin,
  })
  if (decision.kind === 'continue') {
    if (paused.status !== undefined) {
      await send('Fetch.continueRequest', { requestId: paused.requestId })
      return
    }
    const topDocument = topFrame && paused.resourceType === 'Document'
    await gateRequest(state, send, paused, topDocument)
    return
  }
  if (decision.kind === 'serve') {
    // Not a swallow: a document that cannot be served is failed like a blocked request,
    // so the page reports it instead of waiting on a request nobody answers.
    await serveDocument(state, send, paused).catch(() => failRequest(send, paused.requestId))
    return
  }
  recordRefusal(state, decision, paused, topFrame)
  await failRequest(send, paused.requestId)
}

/** Decide every request the page makes, before Chrome resolves a name or opens a socket. */
const guardRequests = (state: PageState, send: CdpSend): void => {
  state.view.addEventListener('Fetch.requestPaused', (event: Event) => {
    const paused = pausedOf(event)
    if (paused === undefined) return
    // A view closed mid-request rejects here; there is nothing left to answer.
    void answerPaused(state, send, paused).catch(() => undefined)
  })
}

/** Attach every Chrome listener a session needs. */
export const attachChromeListeners = (state: PageState, send: CdpSend): void => {
  answerDialogs(state, send)
  followLoading(state)
  guardRequests(state, send)
}

/** The CDP domains and the interception a Chrome session turns on, after its first navigation. */
export const enableChromeGuard = async (state: PageState, send: CdpSend): Promise<void> => {
  await send('Page.enable')
  const tree = await send<{ frameTree: { frame: { id: string } } }>('Page.getFrameTree')
  state.mainFrameId = tree.frameTree.frame.id
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: networkLockdownSource,
    runImmediately: true,
  })
  await send('Fetch.enable', {
    patterns: [
      { urlPattern: '*', requestStage: 'Request' },
      { urlPattern: '*', resourceType: 'Document', requestStage: 'Response' },
    ],
  })
}
