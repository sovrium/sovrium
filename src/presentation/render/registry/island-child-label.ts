/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import type { Languages } from '@/domain/models/app/languages'

/**
 * Resolve a CHILD component's caption through the active language.
 *
 * **Why this is needed at all.** `substitutePropsTranslationTokens` runs over the
 * props of the component currently being rendered (see `component-builder.ts`) —
 * and the `tabs` / `accordion` renderers do not read their children's rendered
 * output, they read the RAW child objects off `component.children` to build the
 * island's `items`. So both caption placements arrive unresolved:
 *
 *  - `content.label` / `content.title` — `content` is a top-level field, and
 *    `$t:` substitution never touches top-level fields;
 *  - `props.label` — substitution DOES reach it, but the substituted copy is on
 *    the rendered element the extractor throws away.
 *
 * The second one is the trap: it is the placement that looks like it must work.
 * Without this, a `$t:apps.crm.name` caption is painted on the tab verbatim and
 * a tabbed hero is unusable for any app with more than one locale.
 *
 * Mirrors the same `resolveTranslationPattern` call the auth-form and crud-form
 * renderers make for their own built-in labels.
 */
export function localizeChildLabel(
  text: string,
  currentLang: string | undefined,
  languages: Languages | undefined
): string {
  if (text.length === 0) return text
  return resolveTranslationPattern(text, currentLang ?? languages?.default ?? '', languages)
}

/**
 * Slug source for a caption-derived id.
 *
 * A `$t:` caption is slugified from its translation KEY, not from the resolved
 * text: an id derived from the caption would be `projects` in English and
 * `projets` in French, so a `defaultTab` / `defaultOpen` referencing it could
 * only ever match in one locale — and would silently match NOTHING in the other,
 * leaving the container with no active panel. The key is locale-invariant, which
 * is exactly the property an id needs.
 */
export function idSourceForLabel(label: string): string {
  return label.startsWith('$t:') ? label.slice(3) : label
}

/** Slugify a caption (or translation key) into a stable element id. */
export function slugifyLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
