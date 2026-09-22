/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  collectTranslationsForKey,
  resolveTranslationPattern,
  resolveTranslationTokensDeep,
} from '@/domain/models/app/languages/translation-resolver'
import type { Languages } from '@/domain/models/app/languages'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * Find first translation key in children
 */
export function findFirstTranslationKey(
  children: readonly (Component | string)[] | undefined
): string | undefined {
  return children
    ?.find(
      (child: Component | string): child is string =>
        typeof child === 'string' && child.startsWith('$t:')
    )
    ?.slice(3) // Remove '$t:' prefix
}

/**
 * Extract translation key from content string
 * Returns the key portion after $t: prefix if content is a translation token
 */
export function extractTranslationKeyFromContent(content: string | undefined): string | undefined {
  if (!content || typeof content !== 'string') return undefined
  return content.startsWith('$t:') ? content.slice(3) : undefined
}

/**
 * Get current language with fallback
 */
export function getCurrentLanguage(
  currentLang: string | undefined,
  languages: Languages | undefined
): string {
  return currentLang || languages?.default || 'en-US'
}

/**
 * Resolve translation pattern for a child element
 */
export function resolveChildTranslation(
  child: string,
  currentLang: string | undefined,
  languages: Languages | undefined
): string {
  const lang = getCurrentLanguage(currentLang, languages)
  return resolveTranslationPattern(child, lang, languages)
}

/**
 * Collect translation data for a key
 */
export function getTranslationData(
  translationKey: string | undefined,
  languages: Languages | undefined
): Record<string, string> | undefined {
  return translationKey ? collectTranslationsForKey(translationKey, languages) : undefined
}

/**
 * Substitutes translation tokens in props recursively
 *
 * Walks through props object and replaces all $t:key patterns with actual translations.
 * Handles nested objects (e.g., style props) recursively.
 *
 * @param props - Component props that may contain translation tokens
 * @param currentLang - Current language code
 * @param languages - Languages configuration
 * @returns Props with translation tokens replaced
 *
 * @example
 * ```typescript
 * const languages = {
 *   default: 'en',
 *   translations: { 'en': { 'close.label': 'Close dialog' } }
 * }
 * const props = {
 *   'aria-label': '$t:close.label',
 *   title: 'Static text'
 * }
 * substitutePropsTranslationTokens(props, 'en-US', languages)
 * // {
 * //   'aria-label': 'Close dialog',
 * //   title: 'Static text'
 * // }
 * ```
 */
export function substitutePropsTranslationTokens(
  props: Record<string, unknown> | undefined,
  currentLang: string | undefined,
  languages: Languages | undefined
): Record<string, unknown> | undefined {
  if (!props || !languages) {
    return props
  }

  const lang = getCurrentLanguage(currentLang, languages)

  // Use functional Object.entries + reduce for immutable transformation
  return Object.entries(props).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (typeof value === 'string') {
      return { ...acc, [key]: resolveTranslationPattern(value, lang, languages) }
    } else if (Array.isArray(value)) {
      // Recursively handle arrays (like navigation links, footer columns)
      return {
        ...acc,
        [key]: value.map((item) =>
          item && typeof item === 'object' && !Array.isArray(item)
            ? substitutePropsTranslationTokens(
                item as Record<string, unknown>,
                currentLang,
                languages
              )
            : typeof item === 'string'
              ? resolveTranslationPattern(item, lang, languages)
              : item
        ),
      }
    } else if (value && typeof value === 'object') {
      // Recursively handle nested objects (like style props)
      return {
        ...acc,
        [key]: substitutePropsTranslationTokens(
          value as Record<string, unknown>,
          currentLang,
          languages
        ),
      }
    } else {
      return { ...acc, [key]: value }
    }
  }, {})
}

/**
 * Resolve `$t:` tokens across a record of SCHEMA-LEVEL fields lifted onto the
 * element props.
 *
 * The sibling of {@link substitutePropsTranslationTokens}, for the other half
 * of a component's surface. That one walks `component.props` — the freeform
 * bag — while a typed field declared beside `props` (a kpi `label`, a chart
 * `emptyMessage`, a data-table `viewLabels`) never passes through it, because
 * the per-type lift that copies those fields runs afterwards. Without this,
 * whether an author's token resolved depended on which of the two a field
 * happened to be, a distinction invisible from the config.
 *
 * Shares that function's language rule rather than restating it: absent a
 * `currentLang`, the app's default language still resolves, so the two routes
 * cannot disagree. Non-`$t:` strings — URLs, endpoints, `$record.` / `$query.`
 * bindings — are returned untouched, as is an already-resolved string, which
 * makes the pass safe to run over props that have already been substituted.
 */
