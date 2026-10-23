/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The data attributes of the two actions that act on another component of the
 * page — `fill` writes into a form control, `seek` moves a media player. The
 * always-loaded client runtime runs both from the button alone
 * (`islands/runtime/fill-runtime.ts`, `islands/runtime/seek-runtime.ts`), so
 * every `$record.*` they carry is resolved here, against the record the button
 * is drawn for.
 */

import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'
import { outcomeToastAttributes } from './button-action-builders'
import type {
  ClipboardAction,
  FillAction,
  SeekAction,
} from '@/domain/models/app/pages/components/action-client'

/** A fill action: writes a value into a form control on the page (`fill-runtime.ts`). */
export type FillButtonAction = FillAction

/**
 * Returns true if the given action is a fill action
 */
export function isFillAction(action: unknown): action is FillButtonAction {
  return (action as { type?: string })?.type === 'fill'
}

/**
 * The fill a button runs on click, its `value` resolved against the button's
 * record (the row it is drawn in, or the page's bound record) so the client
 * writes text and never sees a `$record.` token. Carried whole in one JSON
 * attribute, like the toast and fetch actions beside it.
 */
export function buildFillDataAttributes(
  action: FillButtonAction,
  record: Readonly<Record<string, unknown>> | undefined
): Record<string, string> {
  const value = record === undefined ? action.value : substituteRecordVars(action.value, record)
  return {
    'data-action-type': 'fill',
    'data-action-config': JSON.stringify({
      target: action.target,
      value,
      ...(action.field !== undefined && { field: action.field }),
      ...(action.mode !== undefined && { mode: action.mode }),
    }),
  }
}

/** A seek action: moves a video or audio player on the page to a moment (`seek-runtime.ts`). */
export type SeekButtonAction = SeekAction

/**
 * Returns true if the given action is a seek action
 */
export function isSeekAction(action: unknown): action is SeekButtonAction {
  return (action as { type?: string })?.type === 'seek'
}

/**
 * The seek a button runs on click, its `target` and `time` resolved against
 * the button's record, so the client reads a player id and a number of seconds
 * and never a `$record.` token. A time that resolves to no number is carried
 * as `null`, which the runtime ignores.
 */
export function buildSeekDataAttributes(
  action: SeekButtonAction,
  record: Readonly<Record<string, unknown>> | undefined
): Record<string, string> {
  const resolve = (value: string): string =>
    record === undefined ? value : substituteRecordVars(value, record)
  const text = typeof action.time === 'number' ? '' : resolve(action.time).trim()
  const time = typeof action.time === 'number' ? action.time : text === '' ? NaN : Number(text)
  return {
    'data-action-type': 'seek',
    'data-action-config': JSON.stringify({
      target: resolve(action.target),
      time: Number.isFinite(time) ? time : null,
      ...(action.play === false && { play: false }),
    }),
  }
}

/**
 * Returns true if the given action is a clipboard copy
 */
export function isClipboardAction(action: unknown): action is ClipboardAction {
  return (action as { type?: string })?.type === 'clipboard'
}

/**
 * The copy a button runs on click (`clipboard-runtime.ts`), its `value`
 * resolved against the button's record, so the client copies text and never a
 * `$record.` token. A field the record does not carry for this reader resolves
 * to empty, so a hidden value is never written into the page.
 */
export function buildClipboardDataAttributes(
  action: ClipboardAction,
  record: Readonly<Record<string, unknown>> | undefined
): Record<string, string> {
  return {
    'data-action-type': 'clipboard',
    'data-action-config': JSON.stringify({
      value: record === undefined ? action.value : substituteRecordVars(action.value, record),
    }),
    ...outcomeToastAttributes('success', action.onSuccess?.toast),
    ...outcomeToastAttributes('error', action.onError?.toast),
  }
}
