/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'
import { cn } from '@/presentation/design/class-merge'
import {
  computeSearchInputItemClasses,
  computeSearchInputItemExcerptClasses,
  computeSearchInputItemTitleClasses,
  computeSearchInputResultsClasses,
} from '@/presentation/design/search-input-default-classes'
import { fill, optionId, type PageSearchWords } from './page-search-words'
import type { SearchResult } from './page-search-matcher'
import type { PageSearchController } from './use-page-search'
import type { MouseEvent, ReactElement } from 'react'

/**
 * The page search's panels: the listbox of results, the line a pending query
 * or an empty answer shows instead, and the polite status counting the
 * results. Split from `page-search-island.tsx`, which keeps the field.
 */

interface PageSearchResultsPanelProps {
  readonly listboxId: string
  readonly results: ReadonlyArray<SearchResult>
  readonly active: number
  /** The pending query's line, drawn above the results it keeps listed. */
  readonly searchingLine: string | undefined
  readonly onNavigate: (url: string) => void
}

function PageSearchResultsPanel({
  listboxId,
  results,
  active,
  searchingLine,
  onNavigate,
}: PageSearchResultsPanelProps): ReactElement {
  return (
    <ul
      id={listboxId}
      role="listbox"
      data-slot="search-input-results"
      className={computeSearchInputResultsClasses()}
    >
      {searchingLine !== undefined && (
        <li
          role="presentation"
          data-slot="search-input-searching"
          className={MESSAGE_LINE_CLASSES}
        >
          {searchingLine}
        </li>
      )}
      {results.map((result, index) => (
        <PageSearchResultOption
          key={result.url}
          id={optionId(listboxId, index)}
          highlighted={index === active}
          result={result}
          onNavigate={onNavigate}
        />
      ))}
    </ul>
  )
}

interface PageSearchResultOptionProps {
  readonly id: string
  readonly highlighted: boolean
  readonly result: SearchResult
  readonly onNavigate: (url: string) => void
}

function PageSearchResultOption({
  id,
  highlighted,
  result,
  onNavigate,
}: PageSearchResultOptionProps): ReactElement {
  const handleClick = useCallback(
    (e: MouseEvent<HTMLLIElement | HTMLAnchorElement>): void => {
      e.preventDefault()
      onNavigate(result.url)
    },
    [onNavigate, result.url]
  )

  return (
    <li
      id={id}
      role="option"
      aria-selected={highlighted}
      data-highlighted={highlighted ? '' : undefined}
      onClick={handleClick}
      data-slot="search-input-item"
      className={computeSearchInputItemClasses()}
    >
      <a
        href={result.url}
        onClick={handleClick}
        tabIndex={-1}
        className="contents"
      >
        <span className={computeSearchInputItemTitleClasses()}>{result.title}</span>
        <span className={computeSearchInputItemExcerptClasses()}>{result.excerpt}</span>
      </a>
    </li>
  )
}

/** The muted line the panel shows while it searches, or when nothing matched. */
const MESSAGE_LINE_CLASSES = 'px-2 py-1.5 text-sm text-muted-foreground'

/** The panel with no result to list: it is searching, or nothing matched the query. */
function PageSearchMessagePanel({
  pending,
  text,
}: {
  readonly pending: boolean
  readonly text: string
}): ReactElement {
  return (
    <div
      data-slot={pending ? 'search-input-searching' : 'search-input-empty'}
      className={cn(computeSearchInputResultsClasses(), MESSAGE_LINE_CLASSES)}
    >
      {text}
    </div>
  )
}

/** What the polite status reads: how many results are listed, once the answer is in. */
const statusText = (
  words: PageSearchWords,
  listed: boolean,
  pending: boolean,
  count: number
): string => {
  if (!listed || pending) return ''
  return fill(count === 1 ? words.resultCountOne : words.resultCount, 'count', String(count))
}

/** Every listed or message panel the field opens, by the search's state. */
export function PageSearchPanels({
  controller,
  listboxId,
  words,
}: {
  readonly controller: PageSearchController
  readonly listboxId: string
  readonly words: PageSearchWords
}): ReactElement {
  const { query, results, isOpen, pending, active, onNavigate } = controller
  const listed = isOpen && results.length > 0
  const message = pending ? words.searching : fill(words.noResultsFor, 'query', query.trim())
  return (
    <>
      {listed && (
        <PageSearchResultsPanel
          listboxId={listboxId}
          results={results}
          active={active}
          searchingLine={pending ? words.searching : undefined}
          onNavigate={onNavigate}
        />
      )}
      {isOpen && !listed && (
        <PageSearchMessagePanel
          pending={pending}
          text={message}
        />
      )}
      <div
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {statusText(words, listed, pending, results.length)}
      </div>
    </>
  )
}
