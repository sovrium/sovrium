/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { INTERPRETER_UI_STRINGS } from '@/domain/models/app/languages/interpreter-ui-strings'
import {
  resolveInterpreterString,
  resolveInterpreterStringOverrides,
} from '@/domain/models/app/languages/translation-resolver'
import type { Languages } from '@/domain/models/app/languages'

/**
 * The status name a data component's server-rendered placeholder carries while
 * it loads (`kpi.loading`, `chart.loading`, …), in the page language.
 */
export function islandLoadingLabel(
  key: string,
  currentLang: string | undefined,
  languages: Languages | undefined
): { readonly status: string } {
  return { status: resolveInterpreterString(key, currentLang, languages) }
}

/**
 * The words a data component's island draws itself — its loading status, its
 * failed read and its missing binding (`<component>.*`), and the two lines
 * every such state shares (`component.*`) — in the page language, and only
 * where they differ from the English the island is written in, so an English
 * page's island props are unchanged.
 */
export const islandUiStrings = (
  component: string,
  currentLang: string | undefined,
  languages: Languages | undefined
): Readonly<Record<string, string>> | undefined =>
  resolveInterpreterStringOverrides([`${component}.`, 'component.'], currentLang, languages)

/**
 * EVERY catalogue word under `prefixes`, in the page language — for an island
 * that carries no English of its own because its mount budget has no room for
 * a fallback, so the server, its only mounter, hands it each word it draws.
 */
export const islandAllStrings = (
  prefixes: readonly string[],
  currentLang: string | undefined,
  languages: Languages | undefined
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.keys(INTERPRETER_UI_STRINGS)
      .filter((key) => prefixes.some((prefix) => key.startsWith(prefix)))
      .map((key) => [key, resolveInterpreterString(key, currentLang, languages)])
  )
