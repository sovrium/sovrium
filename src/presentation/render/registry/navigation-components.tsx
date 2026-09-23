/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement, Fragment } from 'react'
import { computeButtonGroupClasses } from '../../design/interactive-content-default-classes'
import {
  computeBreadcrumbItemClasses,
  computeBreadcrumbListClasses,
  computeBreadcrumbSeparatorClasses,
  computePaginationButtonClasses,
  computePaginationEllipsisClasses,
  computePaginationListClasses,
} from '../../design/navigation-default-classes'
import { renderIcon } from '../elements/icon-renderer'
import { resolveChildTranslation } from '../i18n/translation-handler'
import { omitInternalMarkers } from '../props/internal-marker-props'
import type { ComponentRenderer, DispatchableComponentType } from './component-dispatch-config'
import type { Languages } from '@/domain/models/app/languages'
import type { Component } from '@/domain/models/app/pages/components'

interface BreadcrumbItem {
  readonly label: string
  readonly href?: string
  readonly icon?: string
}

/**
 * Renders the label content for a single crumb — either bare text or an
 * icon-prefixed inline-flex group when the schema supplied an icon name.
 *
 * `label` goes through the `$t:` resolver, so both trail forms are
 * translatable: an authored `breadcrumbItems[].label` and a derived trail's
 * `labels` map, which `breadcrumb.ts` documents as accepting a `$t:` key. A
 * string carrying no `$t:` prefix passes through untouched.
 */
function renderBreadcrumbLabel(
  item: BreadcrumbItem,
  currentLang: string | undefined,
  languages: Languages | undefined
): ReactElement | string {
  const label = resolveChildTranslation(item.label, currentLang, languages)
  if (!item.icon) return label
  const iconEl = renderIcon({ name: item.icon, size: 16, 'aria-hidden': 'true' }, [])
  return (
    <span className="inline-flex items-center gap-1">
      {iconEl}
      <span>{label}</span>
    </span>
  )
}

/**
 * Renders one crumb entry: a current-page `<span>` (carrying
 * `aria-current="page"`) or a hyperlink anchor for prior segments.
 */
function renderBreadcrumbEntry(
  item: BreadcrumbItem,
  isCurrent: boolean,
  currentLang: string | undefined,
  languages: Languages | undefined
): ReactElement {
  const labelContent = renderBreadcrumbLabel(item, currentLang, languages)
  const crumbClasses = computeBreadcrumbItemClasses({
    state: isCurrent ? 'current' : 'default',
  })
  if (isCurrent || !item.href) {
    return (
      <span
        aria-current={isCurrent ? 'page' : undefined}
        className={crumbClasses}
      >
        {labelContent}
      </span>
    )
  }
  return (
    <a
      href={item.href}
      className={crumbClasses}
    >
      {labelContent}
    </a>
  )
}

/**
 * Renders the breadcrumb trail described by the page schema.
 *
 * Schema fields consumed:
 * - `breadcrumbItems[]` — ordered list of segments (label/href/icon)
 * - `separator` — character rendered between items (default '/')
 *
 * The last item in the list is treated as the current page and rendered as
 * plain text (no link), matching the WAI-ARIA breadcrumb pattern.
 *
 * A `derive: 'path'` trail never reaches here as such: `resolveDerivedBreadcrumbs`
 * (`presentation/rendering/derived-breadcrumb-resolver.ts`) has already turned it
 * into `breadcrumbItems` while the request path was in scope. That is deliberate
 * — the two forms then share one set of markup and accessibility semantics and
 * cannot drift apart.
 */
