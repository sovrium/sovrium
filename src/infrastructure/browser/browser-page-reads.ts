/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { StepError, withDeadline } from './browser-cdp'
import {
  currentHref,
  describeLocator,
  evaluate,
  findOne,
  pollUntil,
  throwGuardEvents,
} from './browser-page-find'
import { pageCall } from './browser-page-inputs-runtime'
import type { PageMatch, PageQuery } from './browser-page-runtime'
import type { PageState } from './browser-page-state'
import type {
  BrowserExtraction,
  BrowserLocator,
  BrowserReadRequest,
} from '@/application/ports/services/browser-driver'

/** The steps that look at the page: wait, check, read, dismiss, picture. */

const countVisible = async (state: PageState, locator: BrowserLocator): Promise<number> =>
  (await evaluate<PageMatch>(state, pageCall('resolve', { ...locator, nth: locator.nth ?? 0 })))
    ?.count ?? 0

export const waitForCondition = async (
  state: PageState,
  condition:
    | { readonly target: BrowserLocator; readonly state: 'visible' | 'hidden' }
    | { readonly url: string },
  timeoutMs: number
): Promise<void> => {
  const met = await pollUntil(async () => {
    if ('url' in condition) return (await currentHref(state)).includes(condition.url)
    const count = await countVisible(state, condition.target)
    return condition.state === 'hidden' ? count === 0 : count > 0
  }, timeoutMs)
  throwGuardEvents(state)
  if (met) return
  const what =
    'url' in condition
      ? `the address to contain "${condition.url}" (it is ${await currentHref(state)})`
      : `${describeLocator(condition.target)} to ${condition.state === 'hidden' ? 'go away' : 'show'}`
  throw new StepError('step_failed', `waited ${String(timeoutMs)} ms for ${what}`)
}

/** The text of the matched element, or `undefined` while it cannot be read. */
const readTarget = async (
  state: PageState,
  locator: BrowserLocator
): Promise<string | undefined> => {
  const read = await evaluate<{ count: number; values: unknown[] }>(
    state,
    pageCall('read', locator, {})
  )
  const value = read?.values[0]
  return typeof value === 'string' ? value : undefined
}

export const assertCondition = async (
  state: PageState,
  condition: { readonly target: BrowserLocator; readonly text?: string } | { readonly url: string },
  timeoutMs: number
): Promise<void> => {
  if ('url' in condition) {
    const met = await pollUntil(
      async () => (await currentHref(state)).includes(condition.url),
      timeoutMs
    )
    if (met) return
    throw new StepError(
      'step_failed',
      `the check failed: expected the address to contain "${condition.url}", it is ${await currentHref(state)}`
    )
  }
  await findOne(state, condition.target, { timeoutMs })
  const wanted = condition.text
  if (wanted === undefined) return
  const seen = { last: '' }
  const met = await pollUntil(async () => {
    seen.last = (await readTarget(state, condition.target)) ?? seen.last
    return seen.last.includes(wanted)
  }, timeoutMs)
  if (met) return
  throw new StepError(
    'step_failed',
    `the check failed: expected ${describeLocator(condition.target)} to contain "${wanted}", it reads "${seen.last}"`
  )
}

type Value = string | Readonly<Record<string, string>>

/** Read one element, or (with `all`) every match up to the limit. */
export const readValues = async (
  state: PageState,
  request: BrowserReadRequest,
  timeoutMs: number
): Promise<BrowserExtraction> => {
  const options = {
    ...(request.attribute === undefined ? {} : { attribute: request.attribute }),
    ...(request.fields === undefined ? {} : { fields: request.fields }),
  }
  if (request.all === undefined) {
    await findOne(state, request.target, { timeoutMs })
    const read = await evaluate<{ values: Value[] }>(
      state,
      pageCall('read', request.target, options)
    )
    const value = read?.values[0]
    if (value === undefined) {
      throw new StepError('step_failed', `${describeLocator(request.target)} could not be read`)
    }
    return { kind: 'one', value }
  }
  const query: PageQuery = { ...request.target }
  const found = { values: [] as Value[], total: 0 }
  await pollUntil(async () => {
    const read = await evaluate<{ count: number; values: Value[] }>(
      state,
      pageCall('read', query, { ...options, limit: request.all?.limit ?? 100 })
    )
    if (read !== undefined) Object.assign(found, { values: read.values, total: read.count })
    return found.total > 0
  }, timeoutMs)
  return { kind: 'all', values: found.values, total: found.total }
}

/** Click the element if it shows within `timeoutMs`; `false` when it never did. */
export const dismissOverlay = async (
  state: PageState,
  target: BrowserLocator,
  timeoutMs: number
): Promise<boolean> => {
  const shown = await pollUntil(async () => (await countVisible(state, target)) > 0, timeoutMs)
  if (!shown) return false
  const match = await findOne(state, target, { timeoutMs: Math.max(timeoutMs, 1000) })
  await withDeadline(state.view.click(match.point.x, match.point.y), timeoutMs, 'the click')
  return true
}

/** The whole page's area, for a full-page picture. */
const contentClip = async (send: NonNullable<PageState['send']>) => {
  const metrics = await send<{ cssContentSize: { width: number; height: number } }>(
    'Page.getLayoutMetrics'
  )
  const { width, height } = metrics.cssContentSize
  return { x: 0, y: 0, width: Math.ceil(width), height: Math.ceil(height), scale: 1 }
}

/** A PNG of the page with every sensitive field covered, then uncovered. */
export const capturePage = async (state: PageState, fullPage: boolean): Promise<Uint8Array> => {
  await evaluate(state, pageCall('mask'))
  try {
    if (state.send === undefined) {
      return new Uint8Array(await state.view.screenshot({ encoding: 'buffer', format: 'png' }))
    }
    const clip = fullPage ? await contentClip(state.send) : undefined
    const { data } = await state.send<{ data: string }>('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      ...(clip === undefined ? {} : { clip, captureBeyondViewport: true }),
    })
    return new Uint8Array(Buffer.from(data, 'base64'))
  } finally {
    await evaluate(state, pageCall('unmask'))
  }
}
