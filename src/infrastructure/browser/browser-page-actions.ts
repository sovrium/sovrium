/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { messageOf, StepError, withDeadline } from './browser-cdp'
import { addressRefusal, describeAddressRefusal } from './browser-host-guard'
import { describeLocator, evaluate, findOne, settle, throwGuardEvents } from './browser-page-find'
import { pageCall } from './browser-page-inputs-runtime'
import type { PageState } from './browser-page-state'
import type { BrowserLocator, BrowserUploadFile } from '@/application/ports/services/browser-driver'

/**
 * The steps that act on the page ([internal ref] D6). Every pointer input is a
 * native click at the element's centre — the page sees a trusted event — and
 * every one is followed by a settle, then by the guard's verdict on what the
 * input led to.
 */

/** Click at a point, bounded, then wait for what it started. */
const clickAt = async (
  state: PageState,
  point: { readonly x: number; readonly y: number },
  timeoutMs: number
): Promise<void> => {
  await withDeadline(state.view.click(point.x, point.y), timeoutMs, 'the click')
  await settle(state, timeoutMs)
  throwGuardEvents(state)
}

/**
 * Open a page. A host off `allowedHosts`, a private address, or an address that
 * is not `http(s)` is refused before the browser moves.
 *
 * The scheme check is not redundant with the guard: a `data:` or `blob:`
 * document is not a network response, so it is never re-served with the
 * browser policy, and a window or WebSocket it opens is outside this view's
 * request interception. A templated `goto` filled from trigger data must not
 * be able to name one.
 */
export const gotoPage = async (state: PageState, url: string, timeoutMs: number): Promise<void> => {
  if (!/^https?:/i.test(url.trim())) {
    const scheme = /^\s*([a-z][a-z0-9+.-]*):/i.exec(url)?.[1]
    throw new StepError(
      'host_not_allowed',
      `host_not_allowed: a goto opens http and https addresses only, and this one ${scheme === undefined ? 'has no scheme' : `is a ${scheme.toLowerCase()}: address`}`
    )
  }
  const refusal = addressRefusal(url, state.allowedHosts)
  if (refusal !== undefined) {
    throw new StepError('host_not_allowed', describeAddressRefusal(refusal, state.allowedHosts))
  }
  state.refused = undefined
  state.notDocument = undefined
  try {
    await withDeadline(state.view.navigate(url), timeoutMs, `opening ${url}`)
  } catch (error) {
    throwGuardEvents(state)
    throw error instanceof StepError
      ? error
      : new StepError('step_failed', `${url} could not be opened: ${messageOf(error)}`)
  }
  await settle(state, timeoutMs)
  throwGuardEvents(state)
}

export const clickElement = async (
  state: PageState,
  target: BrowserLocator,
  timeoutMs: number
): Promise<void> => {
  const match = await findOne(state, target, { timeoutMs, uncovered: true })
  await clickAt(state, match.point, timeoutMs)
}

/** Click into a field, clear it, type `text`. The typed text is never logged or returned. */
export const fillField = async (
  state: PageState,
  input: {
    readonly target: BrowserLocator
    readonly text: string
    readonly sensitive: boolean
    readonly timeoutMs: number
  }
): Promise<void> => {
  const match = await findOne(state, input.target, {
    timeoutMs: input.timeoutMs,
    uncovered: true,
  })
  await withDeadline(state.view.click(match.point.x, match.point.y), input.timeoutMs, 'the click')
  await evaluate(state, pageCall('clearTarget', input.sensitive))
  await withDeadline(state.view.type(input.text), input.timeoutMs, 'typing')
}

export const selectOption = async (
  state: PageState,
  target: BrowserLocator,
  option: string,
  timeoutMs: number
): Promise<void> => {
  await findOne(state, target, { timeoutMs })
  const result = await evaluate<{ ok: boolean; options: string[] }>(
    state,
    pageCall('selectOption', option)
  )
  if (result?.ok === true) return
  throw new StepError(
    'step_failed',
    `${describeLocator(target)} has no option "${option}"; its options are: ${(result?.options ?? []).map((o) => `"${o}"`).join(', ')}`
  )
}

/** Leave a box in `checked` state: clicked when it is not, set directly if a click did not do it. */
export const checkBox = async (
  state: PageState,
  target: BrowserLocator,
  checked: boolean,
  timeoutMs: number
): Promise<void> => {
  const match = await findOne(state, target, { timeoutMs })
  if ((await evaluate<boolean>(state, pageCall('isChecked'))) === checked) return
  if (!match.point.obscured) await clickAt(state, match.point, timeoutMs)
  if ((await evaluate<boolean>(state, pageCall('isChecked'))) === checked) return
  await evaluate(state, pageCall('setChecked', checked))
}

/**
 * Attach files to a file field through `DataTransfer` — on both backends, so a
 * remote browser gets the bytes and not a path it cannot read ([internal ref] D6).
 */
export const uploadFiles = async (
  state: PageState,
  target: BrowserLocator,
  files: readonly BrowserUploadFile[],
  timeoutMs: number
): Promise<void> => {
  await findOne(state, target, { timeoutMs, hidden: true })
  const payload = files.map((file) => ({
    name: file.name,
    type: file.contentType,
    data: Buffer.from(file.bytes).toString('base64'),
  }))
  const attached = await evaluate<number>(state, pageCall('attachFiles', payload))
  if (attached !== files.length) {
    throw new StepError('step_failed', `${describeLocator(target)} did not accept the file(s)`)
  }
}

const MODIFIERS: ReadonlySet<string> = new Set(['Shift', 'Control', 'Alt', 'Meta'])

/** `Control+A` → the key `a` with the `Control` modifier. */
const parseKey = (
  key: string
): { readonly key: string; readonly modifiers: Bun.WebView.Modifier[] } => {
  const parts = key.split('+').filter((part) => part !== '')
  const last = parts.at(-1) ?? key
  const modifiers = parts.slice(0, -1).filter((part) => MODIFIERS.has(part))
  return {
    key: last.length === 1 && modifiers.length > 0 ? last.toLowerCase() : last,
    modifiers: modifiers as Bun.WebView.Modifier[],
  }
}

export const pressKey = async (
  state: PageState,
  key: string,
  target: BrowserLocator | undefined,
  timeoutMs: number
): Promise<void> => {
  if (target !== undefined) {
    await findOne(state, target, { timeoutMs })
    await evaluate(state, pageCall('focusTarget'))
  }
  const parsed = parseKey(key)
  await withDeadline(
    state.view.press(
      parsed.key,
      parsed.modifiers.length > 0 ? { modifiers: parsed.modifiers } : {}
    ),
    timeoutMs,
    `the key ${key}`
  )
  await settle(state, timeoutMs)
  throwGuardEvents(state)
}
