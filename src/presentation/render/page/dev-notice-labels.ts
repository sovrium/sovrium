/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveForLanguage } from '@/domain/models/app/languages/locale-lookup-service'

/**
 * Per-locale copy for the dev-mode notice.
 *
 * The notice is platform CHROME (exactly like the "Built with Sovrium" badge in
 * `badge-labels.ts`, whose pattern this mirrors): its copy follows the page's
 * active locale through an internal map — it is NOT app-authored `$t:`
 * translation content and is not customizable.
 *
 * Copy is deliberately hard-coded rather than env-driven: `SOVRIUM_DEV_*`
 * carries only the *facts* about the environment (is dev mode on, which
 * credentials, which page to read more on). Letting an operator supply arbitrary notice
 * text would turn platform chrome into an untranslatable, unreviewable content
 * surface.
 */
export interface DevNoticeLabels {
  /** Collapsed-state pill label — kept to a single word so the pill stays small. */
  readonly summary: string
  /**
   * Panel heading template: takes the optional display name
   * (`SOVRIUM_DEV_NAME`) and slots it into the localized title
   * (`<name> — development` / `<name> — développement`), falling back to
   * `Dev mode` / `Mode dev` when no name is given. The name itself is never translated — only this
   * surrounding template is localized.
   */
  readonly title: (name?: string) => string
  /** Panel body: the mode, and that the data on this instance is disposable. */
  readonly body: string
  /** Lead-in for the display credentials block. */
  readonly credentialsLabel: string
  /** Prefill button (inside the credentials block) that fills a sign-in form. */
  readonly prefill: string
  /** Call-to-action pointing at `SOVRIUM_DEV_URL`. */
  readonly cta: string
}

const EN: DevNoticeLabels = {
  summary: 'Dev',
  title: (name) => (name ? `${name} — development` : 'Dev mode'),
  body: 'Development mode. Data on this instance is disposable.',
  credentialsLabel: 'Sign in with',
  prefill: 'Fill sign-in form',
  cta: 'Learn more →',
}

const FR: DevNoticeLabels = {
  summary: 'Dev',
  title: (name) => (name ? `${name} — développement` : 'Mode dev'),
  body: 'Mode développement. Les données de cette instance sont jetables.',
  credentialsLabel: 'Connexion',
  prefill: 'Remplir le formulaire',
  cta: 'En savoir plus →',
}

/**
 * Locale → copy. Typed as an open `Record<string, …>` (NOT an `'en' | 'fr'`
 * union) so any supported locale WITHOUT an entry resolves gracefully to the
 * English default via {@link getDevNoticeLabels}.
 */
const DEV_NOTICE_LABELS: Readonly<Record<string, DevNoticeLabels>> = {
  en: EN,
  fr: FR,
}

/**
 * Resolve the notice copy for the active language. A regional tag resolves
 * through its primary subtag (`fr-FR` → `fr`), so a French-locale page gets the
 * French notice; `undefined` and any locale with no map entry (e.g. an unmapped
 * `de`) fall back to English, so an unmapped locale never renders blanks or
 * leaks a translation key. The same {@link resolveForLanguage} every chrome map
 * uses.
 */
export const getDevNoticeLabels = (lang: string | undefined): DevNoticeLabels =>
  resolveForLanguage(DEV_NOTICE_LABELS, lang, EN)
