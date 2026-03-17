/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { lazy } from 'react'

/**
 * Island component registry — maps island type names to lazy-loaded React components.
 *
 * Using React.lazy() enables automatic code splitting when combined with
 * Bun.build({ splitting: true }). Each island and its unique dependencies
 * are extracted into separate chunks, so pages only download code for the
 * island types they actually use.
 *
 * To add a new island type:
 * 1. Create the component in src/presentation/islands/
 * 2. Add a lazy import entry here
 * 3. Add the SSR placeholder in island-components.tsx
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Island props vary by type
export const ISLANDS: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  'data-table': lazy(() => import('./data-table-island')),
  'search-input': lazy(() => import('./search-island')),
}

/**
 * Set of island type names, used by SSR to determine which sections
 * need island placeholders instead of static rendering.
 */
export const ISLAND_TYPES = new Set(Object.keys(ISLANDS))
