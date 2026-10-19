/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A trigger entry as a run history reads it: what started the run, in a few
 * words — `Schedule · daily 06:00`, `Quotes · updated`, `Form · Quote request`
 * — rather than the bare type (`cron`, `record`, `form`) the entry is keyed by.
 *
 * Phrased on the server, in the operator's console language, like the run's
 * other readings: the console may be mounted on an app declaring no languages,
 * whose author overrides must not rename the operator's chrome. So the words
 * live here, one table per console language. A schedule, a record trigger and
 * a form say what they watch; every other trigger reads as its kind.
 */

import type { Trigger } from './trigger'

/** The console languages this description is written in. */
export type DescriptionLanguage = 'en' | 'fr'

/** How the description names what it cannot read off the entry alone. */
export interface DescriptionNames {
  /** A table, as a person reads it: its declared label, else its name made readable. */
  readonly tableLabel: (table: string) => string
  /** A form, as a person reads it: its declared title, else its name made readable. */
  readonly formLabel: (form: string) => string
}

const WORDS = {
  en: {
    schedule: 'Schedule',
    form: 'Form',
    record: 'Record change',
    commentKind: 'Comment',
    kinds: {
      webhook: 'Webhook',
      manual: 'Manual',
      'automation-call': 'Automation call',
      'automation-failure': 'Automation failure',
      auth: 'Account',
    },
    comment: 'comment',
    everyMinutes: 'every {n} min',
    everyMinute: 'every minute',
    hourly: 'hourly at :{mm}',
    everyHours: 'every {n} h',
    daily: 'daily {time}',
    weekdays: 'weekdays {time}',
    monthly: 'monthly, day {day} {time}',
    events: { create: 'created', update: 'updated', delete: 'deleted', restore: 'restored' },
    changed: '{fields} changed',
  },
  fr: {
    schedule: 'Planification',
    form: 'Formulaire',
    record: 'Changement d’enregistrement',
    commentKind: 'Commentaire',
    kinds: {
      webhook: 'Webhook',
      manual: 'Manuel',
      'automation-call': 'Appel d’automatisation',
      'automation-failure': 'Échec d’automatisation',
      auth: 'Compte',
    },
    comment: 'commentaire',
    everyMinutes: 'toutes les {n} min',
    everyMinute: 'chaque minute',
    hourly: 'toutes les heures à :{mm}',
    everyHours: 'toutes les {n} h',
    daily: 'chaque jour {time}',
    weekdays: 'en semaine {time}',
    monthly: 'chaque mois, le {day} {time}',
    events: { create: 'créé', update: 'modifié', delete: 'supprimé', restore: 'restauré' },
    changed: '{fields} modifié',
  },
} as const

type Words = (typeof WORDS)[DescriptionLanguage]

const fill = (template: string, values: Readonly<Record<string, string>>): string =>
  Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, value), template)

const pad = (value: string): string => value.padStart(2, '0')

/** A whole number in `[min, max]`, written as digits only. */
const wholeIn = (field: string, min: number, max: number): number | undefined =>
  /^\d{1,2}$/.test(field) && Number(field) >= min && Number(field) <= max
    ? Number(field)
    : undefined

/** A day of the week (`0`–`7`, Sunday twice) in the page language's short form. */
const weekdayName = (field: string, language: DescriptionLanguage): string | undefined => {
  const day = wholeIn(field, 0, 7)
  if (day === undefined) return undefined
  // The first of January 2023 fell on a Sunday: cron weekday `d` is January `1 + d`.
  const date = new Date(Date.UTC(2023, 0, 1 + (day % 7)))
  return new Intl.DateTimeFormat(language, { weekday: 'short', timeZone: 'UTC' }).format(date)
}

/** The run time of a fixed-hour schedule, `06:00`. */
const clockOf = (minute: string, hour: string): string | undefined =>
  wholeIn(minute, 0, 59) === undefined || wholeIn(hour, 0, 23) === undefined
    ? undefined
    : `${pad(hour)}:${pad(minute)}`

