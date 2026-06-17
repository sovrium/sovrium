/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState, type ChangeEvent } from 'react'
import { validateFiles } from './file-upload-validators'

interface FileUploadStateInput {
  readonly maxFiles: number | undefined
  readonly maxFileSize: number | undefined
}

export interface FileUploadState {
  readonly error: string | undefined
  readonly fileNames: readonly string[]
  readonly handleChange: (event: ChangeEvent<HTMLInputElement>) => void
}

export function useFileUploadState({
  maxFiles,
  maxFileSize,
}: FileUploadStateInput): FileUploadState {
  const [error, setError] = useState<string | undefined>(undefined)
  const [fileNames, setFileNames] = useState<readonly string[]>([])

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { files } = event.target
      if (!files || files.length === 0) return
      const errorMessage = validateFiles(files, maxFiles, maxFileSize)
      if (errorMessage) {
        setError(errorMessage)
        setFileNames([])
        return
      }
      setError(undefined)
      setFileNames(Array.from(files).map((file) => file.name))
    },
    [maxFiles, maxFileSize]
  )

  return { error, fileNames, handleChange }
}
