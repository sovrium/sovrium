/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveForLanguage } from '@/domain/models/app/languages/locale-lookup-service'
import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import {
  resolvePageSearchWords,
  type PageSearchWords,
} from '@/presentation/render/elements/search-input-renderers'
import type { Languages } from '@/domain/models/app/languages'

/**
 * Per-locale docs-article CHROME labels.
 *
 * The docs three-column layout renders a handful of hardcoded chrome literals
 * (breadcrumb "Home"; prev/next "Previous"/"Next"; TOC "On this page"; the
 * "Copy/View/Edit" affordances; the "Last updated" stamp label) that must follow
 * the active request language. This module is the single source of truth for
 * those labels — a presentation-layer locale → label map (the same shape the docs
 * sidebar's section zone mapping in `docs-sidebar-tabs.ts` uses).
 *
 * The words an app may rename — the sidebar search field, the outline, the
 * breadcrumb and the pager — are engine interface strings instead (`docs.*`,
 * `breadcrumb.label`), resolved through
 * {@link resolveInterpreterString} so `languages.translations[<lang>]['sovrium.<key>']`
 * overrides them as it overrides every other engine word.
 */

/** The full set of localizable docs-chrome labels. */
export interface DocsChromeLabels {
  /** Breadcrumb root link text. */
  readonly home: string
  /** Prev-card label (the `←` arrow is added by the renderer). */
  readonly previous: string
  /** Next-card label (the `→` arrow is added by the renderer). */
  readonly next: string
  /** Right-rail table-of-contents heading. */
  readonly onThisPage: string
  /** No-JS "view the raw markdown" affordance. */
  readonly viewAsMarkdown: string
  /** Client-side "copy the raw markdown" affordance. */
  readonly copyAsMarkdown: string
  /** "Edit this page" affordance (rendered only when `contentDir.editUrl` is set). */
  readonly editThisPage: string
  /** "Report an issue" affordance (rendered only when `contentDir.issueUrl` is set). */
  readonly reportAnIssue: string
  /** Prefix for the last-updated stamp (the date value stays as-is). */
  readonly lastUpdated: string
  /** Name of the button that opens the documentation navigation below `lg`. */
  readonly menu: string
  /** Opens the name of a wide table's scroll region, before its column headers. */
  readonly table: string
  /** Placeholder and accessible name of the docs search field in the sidebar (`nav.search`). */
  readonly searchDocs: string
  /** Accessible name of the article's outline (`docs.outline`). */
  readonly outline: string
  /** Accessible name of the article's breadcrumb (`breadcrumb.label`). */
  readonly breadcrumb: string
  /** Name of the button that closes the navigation drawer below `lg` (`sidebar.drawerClose`). */
  readonly menuClose: string
  /** What the sidebar search's results panel says (`search.searching`, …). */
  readonly searchWords: PageSearchWords
}

/** The labels no app renames: drawn from the locale map below. */
type FixedDocsChromeLabels = Omit<
  DocsChromeLabels,
  'previous' | 'next' | 'searchDocs' | 'outline' | 'breadcrumb' | 'menuClose' | 'searchWords'
>

const EN: FixedDocsChromeLabels = {
  home: 'Home',
  onThisPage: 'On this page',
  viewAsMarkdown: 'View as Markdown',
  copyAsMarkdown: 'Copy as Markdown',
  editThisPage: 'Edit this page',
  reportAnIssue: 'Report an issue',
  lastUpdated: 'Last updated',
  menu: 'Menu',
  table: 'Table',
}

const FR: FixedDocsChromeLabels = {
  home: 'Accueil',
  onThisPage: 'Sur cette page',
  viewAsMarkdown: 'Voir en Markdown',
  copyAsMarkdown: 'Copier en Markdown',
  editThisPage: 'Modifier cette page',
  reportAnIssue: 'Signaler un problème',
  lastUpdated: 'Dernière mise à jour',
  menu: 'Menu',
  table: 'Tableau',
}

/**
 * Locale → labels. Typed as an open `Record<string, …>` (NOT an `'en' | 'fr'`
 * union) so any supported locale WITHOUT an entry resolves gracefully to the
 * English default via {@link getDocsChromeLabels}.
 */
const DOCS_CHROME_LABELS: Readonly<Record<string, FixedDocsChromeLabels>> = {
  en: EN,
  fr: FR,
}

/**
 * Resolve the docs-chrome labels for the active language. Returns the English
 * default for `undefined` (no `/:lang/` prefix) or any locale with no map entry
 * (e.g. an unmapped `de`) — a graceful English fallback.
 *
 * Shares {@link resolveForLanguage} with the three other platform-chrome maps
 * (the badge, the dev-mode notice, the toast dismiss control), so a regional tag
 * resolves through its primary subtag (`fr-FR` → `fr`) rather than missing the
 * map and falling back to English.
 *
 * That relaxation is currently UNREACHABLE on this path, and is here for
 * consistency rather than to fix a live defect. This label lookup is fed
 * `markdown.lang`, which is `resolveMarkdownPage`'s `currentLang` — the
 * request-resolved `detectedLanguage`, matched against `supported[].code`, and
 * `LanguageCodeSchema` constrains a code to `/^[a-z]{2}$/`. So a regional tag
 * cannot arrive here while that remains the source. It CAN arrive at the other
 * three, which read `resolvePageLanguage`'s `lang` — fed by an authored
 * `meta.lang` and by the persisted language preference, both of which carry the
 * full locale. Keeping the four lookups identical is what stops this one being
 * the odd one out if the docs lang source ever widens to that resolver.
 *
 * `languages` carries the app's own words: an override of an engine key the
 * docs chrome reads replaces the built-in word in that language.
 */
export const getDocsChromeLabels = (
  lang: string | undefined,
  languages?: Languages
): DocsChromeLabels => {
  const word = (key: string): string => resolveInterpreterString(key, lang, languages)
  return {
    ...resolveForLanguage(DOCS_CHROME_LABELS, lang, EN),
    previous: word('docs.pager.previous'),
    next: word('docs.pager.next'),
    searchDocs: word('docs.search'),
    outline: word('docs.outline'),
    breadcrumb: word('breadcrumb.label'),
    menuClose: word('sidebar.drawerClose'),
    searchWords: resolvePageSearchWords(lang, languages),
  }
}
