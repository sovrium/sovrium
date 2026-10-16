/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeFileUploadFileContentClasses,
  computeFileUploadFileMarkClasses,
  computeFileUploadFileNameClasses,
  computeFileUploadFileRowClasses,
  computeFileUploadListClasses,
} from '@/presentation/design/file-upload-default-classes'
import { FileGlyph } from '@/presentation/design/form-glyphs'
import type { ReactElement } from 'react'

/** The words a failed file's chip says, in the page's language. */
export interface FailedChipStrings {
  readonly failed: string
  readonly retry: string
  readonly remove: string
}

interface FileNameListProps {
  readonly fileNames: readonly string[]
  /** The picked files whose upload failed: their chips say so and offer Retry and Remove. */
  readonly failedNames?: readonly string[]
  readonly strings: FailedChipStrings
  readonly onRetry: () => void
  readonly onRemove: (name: string) => void
}

/** What a failed file's chip adds: why, and the two ways on from there. */
function FailedChipActions({
  name,
  strings,
  onRetry,
  onRemove,
}: {
  readonly name: string
  readonly strings: FailedChipStrings
  readonly onRetry: () => void
  readonly onRemove: (name: string) => void
}): ReactElement {
  return (
    <>
      <p
        data-slot="item-description"
        className="text-destructive text-xs"
      >
        {strings.failed}
      </p>
      <div
        data-slot="item-actions"
        className="ml-auto flex gap-2"
      >
        <button
          type="button"
          onClick={onRetry}
          className="hover:bg-muted rounded-md border px-2 py-0.5 text-xs font-medium"
        >
          {strings.retry}
        </button>
        <button
          type="button"
          onClick={() => onRemove(name)}
          className="hover:bg-muted rounded-md px-2 py-0.5 text-xs font-medium"
        >
          {strings.remove}
        </button>
      </div>
    </>
  )
}

/**
 * The picked files under the control: an item group, each file an outlined
 * small item whose media is the file glyph and whose title is its name.
 *
 * A file whose upload FAILED keeps its chip, marked failed, with a Retry that
 * sends the same file again and a Remove that clears it — a failure the reader
 * can act on where they are looking, rather than a toast alone.
 */
export function FileNameList({
  fileNames,
  failedNames = [],
  strings,
  onRetry,
  onRemove,
}: FileNameListProps): ReactElement {
  return (
    <ul
      data-slot="item-group"
      className={computeFileUploadListClasses()}
    >
      {fileNames.map((name) => (
        <li
          key={name}
          data-slot="item"
          data-variant="outline"
          data-size="sm"
          {...(failedNames.includes(name) && { 'data-state': 'failed' })}
          className={computeFileUploadFileRowClasses()}
        >
          <div
            data-slot="item-media"
            data-variant="icon"
            className={computeFileUploadFileMarkClasses()}
          >
            <FileGlyph />
          </div>
          <div
            data-slot="item-content"
            className={computeFileUploadFileContentClasses()}
          >
            <div
              data-slot="item-title"
              className={computeFileUploadFileNameClasses()}
            >
              {name}
            </div>
          </div>
          {failedNames.includes(name) && (
            <FailedChipActions
              name={name}
              strings={strings}
              onRetry={onRetry}
              onRemove={onRemove}
            />
          )}
        </li>
      ))}
    </ul>
  )
}
