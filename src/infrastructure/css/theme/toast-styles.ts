/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The toast region and its toasts — every toast the page raises, the palette's
 * dark-mode confirmation among them.
 *
 * A toast with no variant, and a loading one, is an ink chip, as the reference
 * draws it: the inverse of everything around it, which is what makes it read as
 * floating without a second elevation step. A toast WITH a variant takes that
 * variant's roles, the ones the inline alerts use: an `error` (or `destructive`)
 * toast is drawn in the error roles, a `success`, `warning` or `info` toast in
 * its own. A failure that looked exactly like the confirmation beside it would
 * be read as one.
 *
 * The region's distance from the bottom edge is set HERE, for every builder
 * that pins it to the corner (the island toaster, the client toast, the inline
 * toast runtime and the hosted form's flash): 16px, or clear above the
 * floating "Built with Sovrium" badge when the page shows it, so a toast never
 * covers the badge. The builders write no `bottom` of their own, which an
 * inline style would make impossible to move. A region the page draws in its
 * own flow is not positioned, and `bottom` does nothing to it.
 *
 * Every rule sits in the components layer, under the utilities: the classes
 * `design.components.toast` puts on a toast (`parts.root` on every toast,
 * `variants.<variant>.root` on that variant's) must win over these defaults,
 * and an unlayered rule would beat any utility whatever its specificity.
 */
const toneRule = (variants: readonly string[], role: string): string =>
  `${variants.map((variant) => `[data-sonner-toaster] [data-toast][data-variant='${variant}']`).join(',\n      ')} {
        background-color: var(--color-${role}-bg);
        color: var(--color-${role}-fg);
        border-color: var(--color-${role}-border);
      }`

const TOAST_RULES = `@layer components {
      [data-sonner-toaster] {
        display: flex;
        flex-direction: column;
        gap: 8px;
        bottom: 16px;
      }

      body:has([data-sovrium-badge='floating']) [data-sonner-toaster] {
        bottom: 3.5rem;
      }

      [data-sonner-toaster] [data-toast] {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        background-color: var(--foreground);
        color: var(--background);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-lg);
        font-size: var(--text-sm);
        line-height: var(--text-sm--line-height);
      }

      ${toneRule(['error', 'destructive'], 'error')}

      ${toneRule(['success'], 'success')}

      ${toneRule(['warning'], 'warning')}

      ${toneRule(['info'], 'info')}
    }`

/**
 * Generate the toast stylesheet. Plain CSS because the toasts are built by
 * runtime code, and it flows through both compile engines like
 * `generateCalendarStyles()`.
 */
export function generateToastStyles(): string {
  return ['/* ── Toasts ── */', TOAST_RULES].join('\n\n    ')
}
