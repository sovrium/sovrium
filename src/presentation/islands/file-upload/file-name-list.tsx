/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeFileUploadFileNameClasses,
  computeFileUploadFileRowClasses,
  computeFileUploadFileMarkClasses,
  computeFileUploadListClasses,
} from '@/presentation/design/file-upload-default-classes'
import { FileGlyph } from '@/presentation/design/form-glyphs'
import type { ReactElement } from 'react'

interface FileNameListProps {
  readonly fileNames: readonly string[]
}

/**
 * The picked-file list under the control.
 *
 * Wave R-E gives each file its own bordered row (`spec-form.mjs:30`) instead
 * of the bare `<ul>` of unstyled text this shipped as. The change is not
 * decorative: three picked files as three lines of 12px body text read as a
 * paragraph of help copy, so nothing signalled that each one is a discrete
 * thing that was attached — the affordance a user needs before they can trust
 * that the right files went up.
 *
 * The row draws a mark and a monospace name. A size and a remove control are
 * in the recipe (`computeFileUploadFileSize/RemoveClasses`) but not drawn
 * here, because the island's state carries only names; wiring removal is
 * behaviour and belongs to its own spec rather than to a paint wave.
 */
export function FileNameList({ fileNames }: FileNameListProps): ReactElement {
  return (
    <ul className={computeFileUploadListClasses()}>
      {fileNames.map((name) => (
        <li
          key={name}
          className={computeFileUploadFileRowClasses()}
        >
          <FileGlyph className={computeFileUploadFileMarkClasses()} />
          <span className={computeFileUploadFileNameClasses()}>{name}</span>
        </li>
      ))}
    </ul>
  )
}
