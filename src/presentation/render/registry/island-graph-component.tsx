/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Renderer for `{ type: 'graph' }` — the SERVER half of a hybrid component.
 *
 * ─── WHAT IS SERVER-RENDERED, AND WHAT HYDRATES ────────────────────────────
 *
 * Three of the four things this component emits are in the FIRST response, and
 * only one of them hydrates:
 *
 *  - the DEGRADED / UNAVAILABLE notice — a fact from the read, not client state;
 *  - the EMPTY state — likewise;
 *  - the accessible TWIN — the primary artifact, and it sits OUTSIDE the island
 *    root because an island replaces its own mount root and two paints of one
 *    table across that boundary drift silently ({@link GraphTwin});
 *  - the DRAWING — an island, because SELECTION is client state: a node is
 *    focused, `Enter` selects it, the reach set lights up and everything
 *    outside it dims. `matrix` next door made the opposite call on the same
 *    wire because nothing on a matrix changes after delivery.
 *
 * The read itself happened one pass earlier, in `graph-resolver.ts`, which
 * attaches the resolved drawing as a render-time `graphView` field. So the
 * island FETCHES NOTHING: the server already read the endpoint once, with the
 * caller's own credentials, and hands the projection across as props.
 *
 * ─── THE FOUR READS STAY FOUR ──────────────────────────────────────────────
 *
 * `empty` (no column admits a node) renders `emptyMessage` INSTEAD of the
 * drawing. `sparse` (columns resolve, no edge connects a drawn pair) renders
 * the DRAWING with its nodes and no lines, because a set of resources nobody
 * has been granted is a finding rather than a blank. `degraded` renders the
 * drawing it HAS and names each unresolved source beside it — a generic "some
 * data is missing" would leave an operator unable to tell which half to
 * distrust — and `emptyMessage` is NOT used. `unavailable` renders the notice
 * and NO drawing: the instance has grants, and saying it has none because this
 * caller could not read them is the exact lie the endpoint's own `degraded[]`
 * contract exists to refuse.
 *
 * @see ./graph-twin.tsx — the accessible twin, which is never optional
 * @see src/presentation/islands/graph/graph-island.tsx — the half that hydrates
 */

import { GraphIslandHost } from '@/presentation/render/registry/graph-island-host'
import type { ComponentRenderer } from './component-dispatch-config'
import type { GraphComponent } from '@/presentation/render/registry/graph-island-host'
import type { GraphView } from '@/presentation/render/resolve/graph-projection'
import type { ReactElement } from 'react'

/** What the drawing says when no `emptyMessage` was declared. */
const DEFAULT_EMPTY_MESSAGE = 'Nothing to show.'

/** What the notice says when the read did not succeed for this caller. */
const UNAVAILABLE_MESSAGE = 'This map could not be read.'

const NOTICE_CLASS =
  'mb-2 rounded-md border border-error-border bg-error-bg px-3 py-2 text-sm text-error-fg'

/**
 * The notice's own sentence, or nothing when the read was whole.
 *
 * `unavailable` has no sources to name — that is the point of it — so it speaks
 * for itself rather than printing an empty list. A DEGRADED read names each
 * unresolved source: a generic "some data is missing" would leave an operator
 * unable to tell which half of the map to distrust.
 */
const noticeMessage = (view: GraphView): string | undefined => {
  if (view.kind === 'unavailable') return UNAVAILABLE_MESSAGE
  if (view.degraded.length === 0) return undefined
  return `Some sources could not be read: ${view.degraded.join(', ')}`
}

export const islandGraphComponent: ComponentRenderer = (config): ReactElement => {
  const component = config.component as GraphComponent | undefined
  const view: GraphView = component?.graphView ?? { kind: 'unavailable' }
  const elementProps = config.elementPropsWithSpacing
  const notice = noticeMessage(view)
  return (
    <div
      data-component-type="graph"
      className={elementProps['className'] as string | undefined}
      id={elementProps['id'] as string | undefined}
      data-testid={elementProps['data-testid'] as string | undefined}
    >
      {notice === undefined ? undefined : (
        <p
          data-graph-degraded=""
          className={NOTICE_CLASS}
        >
          {notice}
        </p>
      )}
      {view.kind === 'empty' ? (
        <p
          data-graph-empty=""
          className="text-foreground-subtle text-sm"
        >
          {component?.emptyMessage ?? DEFAULT_EMPTY_MESSAGE}
        </p>
      ) : undefined}
      {view.kind !== 'drawing' || component === undefined ? undefined : (
        <GraphIslandHost
          component={component}
          view={view}
        />
      )}
    </div>
  )
}
