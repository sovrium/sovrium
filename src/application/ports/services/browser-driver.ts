/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Browser driver port: one real browser session at a time, driven
 * step by step by a `browser/run` action.
 *
 * The adapter owns everything about the browser — which backend, how it is
 * launched, the guard that holds every request to `allowedHosts`, answering
 * dialogs, keeping popups in the same view — and the handler owns what to do
 * with it. Every value the port receives is FINAL: templates, `$env` values
 * and one-time codes were filled in by the caller, and the port never records
 * a value it was given to type.
 *
 * Every failure carries a {@link BrowserFailureCode}; a message STARTS with the
 * code when it is one of the typed refusals of [internal ref] D10, so an operator
 * reading a run error knows which rule stopped it.
 */

/** The typed refusals of [internal ref] D10, and the two ordinary ways a step fails. */
export type BrowserFailureCode =
  | 'browser_unavailable'
  | 'browser_launch_failed'
  | 'host_not_allowed'
  | 'frame_cross_origin'
  | 'navigation_not_document'
  | 'upload_too_large'
  /** The browser agent asked for a backend that cannot hold its requests (WebKit). */
  | 'browser_backend_refused'
  /** The element was not found in time, matched more than once, or did not say what was checked. */
  | 'step_failed'
  /** The browser stopped answering, or was closed under the step. */
  | 'browser_closed'

export class BrowserFailure extends Data.TaggedError('BrowserFailure')<{
  readonly code: BrowserFailureCode
  readonly message: string
}> {}

/** How a step names its element — the `browser/run` locator with its templates filled in. */
export interface BrowserLocator {
  readonly role?: string
  readonly name?: string
  readonly label?: string
  readonly text?: string
  readonly placeholder?: string
  readonly testId?: string
  readonly selector?: string
  readonly exact?: boolean
  readonly nth?: number
}

/** A file handed to a file field. */
export interface BrowserUploadFile {
  readonly name: string
  readonly contentType: string
  readonly bytes: Uint8Array
}

/** A dialog the page opened, and how the driver answered it. */
export interface BrowserDialog {
  readonly dialog: 'alert' | 'confirm' | 'prompt' | 'beforeunload'
  readonly answer: 'accepted' | 'no' | 'empty'
}

/** What `extract` read: one value, or (with `all`) the values and how many matched in all. */
export type BrowserExtraction =
  | { readonly kind: 'one'; readonly value: string | Readonly<Record<string, string>> }
  | {
      readonly kind: 'all'
      readonly values: readonly (string | Readonly<Record<string, string>>)[]
      readonly total: number
    }

/** What a step reads off the page. */
export interface BrowserReadRequest {
  readonly target: BrowserLocator
  readonly attribute?: string
  readonly fields?: Readonly<Record<string, BrowserLocator>>
  /** Read every match, at most this many. */
  readonly all?: { readonly limit: number }
}

/**
 * What kind of element one locator names, for a gesture that must not land on
 * the wrong one: a `field` to type into, a `box` to tick, a `list` to choose
 * from, a `file` field, or anything `other`.
 */
export type BrowserElementKind = 'field' | 'box' | 'list' | 'file' | 'other'

/**
 * How a session's submission gate treats a request that sends data — any
 * method but `GET` or `HEAD`. `approve` holds the sends
 * of an agent gesture for a person (`browser/agent`), `refuse` fails them
 * (`browser.use`), `allow` lets them through (`approveSubmit: false`). Under
 * the first two, a send outside a gesture, a beacon and a WebSocket are
 * refused. Any of the three asks for a backend that guards every request: on
 * WebKit the session is refused with `browser_backend_refused`.
 */
export type BrowserSendGate = 'approve' | 'refuse' | 'allow'

/** A request that sends data, as the gate names it: its method and address, never its body. */
export interface BrowserSend {
  readonly method: string
  readonly url: string
}

/** What the gate did with the sends since the last time they were taken. */
export interface BrowserSends {
  /** Held unanswered in the browser for a person (`approve`), still waiting. */
  readonly held: readonly BrowserSend[]
  /** Sends of a gesture failed under `refuse`. */
  readonly refused: readonly BrowserSend[]
  /** Background sends and beacons failed, the run going on. */
  readonly heldBack: readonly BrowserSend[]
}

