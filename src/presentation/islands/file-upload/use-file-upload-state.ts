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
  /** When set, a picked file is POSTed (multipart) to this URL. */
  readonly uploadAction: string | undefined
  /** Success effects (status badge + sibling refetch) run on a 2xx upload. */
  readonly onSuccess: FetchSuccessResponse | undefined
  /** Failure toast dispatched when the upload resolves non-2xx. */
  readonly onError: FetchToastResponse | undefined
}

export interface FileUploadState {
  readonly error: string | undefined
  readonly fileNames: readonly string[]
  /** True while a multipart upload is in flight (drives the disabled state). */
  readonly submitting: boolean
  readonly handleChange: (event: ChangeEvent<HTMLInputElement>) => void
}

/**
 * Composition-root hook for the file-upload island. Owns the picked-file
 * error / filename / submitting state plus the change handler that validates
 * against `maxFiles` / `maxFileSize` and — when an `uploadAction` is set —
 * fires the multipart upload submission (which runs the configured
 * onSuccess effects / onError toast).
 */
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
      // A `change` event with empty/no files (typical after we clear the
      // input or after a re-trigger fired without a fresh selection) is a
      // no-op — we keep the previous error/filename state visible so the
      // user can see why the prior selection was rejected.
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
      // Only POST when the schema wired an `uploadAction`; otherwise the island
      // stays a pick-and-validate control (the basic / dropzone-only variant).
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
