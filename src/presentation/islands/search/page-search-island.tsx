/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useMemo } from 'react'
import { cn } from '@/presentation/design/class-merge'
import { SearchLucideGlyph } from '@/presentation/design/control-glyphs'
import {
  computeInputGroupAddonClasses,
  computeInputGroupClasses,
  computeInputGroupFieldClasses,
} from '@/presentation/design/input-group-default-classes'
import {
  computeSearchInputItemClasses,
  computeSearchInputItemExcerptClasses,
  computeSearchInputItemTitleClasses,
  computeSearchInputResultsClasses,
  computeSearchInputRootClasses,
} from '@/presentation/design/search-input-default-classes'
import { usePageSearch } from '../page-search/use-page-search'
import type { SearchResult } from '../page-search/matcher'
import type { MouseEvent, ReactElement } from 'react'

/**
 * `page-search-island` — hydrates the SSR `<input type="search">` rendered
 * by `renderPageSearch` into a live results panel sourced from the build-time
 * `/sovrium-search/index.json` — or, under `index: 'session'`, from
 * `GET /api/search/pages` per query. Matching logic lives in
 * {@link ./page-search/matcher}; the state machine lives in
 * {@link ./page-search/use-page-search}. This file is the render layer only.
 *
 * Behaviour (drives `[internal ref]-*`): debounced (150ms) search
 * on every keystroke; `Escape` clears + collapses; `Enter` navigates to the
 * first result; outside-click collapses (preserving the query). Each option
 * shows the page `title` (bold) followed by the body `excerpt`, both rendered
 * as plain-text React children — never `dangerouslySetInnerHTML`.
 *
 * The input is a `combobox` (the ARIA 1.2 pattern shadcn's Combobox follows):
 * `aria-expanded` and `aria-controls` are combobox states, which a bare search
 * box may not carry.
 *
 * Drawn on shadcn/ui's anatomy: the box is one `InputGroup` with a magnifier
 * in an addon at its start (the same box the server drew), and the results
 * open under it on the popover surface as command-style rows
 * (`search-input-default-classes.ts`).
 */
interface PageSearchIslandProps {
  readonly placeholder?: string
  readonly maxResults?: number
  /** `'session'` — ask the server per query for the pages this reader may open. */
  readonly index?: 'session'
  readonly id?: string
  readonly className?: string
  readonly 'data-testid'?: string
}

// ── Results panel + option subcomponents ─────────────────────────────────────

interface PageSearchResultsPanelProps {
  readonly results: ReadonlyArray<SearchResult>
  readonly onNavigate: (url: string) => void
}

function PageSearchResultsPanel({
  results,
  onNavigate,
}: PageSearchResultsPanelProps): ReactElement {
  return (
    <ul
      id="page-search-listbox"
      role="listbox"
      data-slot="search-input-results"
      className={computeSearchInputResultsClasses()}
    >
      {results.map((result) => (
        <PageSearchResultOption
          key={result.url}
          result={result}
          onNavigate={onNavigate}
        />
      ))}
    </ul>
  )
}

interface PageSearchResultOptionProps {
  readonly result: SearchResult
  readonly onNavigate: (url: string) => void
}

function PageSearchResultOption({ result, onNavigate }: PageSearchResultOptionProps): ReactElement {
  const handleClick = useCallback(
    (e: MouseEvent<HTMLLIElement | HTMLAnchorElement>): void => {
      e.preventDefault()
      onNavigate(result.url)
    },
    [onNavigate, result.url]
  )

  return (
    <li
      role="option"
      aria-selected={false}
      onClick={handleClick}
      data-slot="search-input-item"
      className={computeSearchInputItemClasses()}
    >
      <a
        href={result.url}
        onClick={handleClick}
        className="contents"
      >
        <span className={computeSearchInputItemTitleClasses()}>{result.title}</span>
        <span className={computeSearchInputItemExcerptClasses()}>{result.excerpt}</span>
      </a>
    </li>
  )
}

/** The magnifier in an addon at the group's start, hidden from assistive technology. */
function SearchMark(): ReactElement {
  return (
    <div
      data-slot="input-group-addon"
      data-align="inline-start"
      className={computeInputGroupAddonClasses({ align: 'inline-start' })}
    >
      <SearchLucideGlyph />
    </div>
  )
}

// ── Top-level component ──────────────────────────────────────────────────────

export default function PageSearchIsland({
  placeholder,
  maxResults,
  index,
  id,
  className,
  'data-testid': testId,
}: PageSearchIslandProps): ReactElement {
  const effectivePlaceholder = placeholder ?? 'Search...'
  const effectiveMaxResults = useMemo(
    () => (typeof maxResults === 'number' && maxResults > 0 ? maxResults : 10),
    [maxResults]
  )

  const { query, results, isOpen, containerRef, onChange, onKeyDown, onNavigate } = usePageSearch(
    effectiveMaxResults,
    index === 'session'
  )
  const listed = isOpen && results.length > 0

  return (
    <div
      ref={containerRef}
      id={id}
      className={cn(computeSearchInputRootClasses(), className)}
      data-testid={testId}
    >
      <div
        role="group"
        data-slot="input-group"
        className={computeInputGroupClasses()}
      >
        <input
          type="search"
          role="combobox"
          value={query}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder={effectivePlaceholder}
          aria-label={effectivePlaceholder}
          aria-autocomplete="list"
          aria-controls={listed ? 'page-search-listbox' : undefined}
          aria-expanded={isOpen}
          data-slot="input-group-control"
          className={computeInputGroupFieldClasses()}
        />
        <SearchMark />
      </div>
      {listed && (
        <PageSearchResultsPanel
          results={results}
          onNavigate={onNavigate}
        />
      )}
    </div>
  )
}
