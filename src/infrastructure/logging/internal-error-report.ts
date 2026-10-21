/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { OPERATOR_FIX_GUIDANCE, operatorFixOf } from '@/domain/errors/operator-fixable-error'
import {
  failureName,
  failureStack,
  scrubReportText,
} from '@/domain/kernel/url/issue-report-failure'
import {
  computeErrorSignature,
  formatIssueTitle,
  reportedStackFrames,
} from '@/domain/kernel/url/issue-report-url'
import { readReportScrub } from '@/infrastructure/logging/issue-report-facts'
import { keepServerFailure } from '@/infrastructure/logging/issue-report-store'
import type { ReportScrub } from '@/domain/kernel/url/issue-report-failure'

/**
 * An internal error the server answered, kept so the OPERATOR can act on it.
 *
 * Kept — its class and its stack frames, never its message — under the request
 * id it was answered with, in the project's data directory, where
 * `sovrium report --request-id <id>` and the console's report read find it.
 * Whoever made the request is told the request id and nothing else.
 *
 * Two kinds, told apart by `operatorFixOf`: an engine DEFECT, whose log line
 * names its signature and the command that reports it; and a failure the
 * operator can fix (their environment, their database), kept with the code of
 * its fix, whose log line names that fix and offers no report.
 */

/** Where a server error happened, as its report title names it: a request the server answered. */
const SERVER_COMMAND = 'request'

/**
 * What a kept server error is scrubbed of, read once per process: it resolves
 * directories on disk, and an internal error is answered on the request path.
 * The environment, the project directory and the home directory do not change
 * while the server runs.
 */
let serverScrub: ReportScrub | undefined

const scrubForServer = (): ReportScrub => {
  serverScrub ??= readReportScrub()
  return serverScrub
}

/** A failure as it is kept for a report: its class, its signature and its scrubbed frames. */
export interface KeptFailureDescription {
  readonly errorClass: string
  readonly signature: string
  /** The in-repository frames, one per line, scrubbed of secrets and local paths. */
  readonly frames: string
}

/**
 * Describe `error` as a report keeps it. The class and the frames, never the
 * message: a driver's message can name a table, a column or a submitted value,
 * and a filed report is public.
 */
export const describeKeptFailure = (error: unknown): KeptFailureDescription => {
  const failure = { name: failureName(error), stack: failureStack(error) }
  return {
    errorClass: failure.name,
    signature: computeErrorSignature(failure),
    frames: scrubReportText(reportedStackFrames(failure.stack).join('\n'), scrubForServer()),
  }
}

/**
 * Keep `error` under `requestId` and return what its log line adds. Never
 * throws, and does no disk I/O itself: the copy is queued and written after the
 * answer (keeping it is best effort).
 */
export const keepInternalError = (error: unknown, requestId: string): string => {
  const { errorClass, signature, frames } = describeKeptFailure(error)
  const fix = operatorFixOf(error)
  keepServerFailure({
    requestId,
    errorClass,
    signature,
    logs: frames === '' ? errorClass : `${errorClass}\n${frames}`,
    at: new Date().toISOString(),
    ...(fix === undefined ? {} : { fix }),
  })
  return fix === undefined
    ? `internal error ${formatIssueTitle(SERVER_COMMAND, errorClass, signature)}; run \`sovrium report --request-id ${requestId}\` where this server runs to report it`
    : `internal error ${errorClass}, operator-fixable: ${fix} (${OPERATOR_FIX_GUIDANCE[fix]})`
}

/**
 * What an internal error's log line adds after the route: the request id and
 * what {@link keepInternalError} says. Empty when no request id was set.
 */
export const internalErrorLogSuffix = (error: unknown, requestId: string | undefined): string =>
  requestId === undefined ? '' : ` requestId=${requestId} ${keepInternalError(error, requestId)}`
