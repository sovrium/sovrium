/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Component } from '@/domain/models/app/pages/components'

/**
 * True when a `command-palette` is in SEARCH mode, and therefore mounts the
 * `command-palette` island instead of shipping the built-in inline runtime.
 *
 * `command-palette` is deliberately NOT in `ISLAND_COMPONENT_TYPES`: the
 * built-in quick-action mode builds its overlay from a synchronous inline
 * script and mounts nothing, and it is appended to EVERY page — listing the
 * type would build the island bundle and inject its hydration `<script>` for
 * every page of every app.
 *
 * Shared by the TWO call-sites that must agree, exactly as `isSourcedSidebar`
 * is: the page renderer's `selfNeedsIslands` (BUILD the bundle) and
 * `PageIslandDetection`'s `itemSelfNeedsIslands` (INJECT the script). If they
 * diverge, the bundle is built with no script tag (the overlay never opens) or
 * the script tag 404s.
 */
export function isSearchPalette(component: Component): boolean {
  if (component.type !== 'command-palette') return false
  return (component as { readonly search?: unknown }).search !== undefined
}

/**
 * True when a `sidebar` carries at least one navigation group.
 *
 * The mobile drawer toggle keys on such a sidebar: at a viewport where the
 * sidebar is hidden, the burger is the only way into the app's navigation, so
 * the toggle must ship whenever the navigation does — and NOT ride inside the
 * command palette's script, which a page may legitimately not carry at all.
 */
export function isNavigationSidebar(component: Component): boolean {
  if (component.type !== 'sidebar') return false
  const { groups } = component as { readonly groups?: unknown }
  return Array.isArray(groups) && groups.length > 0
}
