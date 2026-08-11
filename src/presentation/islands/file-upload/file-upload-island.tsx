/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useRef, type ChangeEventHandler, type ReactElement, type Ref } from 'react'
import { cn } from '@/presentation/utils/design/class-merge'
import { FileNameList } from './file-name-list'
import { useFileUploadState } from './use-file-upload-state'
import type {
  FetchSuccessResponse,
  FetchToastResponse,
} from '@/domain/models/app/pages/components/action'

interface FileUploadIslandProps {
  readonly accept?: string
  readonly maxFiles?: number
  readonly maxFileSize?: number
  readonly dropZone?: boolean
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
}

interface UploadLabelProps {
  readonly inputId: string | undefined
  readonly dropZone: boolean
  readonly disabled: boolean
  readonly buttonText: string
}

interface UploadInputProps {
  readonly inputRef: Ref<HTMLInputElement>
  readonly inputId: string | undefined
  readonly accept: string | undefined
  readonly allowMultiple: boolean
  readonly disabled: boolean
  readonly buttonText: string
  readonly onChange: ChangeEventHandler<HTMLInputElement>
}

/*
 * The file input is intentionally visible (not `sr-only`). Playwright's
 * `setInputFiles(...)` works against hidden inputs in theory, but in
 * practice some browser builds skip the synthetic `change` propagation
 * when the input is fully off-screen via `position: absolute` /
 * `clip-path`. Keeping the input on-screen mirrors the working pattern
 * in `src/presentation/islands/components/crud-form/file-field.tsx`.
 */
function UploadInput({
  inputRef,
  inputId,
  accept,
  allowMultiple,
  disabled,
  buttonText,
  onChange,
}: UploadInputProps): ReactElement {
  return (
    <input
      ref={inputRef}
      id={inputId}
      type="file"
      accept={accept}
      multiple={allowMultiple}
      disabled={disabled}
      aria-label={buttonText}
      onChange={onChange}
    />
  )
}

function UploadLabel({ inputId, dropZone, disabled, buttonText }: UploadLabelProps): ReactElement {
  return (
    <label
      htmlFor={inputId}
      className={cn(
        'inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium shadow-sm transition-colors',
        dropZone &&
          'min-h-[120px] cursor-pointer flex-col justify-center border-dashed text-center',
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'border-border bg-background text-foreground hover:bg-background-subtle cursor-pointer'
      )}
      aria-disabled={disabled ? 'true' : undefined}
    >
      <span aria-hidden="true">+</span>
      <span>{dropZone ? `Drag and drop files here or browse — ${buttonText}` : buttonText}</span>
    </label>
  )
}

interface FileUploadFeedbackProps {
  readonly error: string | undefined
  readonly fileNames: readonly string[]
}

/** The inline validation-error / picked-filename region below the control. */
function FileUploadFeedback({
  error,
  fileNames,
}: FileUploadFeedbackProps): ReactElement | undefined {
  if (error) {
    return (
      <p
        role="alert"
        className="text-destructive text-sm"
      >
        {error}
      </p>
    )
  }
  if (fileNames.length > 0) return <FileNameList fileNames={fileNames} />
  return undefined
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
 */
export default function FileUploadIsland({
  accept,
  maxFiles,
  maxFileSize,
  dropZone = false,
  disabled = false,
  label,
  id,
  uploadAction,
  onSuccess,
  onError,
}: FileUploadIslandProps): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null)
  const { error, fileNames, submitting, handleChange } = useFileUploadState({
    maxFiles,
    maxFileSize,
    uploadAction,
    onSuccess,
    onError,
  })
  const allowMultiple = typeof maxFiles === 'number' ? maxFiles > 1 : false
  const inputId = id ? `${id}-input` : undefined
  const buttonText = label ?? 'Upload file'
  // Disable the control while a multipart upload is in flight (minimal progress
  // affordance) — re-enabled when the request settles.
  const controlsDisabled = disabled || submitting

  // NOTE: We deliberately do NOT re-emit `id` / `className` / `data-testid` on
  // this inner wrapper. The island's host element (the SSR placeholder div in
  // `renderFileUploadIsland`) already carries those — re-emitting them on a
  // child causes duplicate-`id` strict-mode violations on `page.locator('#x')`.
  return (
    <div
      className="flex flex-col gap-2"
      data-component="file-upload-island"
      data-dropzone={dropZone ? 'true' : undefined}
      data-island-mounted="true"
    >
      <UploadLabel
        inputId={inputId}
        dropZone={dropZone}
        disabled={controlsDisabled}
        buttonText={buttonText}
      />
      <UploadInput
        inputRef={inputRef}
        inputId={inputId}
        accept={accept}
        allowMultiple={allowMultiple}
        disabled={controlsDisabled}
        buttonText={buttonText}
        onChange={handleChange}
      />
      <FileUploadFeedback
        error={error}
        fileNames={fileNames}
      />
    </div>
  )
}
