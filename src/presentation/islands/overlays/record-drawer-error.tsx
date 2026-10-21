/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { reportStringsOf } from '../parts/report-read'
import { AlertGlyph, FAILURE_ALERT_CLASS, ReportedFailure } from '../parts/reported-failure'
import type { ReactElement } from 'react'

/** A refused save answered by a server error the console can name. */
export interface DrawerFailedRequest {
  /** The request the error was answered under. */
  readonly id: string
  /** The page-language `report.*` words; English where absent. */
  readonly words?: Readonly<Record<string, string>> | undefined
}

/**
 * The drawer's inline error, or nothing when there is none. A save the server
 * failed under a request id is drawn as the console's one failure anatomy
 * ({@link ReportedFailure}): the sentence as the alert, the id with its copy
 * control, and the report the server answers for that request. Its sentence
 * already says what to do, so the read-failure line is not drawn under it.
 */
export function DrawerError({
  error,
  name = 'Validation error',
  failedRequest,
}: {
  readonly error: string | undefined
  /** The banner's accessible name, in the page language. */
  readonly name?: string | undefined
  readonly failedRequest?: DrawerFailedRequest | undefined
}): ReactElement | undefined {
  if (!error) return undefined
  if (failedRequest !== undefined) {
    return (
      <div
        data-slot="alert"
        data-variant="destructive"
        data-save-error="true"
        className={FAILURE_ALERT_CLASS}
      >
        <AlertGlyph />
        <ReportedFailure
          sentence={error}
          requestId={failedRequest.id}
          strings={reportStringsOf(failedRequest.words)}
          detail={null}
        />
      </div>
    )
  }
  return (
    <p
      role="alert"
      aria-label={name}
      className="text-error-fg bg-error-bg border-error-border text-md rounded border p-2"
    >
      {error}
    </p>
  )
}
