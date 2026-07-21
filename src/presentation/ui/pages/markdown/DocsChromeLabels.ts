/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export interface DocsChromeLabels {
  readonly home: string
  readonly previous: string
  readonly next: string
  readonly onThisPage: string
  readonly viewAsMarkdown: string
  readonly copyAsMarkdown: string
  readonly editThisPage: string
  readonly reportAnIssue: string
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

const DOCS_CHROME_LABELS: Readonly<Record<string, DocsChromeLabels>> = {
  en: EN,
  fr: FR,
}

export const getDocsChromeLabels = (lang: string | undefined): DocsChromeLabels =>
  (lang !== undefined ? DOCS_CHROME_LABELS[lang] : undefined) ?? EN
