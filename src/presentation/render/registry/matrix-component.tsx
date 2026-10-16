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
 * registration, no `ISLAND_MOUNT_CEILINGS` baseline, no charting library, and not one byte
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

import { fillPlaceholders } from '@/domain/kernel/format/placeholder-format'
import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import { MatrixGrid, MatrixNotice } from '@/presentation/render/registry/matrix-grid'
import { MatrixTwin } from '@/presentation/render/registry/matrix-twin'
import type { ComponentRenderer } from './component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'
import type { MatrixResolvedComponent } from '@/presentation/render/resolve/matrix-graph-resolver'
import type { MatrixView } from '@/presentation/render/resolve/matrix-projection'
import type { ReactElement } from 'react'

/** One of the matrix's own words (`matrix.*`), in the page language. */
type MatrixWord = (key: string) => string

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
const noticeMessage = (view: MatrixView, word: MatrixWord): string | undefined => {
  if (view.kind === 'unavailable') return word('matrix.unavailable')
  if (view.degraded.length === 0) return undefined
  return fillPlaceholders(word('matrix.degraded'), { sources: view.degraded.join(', ') })
}

export const matrixComponent: ComponentRenderer = (config): ReactElement => {
  const component = config.component as MatrixComponent | undefined
  const view: MatrixView = component?.matrixView ?? { kind: 'unavailable' }
  const elementProps = config.elementPropsWithSpacing
  const word: MatrixWord = (key) =>
    resolveInterpreterString(key, config.currentLang, config.languages)
  const notice = noticeMessage(view, word)
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
          className="text-muted-foreground text-sm"
        >
          {component?.emptyMessage ?? word('matrix.empty')}
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
              className="text-muted-foreground mt-3 text-xs"
            >
              {word('matrix.truncated')}
            </p>
          ) : undefined}
          <MatrixTwin
            rows={view.twinRows}
            headings={[
              word('matrix.resource'),
              word('matrix.grantSource'),
              word('matrix.operations'),
              word('matrix.note'),
            ]}
          />
        </div>
      )}
    </div>
  )
}
