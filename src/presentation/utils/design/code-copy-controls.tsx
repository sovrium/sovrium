/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * React rendering of the code-block copy affordance, for the config `code`
 * component. The geometry, class list and attribute contract live in the sibling
 * `code-copy-glyphs.ts`, which also renders the raw-HTML form the docs fence
 * splice needs — see that module for the full rationale (one `<svg>` with two
 * `<g>` glyphs, `aria-label` never mutated, confirmation via a polite live
 * region).
 *
 * This file exports COMPONENTS ONLY; the constants and the raw-HTML renderer
 * stay next door so React Fast Refresh keeps working on both.
 */

import {
  CHECK_PATH,
  CODE_COPY_BUTTON_CLASSES,
  CODE_COPY_STATUS_CLASSES,
  COPY_SHEET_PATH,
  COPY_SHEET_RECT,
  GLYPH_SVG_ATTRS,
} from '@/presentation/utils/design/code-copy-glyphs'
import type { ReactElement } from 'react'

/**
 * The copy/check glyph pair. Marked `aria-hidden` — the button's `aria-label` is
 * the accessible name, so the icon must not contribute a second one.
 */
function CodeCopyGlyphs(): ReactElement {
  return (
    <svg
      {...GLYPH_SVG_ATTRS}
      aria-hidden="true"
    >
      <g data-copy-glyph="copy">
        <rect {...COPY_SHEET_RECT} />
        <path d={COPY_SHEET_PATH} />
      </g>
      <g data-copy-glyph="copied">
        <path d={CHECK_PATH} />
      </g>
    </svg>
  )
}

/**
 * The copy button. `data-copy-code` is the contract the delegated
 * `copyCodeScript` keys on; `data-copied-label` is the text that handler writes
 * into the status region.
 */
export function CodeCopyButton({
  copyLabel,
  copiedLabel,
}: {
  readonly copyLabel: string
  readonly copiedLabel: string
}): ReactElement {
  return (
    <button
      type="button"
      aria-label={copyLabel}
      title={copyLabel}
      data-copy-code="true"
      data-copied-label={copiedLabel}
      className={CODE_COPY_BUTTON_CLASSES}
    >
      <CodeCopyGlyphs />
    </button>
  )
}

/**
 * The polite live region the copy confirmation is announced through. Kept
 * OUTSIDE the button: nested inside, the announcement would ride along in the
 * button's own content and be re-read as part of the control on every focus.
 */
export function CodeCopyStatus(): ReactElement {
  return (
    <span
      role="status"
      aria-live="polite"
      data-copy-status="true"
      className={CODE_COPY_STATUS_CLASSES}
    />
  )
}
