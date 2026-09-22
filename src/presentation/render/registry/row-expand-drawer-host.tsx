/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ReactElement } from 'react'

/** The synthesized expand drawer is hidden until a row opens it. */
const HIDDEN_STYLE = { display: 'none' } as const

/**
 * The SSR host a grid's `rowExpand` mounts its record panel into.
 *
 * It is the `record-drawer` island's own host, spelled the same way the
 * standalone component spells it — `rowExpand` is a shorthand for that wiring,
 * so the panel it opens must BE that panel rather than a lookalike that can
 * drift from it.
 *
 * Rendered as a SIBLING of the grid, never a child: the grid island renders
 * into its own host element, so a drawer nested inside it would be discarded
 * the moment the grid hydrates.
 */
export function RowExpandDrawerHost({
  props,
}: {
  readonly props: Record<string, unknown>
}): ReactElement {
  return (
    <div
      data-island="record-drawer"
      data-island-props={JSON.stringify(props)}
      style={HIDDEN_STYLE}
    >
      <div
        role="dialog"
        aria-label={props['title'] as string}
      >
        <p>Loading...</p>
      </div>
    </div>
  )
}
