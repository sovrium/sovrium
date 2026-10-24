/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { SearchLucideGlyph } from '@/presentation/design/control-glyphs'
import {
  computeInputGroupAddonClasses,
  computeInputGroupClasses,
  computeInputGroupFieldClasses,
} from '@/presentation/design/input-group-default-classes'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { computeSearchInputRootClasses } from '@/presentation/design/search-input-default-classes'
import { hostComponentType } from '@/presentation/render/registry/island-host-attributes'
import type { ElementProps } from './html-element-renderer'

/**
 * The search box itself, shared by both scopes: shadcn/ui's `InputGroup` — one
 * bordered box — with a magnifier in an addon at its start and the search
 * input as its control.
 */
function searchInputGroup(input: ReactElement): ReactElement {
  return (
    <div
      role="group"
      data-slot="input-group"
      className={computeInputGroupClasses()}
    >
      {input}
      <div
        data-slot="input-group-addon"
        data-align="inline-start"
        className={computeInputGroupAddonClasses({ align: 'inline-start' })}
      >
        <SearchLucideGlyph />
      </div>
    </div>
  )
}

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
  /** The accessible name when the author declares no placeholder, in the page language. */
  readonly defaultLabel?: string
  /** The schema's top-level `placeholder`, read after `props.placeholder`. */
  readonly placeholder?: string
  /**
   * The shared-filter channel the box publishes on (`publishes`), with the
   * subscriber ids the page stamped as `controls`.
   */
  readonly publishes?: unknown
}

/** `publishes` as the `<input>` attributes the vanilla publisher and late subscribers read. */
function publisherAttributes(publishes: unknown): Record<string, string | undefined> {
  if (typeof publishes !== 'object' || publishes === null) return {}
  const { bindTo, param, controls, url } = publishes as Record<string, unknown>
  if (typeof bindTo !== 'string' || typeof param !== 'string') return {}
  return {
    'data-publishes-bind-to': bindTo,
    'data-publishes-param': param,
    'data-publishes-url': url === true ? 'true' : undefined,
    'aria-controls': typeof controls === 'string' && controls !== '' ? controls : undefined,
  }
}

/**
 * Renders a search input container with an inner input element.
 *
 * The component uses props.id as the container id and renders an input
 * element inside. This pattern allows selectors like `#search-bar input`
 * to locate the input element within the named search container.
 *
 * The container is the search box's root (`data-slot="search-input"`) and
 * holds one shadcn/ui input group: the magnifier in an addon at its start and
 * the input as the group's control, so a bare publishing box renders as a peer
 * of the other input groups without the author spelling any Tailwind classes. The
 * author's className is merged onto the root through `resolveClasses`, so it
 * beats the recipe on any same-property conflict.
 *
 * `debounceMs` / `minQueryLength` are stamped onto the INNER `<input>` as
 * `data-search-debounce` / `data-search-min-length`, beside the channel it
 * publishes on — the subscriber reads all of them off the input it hears. Each attribute is emitted ONLY when the author declared the
 * field: an absent attribute means "0", and the reading subscriber owns that
 * default. Stamping a phantom fallback here would make the markup claim a
 * behaviour the config never asked for.
 */
export function renderSearchInput(config: RenderSearchInputConfig): ReactElement {
  const {
    props,
    debounceMs,
    minQueryLength,
    defaultPlaceholder = 'Search...',
    defaultLabel = 'Search',
  } = config
  const id = props.id as string | undefined
  const placeholder = (props.placeholder as string | undefined) ?? config.placeholder
  const ariaLabel = props['aria-label'] as string | undefined
  const className = props.className as string | undefined
  const testId = props['data-testid'] as string | undefined

  return (
    <div
      id={id}
      className={resolveClasses(computeSearchInputRootClasses(), className)}
      data-testid={testId}
      data-slot="search-input"
    >
      {searchInputGroup(
        <input
          type="search"
          placeholder={placeholder ?? defaultPlaceholder}
          aria-label={ariaLabel ?? placeholder ?? defaultLabel}
          data-slot="input-group-control"
          className={computeInputGroupFieldClasses()}
          {...publisherAttributes(config.publishes)}
          data-search-debounce={debounceMs === undefined ? undefined : String(debounceMs)}
          data-search-min-length={minQueryLength === undefined ? undefined : String(minQueryLength)}
        />
      )}
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

  // The SSR shell draws the island's own box — the same input group — so the
  // field does not move or restyle when the island mounts and replaces it.
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
      className={resolveClasses(computeSearchInputRootClasses(), className)}
      data-testid={testId}
      data-slot="search-input"
      data-island="search-input"
      data-component-type={hostComponentType(props)}
      data-island-props={propsJson}
    >
      {searchInputGroup(
        <input
          type="search"
          placeholder={effectivePlaceholder}
          aria-label={effectivePlaceholder}
          data-slot="input-group-control"
          className={computeInputGroupFieldClasses()}
        />
      )}
    </div>
  )
}
