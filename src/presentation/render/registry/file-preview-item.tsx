/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { FileIcon } from 'lucide-react'
import {
  computeItemActionsClasses,
  computeItemClasses,
  computeItemContentClasses,
  computeItemDescriptionClasses,
  computeItemMediaClasses,
  computeItemTitleClasses,
} from '@/presentation/design/item-default-classes'
import type { PreviewFile } from '@/presentation/render/resolve/file-preview-resolver'
import type { ReactElement } from 'react'

/**
 * A file the browser cannot show: shadcn/ui's outlined `Item` naming the file
 * and its type, with the Download button (and Open, when the toolbar lists it)
 * in its actions on the same signed address.
 */
export function fileItem(file: PreviewFile, tools: readonly ReactElement[]): ReactElement {
  return (
    <div
      data-slot="item"
      data-variant="outline"
      data-size="default"
      className={computeItemClasses({ variant: 'outline' })}
    >
      <div
        data-slot="item-media"
        data-variant="icon"
        className={computeItemMediaClasses({ variant: 'icon' })}
      >
        <FileIcon aria-hidden="true" />
      </div>
      <div
        data-slot="item-content"
        className={computeItemContentClasses()}
      >
        <div
          data-slot="item-title"
          className={computeItemTitleClasses()}
        >
          {file.name}
        </div>
        <p
          data-slot="item-description"
          className={computeItemDescriptionClasses()}
        >
          {file.type}
        </p>
      </div>
      <div
        data-slot="item-actions"
        className={computeItemActionsClasses()}
      >
        {tools}
      </div>
    </div>
  )
}
