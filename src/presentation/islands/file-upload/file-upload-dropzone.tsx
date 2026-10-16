/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState, type DragEvent, type ReactElement } from 'react'
import { computeFileUploadDropzoneClasses } from '@/presentation/design/file-upload-default-classes'
import { FileUploadDropzoneParts } from '@/presentation/design/file-upload-dropzone-parts'

interface DropZoneProps {
  readonly disabled: boolean
  readonly hint: string | undefined
  readonly onBrowse: () => void
  readonly onDropFiles: (files: FileList, zone: Element) => void
  readonly strings: Readonly<Record<string, string>> | undefined
}

/**
 * The drop zone: shadcn/ui's Empty with a dashed edge, ringed while a file is
 * held over it. A file dropped on it goes through the same validation and
 * upload as a picked one.
 */
export function DropZone({
  disabled,
  hint,
  onBrowse,
  onDropFiles,
  strings,
}: DropZoneProps): ReactElement {
  const [over, setOver] = useState(false)
  const enter = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      if (!disabled) setOver(true)
    },
    [disabled]
  )
  const leave = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false)
  }, [])
  const drop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setOver(false)
      if (!disabled) onDropFiles(event.dataTransfer.files, event.currentTarget)
    },
    [disabled, onDropFiles]
  )
  const state = disabled ? 'disabled' : over ? 'hover' : 'default'
  return (
    <div
      data-slot="empty"
      className={computeFileUploadDropzoneClasses({ state })}
      aria-disabled={disabled ? 'true' : undefined}
      onDragEnter={enter}
      onDragOver={enter}
      onDragLeave={leave}
      onDrop={drop}
    >
      <FileUploadDropzoneParts
        hint={hint}
        disabled={disabled}
        onBrowse={onBrowse}
        strings={strings}
      />
    </div>
  )
}
