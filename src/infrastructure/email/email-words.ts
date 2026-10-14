/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { escapeHtml } from '@/domain/kernel/markdown/markdown-renderer'
import { findDeclaredLanguageCode } from '@/domain/models/app/languages/language-detection'
import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import type { Languages } from '@/domain/models/app/languages'

/**
 * The words of a default auth email, in its reader's language: `email.<key>`
 * from the engine catalogue, renamed under `sovrium.email.<key>`.
 */
export interface EmailWords {
  /** The language the email declares on its `<html lang>`. */
  readonly lang: string
  /** `email.<key>` in that language, each `{slot}` filled once, in one pass. */
  readonly t: (key: string, slots?: Readonly<Record<string, string>>) => string
}

/** The words of `lang` (a code), renamed by the app's own translations. */
export const emailWordsFor = (lang: string, languages?: Languages): EmailWords => ({
  lang,
  t: (key, slots = {}) =>
    resolveInterpreterString(`email.${key}`, lang, languages).replace(
      /\{(\w+)\}/g,
      (slot, name: string) => slots[name] ?? slot
    ),
})

/**
 * The words an email to this reader is written in: the account's stored
 * language when the app declares it, else the app's default language, else
 * English — so an app that declares no languages sends the English it always did.
 */
export const recipientEmailWords = (
  languages: Languages | undefined,
  stored?: string | null
): EmailWords =>
  emailWordsFor(
    findDeclaredLanguageCode(languages, stored ?? undefined) ?? languages?.default ?? 'en',
    languages
  )

/** The English every default email is written in when no reader language is given. */
export const ENGLISH_WORDS = emailWordsFor('en')

/** The expiry spans the default emails name, as catalogue keys. */
const EXPIRY_KEYS: Readonly<Record<string, string>> = {
  '10 minutes': 'expiry.minutes10',
  '1 hour': 'expiry.hour1',
  '24 hours': 'expiry.hours24',
}

/** An expiry span in the reader's language; a span the catalogue does not word stays as written. */
export const expiryIn = (words: EmailWords, span: string): string => {
  const key = EXPIRY_KEYS[span]
  return key === undefined ? span : words.t(key)
}

/** The greeting, the name escaped for the HTML part. */
export const greetingsOf = (
  words: EmailWords,
  userName: string | undefined
): { readonly text: string; readonly html: string } =>
  userName
    ? {
        text: words.t('greeting', { name: userName }),
        html: words.t('greeting', { name: escapeHtml(userName) }),
      }
    : { text: words.t('greetingAnonymous'), html: words.t('greetingAnonymous') }