/** The five fields of a cron expression, by name. */
interface CronFields {
  readonly minute: string
  readonly hour: string
  readonly day: string
  readonly month: string
  readonly weekday: string
}

/** One shape of schedule this description reads, or `undefined` when it is another. */
type CronRule = (
  cron: CronFields,
  words: Words,
  language: DescriptionLanguage
) => string | undefined

/** A step field (a star, a slash and N): every N units. */
const stepOf = (field: string): string | undefined => /^\*\/(\d{1,2})$/.exec(field)?.[1]

/** Runs whatever the day: no day of the month, month or weekday narrows it. */
const everyDay = (cron: CronFields): boolean =>
  cron.day === '*' && cron.month === '*' && cron.weekday === '*'

/** At a fixed time of day on the days `weekday` names, the month and its days free. */
const timeOnWeekdays = (
  cron: CronFields,
  weekday: (field: string) => boolean
): string | undefined =>
  cron.day === '*' && cron.month === '*' && weekday(cron.weekday)
    ? clockOf(cron.minute, cron.hour)
    : undefined

const CRON_RULES: readonly CronRule[] = [
  (cron, words) =>
    everyDay(cron) && cron.hour === '*' && cron.minute === '*' ? words.everyMinute : undefined,
  (cron, words) => {
    const n = everyDay(cron) && cron.hour === '*' ? stepOf(cron.minute) : undefined
    return n === undefined ? undefined : fill(words.everyMinutes, { n })
  },
  (cron, words) =>
    everyDay(cron) && cron.hour === '*' && wholeIn(cron.minute, 0, 59) !== undefined
      ? fill(words.hourly, { mm: pad(cron.minute) })
      : undefined,
  (cron, words) => {
    const n = everyDay(cron) && cron.minute === '0' ? stepOf(cron.hour) : undefined
    return n === undefined ? undefined : fill(words.everyHours, { n })
  },
  (cron, words) => {
    const time = timeOnWeekdays(cron, (field) => field === '*')
    return time === undefined ? undefined : fill(words.daily, { time })
  },
  (cron, words) => {
    const time = timeOnWeekdays(cron, (field) => field === '1-5')
    return time === undefined ? undefined : fill(words.weekdays, { time })
  },
  (cron, _words, language) => {
    const time = timeOnWeekdays(cron, (field) => wholeIn(field, 0, 7) !== undefined)
    return time === undefined ? undefined : `${weekdayName(cron.weekday, language) ?? ''} ${time}`
  },
  (cron, words) => {
    const day = cron.month === '*' && cron.weekday === '*' ? wholeIn(cron.day, 1, 31) : undefined
    const time = day === undefined ? undefined : clockOf(cron.minute, cron.hour)
    return time === undefined ? undefined : fill(words.monthly, { day: String(day), time })
  },
]

/**
 * A five-field cron expression in words: `every 15 min`, `daily 06:00`,
 * `Mon 07:30`, `weekdays 08:00`, `monthly, day 1 09:00`. An expression these
 * shapes do not cover reads as itself — exact, if not friendly.
 */
export const describeCronExpression = (
  expression: string,
  language: DescriptionLanguage
): string => {
  const [minute, hour, day, month, weekday, ...extra] = expression.trim().split(/\s+/)
  if (weekday === undefined || extra.length > 0) return expression
  const cron = { minute, hour, day, month, weekday } as CronFields
  const words = WORDS[language]
  return (
    CRON_RULES.reduce<string | undefined>(
      (found, rule) => found ?? rule(cron, words, language),
      undefined
    ) ?? expression
  )
}

type RecordTrigger = Extract<Trigger, { readonly type: 'record' }>

/** The field a condition reads: `status` for `status` or `{{trigger.data.record.status}}`. */
const conditionField = (field: string): string =>
  field
    .replace(/^\{\{\s*|\s*\}\}$/g, '')
    .split('.')
    .at(-1) ?? field

