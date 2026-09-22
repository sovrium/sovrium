/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveForLanguage } from '@/domain/models/app/languages/locale-lookup-service'

/**
 * Per-locale accessible name for a toast's dismiss control.
 *
 * The control is platform CHROME (exactly like the "Built with Sovrium" badge in
 * `badge-labels.ts` and the demo notice in `demo-notice-labels.ts`, whose
 * pattern this mirrors): its label follows the page's active locale through an
 * internal map — it is NOT app-authored `$t:` translation content and is not
 * customizable. The word names a platform affordance, not anything the author
 * wrote, so letting a config supply it would turn chrome into an untranslatable
 * content surface.
 *
 * It reaches the browser as an attribute on the server-rendered toast container
 * rather than as a client-side lookup, because the renderers that build the
 * control run in the browser with no access to the page's locale. A page that
 * declares no `page.toasts` renders no container to carry it, so a toast raised
 * there falls back to the English default in
 * `islands/runtime/toast-accessibility.ts`.
 */
const EN = 'Dismiss'

const FR = 'Fermer'

/**
 * Locale → label. Typed as an open `Record<string, …>` (NOT an `'en' | 'fr'`
 * union) so any supported locale WITHOUT an entry resolves gracefully to the
 * English default via {@link getToastDismissLabel}.
 */
const TOAST_DISMISS_LABELS: Readonly<Record<string, string>> = {
  en: EN,
  fr: FR,
}

/**
 * Resolve the dismiss label for the active language. A regional tag resolves
 * through its primary subtag (`fr-FR` → `fr`), so a French-locale page names the
 * control in French; `undefined` and any locale with no map entry (e.g. an
 * unmapped `de`) fall back to English, so an unmapped locale never leaves the
 * control without an accessible name. The same {@link resolveForLanguage} every
 * chrome map uses.
 */
export const getToastDismissLabel = (lang: string | undefined): string =>
  resolveForLanguage(TOAST_DISMISS_LABELS, lang, EN)
