/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeFileUploadCompactHintClasses } from './file-upload-default-classes'
import type { ReactElement } from 'react'

/**
 * What a compact upload takes — `PNG, JPEG, PDF · 10 MB each` — drawn by the
 * server just after the upload, as its sibling, so the trigger keeps its own
 * text and the line never moves when the island mounts. A drop zone states the
 * same words in its description; a compact upload has no zone, so without this
 * line an operator would learn the bucket's types and cap only by being refused.
 */
export function FileUploadCompactHint({
  id,
  hint,
}: {
  readonly id: string | undefined
  readonly hint: string
}): ReactElement {
  return (
    <span
      id={id}
      data-slot="file-upload-hint"
      className={computeFileUploadCompactHintClasses()}
    >
      {hint}
    </span>
  )
}
