/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Per-locale docs-article CHROME labels.
 *
 * The docs three-column layout renders a handful of hardcoded chrome literals
 * (breadcrumb "Home"; prev/next "Previous"/"Next"; TOC "On this page"; the
 * "Copy/View/Edit" affordances; the "Last updated" stamp label) that must follow
 * the active request language. This module is the single source of truth for
 * those labels — a presentation-layer locale → label map (the same shape the docs
 * sidebar's section zone mapping in `DocsSidebarTabs.ts` uses).
 *
 * NOTE: only the LABELS localize here — NOT the last-updated DATE VALUE (still an
 * English `Month D, YYYY` from `formatHumanDate`); locale-aware date formatting
 * is a documented follow-up.
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
}

const EN: DocsChromeLabels = {
  home: 'Home',
  previous: 'Previous',
  next: 'Next',
  onThisPage: 'On this page',
  viewAsMarkdown: 'View as Markdown',
  copyAsMarkdown: 'Copy as Markdown',
  editThisPage: 'Edit this page',
  reportAnIssue: 'Report an issue',
  lastUpdated: 'Last updated',
}

const FR: DocsChromeLabels = {
  home: 'Accueil',
  previous: 'Précédent',
  next: 'Suivant',
  onThisPage: 'Sur cette page',
  viewAsMarkdown: 'Voir en Markdown',
  copyAsMarkdown: 'Copier en Markdown',
  editThisPage: 'Modifier cette page',
  reportAnIssue: 'Signaler un problème',
  lastUpdated: 'Dernière mise à jour',
}

/**
 * Locale → labels. Typed as an open `Record<string, …>` (NOT an `'en' | 'fr'`
 * union) so any supported locale WITHOUT an entry resolves gracefully to the
 * English default via {@link getDocsChromeLabels}.
 */
const DOCS_CHROME_LABELS: Readonly<Record<string, DocsChromeLabels>> = {
  en: EN,
  fr: FR,
}

/**
 * Resolve the docs-chrome labels for the active language. Returns the English
 * default for `undefined` (no `/:lang/` prefix) or any locale with no map entry
 * (e.g. an unmapped `de`) — a graceful English fallback.
 */
export const getDocsChromeLabels = (lang: string | undefined): DocsChromeLabels =>
  (lang !== undefined ? DOCS_CHROME_LABELS[lang] : undefined) ?? EN
