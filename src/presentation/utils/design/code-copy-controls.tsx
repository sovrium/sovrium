/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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
