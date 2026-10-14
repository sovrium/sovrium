/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import {
  computeButtonGroupClasses,
  computeButtonGroupOrientationClasses,
} from '../../design/interactive-content-default-classes'
import {
  computePaginationEdgeClasses,
  computePaginationLinkClasses,
  PAGINATION_CLASSES,
  PAGINATION_CONTENT_CLASSES,
  PAGINATION_EDGE_LABEL_CLASSES,
  PAGINATION_ELLIPSIS_CLASSES,
} from '../../design/pagination-default-classes'
import { resolveClasses } from '../../design/resolve-classes'
import { renderIcon } from '../elements/icon-renderer'
import { resolveChildTranslation } from '../i18n/translation-handler'
import { omitInternalMarkers } from '../props/internal-marker-props'
import { renderBreadcrumb } from './breadcrumb-component'
import type { ComponentRenderer, DispatchableComponentType } from './component-dispatch-config'
import type { Languages } from '@/domain/models/app/languages'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * Renders a button-group container that wraps its children buttons.
 *
 * Uses the WAI-ARIA `role="group"` pattern with an accessible label from
 * `props.label`. Children buttons are rendered tightly together via flex +
 * negative-margin so adjacent borders merge into a single visual rule.
 */
function renderButtonGroup({
  elementProps,
  renderedChildren,
  component,
}: {
  readonly elementProps: Record<string, unknown>
  readonly renderedChildren: readonly ReactElement[]
  readonly component?: unknown
}): ReactElement {
  const orientation =
    (component as { orientation?: string } | undefined)?.orientation === 'vertical'
      ? 'vertical'
      : 'horizontal'
  const label = elementProps['label'] as string | undefined
  const {
    'data-testid': dataTestId,
    label: _label,
    'data-label': _dataLabel,
    className,
    ...rest
  } = omitInternalMarkers(elementProps) as Record<string, unknown>
  const cn = className as string | undefined
  // The prestyled-islands rule (prestyled-by-default): the button-group container ships a
  // surface chrome (rounded + subtle shadow) from
  // `computeButtonGroupClasses` AHEAD of the segmented-control rhythm
  // (a row or a column by `orientation`) so the bare `{ type: 'button-group' }`
  // renders as one cohesive shape. The author-supplied className appends
  // merged in via `resolveClasses`, so it wins same-property conflicts.
  const containerDefaults = `${computeButtonGroupOrientationClasses(orientation)} ${computeButtonGroupClasses()}`
  const containerClass = cn ? `${containerDefaults} ${cn}` : containerDefaults
  return (
    <div
      {...rest}
      role="group"
      aria-label={label}
      data-orientation={orientation}
      className={containerClass}
      data-testid={dataTestId as string | undefined}
    >
      {renderedChildren}
    </div>
  )
}

/**
 * Computes the page-number sequence shown by the pagination control.
 *
 * Always pins the first and last page; surfaces `siblingCount` neighbours on
 * each side of `currentPage`. Inserts an ellipsis sentinel between any pinned
 * boundary and the sibling window when the gap is larger than one page.
 */
export function paginationPages(
  totalPages: number,
  currentPage: number,
  siblingCount: number
): readonly (number | 'ellipsis')[] {
  if (totalPages <= 1) return totalPages === 1 ? [1] : []

  const firstPage = 1
  const lastPage = totalPages
  const leftSibling = Math.max(currentPage - siblingCount, firstPage)
  const rightSibling = Math.min(currentPage + siblingCount, lastPage)

  const rawPages: readonly number[] = [
    firstPage,
    ...Array.from({ length: rightSibling - leftSibling + 1 }, (_, i) => leftSibling + i),
    lastPage,
  ]
  const uniqueAscending = [...new Set(rawPages)].toSorted((a, b) => a - b)
  return uniqueAscending.flatMap((page, index) => {
    if (index === 0) return [page]
    const prev = uniqueAscending[index - 1] as number
    return page - prev > 1 ? ['ellipsis' as const, page] : [page]
  })
}