function renderBreadcrumb({
  elementPropsWithSpacing,
  component,
  currentLang,
  languages,
}: {
  readonly elementPropsWithSpacing: Record<string, unknown>
  readonly component?: Component
  readonly currentLang?: string
  readonly languages?: Languages
}): ReactElement {
  const comp = component as
    { breadcrumbItems?: readonly BreadcrumbItem[]; separator?: string } | undefined
  const items = comp?.breadcrumbItems ?? []
  const separator = comp?.separator ?? '/'
  const { 'data-testid': dataTestId, ...rest } = omitInternalMarkers(elementPropsWithSpacing)
  const className = rest.className as string | undefined
  // THE AUTHOR'S LABEL WINS, and the default is what it always was.
  //
  // `aria-label` arrived inside `rest` and was then overwritten by a hardcoded
  // literal one line later, so the name was unreachable from config — and
  // "Breadcrumb" is exactly the name every page's own trail already carries.
  // Two navigation landmarks sharing one name is a defect for anyone cycling
  // landmarks, so a SECOND trail in the same document (a specimen of this type,
  // a sub-trail inside a panel) had no way to distinguish itself and could only
  // be refused. Reading the declared value first costs nothing and leaves the
  // WAI-ARIA default in place for every trail that says nothing.
  const ariaLabel = (rest['aria-label'] as string | undefined) ?? 'Breadcrumb'
  const lastIndex = items.length - 1
  const separatorClasses = computeBreadcrumbSeparatorClasses()
  return (
    <nav
      {...rest}
      aria-label={ariaLabel}
      className={className}
      data-testid={dataTestId as string | undefined}
    >
      <ol className={computeBreadcrumbListClasses()}>
        {items.map((item, index) => {
          const isCurrent = index === lastIndex
          return (
            <Fragment key={`${index}-${item.label}`}>
              <li>{renderBreadcrumbEntry(item, isCurrent, currentLang, languages)}</li>
              {!isCurrent && (
                <li
                  aria-hidden="true"
                  className={separatorClasses}
                >
                  {separator}
                </li>
              )}
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}

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
}: {
  readonly elementProps: Record<string, unknown>
  readonly renderedChildren: readonly ReactElement[]
}): ReactElement {
  const label = elementProps['label'] as string | undefined
  const {
    'data-testid': dataTestId,
    label: _label,
    'data-label': _dataLabel,
    className,
    ...rest
  } = omitInternalMarkers(elementProps) as Record<string, unknown>
  const cn = className as string | undefined
  // [internal ref] (prestyled-by-default): the button-group container ships a
  // surface chrome (rounded + subtle shadow) from
  // `computeButtonGroupClasses` AHEAD of the segmented-control rhythm
  // (`-space-x-px isolate`) so the bare `{ type: 'button-group' }`
  // renders as one cohesive shape. The author-supplied className appends
  // merged in via `resolveClasses`, so it wins same-property conflicts.
  const containerDefaults = `inline-flex isolate -space-x-px ${computeButtonGroupClasses()}`
  const containerClass = cn ? `${containerDefaults} ${cn}` : containerDefaults
  return (
    <div
      {...rest}
      role="group"
      aria-label={label}
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
        aria-hidden="true"
      >
        <span className={computePaginationEllipsisClasses()}>...</span>
      </li>
    )
  }
  const isActive = entry === currentPage
  return (
    <li key={entry}>
      <button
        type="button"
        aria-current={isActive ? 'page' : undefined}
        className={computePaginationButtonClasses({
          state: isActive ? 'selected' : 'default',
        })}
      >
        {entry}
      </button>
    </li>
  )
}

/**
 * Renders a pagination navigation control (server-rendered).
 *
 * The current page is marked with `aria-current="page"` so assistive tech and
 * the spec's `expect(...).toHaveAttribute('aria-current', 'page')` both work.
 * Ellipsis gaps are rendered as `<span>...</span>` for visual continuity.
 */
function renderPagination({
  elementProps,
  component,
}: {
  readonly elementProps: Record<string, unknown>
  readonly component?: Component
}): ReactElement {
  const comp = component as
    { totalPages?: number; currentPage?: number; siblingCount?: number } | undefined
  const totalPages = comp?.totalPages ?? 1
  const currentPage = comp?.currentPage ?? 1
  const siblingCount = comp?.siblingCount ?? 1
  const pages = paginationPages(totalPages, currentPage, siblingCount)
  const { 'data-testid': dataTestId, className, ...rest } = omitInternalMarkers(elementProps)

  const prevDisabled = currentPage <= 1
  const nextDisabled = currentPage >= totalPages
  return (
    <nav
      {...rest}
      aria-label="Pagination"
      className={className as string | undefined}
      data-testid={dataTestId as string | undefined}
    >
      <ul className={computePaginationListClasses()}>
        <li>
          <button
            type="button"
            aria-label="Previous"
            disabled={prevDisabled}
            className={computePaginationButtonClasses({
              state: prevDisabled ? 'disabled' : 'default',
            })}
          >
            Previous
          </button>
        </li>
        {pages.map((entry, index) => renderPaginationEntry(entry, index, currentPage))}
        <li>
          <button
            type="button"
            aria-label="Next"
            disabled={nextDisabled}
            className={computePaginationButtonClasses({
              state: nextDisabled ? 'disabled' : 'default',
            })}
          >
            Next
          </button>
        </li>
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
