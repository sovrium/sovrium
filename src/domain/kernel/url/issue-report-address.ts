/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { bugReportFields, type IssueReportFacts } from '@/domain/kernel/url/issue-report-failure'
import { buildIssueReportUrl, formatIssueTitle } from '@/domain/kernel/url/issue-report-url'
import type { OperatorFix } from '@/domain/errors/operator-fixable-error'

/**
 * The prefilled bug report addresses of the two failures the server keeps for
 * its operator: an internal error it answered under a request id, and a run it
 * closed because the run stopped on an internal error.
 *
 * One builder per failure, shared by every surface that offers the report —
 * `sovrium report --request-id` on the terminal and the console's report reads
 * — so the same failure yields the same address wherever it is asked for.
 *
 * Built only from what was KEPT: the error class, its signature and the
 * scrubbed in-repository frames. Never the error's message, a trigger's
 * payload, record data or any name the operator chose (an automation, an
 * action, a table, the app): the address leaves the machine the moment it is
 * opened, and the run id is enough for the operator to find the run.
 *
 * The title names WHERE it failed: `request` for an internal error the server
 * answered, `automation` for a run the engine closed.
 */

/** The surface an internal error the server answered is reported under. */
const REQUEST_SURFACE = 'request'

/** The surface a run closed on an internal error is reported under. */
const AUTOMATION_SURFACE = 'automation'

/** An internal error the server answered, as it was kept (already scrubbed). */
export interface KeptServerFailureReport {
  readonly requestId: string
  readonly errorClass: string
  readonly signature: string
  /** The error class and its in-repository frames, scrubbed when kept. */
  readonly logs: string
  /** Set when the failure is the operator's to fix: no report is offered for it. */
  readonly fix?: OperatorFix
}

/** A run the engine closed because it stopped on an internal error. */
export interface RunDefectReport {
  readonly runId: string
  readonly errorClass: string
  readonly signature: string
  /** The in-repository frames, one per line, scrubbed when the defect was recorded. */
  readonly frames?: string
}

/** The bug report address for an internal error the server kept under its request id. */
export const serverFailureReportUrl = (
  failure: KeptServerFailureReport,
  facts: IssueReportFacts
): string =>
  buildIssueReportUrl({
    form: 'bug.yml',
    title: formatIssueTitle(REQUEST_SURFACE, failure.errorClass, failure.signature),
    fields: bugReportFields(facts, {
      logs: `Request id: ${failure.requestId}\n${failure.logs}`,
    }),
  })

/** The bug report address for a run closed on an internal error: names the run, never its data. */
export const runDefectReportUrl = (run: RunDefectReport, facts: IssueReportFacts): string =>
  buildIssueReportUrl({
    form: 'bug.yml',
    title: formatIssueTitle(AUTOMATION_SURFACE, run.errorClass, run.signature),
    fields: bugReportFields(facts, {
      logs: [
        `Run id: ${run.runId}`,
        run.errorClass,
        ...(run.frames === undefined || run.frames === '' ? [] : [run.frames]),
      ].join('\n'),
    }),
  })

/**
 * The blank bug report address for this installation, when nothing failed on
 * screen: the bug form with the version, the operating system, the install
 * channel and the database, and no title and no logs — the person describes
 * their own problem. Names nothing the operator chose.
 */
export const installationReportUrl = (facts: IssueReportFacts): string =>
  buildIssueReportUrl({ form: 'bug.yml', title: '', fields: bugReportFields(facts) })
