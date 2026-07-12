/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState, type ChangeEvent } from 'react'
import { submitUpload } from './file-upload-submit'
import { validateFiles } from './file-upload-validators'
import type {
  FetchSuccessResponse,
  FetchToastResponse,
} from '@/domain/models/app/pages/components/action'

interface FileUploadStateInput {
  readonly maxFiles: number | undefined
  readonly maxFileSize: number | undefined
  readonly uploadAction: string | undefined
  readonly onSuccess: FetchSuccessResponse | undefined
  readonly onError: FetchToastResponse | undefined
}

export interface FileUploadState {
  readonly error: string | undefined
  readonly fileNames: readonly string[]
  readonly submitting: boolean
  readonly handleChange: (event: ChangeEvent<HTMLInputElement>) => void
}

export function useFileUploadState({
  maxFiles,
  maxFileSize,
  uploadAction,
  onSuccess,
  onError,
}: FileUploadStateInput): FileUploadState {
  const [error, setError] = useState<string | undefined>(undefined)
  const [fileNames, setFileNames] = useState<readonly string[]>([])
  const [submitting, setSubmitting] = useState(false)

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
      const picked = Array.from(files)
      setFileNames(picked.map((file) => file.name))
      if (uploadAction) {
        setSubmitting(true)
        void submitUpload(picked, { url: uploadAction, onSuccess, onError }).finally(() =>
          setSubmitting(false)
        )
      }
    },
    [maxFiles, maxFileSize, uploadAction, onSuccess, onError]
  )

  return { error, fileNames, submitting, handleChange }
}