export function resolveLiftedTranslationTokens(
  lifted: Record<string, unknown>,
  currentLang: string | undefined,
  languages: Languages | undefined
): Record<string, unknown> {
  const lang = getCurrentLanguage(currentLang, languages)
  return resolveTranslationTokensDeep(lifted, lang, languages) as Record<string, unknown>
}

/**
 * The component keys {@link resolveComponentTranslationTokens} leaves alone,
 * each because something else already owns it.
 *
 * `props` is walked by {@link substitutePropsTranslationTokens}, immediately
 * after, and must stay there: its pass has to run BEFORE design-token
 * substitution, an ordering this one knows nothing about.
 *
 * `children` and `content` are the load-bearing two, and the reason is not
 * cost. `buildTranslationProps` derives `data-translation-key` and
 * `data-translations` from the RAW token found in them, and those attributes
 * are what lets the client-side language switcher re-translate without a round
 * trip. Resolve them here and the token is gone before that read, so the
 * attributes vanish and switching language silently stops updating the text.
 * They are resolved later, per child, by `resolveChildTranslation`.
 *
 * `responsive` carries only per-breakpoint `props` / `children` / `content`
 * overrides, which `mergeResponsiveProps` folds into exactly those three before
 * their own passes see them; `i18n` is the per-language override map that
 * `resolveI18nContent` reads by language code.
 *
 * `graphView` / `matrixView` are the odd pair out: not authored config at all,
 * but the RESULT of a render-path read, attached by the graph and matrix
 * resolvers. A token cannot reach them from a config file, and walking them
 * would translate strings an endpoint returned — data, not vocabulary — beside
 * re-walking a whole drawing on every render.
 *
 * `panels` is `children` and `content`'s third sibling, for a reason of its own.
 * A tab panel's `id` is DERIVED from its caption when the author writes none,
 * and `buildTabsItems` derives it from the raw token's KEY precisely so that the
 * id does not move with the active locale — `$t:apps.projects.name` yields
 * `apps-projects-name` in every language, which is what lets one `defaultTab`
 * address one panel in all of them. Resolve the caption
 * here and the derivation sees `Projects` in English and `Projets` in French, so
 * `defaultTab` matches in at most one locale and silently opens the first tab in
 * the others. Nothing is left untranslated by the skip: `buildTabsItems`
 * localises every caption and description itself, via `localizeChildLabel`.
 */
const COMPONENT_KEYS_RESOLVED_ELSEWHERE: ReadonlySet<string> = new Set([
  'props',
  'children',
  'content',
  'panels',
  'responsive',
  'i18n',
  'graphView',
  'matrixView',
])

/**
 * Resolve `$t:` tokens across a component's own SCHEMA-LEVEL fields.
 *
 * The third and last route by which an authored string reaches the DOM, and the
 * one neither sibling above covers. {@link substitutePropsTranslationTokens}
 * walks `component.props`; `resolveLiftedTranslationTokens` walks whatever the
 * per-type lift in `buildTypeSpecificElementProps` copied onto the element
 * props. But a renderer may read a typed field STRAIGHT off the component
 * object it is handed — `graph` and `matrix` both read their `label` and
 * `emptyMessage` that way — and such a field is lifted by nothing, so no lift
 * can resolve it. Adding a per-type entry would not help either: the entry
 * writes element props the renderer never looks at.
 *
 * So the pass happens once, here, over the component itself, BEFORE either
 * sibling runs. That also means a lifted field arrives at the lift already
 * resolved; `resolveLiftedTranslationTokens` still earns its place downstream,
 * because the lift additionally carries strings resolved from `app.tables` —
 * field labels, view names — which never pass through here at all.
 *
 * Absent a dictionary the component is returned unchanged, by identity: an app
 * that declares no `translations` pays one property read per component and no
 * walk.
 */
export function resolveComponentTranslationTokens(
  component: Component,
  currentLang: string | undefined,
  languages: Languages | undefined
): Component {
  if (!languages?.translations) return component
  const lang = getCurrentLanguage(currentLang, languages)
  const fields = component as Readonly<Record<string, unknown>>
  const resolved = Object.fromEntries(
    Object.entries(fields)
      .filter(([key]) => !COMPONENT_KEYS_RESOLVED_ELSEWHERE.has(key))
      .map(([key, value]) => [key, resolveTranslationTokensDeep(value, lang, languages)])
  )
  return { ...fields, ...resolved } as Component
}
