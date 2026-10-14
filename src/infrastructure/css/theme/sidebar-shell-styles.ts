/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The row a SHELL sidebar stands in: a sidebar that folds, stands on the
 * right, or is framed as a floating or inset panel lays its parent out as a
 * row, so it sits BESIDE the content written next to it, and that content
 * takes the width the sidebar gives back when it folds — shadcn/ui's
 * SidebarProvider and SidebarInset, without a wrapper the author must write.
 *
 * Plain CSS because the rule styles the sidebar's PARENT, which no utility on
 * the sidebar can reach. Zero specificity (`:where`), so an author's class on
 * the parent still wins.
 */
const SIDEBAR_SHELL_RULES = `:where(:has(> [data-sidebar-shell])) {
      display: flex;
      align-items: stretch;
    }

    :where(:has(> [data-sidebar-shell])) > :where(:not([data-sidebar-shell])) {
      flex: 1 1 0%;
      min-width: 0;
    }`

/** Generate the shell sidebar's row stylesheet. */
export function generateSidebarShellStyles(): string {
  return ['/* ── Sidebar shell ── */', SIDEBAR_SHELL_RULES].join('\n\n    ')
}
