/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import {
  computeCarouselContainerClasses,
  computeCarouselNavButtonClasses,
  computeEmptyStateContainerClasses,
  computeEmptyStateTitleClasses,
  computeSpeechBubbleClasses,
  computeStaticTableCellClasses,
  computeStaticTableHeaderRowClasses,
  computeStaticTableShellClasses,
} from '../../renderers/element-renderers/recipes/display-default-classes'
import { mergePrestyle } from './interactive-prestyle-builders'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'

export const displayComponents: Partial<Record<Component['type'], ComponentRenderer>> = {
  'static-table': ({ elementPropsWithSpacing, component }) => {
    const tableComp = component as
      | {
          tableHeaders?: readonly string[]
          tableRows?: ReadonlyArray<readonly string[]>
        }
      | undefined
    const headers = tableComp?.tableHeaders ?? []
    const rows = tableComp?.tableRows ?? []
    const {
      'data-testid': dataTestId,
      className: authorClassName,
      ...restProps
    } = elementPropsWithSpacing
    const mergedClassName = mergePrestyle(
      computeStaticTableShellClasses(),
      authorClassName as string | undefined
    )
    const headerCellClass = computeStaticTableCellClasses({ kind: 'header' })
    const dataCellClass = computeStaticTableCellClasses({ kind: 'data' })
    const headerRowClass = computeStaticTableHeaderRowClasses()
    return (
      <table
        {...restProps}
        data-testid={dataTestId as string | undefined}
        className={mergedClassName}
      >
        {headers.length > 0 && (
          <thead>
            <tr className={headerRowClass}>
              {headers.map((header, i) => (
                <th
                  key={i}
                  className={headerCellClass}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
        )}
        {rows.length > 0 && (
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={dataCellClass}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        )}
      </table>
    )
  },

  'speech-bubble': ({ elementProps, content, renderedChildren }) => {
    const side = elementProps['side'] === 'right' ? 'right' : 'left'
    const defaults = computeSpeechBubbleClasses({ side })
    const className = mergePrestyle(defaults, elementProps.className as string | undefined)
    return (
      <div
        data-testid={elementProps['data-testid'] as string | undefined}
        className={className}
      >
        {content || renderedChildren}
      </div>
    )
  },

  carousel: ({ elementProps, renderedChildren }) => {
    const showArrows = elementProps['showArrows'] === true
    const authorClassName = elementProps['className'] as string | undefined
    const className = mergePrestyle(computeCarouselContainerClasses(), authorClassName)
    return (
      <div
        data-testid={elementProps['data-testid'] as string | undefined}
        id={elementProps['id'] as string | undefined}
        className={className}
        data-component="carousel"
      >
        {renderedChildren}
        {showArrows && (
          <>
            <button
              type="button"
              aria-label="Previous slide"
              className={computeCarouselNavButtonClasses({ direction: 'prev' })}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next slide"
              className={computeCarouselNavButtonClasses({ direction: 'next' })}
            >
              ›
            </button>
          </>
        )}
      </div>
    )
  },

  'empty-state': ({ elementProps, content, renderedChildren }) => {
    const title = elementProps['emptyTitle'] as string | undefined
    const description = elementProps['emptyDescription'] as string | undefined
    const authorClassName = elementProps['className'] as string | undefined
    const className = mergePrestyle(computeEmptyStateContainerClasses(), authorClassName)
    return (
      <div
        data-testid={elementProps['data-testid'] as string | undefined}
        id={elementProps['id'] as string | undefined}
        className={className}
        data-component="empty-state"
        role="status"
      >
        {title ? <h3 className={computeEmptyStateTitleClasses()}>{title}</h3> : undefined}
        {description ? <p className="text-sm">{description}</p> : undefined}
        {content || renderedChildren}
      </div>
    )
  },
}
