/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState, type MouseEvent } from 'react'
import { COPY_BUTTON_CLASS } from '../../parts/report-read'
import { CopyGlyph } from '../../parts/reported-failure'

/**
 * The copy button of a column declaring `copyLabel`: it copies the WHOLE stored
 * value, whatever its format shows, and never opens the row it sits in.
 */
export function CellCopy({ value, label }: { readonly value: string; readonly label: string }) {
  const [copied, setCopied] = useState(false)
  const copy = (event: MouseEvent) => {
    event.stopPropagation()
    void navigator.clipboard?.writeText(value).then(
      () => setCopied(true),
      () => setCopied(false)
    )
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      title={label}
      data-slot="button"
      data-copied={copied ? 'true' : undefined}
      className={COPY_BUTTON_CLASS}
    >
      <CopyGlyph copied={copied} />
    </button>
  )
}
