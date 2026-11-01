/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A drawn edit to TRANSLATED copy, and what the page import writes for it.
 *
 * The page keeps its `$t:` key, never the drawn text. The text is written to
 * the DEFAULT language's entry for that key, and to no other language: every
 * other language holding the key is named as needing translation, because a
 * translation is written by a person who reads that language, never guessed.
 * Nothing is written, and the report says why, when the text is more than its
 * key, when the default language holds no entry for the key, or when the
 * config's translations are not a file the import edits.
 *
 * Pure: the same edit and languages always give the same answer.
 */

/** The languages a translated edit is read against. */
export interface TranslationScope {
  /** The app's default language code. */
  readonly defaultLanguage: string
  /** Every language's entries, by language code then key. */
  readonly translations: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  /** Why the config's translations cannot be written, when they cannot: a sentence. */
  readonly unwritable?: string | undefined
}

/** One translation entry the import writes. */
export interface TranslationWrite {
  readonly language: string
  /** The key, without its `$t:` prefix. */
  readonly key: string
  readonly text: string
}

/** What a translated edit comes to: its report fields, and the entry to write. */
export interface TranslationOutcome {
  readonly written?: string | undefined
  readonly needsTranslation?: readonly string[] | undefined
  readonly reason?: string | undefined
  readonly write?: TranslationWrite | undefined
}

/**
 * What the import does with one edit to translated copy.
 *
 * @param edit - the key (`$t:dashboard.title`), the config's text, the drawn text.
 * @param scope - the app's languages, or `undefined` when it declares none.
 */
export const translationOutcome = (
  edit: { readonly key: string; readonly configText: string | undefined; readonly text: string },
  scope: TranslationScope | undefined
): TranslationOutcome => {
  const key = edit.key.slice('$t:'.length)
  if (edit.configText !== edit.key) {
    return {
      reason: `The text holds more than the key ${edit.key}, so nothing was written; change it in the config.`,
    }
  }
  if (scope === undefined) {
    return {
      reason: 'The app declares no languages, so the translation has nowhere to be written.',
    }
  }
  const { defaultLanguage, translations } = scope
  const others = Object.keys(translations).filter(
    (language) => language !== defaultLanguage && translations[language]?.[key] !== undefined
  )
  if (typeof translations[defaultLanguage]?.[key] !== 'string') {
    return {
      needsTranslation: others,
      reason: `The default language ${defaultLanguage} holds no entry for ${key}, so nothing was written; add it to languages.translations.${defaultLanguage}.`,
    }
  }
  if (scope.unwritable !== undefined) {
    return {
      needsTranslation: others,
      reason: `${scope.unwritable} Change the ${defaultLanguage} entry for ${key} there.`,
    }
  }
  return {
    written: defaultLanguage,
    needsTranslation: others,
    write: { language: defaultLanguage, key, text: edit.text },
  }
}

/**
 * The keys of a run drawn two ways: two edits of one key that do not agree,
 * which the caller refuses to write rather than pick one.
 *
 * @param writes - every write, in report order.
 */
export const conflictingKeys = (writes: readonly TranslationWrite[]): ReadonlySet<string> =>
  new Set(
    [...Map.groupBy(writes, (write) => write.key)]
      .filter(([, group]) => new Set(group.map((write) => write.text)).size > 1)
      .map(([key]) => key)
  )
