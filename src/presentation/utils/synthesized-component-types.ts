/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Component types that are **never schema-authored** — they are synthesized at
 * render time and injected into a page's component tree by the renderer:
 *
 * - `command-palette` — appended to every page by `render-page` so the global
 *   `Cmd+K` palette is available app-wide.
 * - `favorites-button` — injected into single-record-bound containers by
 *   `data-source-resolver`.
 *
 * Any "does this page have authored content?" predicate must filter these out,
 * otherwise the always-appended `command-palette` makes every page look
 * non-empty (e.g. it would spuriously emit the scroll-animation script onto a
 * page whose schema declares `components: []`).
 */
export const SYNTHESIZED_COMPONENT_TYPES: ReadonlySet<string> = new Set([
  'command-palette',
  'favorites-button',
])

/**
 * Returns `true` when the component type was authored in the app schema (i.e.
 * is NOT one of the render-time-synthesized types).
 */
export const isSchemaAuthoredComponent = (type: string): boolean =>
  !SYNTHESIZED_COMPONENT_TYPES.has(type)
