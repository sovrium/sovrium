/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export interface DemoNoticeLabels {
  readonly summary: string
  readonly title: (name?: string) => string
  readonly body: string
  readonly credentialsLabel: string
  readonly prefill: string
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

const DEMO_NOTICE_LABELS: Readonly<Record<string, DemoNoticeLabels>> = {
  en: EN,
  fr: FR,
}

export const getDemoNoticeLabels = (lang: string | undefined): DemoNoticeLabels =>
  (lang !== undefined ? DEMO_NOTICE_LABELS[lang] : undefined) ?? EN
