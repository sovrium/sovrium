/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The ONE dismissal policy every client-side toast renderer resolves through.
 *
 * Two renderers raise a `[data-sonner-toaster]` toast — `runtime/toast.ts` (the
 * shared island renderer) and `client.ts#showToast` (the richer variant, which
 * wraps the message in a `<span>` and can render an action button). They must
 * not import each other: `client.ts` is the always-loaded client bundle, so
 * pulling the island renderer into it would be a payload regression. This
 * module is therefore the seam they share — a pure function over three inputs,
 * no DOM, importable from both without dragging anything behind it.
 *
 * THE POLICY, in precedence order:
 *
 *  1. An explicit positive `duration` wins outright. It wins even over the
 *     error and action clauses below, because those govern the DEFAULT only —
 *     otherwise "duration is honoured" would be false in exactly the place an
 *     author took the trouble to write one.
 *  2. Otherwise an `error` / `destructive` toast persists. A failure the
 *     operator never read is a failure that did not happen.
 *  3. Otherwise a toast carrying an action button persists. Expiring a control
 *     out from under a reader is worse than leaving it up.
 *  4. Otherwise: {@link DEFAULT_TOAST_DURATION_MS}.
 *
 * The 5000 is not invented here. It is what the config schema has documented
 * all along — `toast.duration`'s `(default: 5000)` in `pages/toasts.ts`,
 * `components/action-fetch.ts` and `components/action-response.ts` — and what
 * the published docs state in the `toast` table of `overlay-components.md`.
 * This module makes the renderers agree with the documentation; it does not
 * choose a new number.
 */

/** The documented auto-dismiss delay, in milliseconds, when none is declared. */
export const DEFAULT_TOAST_DURATION_MS = 5000

/**
 * Variants that wait to be dismissed instead of expiring.
 *
 * Both names are live: `error` is the standalone `ToastVariantSchema` spelling,
 * `destructive` the component-library spelling the fetch-response variant adds.
 */
const PERSISTENT_VARIANTS: ReadonlySet<string> = new Set(['error', 'destructive'])

/** What a renderer knows about a toast at the moment it schedules dismissal. */
export interface ToastDismissalInput {
  /** The author's explicit `duration`, in milliseconds, if they wrote one. */
  readonly duration?: number
  /** The toast's `variant`, if any. */
  readonly variant?: string
  /** Whether this toast actually renders an action button. */
  readonly hasAction?: boolean
}

/**
 * Resolve how long a toast stays on screen.
 *
 * @returns a positive millisecond delay, or `undefined` for "persist — arm no
 * timer at all". `undefined` rather than `0` or `Infinity` so a caller cannot
 * accidentally pass the result to `setTimeout` and dismiss instantly.
 */
export function resolveToastDuration(input: ToastDismissalInput): number | undefined {
  if (typeof input.duration === 'number' && input.duration > 0) return input.duration
  if (input.variant !== undefined && PERSISTENT_VARIANTS.has(input.variant)) return undefined
  if (input.hasAction === true) return undefined
  return DEFAULT_TOAST_DURATION_MS
}
