/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What the console prints under the name on the reader's own directory row,
 * per console language.
 *
 * An engine word, like the sign-in methods beside it: no app config declares
 * it, so no app dictionary can translate it. The console speaks to the
 * operator in the second person, and in French with « tu ».
 */

import type { ConsoleLanguage } from './operator-language'

/** The caption of the reader's own row. */
const SELF_WORDS: Readonly<Record<ConsoleLanguage, string>> = {
  en: 'You',
  fr: 'Toi',
}

/** What the console prints under the reader's own name, in `language`. */
export const selfLabelOf = (language: ConsoleLanguage): string => SELF_WORDS[language]