/** `status → Signed` for a condition that one field equals one value, else `undefined`. */
const describeCondition = (condition: RecordTrigger['condition']): string | undefined => {
  const only = condition?.conditions.length === 1 ? condition.conditions[0] : undefined
  if (only?.operator !== 'equals' || only.value === undefined || only.value === null) {
    return undefined
  }
  return `${conditionField(only.field)} → ${String(only.value)}`
}

/** A record trigger: its table and what it watches — a value reached, fields changed, or its events. */
const describeRecord = (trigger: RecordTrigger, words: Words, names: DescriptionNames): string => {
  const watched = trigger.watchFields ?? []
  const what =
    describeCondition(trigger.condition) ??
    (watched.length > 0
      ? fill(words.changed, { fields: watched.join(', ') })
      : trigger.events.map((event) => words.events[event]).join(', '))
  return `${names.tableLabel(trigger.table)} · ${what}`
}

/** What an entry watches, in words, before any name its author gave it. */
const describeEntry = (
  trigger: Trigger,
  words: Words,
  language: DescriptionLanguage,
  names: DescriptionNames
): string => {
  if (trigger.type === 'cron') {
    return `${words.schedule} · ${describeCronExpression(trigger.expression, language)}`
  }
  if (trigger.type === 'record') return describeRecord(trigger, words, names)
  if (trigger.type === 'comment') return `${names.tableLabel(trigger.table)} · ${words.comment}`
  if (trigger.type === 'form') return `${words.form} · ${names.formLabel(trigger.form)}`
  return words.kinds[trigger.type]
}

/** The name an author gave an entry, or `undefined` when it goes by its type. */
const authorName = (trigger: {
  readonly type: string
  readonly name?: string | undefined
}): string | undefined =>
  trigger.name !== undefined && trigger.name !== trigger.type ? trigger.name : undefined

/**
 * What started a run, in the operator's `language`. An entry its author named
 * reads that name after the description (`Manual · on-demand`), so two entries
 * of one kind stay apart.
 *
 * @param trigger - the entry the run was started by, as the live config declares it
 * @param language - the operator's console language
 * @param names - how tables and forms are named
 */
export const describeTrigger = (
  trigger: Trigger,
  language: DescriptionLanguage,
  names: DescriptionNames
): string => {
  const text = describeEntry(trigger, WORDS[language], language, names)
  const name = authorName(trigger)
  return name === undefined ? text : `${text} · ${name}`
}

/** A trigger's kind in words, with nothing it watches: `Schedule`, `Record change`, `Webhook`. */
export const describeTriggerKind = (
  type: Trigger['type'],
  language: DescriptionLanguage
): string => {
  const words = WORDS[language]
  if (type === 'cron') return words.schedule
  if (type === 'form') return words.form
  if (type === 'record') return words.record
  if (type === 'comment') return words.commentKind
  return words.kinds[type]
}

/** One declared entry a trigger-name choice stands for: its type and its reading. */
export interface TriggerChoiceEntry {
  readonly type: Trigger['type']
  readonly label: string
}

/**
 * What a trigger-name filter choice reads as, from every entry carrying that
 * name across the app: the reading they all share; when they differ, their
 * kind in words, followed by the name when the author named the entries
 * (`Schedule · nightly`); when their kinds differ too, the name as written.
 */
export const describeTriggerChoice = (
  name: string,
  entries: ReadonlyArray<TriggerChoiceEntry>,
  language: DescriptionLanguage
): string => {
  const [first] = entries
  if (first === undefined) return name
  if (entries.every((entry) => entry.label === first.label)) return first.label
  if (!entries.every((entry) => entry.type === first.type)) return name
  const kind = describeTriggerKind(first.type, language)
  return name === first.type ? kind : `${kind} · ${name}`
}
