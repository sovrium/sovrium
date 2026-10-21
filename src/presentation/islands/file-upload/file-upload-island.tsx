/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useId, useRef, type ReactElement } from 'react'
import {
  fileUploadDropzoneHint,
  computeFileUploadErrorClasses,
  computeFileUploadTriggerClasses,
} from '@/presentation/design/file-upload-default-classes'
import { UploadGlyph } from '@/presentation/design/form-glyphs'
import { FileNameList, type FailedChipStrings } from './file-name-list'
import {
  compactHintIdOf,
  compactTriggerText,
  failedChipStrings,
  useCompactErrorToast,
} from './file-upload-compact'
import { DropZone } from './file-upload-dropzone'
import { UploadInput } from './file-upload-input'
import { useFileUploadState } from './use-file-upload-state'
import type {
  FetchSuccessResponse,
  FetchToastResponse,
} from '@/domain/models/app/pages/components/action'

interface FileUploadIslandProps {
  readonly accept?: string
  /** `accept` in words (`PNG, PDF`), resolved server-side for the drop zone's hint. */
  readonly acceptLabel?: string
  readonly maxFiles?: number
  readonly maxFileSize?: number
  readonly dropZone?: boolean
  /** Only the trigger, at a toolbar's size; the outcome is a toast. */
  readonly compact?: boolean
  readonly disabled?: boolean
  readonly label?: string
  // `id` is the host wrapper's id (used to build a stable input id) — we do
  // NOT re-emit it on our own wrapper because the SSR placeholder host carries
  // the same id already. See the comment near the JSX wrapper.
  readonly id?: string
  /** Destination URL for the multipart upload (resolved from `uploadAction`). */
  readonly uploadAction?: string
  /** Success effects (status badge + sibling refetch) run on a 2xx upload. */
  readonly onSuccess?: FetchSuccessResponse
  /** Failure toast dispatched when the upload resolves non-2xx. */
  readonly onError?: FetchToastResponse
  /** The `fileUpload.*` strings, resolved server-side where they differ from English. */
  readonly uiStrings?: Readonly<Record<string, string>>
}

/** The button's text when the author declared no `label`: the page's word, else English. */
const uploadButtonWord = (strings: FileUploadIslandProps['uiStrings']): string =>
  strings?.['fileUpload.button'] ?? 'Upload file'

/**
 * Without a drop zone: the input's label, drawn as an outline button. A
 * `compact` one carries the upload icon too (see `file-upload-compact.ts`).
 */
function ButtonLabel({
  inputId,
  disabled,
  compact,
  text,
}: {
  readonly inputId: string | undefined
  readonly disabled: boolean
  readonly compact: boolean
  readonly text: string
}): ReactElement {
  return (
    <label
      htmlFor={inputId}
      data-slot="button"
      data-variant="outline"
      className={computeFileUploadTriggerClasses({ disabled })}
      aria-disabled={disabled ? 'true' : undefined}
    >
      {compact && <UploadGlyph size={16} />}
      {text}
    </label>
  )
}

interface FileUploadFeedbackProps {
  readonly error: string | undefined
  readonly upload: ReturnType<typeof useFileUploadState>
  readonly strings: FailedChipStrings
  /** A compact upload draws nothing under its trigger: its outcome is a toast. */
  readonly compact: boolean
}

/** The inline validation-error / picked-filename region below the control. */
function FileUploadFeedback({
  error,
  upload,
  strings,
  compact,
}: FileUploadFeedbackProps): ReactElement | undefined {
  if (compact) return undefined
  if (error) {
    return (
      <p
        role="alert"
        className={computeFileUploadErrorClasses()}
      >
        {error}
      </p>
    )
  }
  if (upload.fileNames.length === 0) return undefined
  return (
    <FileNameList
      fileNames={upload.fileNames}
      failedNames={upload.failedNames}
      strings={strings}
      onRetry={upload.retry}
      onRemove={upload.remove}
    />
  )
}

/**
 * File-upload island — adds client-side file selection + size validation on
 * top of the SSR placeholder rendered by `renderFileUpload`. When the user
 * picks a file (via the browse button or drag-and-drop into the dropzone),
 * we validate each file against `maxFileSize`/`maxFiles` and surface a human
 * readable error message inline (matching the spec phrases "too large",
 * "exceeds", "size limit"). When the schema wires an `uploadAction`, picking a
 * file additionally POSTs it as `multipart/form-data` and runs the configured
 * `onSuccess` effects (persistent `role="status"` badge + sibling `refetch`) /
 * `onError` toast via the shipped action-effects mechanism.
 *
 * Two notes about the wrapper it returns. It deliberately does NOT re-emit
 * `id` / `className` / `data-testid`: the island's HOST element — the SSR
 * placeholder in `renderFileUploadIsland` — already carries those, and
 * repeating them on a child causes duplicate-`id` strict-mode violations on
 * `page.locator('#x')`. And the control is disabled while a multipart upload
 * is in flight, which is the island's whole progress affordance; it re-enables
 * when the request settles.
 */
export default function FileUploadIsland(props: FileUploadIslandProps): ReactElement {
  const { accept, maxFiles, dropZone = false, disabled = false } = props
  const compact = props.compact === true
  const { label, id, uiStrings } = props
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useFileUploadState(props)
  const browse = useCallback(() => inputRef.current?.click(), [])
  const allowMultiple = typeof maxFiles === 'number' ? maxFiles > 1 : false
  const generatedId = useId()
  const inputId = `${id ?? generatedId}-input`
  const buttonText = label ?? uploadButtonWord(uiStrings)
  const controlsDisabled = disabled || upload.submitting
  useCompactErrorToast(compact, upload.error)

  return (
    <div
      className="flex flex-col gap-2"
      data-component="file-upload-island"
      data-dropzone={dropZone ? 'true' : undefined}
      data-island-mounted="true"
    >
      {dropZone ? (
        <DropZone
          disabled={controlsDisabled}
          hint={fileUploadDropzoneHint(props, uiStrings)}
          onBrowse={browse}
          onDropFiles={upload.handleFiles}
          strings={uiStrings}
        />
      ) : (
        <ButtonLabel
          inputId={inputId}
          disabled={controlsDisabled}
          compact={compact}
          text={compactTriggerText(compact, upload.submitting, buttonText, uiStrings)}
        />
      )}
      <UploadInput
        inputRef={inputRef}
        inputId={inputId}
        accept={accept}
        allowMultiple={allowMultiple}
        disabled={controlsDisabled}
        buttonText={buttonText}
        describedBy={compactHintIdOf(props)}
        hidden={dropZone || compact}
        onChange={upload.handleChange}
      />
      <FileUploadFeedback
        error={upload.error}
        upload={upload}
        strings={failedChipStrings(uiStrings)}
        compact={compact}
      />
    </div>
  )
}
