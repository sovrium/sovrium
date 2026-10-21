/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ChangeEventHandler, ReactElement, Ref } from 'react'

interface UploadInputProps {
  readonly inputRef: Ref<HTMLInputElement>
  readonly inputId: string | undefined
  readonly accept: string | undefined
  readonly allowMultiple: boolean
  readonly disabled: boolean
  readonly buttonText: string
  /** The line the server drew beside a compact upload, read after the control's name. */
  readonly describedBy: string | undefined
  /** Hidden from the paint, kept for the keyboard and assistive technology. */
  readonly hidden: boolean
  readonly onChange: ChangeEventHandler<HTMLInputElement>
}

/**
 * The native file input. Beside a drop zone it is `sr-only`: the zone's own
 * Browse files button opens it, and its browser-drawn label, in the browser's
 * language, never shows. Beside a plain button it stays as drawn.
 */
export function UploadInput({
  inputRef,
  inputId,
  accept,
  allowMultiple,
  disabled,
  buttonText,
  describedBy,
  hidden,
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
      aria-describedby={describedBy}
      className={hidden ? 'sr-only' : undefined}
      onChange={onChange}
    />
  )
}
