/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useId, useMemo } from 'react'
import { cn } from '@/presentation/design/class-merge'
import { SearchLucideGlyph } from '@/presentation/design/control-glyphs'
import {
  computeInputGroupAddonClasses,
  computeInputGroupClasses,
  computeInputGroupFieldClasses,
} from '@/presentation/design/input-group-default-classes'
import { computeSearchInputRootClasses } from '@/presentation/design/search-input-default-classes'
import { PageSearchPanels } from './page-search-panels'
import { ENGLISH_WORDS, optionId, type PageSearchWords } from './page-search-words'
import { usePageSearch, type PageSearchSource } from './use-page-search'
import type { ReactElement } from 'react'

/**
 * `page-search-island` — hydrates the SSR `<input type="search">` rendered
 * by `renderPageSearch` into a live results panel sourced from the build-time
 * `/sovrium-search/index.json` — or, under `index: 'session'`, from
 * `GET /api/search/pages` per query. Matching logic lives in
 * {@link ./page-search-matcher}; the state machine lives in
 * {@link ./use-page-search}. This file is the render layer only.
 *
 * Behaviour: debounced (150ms) search on every keystroke; the arrow keys move
 * a highlighted result the field names as its active descendant, `Enter`
 * opens it (the first when none is), `Escape` collapses then clears
 * (`page-search-keys.ts`); outside-click collapses (preserving the query). A
 * query nothing matches opens the panel on one line naming it, a pending
 * session query says it is searching while the previous results stay listed,
 * and a polite status announces how many results are listed. Each option
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
  readonly words?: PageSearchWords
  readonly maxResults?: number
  /** `'session'` — ask the server per query for the pages this reader may open. */
  readonly index?: 'session'
  /** The collection page whose articles alone a session query searches (the docs sidebar). */
  readonly page?: string
  readonly id?: string
  readonly className?: string
  readonly 'data-testid'?: string
}

// ── Top-level component ──────────────────────────────────────────────────────

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

/** The index the box reads, and how many results it lists (ten unless the author says). */
function useSearchSource(
  maxResults: number | undefined,
  index: 'session' | undefined,
  page: string | undefined
): PageSearchSource {
  return useMemo(
    () => ({
      maxResults: typeof maxResults === 'number' && maxResults > 0 ? maxResults : 10,
      sessionIndex: index === 'session',
      page,
    }),
    [maxResults, index, page]
  )
}

export default function PageSearchIsland({
  placeholder,
  words = ENGLISH_WORDS,
  maxResults,
  index,
  page,
  id,
  className,
  'data-testid': testId,
}: PageSearchIslandProps): ReactElement {
  const effectivePlaceholder = placeholder ?? 'Search...'
  const listboxId = `${useId()}-listbox`
  const controller = usePageSearch(useSearchSource(maxResults, index, page))
  const { query, results, isOpen, active, containerRef, onChange, onKeyDown } = controller
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
          aria-controls={listed ? listboxId : undefined}
          aria-activedescendant={listed && active >= 0 ? optionId(listboxId, active) : undefined}
          aria-expanded={isOpen}
          data-slot="input-group-control"
          className={computeInputGroupFieldClasses()}
        />
        <SearchMark />
      </div>
      <PageSearchPanels
        controller={controller}
        listboxId={listboxId}
        words={words}
      />
    </div>
  )
}
