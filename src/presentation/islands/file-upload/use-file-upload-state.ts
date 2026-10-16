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
  readonly maxFiles?: number | undefined
  readonly maxFileSize?: number | undefined
  /** When set, a picked file is POSTed (multipart) to this URL. */
  readonly uploadAction?: string | undefined
  /** Success effects (status badge + sibling refetch) run on a 2xx upload. */
  readonly onSuccess?: FetchSuccessResponse | undefined
  /** Failure toast dispatched when the upload resolves non-2xx. */
  readonly onError?: FetchToastResponse | undefined
  /** The `fileUpload.*` words in the page language, where they differ from English. */
  readonly uiStrings?: Readonly<Record<string, string>> | undefined
}

export interface FileUploadState {
  readonly error: string | undefined
  readonly fileNames: readonly string[]
  /** The names of the picked files whose upload failed, each offered Retry and Remove. */
  readonly failedNames: readonly string[]
  /** Send the failed files again. */
  readonly retry: () => void
  /** Clear a picked file's chip. */
  readonly remove: (name: string) => void
  /** True while a multipart upload is in flight (drives the disabled state). */
  readonly submitting: boolean
  readonly handleChange: (event: ChangeEvent<HTMLInputElement>) => void
  /** Validate and (when wired) upload files dropped on `origin`. */
  readonly handleFiles: (files: FileList | null, origin: Element) => void
}

/**
 * Composition-root hook for the file-upload island. Owns the picked-file
 * error / filename / submitting state plus the change handler that validates
 * against `maxFiles` / `maxFileSize` and — when an `uploadAction` is set —
 * fires the multipart upload submission (which runs the configured
 * onSuccess effects / onError toast).
 */
export function useFileUploadState(input: FileUploadStateInput): FileUploadState {
  const { maxFiles, maxFileSize, uploadAction, onSuccess, onError, uiStrings } = input
  const [error, setError] = useState<string | undefined>(undefined)
  const [fileNames, setFileNames] = useState<readonly string[]>([])
  const [submitting, setSubmitting] = useState(false)
  // The files whose upload failed, kept so Retry sends the SAME files again.
  const [failed, setFailed] = useState<readonly File[]>([])

  const send = useCallback(
    (picked: readonly File[], origin: Element | undefined) => {
      if (!uploadAction) return
      setSubmitting(true)
      setFailed([])
      void submitUpload(picked, { url: uploadAction, onSuccess, onError, origin })
        .then((ok) => setFailed(ok ? [] : picked))
        .finally(() => setSubmitting(false))
    },
    [uploadAction, onSuccess, onError]
  )

  const handleFiles = useCallback(
    (files: FileList | null, origin: Element) => {
      // A `change` event with empty/no files (typical after we clear the
      // input or after a re-trigger fired without a fresh selection) is a
      // no-op — we keep the previous error/filename state visible so the
      // user can see why the prior selection was rejected.
      if (!files || files.length === 0) return
      const errorMessage = validateFiles(files, { maxFiles, maxFileSize }, uiStrings)
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
      send(picked, origin)
    },
    [maxFiles, maxFileSize, send, uiStrings]
  )

  const retry = useCallback(() => send(failed, undefined), [send, failed])
  const remove = useCallback((name: string) => {
    setFileNames((names) => names.filter((picked) => picked !== name))
    setFailed((files) => files.filter((file) => file.name !== name))
  }, [])

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => handleFiles(event.target.files, event.target),
    [handleFiles]
  )

  const failedNames = failed.map((file) => file.name)
  return { error, fileNames, failedNames, retry, remove, submitting, handleChange, handleFiles }
}
