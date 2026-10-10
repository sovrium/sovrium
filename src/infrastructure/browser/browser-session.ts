/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { BrowserFailure, type BrowserSession } from '@/application/ports/services/browser-driver'
import { StepError } from './browser-cdp'
import {
  checkBox,
  clickElement,
  fillField,
  gotoPage,
  pressKey,
  selectOption,
  uploadFiles,
} from './browser-page-actions'
import { outlinePage, probeElement } from './browser-page-agent'
import { asStepError, currentHref } from './browser-page-find'
import { asGesture, releaseSends, takeSends } from './browser-page-gate'
import {
  assertCondition,
  capturePage,
  dismissOverlay,
  readValues,
  waitForCondition,
} from './browser-page-reads'
import { closeSession, exportJar } from './browser-session-open'
import type { PageState } from './browser-page-state'

/**
 * A page state as the {@link BrowserSession} port: every operation an Effect
 * that fails with a typed {@link BrowserFailure}, and a close that also hands
 * the session's turn to the next run.
 */

const toFailure = (error: unknown): BrowserFailure => {
  const step = asStepError(error)
  return new BrowserFailure({ code: step.code, message: step.message })
}

/** One async page operation as an Effect with a typed failure. */
const op = <A>(run: () => Promise<A>, name: string): Effect.Effect<A, BrowserFailure> =>
  Effect.tryPromise({ try: run, catch: toFailure }).pipe(Effect.withSpan(`browser.${name}`))

/**
 * The agent gestures of the port: each a window of the submission gate
 * (`browser-page-gate.ts`), which attributes the sends it sees to it. Without a
 * gate a gesture is just its action.
 */
const gestures = (
  state: PageState
): Pick<BrowserSession, 'click' | 'fill' | 'select' | 'check' | 'press'> => ({
  click: (target, timeoutMs) =>
    op(() => asGesture(state, undefined, () => clickElement(state, target, timeoutMs)), 'click'),
  fill: (input) =>
    op(
      () => asGesture(state, input.sensitive ? 'secret' : 'plain', () => fillField(state, input)),
      'fill'
    ),
  select: (target, option, timeoutMs) =>
    op(
      () => asGesture(state, 'plain', () => selectOption(state, target, option, timeoutMs)),
      'select'
    ),
  check: (target, checked, timeoutMs) =>
    op(
      () => asGesture(state, undefined, () => checkBox(state, target, checked, timeoutMs)),
      'check'
    ),
  press: (key, target, timeoutMs) =>
    op(() => asGesture(state, undefined, () => pressKey(state, key, target, timeoutMs)), 'press'),
})

/**
 * The port over `state`. `release` gives the permit back; it runs once, after
 * the view is closed.
 */
export const sessionOf = (state: PageState, release: Effect.Effect<void>): BrowserSession => {
  const closed = { done: false }
  return {
    guard: state.send === undefined ? 'navigation-only' : 'full',
    goto: (url, timeoutMs) => op(() => gotoPage(state, url, timeoutMs), 'goto'),
    ...gestures(state),
    upload: (target, files, timeoutMs) =>
      op(() => uploadFiles(state, target, files, timeoutMs), 'upload'),
    waitFor: (condition, timeoutMs) =>
      op(() => waitForCondition(state, condition, timeoutMs), 'wait-for'),
    assert: (condition, timeoutMs) =>
      op(() => assertCondition(state, condition, timeoutMs), 'assert'),
    read: (request, timeoutMs) => op(() => readValues(state, request, timeoutMs), 'read'),
    dismiss: (target, timeoutMs) => op(() => dismissOverlay(state, target, timeoutMs), 'dismiss'),
    screenshot: (fullPage) => op(() => capturePage(state, fullPage), 'screenshot'),
    outline: (maxChars) => op(() => outlinePage(state, maxChars), 'outline'),
    probe: (target, timeoutMs) => op(() => probeElement(state, target, timeoutMs), 'probe'),
    takeSends: Effect.sync(() => takeSends(state)),
    releaseSends: (timeoutMs) => op(() => releaseSends(state, timeoutMs), 'release-sends'),
    currentUrl: op(() => currentHref(state), 'current-url'),
    takeDialogs: Effect.sync(() => {
      const taken = state.dialogs
      state.dialogs = []
      return taken
    }),
    exportCookies: op(() => exportJar(state), 'export-cookies'),
    close: Effect.gen(function* () {
      if (closed.done) return
      closed.done = true
      // effect-promise: total -- `closeSession` catches every failure of the jar clear and of `view.close()`; it always resolves.
      yield* Effect.promise(() => closeSession(state))
      yield* release
    }),
  }
}

/** A failure raised before any session exists. */
export const openFailure = (error: unknown): BrowserFailure =>
  error instanceof StepError
    ? new BrowserFailure({ code: error.code, message: error.message })
    : toFailure(error)
