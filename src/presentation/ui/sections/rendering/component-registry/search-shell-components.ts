/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Static SSR search-shell dispatchers (`searchInput`, `pageSearch`).
 *
 * Both render a plain server-side `<input type="search">` rather than an
 * island, and both read TOP-LEVEL schema fields — siblings of `props`, not
 * entries inside it — so they share the `component[...]` lookup contract used
 * by the other top-level-fielded components (textarea, time-picker, …). See
 * the `pickFromComponent` doc-comment in `island-form-components.tsx`.
 *
 * Split out of `interactive-components.ts` to keep that registry under its
 * size ceiling; spread back into it so the dispatch table stays single-source.
 *
 * NOT to be confused with `component-search-bar.tsx`, which renders the
 * (currently non-functional) search bar for data-bound calendar / kanban.
 */

import * as Renderers from '../../renderers/element-renderers'
import type { ComponentRenderer, DispatchableComponentType } from '../component-dispatch-config'

export const searchShellComponents: Partial<Record<DispatchableComponentType, ComponentRenderer>> =
  {
    // `searchInput` publishes its value to bound subscribers. `debounceMs` and
    // `minQueryLength` govern how those SUBSCRIBERS consume the query; the
    // renderer stamps them onto the inner `<input>` where the subscribing island
    // reads them back (see `islands/search/search-query-binding.ts`).
    searchInput: ({ elementProps, component }) => {
      const c = (component ?? {}) as Record<string, unknown>
      const debounceMs = c['debounceMs'] as number | undefined
      const minQueryLength = c['minQueryLength'] as number | undefined
      return Renderers.renderSearchInput({ props: elementProps, debounceMs, minQueryLength })
    },

    // `pageSearch` is the static-public-pages search shell. `placeholder` and
    // `maxResults` are serialized into the `data-island-props` JSON so the React
    // island can pick them up after hydration.
    pageSearch: ({ elementProps, component }) => {
      const c = (component ?? {}) as Record<string, unknown>
      const placeholder = c['placeholder'] as string | undefined
      const maxResults = c['maxResults'] as number | undefined
      return Renderers.renderPageSearch({ props: elementProps, placeholder, maxResults })
    },
  }
