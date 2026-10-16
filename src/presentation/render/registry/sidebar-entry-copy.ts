/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import { resolveChildTranslation } from '../i18n/translation-handler'
import type { SidebarI18n } from './sidebar-entry'

/** Default toggle names (catalogue keys), both carrying the `{label}` a fixed string cannot. */
export const DEFAULT_EXPAND_LABEL = 'sidebar.expand'
export const DEFAULT_COLLAPSE_LABEL = 'sidebar.collapse'

/** Default copy (catalogue keys) for the three states only a FETCHED child list can be in. */
export const DEFAULT_LOADING_LABEL = 'sidebar.loading'
export const DEFAULT_ERROR_LABEL = 'sidebar.loadFailed'
export const DEFAULT_EMPTY_LABEL = 'sidebar.empty'

/**
 * A sidebar copy field in the page language: the author's own wording
 * (`$t:` resolved), else the default the component ships (`sidebar.*`).
 */
export const copy = (value: string | undefined, fallback: string, i18n: SidebarI18n): string =>
  value === undefined
    ? resolveInterpreterString(fallback, i18n.currentLang, i18n.languages)
    : resolveChildTranslation(value, i18n.currentLang, i18n.languages)
