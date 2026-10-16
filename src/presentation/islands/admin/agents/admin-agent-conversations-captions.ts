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
}

const EN: ConversationCaptions = {
  untitled: 'Untitled',
  messages: { one: '{count} message', other: '{count} messages' },
  // Beside the New conversation control, so the note says what each one is
  // for: a user's thread is read, never answered; a thread of your own is
  // started from the button.
  readOnly: 'Read-only: this thread is its user’s. New conversation starts one of your own.',
  model: 'Model',
  input: 'Input',
  output: 'Output',
}

const CAPTIONS: Readonly<Record<string, ConversationCaptions>> = {
  en: EN,
  fr: {
    untitled: 'Sans titre',
    messages: { one: '{count} message', other: '{count} messages' },
    readOnly:
      'Lecture seule : ce fil est celui de son utilisateur. Pour en ouvrir un à toi, commence une nouvelle conversation.',
    model: 'Modèle',
    input: 'Entrée',
    output: 'Sortie',
  },
}

/** The caption set for the page language. */
export const conversationCaptions = (): ConversationCaptions =>
  resolveForLanguage(CAPTIONS, resolvePageLocale(), EN)

/** "1 message" / "3 messages", in the page language. */
export function messageCountText(count: number): string {
  const { messages } = conversationCaptions()
  const category = new Intl.PluralRules(resolvePageLocale()).select(count)
  return (messages[category] ?? messages.other).replace('{count}', String(count))
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

/** "2 hours ago" / "il y a 2 heures", or `—` for a value naming no instant. */
export function relativeTimeText(iso: string, now: number = Date.now()): string {
  const at = iso ? new Date(iso).getTime() : Number.NaN
  if (Number.isNaN(at)) return '—'
  const seconds = Math.round((at - now) / 1000)
  const [unit, size] = UNITS.find(([, length]) => Math.abs(seconds) >= length) ?? ['second', 1]
  const format = new Intl.RelativeTimeFormat(resolvePageLocale(), { numeric: 'auto' })
  return format.format(Math.round(seconds / size), unit)
}
