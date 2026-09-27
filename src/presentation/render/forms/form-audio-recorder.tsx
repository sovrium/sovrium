/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Server-rendered half of the `recordAudio` recorder on an attachment field.
 *
 * Only the Record button is rendered here. The Stop button, the elapsed
 * counter and the microphone error are created by the inline runtime
 * (`form-runtime-audio-recorder.ts`) while a recording is in progress and
 * removed when it ends, so none of them exists in the DOM at rest. The
 * button is `type="button"` so pressing it never submits the form.
 *
 * The page's `microphone=(self)` Permissions-Policy grant is decided from
 * the form's CONFIG (`presentation/api/runtime/microphone-permission.ts`),
 * never from this markup; without it the browser refuses `getUserMedia`.
 */
export function AudioRecorderControls({
  fieldName,
  maxSeconds,
}: {
  readonly fieldName: string
  readonly maxSeconds: number
}) {
  return (
    <div
      className="form-audio-recorder flex flex-wrap items-center gap-2"
      data-form-audio-recorder={fieldName}
      data-max-duration-seconds={String(maxSeconds)}
    >
      <button
        type="button"
        className="form-audio-record"
        data-testid={`record-audio-${fieldName}`}
        data-form-record-audio={fieldName}
      >
        Record audio
      </button>
    </div>
  )
}