/** One open browser session. Every operation waits at most `timeoutMs`. */
export interface BrowserSession {
  /** `full` on Chrome (every request guarded); `navigation-only` on WebKit. */
  readonly guard: 'full' | 'navigation-only'
  readonly goto: (url: string, timeoutMs: number) => Effect.Effect<void, BrowserFailure>
  readonly click: (target: BrowserLocator, timeoutMs: number) => Effect.Effect<void, BrowserFailure>
  /** Click into the field, clear it, type `text`. `sensitive` masks the field in later screenshots. */
  readonly fill: (input: {
    readonly target: BrowserLocator
    readonly text: string
    readonly sensitive: boolean
    readonly timeoutMs: number
  }) => Effect.Effect<void, BrowserFailure>
  readonly select: (
    target: BrowserLocator,
    option: string,
    timeoutMs: number
  ) => Effect.Effect<void, BrowserFailure>
  readonly check: (
    target: BrowserLocator,
    checked: boolean,
    timeoutMs: number
  ) => Effect.Effect<void, BrowserFailure>
  readonly upload: (
    target: BrowserLocator,
    files: readonly BrowserUploadFile[],
    timeoutMs: number
  ) => Effect.Effect<void, BrowserFailure>
  readonly press: (
    key: string,
    target: BrowserLocator | undefined,
    timeoutMs: number
  ) => Effect.Effect<void, BrowserFailure>
  /** Wait for an element to show (or go away), or for the address to contain `url`. */
  readonly waitFor: (
    condition:
      | { readonly target: BrowserLocator; readonly state: 'visible' | 'hidden' }
      | { readonly url: string },
    timeoutMs: number
  ) => Effect.Effect<void, BrowserFailure>
  /** Check an element is there and contains `text` (when given), or the address contains `url`. */
  readonly assert: (
    condition:
      { readonly target: BrowserLocator; readonly text?: string } | { readonly url: string },
    timeoutMs: number
  ) => Effect.Effect<void, BrowserFailure>
  readonly read: (
    request: BrowserReadRequest,
    timeoutMs: number
  ) => Effect.Effect<BrowserExtraction, BrowserFailure>
  /** Click the element if it shows within `timeoutMs`; `false` when it never did. */
  readonly dismiss: (
    target: BrowserLocator,
    timeoutMs: number
  ) => Effect.Effect<boolean, BrowserFailure>
  /** A PNG of the page, every sensitive field painted over. */
  readonly screenshot: (fullPage: boolean) => Effect.Effect<Uint8Array, BrowserFailure>
  /**
   * What the page offers, as an outline a model reads: one line per heading,
   * control, link and block of text, with the role and accessible name a
   * locator uses. A field holding a sensitive value (or a password) shows
   * `***`. At most `maxChars` characters.
   */
  readonly outline: (maxChars: number) => Effect.Effect<string, BrowserFailure>
  /**
   * The kind of the one visible element `target` names. Fails as a click
   * would: nothing found within `timeoutMs`, or several elements matched.
   */
  readonly probe: (
    target: BrowserLocator,
    timeoutMs: number
  ) => Effect.Effect<BrowserElementKind, BrowserFailure>
  /**
   * What the submission gate did since the last call: the sends it holds, and
   * those it failed. Empty when the session has no gate.
   */
  readonly takeSends: Effect.Effect<BrowserSends>
  /**
   * Let every held send continue, once each and in the order the page sent
   * it — released, never replayed — then wait up to `timeoutMs` for what it
   * started. A send the page makes meanwhile is held again.
   */
  readonly releaseSends: (timeoutMs: number) => Effect.Effect<void, BrowserFailure>
  /** The address of the top document, read from the page. */
  readonly currentUrl: Effect.Effect<string, BrowserFailure>
  /** The dialogs answered since the last call. */
  readonly takeDialogs: Effect.Effect<readonly BrowserDialog[]>
  /** The cookie jar, serialised, or `undefined` when the backend keeps its own (WebKit). */
  readonly exportCookies: Effect.Effect<string | undefined, BrowserFailure>
  /** Close the session and give its turn to the next run. Idempotent. */
  readonly close: Effect.Effect<void>
}

/** What a session starts from. */
export interface BrowserSessionOptions {
  readonly allowedHosts: readonly string[]
  /** A jar `exportCookies` produced, restored before the first step (Chrome). */
  readonly cookies?: string
  /** The stored session's name, for a backend that keeps its own jar on disk (WebKit). */
  readonly sessionName?: string
  /** The submission gate, for a browser agent. Refuses a backend without request interception. */
  readonly sendGate?: BrowserSendGate
}

/** The operator's limits, read from `BROWSER_*`. */
export interface BrowserLimits {
  readonly stepTimeoutMs: number
  readonly runTimeoutMs: number
  readonly holdMaxMs: number
  readonly artifactRetentionDays: number
}

/**
 * The browser driver. `open` waits for its turn (`BROWSER_CONCURRENCY`); a
 * session stays open until it is closed, or handed to {@link hold} for a run
 * that waits for a person's confirmation with the filled form on screen.
 */
export class BrowserDriver extends Context.Service<
  BrowserDriver,
  {
    readonly limits: BrowserLimits
    readonly open: (options: BrowserSessionOptions) => Effect.Effect<BrowserSession, BrowserFailure>
    /**
     * Keep `session` open for the run `runId` for at most `holdMs`. Past it the
     * session is closed and `onExpire` runs, once.
     */
    readonly hold: <R>(input: {
      readonly runId: string
      readonly session: BrowserSession
      readonly holdMs: number
      /** Runs with the caller's services, captured when the hold starts. */
      readonly onExpire: Effect.Effect<void, never, R>
    }) => Effect.Effect<void, never, R>
    /** The session held for `runId`, taken out of the hold — or `undefined`. */
    readonly takeHeld: (runId: string) => Effect.Effect<BrowserSession | undefined>
    /** Close the session held for `runId`, if any. `true` when one was. */
    readonly releaseHeld: (runId: string) => Effect.Effect<boolean>
  }
>()('BrowserDriver') {}
