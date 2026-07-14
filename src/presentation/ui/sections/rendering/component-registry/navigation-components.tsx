/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement, Fragment } from 'react'
import { renderIcon } from '../../renderers/element-renderers/icon-renderer'
import { computeButtonGroupClasses } from '../../renderers/element-renderers/recipes/interactive-content-default-classes'
import {
  computeBreadcrumbItemClasses,
  computeBreadcrumbListClasses,
  computeBreadcrumbSeparatorClasses,
  computePaginationButtonClasses,
  computePaginationEllipsisClasses,
  computePaginationListClasses,
} from '../../renderers/element-renderers/recipes/navigation-default-classes'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'

interface BreadcrumbItem {
  readonly label: string
  readonly href?: string
  readonly icon?: string
}

function renderBreadcrumbLabel(item: BreadcrumbItem): ReactElement | string {
  if (!item.icon) return item.label
  const iconEl = renderIcon({ name: item.icon, size: 16, 'aria-hidden': 'true' }, [])
  return (
    <span className="inline-flex items-center gap-1">
      {iconEl}
      <span>{item.label}</span>
    </span>
  )
}

function renderBreadcrumbEntry(item: BreadcrumbItem, isCurrent: boolean): ReactElement {
  const labelContent = renderBreadcrumbLabel(item)
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

function renderBreadcrumb({
  elementPropsWithSpacing,
  component,
}: {
  readonly elementPropsWithSpacing: Record<string, unknown>
  readonly component?: Component
}): ReactElement {
  const comp = component as
    { breadcrumbItems?: readonly BreadcrumbItem[]; separator?: string } | undefined
  const items = comp?.breadcrumbItems ?? []
  const separator = comp?.separator ?? '/'
  const { 'data-testid': dataTestId, ...rest } = elementPropsWithSpacing
  const className = rest.className as string | undefined
  const lastIndex = items.length - 1
  const separatorClasses = computeBreadcrumbSeparatorClasses()
  return (
    <nav
      {...rest}
      aria-label="Breadcrumb"
      className={className}
      data-testid={dataTestId as string | undefined}
    >
      <ol className={computeBreadcrumbListClasses()}>
        {items.map((item, index) => {
          const isCurrent = index === lastIndex
          return (
            <Fragment key={`${index}-${item.label}`}>
              <li>{renderBreadcrumbEntry(item, isCurrent)}</li>
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
  } = elementProps as Record<string, unknown>
  const cn = className as string | undefined
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
  const { 'data-testid': dataTestId, className, ...rest } = elementProps

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

export const navigationComponents: Partial<Record<Component['type'], ComponentRenderer>> = {
  breadcrumb: renderBreadcrumb,
  'button-group': renderButtonGroup,
  pagination: renderPagination,
}
