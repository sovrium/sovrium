/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Static SSR search-shell dispatcher for `search-input`, in both roles.
 *
 * Both render a plain server-side `<input type="search">` rather than an
 * island, and both read TOP-LEVEL schema fields — siblings of `props`, not
 * entries inside it — so they share the `component[...]` lookup contract used
 * by the other top-level-fielded components (textarea, time-picker, …). See
 * the `pickFromComponent` doc-comment in `island-form-components.tsx`.
 *
 * Split out of `interactive-components.ts` to keep that registry under its
 * size ceiling; spread back into it so the dispatch table stays single-source.
 */

import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import * as Renderers from '../elements'
import type { ComponentRenderer, DispatchableComponentType } from './component-dispatch-config'

export const searchShellComponents: Partial<Record<DispatchableComponentType, ComponentRenderer>> =
  {
    // ONE entry for both search scopes: the registry is keyed by `type`, and
    // `searchInput` + `pageSearch` are now one `search-input` type whose `scope`
    // names the mechanism.
    //
    // A box that declares `publishes: { bindTo, param }` instead (no scope)
    // takes the same shell; the renderer stamps the channel on its `<input>`,
    // where the vanilla runtime (`search-input-publisher.ts`) sends each
    // debounced query on the channel.
    //
    // `scope: 'page'` is the static-public-pages search shell. `placeholder` and
    // `maxResults` are serialized into the `data-island-props` JSON so the React
    // island can pick them up after hydration.
    //
    // A box declares `scope: page` or `publishes` (one of the two, at load).
    // The fallback is the publishing box rather than a throw: a renderer is not
    // a validation seam, and drawing the lighter of the two loses least.
    'search-input': ({ elementProps, component, currentLang, languages }) => {
      const c = (component ?? {}) as Record<string, unknown>
      const defaultPlaceholder = resolveInterpreterString(
        'search.placeholder',
        currentLang,
        languages
      )
      if (c['scope'] === 'page') {
        const placeholder = (c['placeholder'] as string | undefined) ?? defaultPlaceholder
        const maxResults = c['maxResults'] as number | undefined
        // `index: 'session'` asks the server per query instead of reading the
        // static public index; anything else — including an omitted key — is
        // the public index.
        const sessionIndex = c['index'] === 'session'
        return Renderers.renderPageSearch({
          props: elementProps,
          placeholder,
          maxResults,
          sessionIndex,
        })
      }
      const debounceMs = c['debounceMs'] as number | undefined
      const minQueryLength = c['minQueryLength'] as number | undefined
      return Renderers.renderSearchInput({
        props: elementProps,
        debounceMs,
        minQueryLength,
        defaultPlaceholder,
        defaultLabel: resolveInterpreterString('search.label', currentLang, languages),
        placeholder: c['placeholder'] as string | undefined,
        publishes: c['publishes'],
      })
    },
  }
