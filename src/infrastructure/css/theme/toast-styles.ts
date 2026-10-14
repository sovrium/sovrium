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
 * An ink chip, as the reference draws it: the inverse of everything around it,
 * which is what makes it read as floating without a second elevation step.
 *
 * The region's distance from the bottom edge is set HERE, for every builder
 * that pins it to the corner (the island toaster, the client toast, the inline
 * toast runtime and the hosted form's flash): 16px, or clear above the
 * floating "Built with Sovrium" badge when the page shows it, so a toast never
 * covers the badge. The builders write no `bottom` of their own, which an
 * inline style would make impossible to move. A region the page draws in its
 * own flow is not positioned, and `bottom` does nothing to it.
 */
const TOAST_RULES = `[data-sonner-toaster] {
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
    }`

/**
 * Generate the toast stylesheet. Plain CSS because the toasts are built by
 * runtime code with no class attribute to hang a utility on, and it flows
 * through both compile engines like `generateCalendarStyles()`.
 */
export function generateToastStyles(): string {
  return ['/* ── Toasts ── */', TOAST_RULES].join('\n\n    ')
}
