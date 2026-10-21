/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Why a control is disabled on its record (`disabledWhen` / `disabledReason`),
 * drawn the same on every surface that draws one: a button field's cell, a row
 * action, a `button` placed on a record. It lives in `design/` because the
 * server-rendered button and the grid islands both draw it.
 *
 * The control stays a real, focusable `<button>` marked `aria-disabled`, never
 * natively `disabled`, so the keyboard still reaches it and it can explain
 * itself. The reason is said twice, for two readers: an always-present,
 * visually hidden node the control names as its description
 * (`aria-describedby`), announced without a pointer; and a tooltip shown while
 * the control's wrapper is hovered or holds the focus. No JavaScript decides
 * either: a page whose runtime has not loaded still explains a disabled control.
 */

import type { DisabledVerdict } from './disabled-verdict'
import type { ReactElement, ReactNode } from 'react'

/** The wrapper a disabled control and its reason sit in: the tooltip's anchor. */
export const DISABLED_CONTROL_WRAPPER_CLASSES = 'group/disabled relative inline-flex'

/**
 * The tooltip, shadcn's tooltip anatomy (`bg-foreground text-background`,
 * `text-xs`, `rounded-md`, `px-3 py-1.5`), shown only on hover and on focus.
 */
const TOOLTIP_CLASSES =
  'bg-foreground text-background pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 hidden w-max max-w-64 -translate-x-1/2 rounded-md px-3 py-1.5 text-xs whitespace-normal text-balance group-focus-within/disabled:block group-hover/disabled:block'

/** The attributes a control disabled on its record carries. */
export const disabledControlAttributes = (
  reasonId: string | undefined
): Readonly<Record<string, string>> => ({
  'aria-disabled': 'true',
  ...(reasonId === undefined ? {} : { 'aria-describedby': reasonId }),
})

/** The hidden description and the tooltip of a disabled control, or nothing without a reason. */
export function renderDisabledReason(reasonId: string, reason: string | undefined): ReactNode {
  if (reason === undefined || reason === '') return undefined
  return (
    <>
      <span
        id={reasonId}
        className="sr-only"
      >
        {reason}
      </span>
      <span
        role="tooltip"
        className={TOOLTIP_CLASSES}
      >
        {reason}
      </span>
    </>
  )
}

/**
 * A disabled control with its reason: `control` is the `<button>` already
 * carrying {@link disabledControlAttributes}, wrapped with what it says.
 */
export function renderDisabledControl(
  control: ReactElement,
  reasonId: string,
  reason: string | undefined
): ReactElement {
  return (
    <span className={DISABLED_CONTROL_WRAPPER_CLASSES}>
      {control}
      {renderDisabledReason(reasonId, reason)}
    </span>
  )
}

/**
 * The attributes a control adds for its record's verdict
 * (`disabled-verdict.ts`): {@link disabledControlAttributes} when the record
 * disables it, nothing when it is usable.
 */
export const verdictAttributes = (
  verdict: DisabledVerdict | undefined,
  reasonId: string
): Readonly<Record<string, string>> =>
  verdict === undefined ? {} : disabledControlAttributes(verdict.reason ? reasonId : undefined)

/**
 * `control` as its record's verdict draws it: wrapped with its reason
 * ({@link renderDisabledControl}) when the record disables it, as it is when
 * usable. `control` carries {@link verdictAttributes} for the same verdict.
 */
export const withVerdict = (
  control: ReactElement,
  verdict: DisabledVerdict | undefined,
  reasonId: string
): ReactElement =>
  verdict === undefined ? control : renderDisabledControl(control, reasonId, verdict.reason)
