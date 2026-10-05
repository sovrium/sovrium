/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ENGINE_KEY_PREFIX, LEGACY_BARE_ENGINE_KEYS } from './interpreter-ui-strings'
import type { Languages } from './language'

/**
 * Report engine keys an author still overrides under their BARE name.
 *
 * An author overrides the engine's interface text under the reserved
 * `sovrium.` prefix. Ten keys were read bare before the prefix existed, and a
 * released app may spell them that way, so the resolver keeps reading them —
 * and this notice says, once for the whole config, which ones to rename.
 *
 * ### Why a notice and not a refusal
 *
 * The config is VALID and keeps its wording. Refusing would break a released
 * app on upgrade for a spelling that worked.
 *
 * ### Why only the ten
 *
 * Any other bare key that happens to match a catalogue name is the author's
 * own vocabulary and does nothing to the engine. A notice there would call
 * every app with a `form.submit` of its own wrong, and teach readers to ignore
 * notices.
 */

/** The greppable token the notice carries. */
export const ENGINE_KEY_UNPREFIXED_TOKEN = 'engine-key-unprefixed'

const LEGACY_BARE_KEYS: ReadonlySet<string> = new Set(LEGACY_BARE_ENGINE_KEYS)

/** `translations.en` for an identifier-shaped code, `translations['en-US']` otherwise. */
const languagePath = (code: string): string =>
  /^[A-Za-z_$][\w$]*$/.test(code)
    ? `languages.translations.${code}`
    : `languages.translations['${code}']`

/** One occurrence, worded with the spelling that replaces it. */
const describeOccurrence = (code: string, key: string): string =>
  `${languagePath(code)}['${key}'] overrides engine interface text under its bare name, which is deprecated — write it as '${ENGINE_KEY_PREFIX}${key}'`

/**
 * The `engine-key-unprefixed` notice for a config, naming every bare legacy key
 * it writes, in declaration order — or no notice at all.
 *
 * @param languages - The config's `languages` block
 * @returns Zero or one notice
 */
export const collectUnprefixedEngineKeyNotices = (
  languages: Languages | undefined
): readonly string[] => {
  const occurrences = Object.entries(languages?.translations ?? {}).flatMap(([code, dictionary]) =>
    Object.keys(dictionary)
      .filter((key) => LEGACY_BARE_KEYS.has(key))
      .map((key) => describeOccurrence(code, key))
  )
  if (occurrences.length === 0) return []
  return [
    `${ENGINE_KEY_UNPREFIXED_TOKEN}: ${occurrences.join(', ')}. The bare name still works for the ten keys that accepted it before the prefix.`,
  ]
}
