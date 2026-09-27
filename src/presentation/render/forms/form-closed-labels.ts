/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveForLanguage } from '@/domain/models/app/languages/locale-lookup-service'

/**
 * Per-locale default copy for the closed-form page.
 *
 * The sentence the engine writes when a form carries no `closedPage` of its
 * own is platform chrome, like the badge (`render/page/badge-labels.ts`,
 * whose pattern this mirrors): it follows the document's language through an
 * internal map and is not app-authored `$t:` content. The engine ships English
 * and French; any other language falls back to English rather than rendering
 * blank. An app wanting its own words in every language authors
 * `availability.closedPage` with `$t:` keys.
 */
export interface FormClosedLabels {
  readonly closed: string
  readonly notYetOpen: string
  readonly notYetOpenAt: (opensAt: string) => string
}

const EN: FormClosedLabels = {
  closed: 'This form is closed and no longer accepting submissions.',
  notYetOpen: 'This form is not yet open.',
  notYetOpenAt: (opensAt) => `This form is not yet open. It opens at ${opensAt}.`,
}

const FR: FormClosedLabels = {
  closed: 'Ce formulaire est fermé et n’accepte plus de réponses.',
  notYetOpen: 'Ce formulaire n’est pas encore ouvert.',
  notYetOpenAt: (opensAt) => `Ce formulaire n’est pas encore ouvert. Il ouvrira le ${opensAt}.`,
}

/**
 * Locale → labels. An open `Record<string, …>` so a supported language with no
 * entry resolves to the English default via {@link getFormClosedLabels}.
 */
const FORM_CLOSED_LABELS: Readonly<Record<string, FormClosedLabels>> = {
  en: EN,
  fr: FR,
}

/**
 * Resolve the closed-page copy for the document language. A regional tag
 * resolves through its primary subtag (`fr-FR` → `fr`); `undefined` and any
 * unmapped language fall back to English.
 */
export const getFormClosedLabels = (lang: string | undefined): FormClosedLabels =>
  resolveForLanguage(FORM_CLOSED_LABELS, lang, EN)
