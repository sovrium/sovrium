/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The house spinner mark, rendered by React.
 *
 * The mark's shape, weight, motion and attributes are DATA in
 * `./spinner-mark-markup.ts`, the one source the plain-DOM pending runtime and
 * the inlined form runtime build from too — see that file for why the arc is
 * shaped and weighted the way it is.
 *
 * ─── WHY IT LIVES IN `design/` ─────────────────────────────────────────────
 *
 * It began as a module constant inside the button renderer, then moved to
 * `render/elements/` when the `spinner` component type gained a renderer of its
 * own. It moved again when React islands (CRUD save and delete, the record
 * button field) started drawing it in their pending state: islands cannot
 * reach `render/`, and `design/` is the one home both trees import.
 */

import { resolveClasses } from './resolve-classes'
import {
  SPINNER_MARK_ATTRIBUTES,
  SPINNER_MARK_CLASS,
  SPINNER_MARK_PATH,
} from './spinner-mark-markup'
import type { ReactElement } from 'react'

/**
 * Render the spinner mark.
 *
 * @param className - Extra classes for the `<svg>`, resolved against the mark's
 *   own so a caller wins any same-property conflict. Omit it to draw the 16px
 *   mark the button uses; pass `size-full` (or any `size-*`) to let the mark
 *   take its size from the box around it.
 */
export function renderSpinnerMark(className?: string): ReactElement {
  const a = SPINNER_MARK_ATTRIBUTES
  return (
    <svg
      key="spinner-mark"
      className={resolveClasses(SPINNER_MARK_CLASS, undefined, className)}
      data-loading={a['data-loading']}
      xmlns={a['xmlns']}
      fill={a['fill']}
      stroke={a['stroke']}
      strokeWidth={a['stroke-width']}
      strokeLinecap={a['stroke-linecap'] as 'round'}
      viewBox={a['viewBox']}
      width={a['width']}
      height={a['height']}
      aria-hidden={a['aria-hidden'] as 'true'}
    >
      <path d={SPINNER_MARK_PATH} />
    </svg>
  )
}

/**
 * A React island's pending caption: the spinner, then the pending word, on one
 * line and centred on each other whatever the control's own layout — a plain
 * button would otherwise sit the mark on the text baseline and grow taller. The
 * island puts this in place of its label (and of a leading icon) and spreads
 * `pendingControlProps(true)` on the control — the same state the plain-DOM
 * `beginPending` draws.
 */
export function renderPendingContent(word: string): ReactElement {
  return (
    <span className="inline-flex items-center gap-1.5 align-top">
      {renderSpinnerMark()}
      {word}
    </span>
  )
}
