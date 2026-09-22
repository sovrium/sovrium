/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Renderer for `{ type: 'matrix' }` — two sets of graph nodes crossed, each
 * intersection a GLYPH rather than a word.
 *
 * ─── IT RENDERS SERVER-SIDE. IT IS NOT AN ISLAND ───────────────────────────
 *
 * Nothing on a matrix is dragged, typed into or re-fetched: it is a static
 * drawing of one read. So there is no `React.lazy` entry, no `ISLANDS`
 * registration, no `ISLAND_MOUNT_CEILINGS` baseline, no visx, and not one byte
 * added to the client bundle (eco R2). The grid AND its accessible twin are in
 * the FIRST response, so a reader with no scripting — and a crawler — get the
 * facts rather than a skeleton.
 *
 * The read itself happens one pass earlier, in `matrix-graph-resolver.ts`, which
 * attaches the resolved drawing to this component as a render-time `matrixView`
 * field — the shape `toc` already uses for its `tocHeadings`.
 *
 * ─── THE FOUR READS STAY FOUR ──────────────────────────────────────────────
 *
 * `empty` (an axis admits nothing) renders `emptyMessage` INSTEAD of the grid.
 * `sparse` (axes resolve, no edge matches) renders the GRID with every cell
 * empty, because a resource nobody has been granted is a finding rather than a
 * blank. `degraded` renders the grid it HAS and names each unresolved source
 * beside it — a generic "some data is missing" would leave an operator unable
 * to tell which half of the grid to distrust. `unavailable` — the read was
 * refused for this caller — renders the notice and NO grid: the instance has
 * grants, and saying it has none because this caller could not read them is the
 * exact lie the endpoint's own `degraded[]` contract exists to refuse.
 *
 * Flattening any two of those into "nothing to show" reads calm where the truth
 * is a gap, which is the single failure this component is shaped to prevent.
 *
 * @see ./matrix-grid.tsx — the drawing and the notice
 * @see ./matrix-twin.tsx — the accessible twin, which is never optional
 */

import { MatrixGrid, MatrixNotice } from '@/presentation/render/registry/matrix-grid'
import { MatrixTwin } from '@/presentation/render/registry/matrix-twin'
import type { ComponentRenderer } from './component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'
import type { MatrixResolvedComponent } from '@/presentation/render/resolve/matrix-graph-resolver'
import type { MatrixView } from '@/presentation/render/resolve/matrix-projection'
import type { ReactElement } from 'react'

/** What the grid says when no `emptyMessage` was declared. */
const DEFAULT_EMPTY_MESSAGE = 'Nothing to show.'

/** What the notice says when the read did not succeed for this caller. */
const UNAVAILABLE_MESSAGE = 'This grid could not be read.'

/** The declaration this renderer reads off the component, beside its drawing. */
type MatrixComponent = Component &
  MatrixResolvedComponent & {
    readonly label?: string
    readonly emptyMessage?: string
  }

/**
 * The notice's own sentence, or nothing when the read was whole.
 *
 * `unavailable` has no sources to name — that is the point of it — so it speaks
 * for itself rather than printing an empty list.
 */
const noticeMessage = (view: MatrixView): string | undefined => {
  if (view.kind === 'unavailable') return UNAVAILABLE_MESSAGE
  if (view.degraded.length === 0) return undefined
  return `Some sources could not be read: ${view.degraded.join(', ')}`
}

export const matrixComponent: ComponentRenderer = (config): ReactElement => {
  const component = config.component as MatrixComponent | undefined
  const view: MatrixView = component?.matrixView ?? { kind: 'unavailable' }
  const elementProps = config.elementPropsWithSpacing
  const notice = noticeMessage(view)
  return (
    <div
      data-component-type="matrix"
      className={elementProps['className'] as string | undefined}
      id={elementProps['id'] as string | undefined}
      data-testid={elementProps['data-testid'] as string | undefined}
    >
      {notice === undefined ? undefined : <MatrixNotice message={notice} />}
      {view.kind === 'empty' ? (
        <p
          data-matrix-empty=""
          className="text-foreground-subtle text-sm"
        >
          {component?.emptyMessage ?? DEFAULT_EMPTY_MESSAGE}
        </p>
      ) : undefined}
      {view.kind !== 'grid' ? undefined : (
        <div className="overflow-x-auto">
          <MatrixGrid
            view={view}
            label={component?.label}
          />
          {view.truncated ? (
            <p
              data-matrix-truncated=""
              className="text-foreground-subtle mt-3 text-xs"
            >
              This grid is larger than the renderer draws whole; some rows or columns are not shown.
            </p>
          ) : undefined}
          <MatrixTwin rows={view.twinRows} />
        </div>
      )}
    </div>
  )
}
