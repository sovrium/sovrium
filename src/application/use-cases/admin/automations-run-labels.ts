/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The readings a run history prints beside a run's raw facts: what started it
 * (`triggerLabel`), which record it concerns (`recordLabel`), and the whole
 * result as one sentence (`resultSummary`). Each is phrased on the server in the
 * operator's console language, as `stepsLabel` is.
 */

import { entityLabelFor, tableLabelsFor } from '@/domain/models/app/auth/readable-name-service'
import { describeTrigger } from '@/domain/models/app/automations/trigger-description-service'
import {
  recordedTrigger,
  runRecordRefOf,
} from '@/domain/models/app/automations/trigger-entries-service'
import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import { recordTitleOf } from '@/domain/models/app/tables/record-title-service'
import type { AdminAutomationRunRow } from '@/application/ports/repositories/automations/admin-automations-repository'
import type { ConsoleLanguage } from '@/application/use-cases/admin/operator-language'
import type { App } from '@/domain/models/app'

type Automation = NonNullable<App['automations']>[number]

type TriggerEntry = Automation['triggers'][number]

/** A declared trigger entry in words, in the operator's `language` — what the catalogue and a run read. */
export function triggerEntryLabel(
  app: App,
  entry: TriggerEntry,
  language: ConsoleLanguage
): string {
  const translate = (text: string): string =>
    resolveTranslationPattern(text, language, app.languages)
  return describeTrigger(entry, language, {
    tableLabel: (name) =>
      tableLabelsFor((app.tables ?? []).find((table) => table.name === name) ?? { name }, translate)
        .labelPlural,
    formLabel: (name) => {
      const form = (app.forms ?? []).find((candidate) => candidate.name === name)
      return form === undefined ? entityLabelFor({ name }) : translate(form.title)
    },
  })
}

/** A run's trigger in words, from the entry the live config declares for it. */
export function runTriggerLabel(
  app: App,
  def: Automation | undefined,
  row: Pick<AdminAutomationRunRow, 'triggerName'>,
  language: ConsoleLanguage
): string {
  const entry = def === undefined ? undefined : recordedTrigger(def, row.triggerName)
  if (entry === undefined) {
    // No longer declared, or no longer placeable: the recorded name, readable.
    return entityLabelFor({ name: row.triggerName ?? def?.triggers[0]?.type ?? 'webhook' })
  }
  return triggerEntryLabel(app, entry, language)
}

/**
 * The record a run concerns, by the name its sheet heads itself with — read off
 * the record the run captured when it started, so a run whose captured values
 * were erased reads the record's id. `null` exactly when the run concerns none.
 */
export function runRecordLabel(
  app: App,
  def: Automation | undefined,
  row: Pick<AdminAutomationRunRow, 'triggerName' | 'triggerData'>
): string | null {
  const { recordTable, recordId } = runRecordRefOf(def, row.triggerName, row.triggerData)
  if (recordTable === null || recordId === null) return null
  const table = (app.tables ?? []).find((candidate) => candidate.name === recordTable)
  const data = row.triggerData as { readonly record?: unknown } | null
  const record =
    typeof data?.record === 'object' && data.record !== null
      ? (data.record as Readonly<Record<string, unknown>>)
      : {}
  const title = recordTitleOf(table?.fields, { ...record, id: recordId })
  return title === '' ? recordId : title
}

/** The matching runs per kind the summary counts. */
export interface RunCounts {
  readonly total: number
  readonly failed: number
  readonly waiting: number
}

const FAILED_STATUSES: ReadonlySet<string> = new Set(['failed', 'exhausted'])
const WAITING_STATUSES: ReadonlySet<string> = new Set(['waiting-approval', 'waiting-delay'])

/** Tally a per-status count into the three figures a run history counts. */
export function tallyRunCounts(byStatus: ReadonlyMap<string, number>): RunCounts {
  const sum = (keep: (status: string) => boolean): number =>
    [...byStatus].filter(([status]) => keep(status)).reduce((total, [, n]) => total + n, 0)
  return {
    total: sum(() => true),
    failed: sum((status) => FAILED_STATUSES.has(status)),
    waiting: sum((status) => WAITING_STATUSES.has(status)),
  }
}

const SUMMARY_WORDS: Readonly<
  Record<ConsoleLanguage, Readonly<Record<'one' | 'many' | 'failed' | 'waiting', string>>>
> = {
  en: { one: '{n} run', many: '{n} runs', failed: '{n} failed', waiting: '{n} waiting' },
  fr: {
    one: '{n} exécution',
    many: '{n} exécutions',
    failed: '{n} en échec',
    waiting: '{n} en attente',
  },
}

/**
 * `35 runs · 3 failed · 1 waiting` (`35 exécutions · 3 en échec · 1 en attente`):
 * the result as one sentence, a zero count left out and the singular for one.
 */
export function runsResultSummary(counts: RunCounts, language: ConsoleLanguage): string {
  const words = SUMMARY_WORDS[language]
  const n = (template: string, value: number): string =>
    template.replace('{n}', new Intl.NumberFormat(language).format(value))
  return [
    n(counts.total === 1 ? words.one : words.many, counts.total),
    ...(counts.failed > 0 ? [n(words.failed, counts.failed)] : []),
    ...(counts.waiting > 0 ? [n(words.waiting, counts.waiting)] : []),
  ].join(' · ')
}

/** The response's count facts: the total, the failed and waiting counts, and their sentence. */
export function runsResultFacts(counts: RunCounts, language: ConsoleLanguage) {
  return {
    total: counts.total,
    counts: { failed: counts.failed, waiting: counts.waiting },
    resultSummary: runsResultSummary(counts, language),
  }
}
