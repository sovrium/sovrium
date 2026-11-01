/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { RecordTriggerSource } from '@/domain/models/app/automations/trigger-entries-service'
import type { Effect } from 'effect'

/** Database error for the submission-runs reads. */
export class SubmissionRunsDatabaseError extends Data.TaggedError('SubmissionRunsDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * The automation runs some form submissions started, as the run history reads
 * them: the runs of a `form` trigger carrying one of the submissions in its
 * trigger data, and the runs a `record` trigger on the form's `submitTo` table
 * started for one of the records those submissions created.
 *
 * Each half is narrowed to the automations that declare the matching trigger,
 * so a run of another automation that happens to carry the same id is never
 * counted. An empty half matches nothing; both empty match no run at all.
 */
export interface SubmissionRunsFilter {
  /** The automations with a `form` trigger on the submissions' form, by name. */
  readonly formAutomations: readonly string[]
  readonly submissionIds: readonly string[]
  /**
   * The `record` trigger entries on the `submitTo` table, by automation and
   * entry name: a run another entry of the same automation started on another
   * table's record of the same id is not one of these.
   */
  readonly recordAutomations: readonly RecordTriggerSource[]
  readonly recordIds: readonly string[]
}

/**
 * One run the filter matched, with the submission or the record it was started
 * for, read out of its trigger data. One of the two is set.
 */
export interface SubmissionRunRow {
  readonly id: string
  readonly automationName: string
  readonly status: string | null
  readonly createdAt: Date | string
  readonly submissionId: string | null
  readonly recordId: string | null
}

/** How many matched runs one submission or one record started. */
export interface SubmissionRunCount {
  readonly submissionId: string | null
  readonly recordId: string | null
  readonly runs: number
}

/**
 * Submission Runs Repository Port — the reads behind a submission's run count,
 * its run list, and the run history narrowed to one submission.
 */
export class SubmissionRunsRepository extends Context.Service<
  SubmissionRunsRepository,
  {
    /** The matched runs, newest first. */
    readonly listRuns: (
      filter: SubmissionRunsFilter
    ) => Effect.Effect<readonly SubmissionRunRow[], SubmissionRunsDatabaseError>
    /** The matched runs counted per submission and per record, in ONE grouped read. */
    readonly countRuns: (
      filter: SubmissionRunsFilter
    ) => Effect.Effect<readonly SubmissionRunCount[], SubmissionRunsDatabaseError>
  }
>()('SubmissionRunsRepository') {}
