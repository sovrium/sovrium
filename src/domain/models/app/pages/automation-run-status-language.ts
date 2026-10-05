/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The automation-run status vocabulary in the READER'S language.
 *
 * `automation-run-status.ts` turns the engine's word into the operator's
 * English one (`completed` → `Success`) wherever a page reads the runs API. The
 * run grid then translates that word through its `valueLabels`, in the
 * browser. A run PAGE reads its run on the server, where no `valueLabels` hook
 * reaches a `$record.` value — so the server relabels it here, from the SAME
 * translation keys the grid names, and a French operator reads « Ignorée » on
 * the page as in the history.
 *
 * A step's `filtered` has no grid column, so its key is the run page's own. An
 * app that translates none of these keys reads the English label.
 *
 * Kept apart from `automation-run-status.ts` because that module ships in the
 * islands' shared hook, and this table is only ever read on the server.
 */

import { localizeRun, isRunsEndpoint } from './automation-run-status'

type RunRecord = Readonly<Record<string, unknown>>

/** Engine status → the translation key the console's run grid reads its word under. */
export const RUN_STATUS_LABEL_KEYS: Readonly<Record<string, string>> = {
  completed: 'admin.automations.runs.status.success',
  failed: 'admin.automations.runs.status.failed',
  'completed-with-errors': 'admin.automations.runs.status.partial',
  'waiting-approval': 'admin.automations.runs.status.waitingApproval',
  rejected: 'admin.automations.runs.status.rejected',
  cancelled: 'admin.automations.runs.status.cancelled',
  exhausted: 'admin.automations.runs.status.retriesExhausted',
  'timed-out': 'admin.automations.runs.status.timedOut',
  queued: 'admin.automations.runs.status.queued',
  running: 'admin.automations.runs.status.running',
  skipped: 'admin.automations.runs.status.skipped',
  filtered: 'admin.automations.runs.step.filtered',
}

/**
 * Reads a translation key in the reader's language, or `undefined` when the app
 * translates no such key — the English label then stands.
 */
export type RunStatusTranslator = (key: string) => string | undefined

/** `localized` with its `status` replaced by the reader's word for `raw`'s, when there is one. */
const inLanguage = (raw: unknown, localized: unknown, translate: RunStatusTranslator): unknown => {
  if (
    typeof raw !== 'object' ||
    raw === null ||
    typeof localized !== 'object' ||
    localized === null
  )
    return localized
  const { status } = raw as RunRecord
  const key = typeof status === 'string' ? RUN_STATUS_LABEL_KEYS[status] : undefined
  const word = key === undefined ? undefined : translate(key)
  return word === undefined ? localized : { ...(localized as RunRecord), status: word }
}

/**
 * One run read from `endpoint`, its own status and each step's in the reader's
 * language — the English labels without a translator. Any other endpoint's
 * record is returned as it arrived.
 */
export const localizeRunRecordInLanguage = <R extends RunRecord>(
  endpoint: string,
  record: R,
  translate?: RunStatusTranslator
): R => {
  if (!isRunsEndpoint(endpoint)) return record
  const english = localizeRun(record)
  if (translate === undefined) return english
  const run = inLanguage(record, english, translate) as R
  const rawSteps = record['steps']
  const { steps } = english
  if (!Array.isArray(rawSteps) || !Array.isArray(steps)) return run
  return {
    ...run,
    steps: steps.map((step: unknown, index) => inLanguage(rawSteps[index], step, translate)),
  }
}
