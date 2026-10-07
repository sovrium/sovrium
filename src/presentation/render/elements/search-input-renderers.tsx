/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { SearchGlyph } from '@/presentation/design/form-glyphs'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { hostComponentType } from '@/presentation/render/registry/island-host-attributes'
import {
  computePageSearchFieldClasses,
  computePageSearchKeyHintClasses,
  computeSearchInputContainerClasses,
  computeSearchInputFieldClasses,
  computeSearchInputIconClasses,
} from '../../design/interactive-content-default-classes'
import type { ElementProps } from './html-element-renderer'

/**
 * Configuration for {@link renderSearchInput}.
 *
 * `debounceMs` and `minQueryLength` are top-level schema fields (siblings of
 * `props`) on the `search-input` component, NOT inside `props`. The dispatcher
 * extracts them via `component.debounceMs` / `component.minQueryLength` and
 * passes them here — the same lookup contract as {@link RenderPageSearchConfig}
 * and the other top-level-fielded components (textarea, time-picker, …).
 */
export interface RenderSearchInputConfig {
  readonly props: ElementProps
  readonly debounceMs?: number
  readonly minQueryLength?: number
  /** The placeholder when the author declares none, in the page language. */
  readonly defaultPlaceholder?: string
}

/**
 * Renders a search input container with an inner input element.
 *
 * The component uses props.id as the container id and renders an input
 * element inside. This pattern allows selectors like `#search-bar input`
 * to locate the input element within the named search container.
 *
 * the prestyled-islands rule (prestyled-by-default): the container ships
 * `computeSearchInputContainerClasses()` chrome (relative + full-width on
 * focal fg tone) and the inner `<input>` ships
 * `computeSearchInputFieldClasses()` chrome (border + bg + radius + focus
 * ring) so the bare `{ type: 'search-input', scope: 'subscribers' }` schema renders as a peer of
 * the regular form `<input>` controls without the author spelling any
 * Tailwind classes. The merged className appends the author-supplied one
 * merged in via `resolveClasses`, so it beats the recipe on any same-property
 * conflict.
 *
 * `debounceMs` / `minQueryLength` are stamped onto the INNER `<input>` as
 * `data-search-debounce` / `data-search-min-length` — subscribers resolve
 * `#<id> input`, so the attributes must sit where the subscriber looks, not on
 * the container. Each attribute is emitted ONLY when the author declared the
 * field: an absent attribute means "0", and the reading subscriber owns that
 * default. Stamping a phantom fallback here would make the markup claim a
 * behaviour the config never asked for.
 */
export function renderSearchInput(config: RenderSearchInputConfig): ReactElement {
  const { props, debounceMs, minQueryLength, defaultPlaceholder = 'Search...' } = config
  const id = props.id as string | undefined
  const placeholder = props.placeholder as string | undefined
  const className = props.className as string | undefined
  const testId = props['data-testid'] as string | undefined

  const containerDefaults = computeSearchInputContainerClasses()
  const containerClassName = resolveClasses(containerDefaults, className)
  const fieldClassName = computeSearchInputFieldClasses()

  return (
    <div
      id={id}
      className={containerClassName}
      data-testid={testId}
    >
      <SearchGlyph className={computeSearchInputIconClasses()} />
      <input
        type="search"
        placeholder={placeholder ?? defaultPlaceholder}
        aria-label={placeholder ?? defaultPlaceholder}
        className={fieldClassName}
        data-search-debounce={debounceMs === undefined ? undefined : String(debounceMs)}
        data-search-min-length={minQueryLength === undefined ? undefined : String(minQueryLength)}
      />
    </div>
  )
}

/**
 * Configuration for {@link renderPageSearch}.
 *
 * `placeholder` and `maxResults` are top-level schema fields (siblings of
 * `props`) on the `search-input` component, NOT inside `props`. The
 * dispatcher extracts them via `component.placeholder` / `component.maxResults`
 * and passes them here. Same lookup contract as the other top-level-fielded
 * components (textarea, time-picker, …).
 */
export interface RenderPageSearchConfig {
  readonly props: ElementProps
  readonly placeholder?: string
  readonly maxResults?: number
  /** `index: 'session'` — the island queries `GET /api/search/pages` per keystroke. */
  readonly sessionIndex?: boolean
}

/**
 * Renders the SSR shell for a `search-input` under `scope: 'page'`.
 *
 * The presence of any page-scoped `search-input` component anywhere in
 * `app.pages[].components[]` is the activation gate for the static
 * search index (see `page-search.ts` doc-comment). This renderer emits
 * the island marker (`data-island="search-input"` + `data-island-props=...`)
 * plus a SSR `<input type="search">` so the page is visually populated
 * on first request, BEFORE the React island hydrates.
 *
 * Once hydrated, `page-search-island.tsx` replaces the static input with
 * a live results panel sourced from `/sovrium-search/index.json`. The
 * SSR markup remains visible until the lazy chunk resolves, then
 * `island-client.tsx` swaps it for the React tree. The SSR `<input>` is
 * required for COMPONENT-001 (the input must be visible on first paint
 * regardless of JS availability).
 */
export function renderPageSearch(config: RenderPageSearchConfig): ReactElement {
  const { props, placeholder, maxResults, sessionIndex } = config
  const id = props.id as string | undefined
  const className = props.className as string | undefined
  const testId = props['data-testid'] as string | undefined
  const effectivePlaceholder = placeholder ?? 'Search...'

  // The prestyled-islands rule (prestyled-by-default): the SSR shell carries the same input
  // chrome as `renderSearchInput` so the SSR page-search reads as a styled
  // input on first paint. The hydrated `page-search-island` then swaps the
  // SSR markup for its own inline-styled live panel (see PanelInlineStyles
  // in page-search-island.tsx) — the island's inline styles are required
  // because the live panel may render on a third-party host that doesn't
  // ship Sovrium's CSS. The SSR shell is the only surface this helper paints.
  const containerDefaults = computeSearchInputContainerClasses()
  const containerClassName = resolveClasses(containerDefaults, className)
  const fieldClassName = computePageSearchFieldClasses()

  const islandProps = {
    placeholder: effectivePlaceholder,
    ...(typeof maxResults === 'number' ? { maxResults } : {}),
    ...(sessionIndex === true ? { index: 'session' } : {}),
    ...(id !== undefined ? { id } : {}),
    ...(className !== undefined ? { className } : {}),
    ...(testId !== undefined ? { 'data-testid': testId } : {}),
  }
  const propsJson = JSON.stringify(islandProps)

  return (
    <div
      id={id}
      className={containerClassName}
      data-testid={testId}
      data-island="search-input"
      data-component-type={hostComponentType(props)}
      data-island-props={propsJson}
    >
      <SearchGlyph className={computeSearchInputIconClasses({ scope: 'page' })} />
      <input
        type="search"
        placeholder={effectivePlaceholder}
        aria-label={effectivePlaceholder}
        className={fieldClassName}
      />
      {/*
        The key that opens the panel, named on the control it opens. Not a
        `kbd` component: this is a hint printed on a field, and a keycap here
        would compete with the field's own border for the same 20px of edge.
      */}
      <span
        aria-hidden="true"
        className={computePageSearchKeyHintClasses()}
      >
        /
      </span>
    </div>
  )
}
