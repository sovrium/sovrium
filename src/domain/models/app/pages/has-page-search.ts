/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { componentTreeHasMatch } from './component-tree-has-type'
import type { App } from '@/domain/models/app'

/**
 * A `search-input` whose scope is the PAGE — the only shape that needs an index.
 *
 * Not a type-name test any more. `search-input` absorbed the retired
 * `pageSearch` and `searchInput` types, and only one of its two scopes reads a
 * prebuilt index: `scope: 'subscribers'` publishes its query to sibling
 * components and touches no index at all. Matching the type alone would make
 * every bound-filter input in the corpus build a search index at boot.
 */
const isPageScopedSearch = (node: Readonly<Record<string, unknown>>): boolean =>
  node['type'] === 'search-input' && node['scope'] === 'page'

export const hasPageSearchComponent = (app: App): boolean =>
  componentTreeHasMatch(app, isPageScopedSearch)
