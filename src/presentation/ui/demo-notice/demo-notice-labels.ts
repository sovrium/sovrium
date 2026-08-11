/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Per-locale copy for the demo context notice.
 *
 * The notice is platform CHROME (exactly like the "Built with Sovrium" badge in
 * `badge/badge-labels.ts`, whose pattern this mirrors): its copy follows the
 * page's active locale through an internal map — it is NOT app-authored `$t:`
 * translation content and is not customizable.
 *
 * Copy is deliberately hard-coded rather than env-driven: `SOVRIUM_DEMO_*`
 * carries only the *facts* about the hosting environment (is this a demo, which
 * credentials, which product page). Letting an operator supply arbitrary notice
 * text would turn platform chrome into an untranslatable, unreviewable content
 * surface.
 */
export interface DemoNoticeLabels {
  /** Collapsed-state pill label — kept to a single word so the pill stays small. */
  readonly summary: string
  /**
   * Panel heading template: takes the optional template display name
   * (`SOVRIUM_DEMO_NAME`) and slots it into the localized title (`<name> demo` /
   * `Démo <name>`), falling back to the brand (`Sovrium demo` / `Démo Sovrium`)
   * when no name is given. The name itself is never translated — only this
   * surrounding template is localized.
   */
  readonly title: (name?: string) => string
  /** Panel body: the brand attribution + data-reset expectation a visitor needs. */
  readonly body: string
  /** Lead-in for the display credentials block. */
  readonly credentialsLabel: string
  /** Prefill button (inside the credentials block) that fills a sign-in form. */
  readonly prefill: string
  /** Call-to-action pointing at the template's product page. */
  readonly cta: string
}

const EN: DemoNoticeLabels = {
  summary: 'Demo',
  title: (name) => (name ? `${name} demo` : 'Sovrium demo'),
  body: 'Built with Sovrium. Data resets nightly at 04:00 UTC.',
  credentialsLabel: 'Sign in with',
  prefill: 'Fill sign-in form',
  cta: 'About this template →',
}

const FR: DemoNoticeLabels = {
  summary: 'Démo',
  title: (name) => (name ? `Démo ${name}` : 'Démo Sovrium'),
  body: 'Construit avec Sovrium. Les données sont réinitialisées chaque nuit à 04:00 UTC.',
  credentialsLabel: 'Connexion',
  prefill: 'Remplir le formulaire',
  cta: 'À propos de ce modèle →',
}

/**
 * Locale → copy. Typed as an open `Record<string, …>` (NOT an `'en' | 'fr'`
 * union) so any supported locale WITHOUT an entry resolves gracefully to the
 * English default via {@link getDemoNoticeLabels}.
 */
const DEMO_NOTICE_LABELS: Readonly<Record<string, DemoNoticeLabels>> = {
  en: EN,
  fr: FR,
}

/**
 * Resolve the notice copy for the active language. Returns the English default
 * for `undefined` or any locale with no map entry (e.g. an unmapped `de`) — the
 * same graceful fallback as `getBadgeLabel`, so an unmapped locale never
 * renders blanks or leaks a translation key.
 */
export const getDemoNoticeLabels = (lang: string | undefined): DemoNoticeLabels =>
  (lang !== undefined ? DEMO_NOTICE_LABELS[lang] : undefined) ?? EN
