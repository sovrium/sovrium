/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Display-category component renderers ([internal ref] prestyled defaults).
 *
 * This file gathers the renderers for the bare-`<div>`-fallback display
 * schemas that gained prestyled-by-default chrome in the
 * "prestyled-by-default islands" plan:
 *
 *   - `empty-state`   — dashed-border "nothing here yet" module with
 *                       optional title + description
 *
 * Other display-category renderers stay where they were (`static-table`,
 * `speech-bubble` in `special-components.tsx`; `list-item`, `timeline` in
 * `structural-components.tsx`) — they were already wired into those
 * groupings before this slice. Splitting these two new renderers into a
 * dedicated file keeps `special-components.tsx` under the per-island
 * `max-lines: 300` cap while still grouping the display-category chrome
 * logically.
 *
 * Each renderer composes its className via
 * {@link mergePrestyle} (defaults → author override) so
 * `props.className` from a schema author appends after the prestyled
 * defaults at the Tailwind cascade.
 */

import {
  computeEmptyStateContainerClasses,
  computeEmptyStateTitleClasses,
  computeSpeechBubbleClasses,
  computeStaticTableCellClasses,
  computeStaticTableHeaderRowClasses,
  computeStaticTableShellClasses,
} from '../../renderers/element-renderers/recipes/display-default-classes'
import { mergePrestyle } from './interactive-prestyle-builders'
import type { ComponentRenderer, DispatchableComponentType } from '../component-dispatch-config'

/**
 * Display-category renderers: the schemas that previously fell
 * through to the unstyled `<div>` fallback in `dispatchComponentType` now
 * carry their own opinionated chrome via these renderers.
 */
export const displayComponents: Partial<Record<DispatchableComponentType, ComponentRenderer>> = {
  // Static-table — prestyled-by-default. Pure presentational
  // composition (NOT an interactive island): the schema author ships
  // `tableHeaders` + `tableRows` as inline literal arrays and gets a
  // bordered + rounded table with subtle header chrome. Distinct from the
  // data-table island (`island-data-components.tsx` + `data-default-
  // classes.ts`) which renders live records with sort/filter/pagination.
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

  // Speech-bubble — prestyled-by-default. The `side` axis flips
  // the sharp-corner tail between bottom-left (sender) and bottom-right
  // (receiver). Replaces the previously inline `bg-info-bg border ...`
  // alias string so the bubble tone now flows through the same
  // var-fallback recipe as every other info-toned surface.
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

  // Empty-state — prestyled-by-default. Renders a centered
  // dashed-border module with optional title + description from the
  // schema's `emptyTitle` / `emptyDescription` fields. Children render
  // below the description (used for CTA buttons via the action fields).
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
