/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement, Fragment } from 'react'
import { renderIcon } from '../../renderers/element-renderers/icon-renderer'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'

interface BreadcrumbItem {
  readonly label: string
  readonly href?: string
  readonly icon?: string
}

function renderBreadcrumb({
  elementPropsWithSpacing,
  component,
}: {
  readonly elementPropsWithSpacing: Record<string, unknown>
  readonly component?: Component
}): ReactElement {
  const comp = component as
    | { breadcrumbItems?: readonly BreadcrumbItem[]; separator?: string }
    | undefined
  const items = comp?.breadcrumbItems ?? []
  const separator = comp?.separator ?? '/'
  const { 'data-testid': dataTestId, ...rest } = elementPropsWithSpacing
  const className = rest.className as string | undefined
  const lastIndex = items.length - 1

  return (
    <nav
      {...rest}
      aria-label="Breadcrumb"
      className={className}
      data-testid={dataTestId as string | undefined}
    >
      <ol className="flex flex-wrap items-center gap-2 text-sm">
        {items.map((item, index) => {
          const isCurrent = index === lastIndex
          const iconEl = item.icon
            ? renderIcon({ name: item.icon, size: 16, 'aria-hidden': 'true' }, [])
            : undefined
          const labelContent = iconEl ? (
            <span className="inline-flex items-center gap-1">
              {iconEl}
              <span>{item.label}</span>
            </span>
          ) : (
            item.label
          )
          return (
            <Fragment key={`${index}-${item.label}`}>
              <li>
                {isCurrent || !item.href ? (
                  <span aria-current={isCurrent ? 'page' : undefined}>{labelContent}</span>
                ) : (
                  <a href={item.href}>{labelContent}</a>
                )}
              </li>
              {!isCurrent && (
                <li
                  aria-hidden="true"
                  className="text-muted-fg"
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
  const containerClass = cn
    ? `inline-flex isolate -space-x-px ${cn}`
    : 'inline-flex isolate -space-x-px'
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
        <span>...</span>
      </li>
    )
  }
  const isActive = entry === currentPage
  return (
    <li key={entry}>
      <button
        type="button"
        aria-current={isActive ? 'page' : undefined}
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
    | { totalPages?: number; currentPage?: number; siblingCount?: number }
    | undefined
  const totalPages = comp?.totalPages ?? 1
  const currentPage = comp?.currentPage ?? 1
  const siblingCount = comp?.siblingCount ?? 1
  const pages = paginationPages(totalPages, currentPage, siblingCount)
  const { 'data-testid': dataTestId, className, ...rest } = elementProps

  return (
    <nav
      {...rest}
      aria-label="Pagination"
      className={className as string | undefined}
      data-testid={dataTestId as string | undefined}
    >
      <ul className="flex items-center gap-1">
        <li>
          <button
            type="button"
            aria-label="Previous"
            disabled={currentPage <= 1}
          >
            Previous
          </button>
        </li>
        {pages.map((entry, index) => renderPaginationEntry(entry, index, currentPage))}
        <li>
          <button
            type="button"
            aria-label="Next"
            disabled={currentPage >= totalPages}
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
