/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { messageOf, sleep, StepError, withDeadline } from './browser-cdp'
import { describeAddressRefusal } from './browser-host-guard'
import { pageCall } from './browser-page-inputs-runtime'
import type { PageMatch, PageQuery } from './browser-page-runtime'
import type { PageState } from './browser-page-state'
import type { BrowserLocator } from '@/application/ports/services/browser-driver'

/**
 * Finding things on the page, and waiting for it to settle: the polling half
 * of every step. Each wait is bounded by the step's own timeout.
 */

/** How often a wait looks again. */
const POLL_MS = 100

/** One page-side evaluation may take at most this long. */
const EVALUATE_MS = 5000

/** Run a page-side expression, bounded. A page that is navigating answers `undefined`. */
export const evaluate = async <T>(state: PageState, expression: string): Promise<T | undefined> => {
  if (state.closed) throw new StepError('browser_closed', 'the browser was closed')
  try {
    return await withDeadline(state.view.evaluate<T>(expression), EVALUATE_MS, 'the page')
  } catch (error) {
    if (state.closed) throw new StepError('browser_closed', 'the browser was closed')
    if (error instanceof StepError) throw error
    return undefined
  }
}

/** The locator as a person reads it: `the button "Submit"`, `the field labelled "Email"`. */
export const describeLocator = (locator: BrowserLocator): string => {
  const nth = locator.nth === undefined ? '' : ` (match ${String(locator.nth + 1)})`
  if (locator.role !== undefined) {
    return `the ${locator.role}${locator.name === undefined ? '' : ` "${locator.name}"`}${nth}`
  }
  if (locator.label !== undefined) return `the field labelled "${locator.label}"${nth}`
  if (locator.text !== undefined) return `the element with the text "${locator.text}"${nth}`
  if (locator.placeholder !== undefined) {
    return `the field with the placeholder "${locator.placeholder}"${nth}`
  }
  if (locator.testId !== undefined) return `the element with the test id "${locator.testId}"${nth}`
  return `the element matching the selector "${locator.selector ?? ''}"${nth}`
}

/** What the page reports for one locator, `undefined` while it cannot answer. */
const resolveOnce = (state: PageState, query: PageQuery): Promise<PageMatch | undefined> =>
  evaluate<PageMatch>(state, pageCall('resolve', query))

/** Why the element was not usable once the wait ran out. */
const notFound = (locator: BrowserLocator, last: PageMatch | undefined, timeoutMs: number) => {
  if (last !== undefined && last.count === 0 && last.crossOrigin > 0) {
    return new StepError(
      'frame_cross_origin',
      `frame_cross_origin: ${describeLocator(locator)} was not found, and the page shows ${String(last.crossOrigin)} frame(s) from another origin, which browser steps cannot reach`
    )
  }
  if (last?.point?.obscured === true) {
    return new StepError(
      'step_failed',
      `${describeLocator(locator)} stayed covered by another element for ${String(timeoutMs)} ms`
    )
  }
  if (last !== undefined && last.count > 0 && locator.nth !== undefined) {
    return new StepError(
      'step_failed',
      `${describeLocator(locator)} does not exist: only ${String(last.count)} element(s) matched`
    )
  }
  return new StepError(
    'step_failed',
    `${describeLocator(locator)} was not found within ${String(timeoutMs)} ms`
  )
}

/** Whether a match can be acted on. */
const usable = (match: PageMatch, needUncovered: boolean): boolean =>
  match.point !== undefined && (!needUncovered || !match.point.obscured)

/**
 * Wait for exactly one element (or the `nth`) to match, and answer it. More
 * than one match without `nth` fails at once, naming how many matched: the
 * step never guesses.
 */
export const findOne = async (
  state: PageState,
  locator: BrowserLocator,
  options: { readonly timeoutMs: number; readonly uncovered?: boolean; readonly hidden?: boolean }
): Promise<PageMatch & { readonly point: NonNullable<PageMatch['point']> }> => {
  const deadline = Date.now() + options.timeoutMs
  const query: PageQuery = {
    ...locator,
    ...(options.hidden === true ? { includeHidden: true } : {}),
  }
  const attempt = async (last: PageMatch | undefined): Promise<PageMatch> => {
    const match = (await resolveOnce(state, query)) ?? last
    if (match !== undefined && match.count > 1 && locator.nth === undefined) {
      throw new StepError(
        'step_failed',
        `${String(match.count)} elements matched ${describeLocator(locator)}; add \`nth\` to pick one, or a narrower locator`
      )
    }
    if (match !== undefined && usable(match, options.uncovered === true)) return match
    if (Date.now() >= deadline) throw notFound(locator, match, options.timeoutMs)
    await sleep(POLL_MS)
    return attempt(match)
  }
  const found = await attempt(undefined)
  return found as PageMatch & { readonly point: NonNullable<PageMatch['point']> }
}

/** Poll `check` until it answers `true` or `timeoutMs` passes; answers whether it did. */
export const pollUntil = async (
  check: () => Promise<boolean>,
  timeoutMs: number
): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs
  const attempt = async (): Promise<boolean> => {
    if (await check()) return true
    if (Date.now() >= deadline) return false
    await sleep(POLL_MS)
    return attempt()
  }
  return attempt()
}

/** The address of the top document, read from the page (`view.url` names the last frame on Chrome). */
export const currentHref = async (state: PageState): Promise<string> =>
  (await evaluate<string>(state, pageCall('href'))) ?? state.view.url

/**
 * Wait until the page has finished what the last input started: no top-frame
 * load in flight and the document complete — or a send held by the submission
 * gate, which nothing finishes until a person decides. Never fails — a page
 * that keeps loading is the next step's to wait for.
 */
export const settle = async (state: PageState, timeoutMs: number): Promise<void> => {
  await sleep(80)
  await pollUntil(
    async () => {
      if (state.gate.held.length > 0) return true
      if (state.loading) return false
      return (await evaluate<string>(state, 'document.readyState')) === 'complete'
    },
    Math.min(timeoutMs, 30_000)
  )
}

/**
 * Fail the step for anything the guard stopped while it ran: a navigation off
 * `allowedHosts`, or a response that was a file rather than a page.
 */
export const throwGuardEvents = (state: PageState): void => {
  const { refused, notDocument } = state
  state.refused = undefined
  state.notDocument = undefined
  if (notDocument !== undefined) {
    throw new StepError(
      'navigation_not_document',
      `navigation_not_document: ${notDocument} answered with a file to download, not a page; browser steps never download natively`
    )
  }
  if (refused !== undefined) {
    throw new StepError('host_not_allowed', describeAddressRefusal(refused, state.allowedHosts))
  }
}

/** A thrown value as a {@link StepError}, keeping a typed one as it is. */
export const asStepError = (error: unknown): StepError =>
  error instanceof StepError ? error : new StepError('step_failed', messageOf(error))