/** Renders a single page-number list item or an ellipsis sentinel. */
function renderPaginationEntry(
  entry: number | 'ellipsis',
  index: number,
  currentPage: number
): ReactElement {
  if (entry === 'ellipsis') {
    return (
      <li
        key={`ellipsis-${index}`}
        data-slot="pagination-item"
      >
        <span
          data-slot="pagination-ellipsis"
          aria-hidden="true"
          className={PAGINATION_ELLIPSIS_CLASSES}
        >
          ...
        </span>
      </li>
    )
  }
  const isActive = entry === currentPage
  return (
    <li
      key={entry}
      data-slot="pagination-item"
    >
      <button
        type="button"
        data-slot="pagination-link"
        aria-current={isActive ? 'page' : undefined}
        data-active={isActive ? '' : undefined}
        className={computePaginationLinkClasses(isActive)}
      >
        {entry}
      </button>
    </li>
  )
}

/**
 * Previous or Next: a `pagination-link` button with its chevron, disabled at
 * the boundary. The visible label folds away below `sm`; the accessible name
 * stays on `aria-label`.
 */
function renderPaginationEdge(
  edge: 'start' | 'end',
  disabled: boolean,
  { label, iconOnly }: { readonly label: string; readonly iconOnly: boolean }
): ReactElement {
  const icon = renderIcon(
    {
      name: edge === 'start' ? 'chevron-left' : 'chevron-right',
      'aria-hidden': 'true',
      'data-icon': edge === 'start' ? 'inline-start' : 'inline-end',
      className: 'rtl:rotate-180',
    },
    []
  )
  return (
    <li data-slot="pagination-item">
      <button
        type="button"
        data-slot="pagination-link"
        aria-label={label}
        disabled={disabled}
        className={computePaginationEdgeClasses(edge, iconOnly)}
      >
        {edge === 'start' && icon}
        {iconOnly ? undefined : <span className={PAGINATION_EDGE_LABEL_CLASSES}>{label}</span>}
        {edge === 'end' && icon}
      </button>
    </li>
  )
}

/** The page count, the current page and the numbers drawn around it. */
const paginationWindow = (comp: PaginationKeys | undefined) => {
  const totalPages = comp?.totalPages ?? 1
  const currentPage = comp?.currentPage ?? 1
  return {
    totalPages,
    currentPage,
    pages: paginationPages(totalPages, currentPage, comp?.siblingCount ?? 1),
  }
}

/** The pagination keys this renderer reads off the component. */
interface PaginationKeys {
  readonly totalPages?: number
  readonly currentPage?: number
  readonly siblingCount?: number
  readonly paginationVariant?: 'default' | 'simple' | 'icons'
  readonly previousLabel?: string
  readonly nextLabel?: string
}

/**
 * Renders a pagination navigation control (server-rendered).
 *
 * The current page is marked with `aria-current="page"` and `data-active`.
 * Ellipsis gaps are rendered as `...` for visual continuity.
 */
function renderPagination({
  elementProps,
  component,
  currentLang,
  languages,
}: {
  readonly elementProps: Record<string, unknown>
  readonly component?: Component
  readonly currentLang?: string
  readonly languages?: Languages
}): ReactElement {
  const comp = component as PaginationKeys | undefined
  const variant = comp?.paginationVariant ?? 'default'
  const edge = (label: string | undefined, fallback: string) => ({
    label: resolveChildTranslation(label ?? fallback, currentLang, languages),
    iconOnly: variant === 'icons',
  })
  const { totalPages, currentPage, pages } = paginationWindow(comp)
  const { 'data-testid': dataTestId, className, ...rest } = omitInternalMarkers(elementProps)
  return (
    <nav
      {...rest}
      data-slot="pagination"
      aria-label="Pagination"
      className={resolveClasses(PAGINATION_CLASSES, undefined, className as string | undefined)}
      data-testid={dataTestId as string | undefined}
    >
      <ul
        data-slot="pagination-content"
        className={PAGINATION_CONTENT_CLASSES}
      >
        {renderPaginationEdge('start', currentPage <= 1, edge(comp?.previousLabel, 'Previous'))}
        {variant === 'simple'
          ? undefined
          : pages.map((entry, index) => renderPaginationEntry(entry, index, currentPage))}
        {renderPaginationEdge('end', currentPage >= totalPages, edge(comp?.nextLabel, 'Next'))}
      </ul>
    </nav>
  )
}

/**
 * Navigation-related page components rendered server-side (no hydration).
 */
export const navigationComponents: Partial<Record<DispatchableComponentType, ComponentRenderer>> = {
  breadcrumb: renderBreadcrumb,
  'button-group': renderButtonGroup,
  pagination: renderPagination,
}
