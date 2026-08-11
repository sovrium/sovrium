/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Per-locale labels for the "Built with Sovrium" badge.
 *
 * The badge is platform CHROME (like the docs-article chrome in
 * `pages/markdown/DocsChromeLabels.ts`, whose pattern this mirrors): its label
 * follows the page's active locale through an internal map — it is NOT
 * app-authored `$t:` translation content and is not customizable (trademark
 * clarity). Always "Built with", never "Powered by".
 */
const EN = 'Built with Sovrium'

const FR = 'Construit avec Sovrium'

/**
 * Locale → label. Typed as an open `Record<string, …>` (NOT an `'en' | 'fr'`
 * union) so any supported locale WITHOUT an entry resolves gracefully to the
 * English default via {@link getBadgeLabel}.
 */
const BADGE_LABELS: Readonly<Record<string, string>> = {
  en: EN,
  fr: FR,
}

/**
 * Resolve the badge label for the active language. Returns the English
 * default for `undefined` or any locale with no map entry (e.g. an unmapped
 * `de`) — a graceful English fallback.
 */
export const getBadgeLabel = (lang: string | undefined): string =>
  (lang !== undefined ? BADGE_LABELS[lang] : undefined) ?? EN
