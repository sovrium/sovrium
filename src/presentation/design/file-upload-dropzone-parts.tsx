/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computePartButtonClasses } from './button-variant-classes'
import {
  FILE_UPLOAD_BROWSE_LABEL,
  FILE_UPLOAD_DROPZONE_PROMPT,
  computeFileUploadContentClasses,
  computeFileUploadDropzoneHintClasses,
  computeFileUploadDropzoneIconClasses,
  computeFileUploadDropzoneTextClasses,
  computeFileUploadHeaderClasses,
} from './file-upload-default-classes'
import { UploadGlyph } from './form-glyphs'
import type { ReactElement } from 'react'

const BROWSE_CLASSES = computePartButtonClasses({ variant: 'outline', size: 'sm' })

/**
 * The inside of a `file-upload` drop zone, drawn once for the server-rendered
 * placeholder and the hydrated island: the `empty-header` (upload glyph,
 * title, the accepted types and limits) and the `empty-content` holding the
 * outline Browse files button. The placeholder passes no `onBrowse` and draws
 * the button disabled, since a press before the island mounts opens nothing.
 */
export function FileUploadDropzoneParts({
  hint,
  disabled,
  onBrowse,
}: {
  readonly hint: string | undefined
  readonly disabled: boolean
  readonly onBrowse?: () => void
}): ReactElement {
  return (
    <>
      <div
        data-slot="empty-header"
        className={computeFileUploadHeaderClasses()}
      >
        <div
          data-slot="empty-icon"
          data-variant="icon"
          className={computeFileUploadDropzoneIconClasses()}
        >
          <UploadGlyph />
        </div>
        <div
          data-slot="empty-title"
          className={computeFileUploadDropzoneTextClasses()}
        >
          {FILE_UPLOAD_DROPZONE_PROMPT}
        </div>
        {hint !== undefined && (
          <p
            data-slot="empty-description"
            className={computeFileUploadDropzoneHintClasses()}
          >
            {hint}
          </p>
        )}
      </div>
      <div
        data-slot="empty-content"
        className={computeFileUploadContentClasses()}
      >
        <button
          type="button"
          data-slot="button"
          data-variant="outline"
          data-size="sm"
          disabled={disabled || onBrowse === undefined}
          onClick={onBrowse}
          className={BROWSE_CLASSES}
        >
          {FILE_UPLOAD_BROWSE_LABEL}
        </button>
      </div>
    </>
  )
}
