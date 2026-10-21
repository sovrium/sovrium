/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { OPERATOR_FIX_GUIDANCE, operatorFixOf } from '@/domain/errors/operator-fixable-error'
import {
  buildFailureReport,
  failureName,
  failureStack,
  redactValues,
  scrubReportText,
  secretEnvValues,
} from '@/domain/kernel/url/issue-report-failure'
import { hasStackFrames, reportedStackFrames } from '@/domain/kernel/url/issue-report-url'
import { readIssueReportFacts, readReportScrub } from '@/infrastructure/logging/issue-report-facts'
import { keepLastCliFailure } from '@/infrastructure/logging/issue-report-store'

/**
 * The bug report a CLI failure offers — a start that could not start, a build
 * that could not build, a command that crashed.
 *
 * Only for a failure Sovrium has no specific handling for. A refusal (a
 * configuration Sovrium declined, a port already taken) is the author's to fix
 * and never reaches here: offering it a bug report would tell the author to
 * file an issue about their own typo. A failure the operator can fix (a
 * missing variable, an unreachable database) is told its fix instead, and
 * nothing is kept for `--last-error`.
 */

/**
 * The error text a report carries: what the CLI printed for the failure, plus
 * its stack frames when that text had none (an Effect tagged error prints as
 * `[Tag] {…}`, without a stack).
 */
const reportText = (text: string, stack: string | undefined): string =>
  hasStackFrames(text) ? text : [text, ...reportedStackFrames(stack)].join('\n')

/**
 * Build the prefilled bug report for `error`, keep it for
 * `sovrium report --last-error`, and return the lines to print after the
 * failure's own headline — or, for a failure the operator can fix, the fix.
 *
 * @param command the command that failed, which titles the report
 * @param error the value that failed — its class and stack name the report
 * @param text what the CLI printed about it, which becomes the report's logs
 */
export const offerFailureReport = (input: {
  readonly command: string
  readonly error: unknown
  readonly text: string
}): string => {
  const fix = operatorFixOf(input.error)
  if (fix !== undefined) return OPERATOR_FIX_GUIDANCE[fix]
  const failure = { name: failureName(input.error), stack: failureStack(input.error) }
  const logs = scrubReportText(reportText(input.text, failure.stack), readReportScrub())
  const report = buildFailureReport({
    command: input.command,
    failure,
    logs,
    facts: readIssueReportFacts(),
  })
  keepLastCliFailure({ url: report.url, title: report.title, at: new Date().toISOString() })
  return [
    'If this looks like a bug in Sovrium, report it. This address opens the issue form',
    'already filled in, with secrets and local paths removed; nothing is sent until you submit it:',
    `  ${report.url}`,
    'Run `sovrium report --last-error` to print the address again.',
  ].join('\n')
}

/**
 * `text` with the value of every secret-named variable redacted, for printing
 * a failure: an error message can quote a value the operator keeps secret, and
 * a terminal is scrolled back, shared and pasted.
 */
export const withoutSecretValues = (text: string): string =>
  redactValues(text, secretEnvValues(process.env))
