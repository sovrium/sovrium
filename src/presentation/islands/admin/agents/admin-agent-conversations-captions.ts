/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The words the conversation viewer writes itself, in the page's language.
 *
 * Platform chrome, so it follows the calendar's rule: a locale → copy table
 * read through `resolveForLanguage` against `<html lang>`, a regional tag
 * (`fr-FR`) answered by its short code, and English for a language with no
 * entry. Counts go through `Intl.PluralRules` and instants through
 * `Intl.RelativeTimeFormat`, both on the same locale — so "0 message" in French
 * and "0 messages" in English are each right, which a hand-written `s` was not.
 */

import { resolveForLanguage } from '@/domain/models/app/languages/locale-lookup-service'
import { resolvePageLocale } from '../../runtime/page-locale'

export interface ConversationCaptions {
  /** A conversation with no title. */
  readonly untitled: string
  /** The message count, by plural category (`{count}` is the number). */
  readonly messages: Readonly<Partial<Record<Intl.LDMLPluralRule, string>>> & {
    readonly other: string
  }
  /** The note under every transcript: a user's thread is read, never answered. */
  readonly readOnly: string
  /** The accessible name of a message's model badge. */
  readonly model: string
  /** The two halves of an opened tool call. */
  readonly input: string
  readonly output: string
  /** How a recorded call ended, in its opened row. */
  readonly outcome: string
  /** The control that leaves an open thread for the list, on a phone. */
  readonly back: string
  /** When the thread began (`{date}`): a date, or a relative day (`startedRelative`). */
  readonly started: string
  readonly startedRelative: string
  /** A recorded call: what ran (`{tool}`), where (`{table}`), how many rows. */
  readonly used: string
  readonly on: string
  readonly rows: Readonly<Partial<Record<Intl.LDMLPluralRule, string>>> & {
    readonly other: string
  }
}

const EN: ConversationCaptions = {
  untitled: 'Untitled',
  messages: { one: '{count} message', other: '{count} messages' },
  // A user's thread is read, never answered: the console starts no thread of
  // its own.
  readOnly: 'Read-only: this thread is its user’s.',
  model: 'Model',
  input: 'Input',
  output: 'Output',
  outcome: 'Outcome',
  back: 'Back to conversations',
  started: 'started {date}',
  startedRelative: 'started {date}',
  used: 'Used {tool}',
  on: ' on {table}',
  rows: { one: '{count} row', other: '{count} rows' },
}

const CAPTIONS: Readonly<Record<string, ConversationCaptions>> = {
  en: EN,
  fr: {
    untitled: 'Sans titre',
    messages: { one: '{count} message', other: '{count} messages' },
    readOnly: 'Lecture seule : ce fil appartient à son utilisateur.',
    model: 'Modèle',
    input: 'Entrée',
    output: 'Sortie',
    outcome: 'Résultat',
    back: 'Retour aux conversations',
    started: 'commencée le {date}',
    startedRelative: 'commencée {date}',
    used: 'Appel à {tool}',
    on: ' sur {table}',
    rows: { one: '{count} ligne', other: '{count} lignes' },
  },
}

/** The caption set for the page language. */
export const conversationCaptions = (): ConversationCaptions =>
  resolveForLanguage(CAPTIONS, resolvePageLocale(), EN)

/** One count in the page language's plural (`Intl.PluralRules`). */
function countText(
  forms: ConversationCaptions['messages'] | ConversationCaptions['rows'],
  count: number
): string {
  const category = new Intl.PluralRules(resolvePageLocale()).select(count)
  return (forms[category] ?? forms.other).replace('{count}', String(count))
}

/** "1 message" / "3 messages", in the page language. */
export function messageCountText(count: number): string {
  return countText(conversationCaptions().messages, count)
}

/**
 * "Used record.list on Orders · 4 rows" — one recorded call, in the page
 * language, split around the tool's name so the row can set the name in mono
 * while the sentence still reads as one line.
 */
export function recordedCallParts(call: {
  readonly name: string
  readonly table?: string | undefined
  readonly rowCount?: number | undefined
}): { readonly before: string; readonly tool: string; readonly after: string } {
  const { used, on, rows } = conversationCaptions()
  const where = call.table === undefined ? '' : on.replace('{table}', () => call.table ?? '')
  const count = call.rowCount === undefined ? '' : ` · ${countText(rows, call.rowCount)}`
  const at = used.indexOf('{tool}')
  return {
    before: used.slice(0, at),
    tool: call.name,
    after: `${used.slice(at + '{tool}'.length)}${where}${count}`,
  }
}

const UNITS: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
]

/** How far ahead of the reader's clock a stamp may sit and still read as "now". */
const SKEW_SECONDS = 300

/** "2 hours ago" / "il y a 2 heures", or `—` for a value naming no instant. */
export function relativeTimeText(iso: string, now: number = Date.now()): string {
  const at = iso ? new Date(iso).getTime() : Number.NaN
  if (Number.isNaN(at)) return '—'
  // A stamp a few minutes ahead of this browser's clock is clock skew between
  // the server and the reader, not a future event: it reads as "now".
  const ahead = Math.round((at - now) / 1000)
  const seconds = ahead > 0 && ahead < SKEW_SECONDS ? 0 : ahead
  const [unit, size] = UNITS.find(([, length]) => Math.abs(seconds) >= length) ?? ['second', 1]
  const format = new Intl.RelativeTimeFormat(resolvePageLocale(), { numeric: 'auto' })
  return format.format(Math.round(seconds / size), unit)
}
