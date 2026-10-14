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

interface FileNameListProps {
  readonly fileNames: readonly string[]
}

/**
 * The picked files under the control: an item group, each file an outlined
 * small item whose media is the file glyph and whose title is its name.
 *
 * A size and a remove control are not drawn: the island's state carries only
 * names, and wiring removal is behaviour that belongs to its own spec.
 */
export function FileNameList({ fileNames }: FileNameListProps): ReactElement {
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
        </li>
      ))}
    </ul>
  )
}
