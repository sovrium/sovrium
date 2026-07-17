/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

const EN = 'Built with Sovrium'

const FR = 'Construit avec Sovrium'

const BADGE_LABELS: Readonly<Record<string, string>> = {
  en: EN,
  fr: FR,
}

export const getBadgeLabel = (lang: string | undefined): string =>
  (lang !== undefined ? BADGE_LABELS[lang] : undefined) ?? EN
