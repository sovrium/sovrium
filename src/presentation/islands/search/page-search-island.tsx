/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useMemo } from 'react'
import { cn } from '@/presentation/design/class-merge'
import { usePageSearch } from '../page-search/use-page-search'
import type { SearchResult } from '../page-search/matcher'
import type { MouseEvent, ReactElement } from 'react'

/**
 * `page-search-island` — hydrates the SSR `<input type="search">` rendered
 * by `renderPageSearch` into a live results panel sourced from the build-time
 * `/sovrium-search/index.json`. Matching logic lives in
 * {@link ./page-search/matcher}; the state machine lives in
 * {@link ./page-search/use-page-search}. This file is the render layer only.
 *
 * Behaviour (drives `[internal ref]-*`): debounced (150ms) search
 * on every keystroke; `Escape` clears + collapses; `Enter` navigates to the
 * first result; outside-click collapses (preserving the query). Each option
 * shows the page `title` (bold) followed by the body `excerpt`, both rendered
 * as plain-text React children — never `dangerouslySetInnerHTML`.
 */
interface PageSearchIslandProps {
  readonly placeholder?: string
  readonly maxResults?: number
  readonly id?: string
  readonly className?: string
  readonly 'data-testid'?: string
}

interface PanelInlineStyles {
  readonly container: React.CSSProperties
  readonly input: React.CSSProperties
  readonly panel: React.CSSProperties
  readonly option: React.CSSProperties
  readonly optionTitle: React.CSSProperties
  readonly optionExcerpt: React.CSSProperties
}

// Inline styles (not Tailwind) so the island renders correctly even on host
// pages that don't ship Sovrium's compiled CSS. Colors reference the DS theme
// CSS variables with literal fallbacks — `var(--color-X, <fallback>)` — so the
// surface is theme-aware when Sovrium's CSS is present (a `theme.colors`
// override recolors it) yet still paints a sensible default on a bare host
// page. Same SSR-safe pattern the chart island uses for its SVG strokes.
// Operators can further override via plain CSS targeting
// `[data-island="search-input"]` selectors.
const STYLES: PanelInlineStyles = {
  container: { position: 'relative', width: '100%' },
  input: {
    width: '100%',
    padding: '0.5rem',
    boxSizing: 'border-box',
    background: 'var(--color-background, white)',
    color: 'var(--color-foreground, inherit)',
    border: '1px solid var(--color-border, rgba(0, 0, 0, 0.12))',
    borderRadius: '0.25rem',
  },
  panel: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    margin: 0,
    padding: 0,
    listStyle: 'none',
    background: 'var(--color-background-raised, white)',
    border: '1px solid var(--color-border, rgba(0, 0, 0, 0.12))',
    borderRadius: '0.25rem',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
    maxHeight: '24rem',
    overflowY: 'auto',
    zIndex: 50,
  },
  option: {
    padding: '0.5rem 0.75rem',
    cursor: 'pointer',
    borderBottom: '1px solid var(--color-border, rgba(0, 0, 0, 0.06))',
  },
  optionTitle: {
    display: 'block',
    fontWeight: 600,
    marginBottom: '0.125rem',
    color: 'var(--color-foreground, inherit)',
  },
  optionExcerpt: {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    fontSize: '0.875rem',
    color: 'var(--color-foreground-muted, rgba(0, 0, 0, 0.65))',
  },
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
      style={STYLES.panel}
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
      style={STYLES.option}
    >
      <a
        href={result.url}
        onClick={handleClick}
      >
        <span style={STYLES.optionTitle}>{result.title}</span>
        <span style={STYLES.optionExcerpt}>{result.excerpt}</span>
      </a>
    </li>
  )
}

// ── Top-level component ──────────────────────────────────────────────────────

export default function PageSearchIsland({
  placeholder,
  maxResults,
  id,
  className,
  'data-testid': testId,
}: PageSearchIslandProps): ReactElement {
  const effectivePlaceholder = placeholder ?? 'Search...'
  const effectiveMaxResults = useMemo(
    () => (typeof maxResults === 'number' && maxResults > 0 ? maxResults : 10),
    [maxResults]
  )

  const { query, results, isOpen, containerRef, onChange, onKeyDown, onNavigate } =
    usePageSearch(effectiveMaxResults)

  return (
    <div
      ref={containerRef}
      id={id}
      className={cn(className)}
      data-testid={testId}
      style={STYLES.container}
    >
      <input
        type="search"
        value={query}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={effectivePlaceholder}
        aria-label={effectivePlaceholder}
        aria-autocomplete="list"
        aria-controls={isOpen ? 'page-search-listbox' : undefined}
        aria-expanded={isOpen}
        style={STYLES.input}
      />
      {isOpen && results.length > 0 && (
        <PageSearchResultsPanel
          results={results}
          onNavigate={onNavigate}
        />
      )}
    </div>
  )
}
