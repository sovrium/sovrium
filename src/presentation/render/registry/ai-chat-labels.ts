/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveForLanguage } from '@/domain/models/app/languages/locale-lookup-service'

/**
 * Per-locale copy for the `ai-chat` panel's engine-written notices.
 *
 * The sentence a failed turn shows, its Retry button, and the notice a host with
 * no AI provider draws are platform chrome, like the closed-form page
 * (`render/forms/form-closed-labels.ts`, whose pattern this mirrors): they follow
 * the document's language through an internal map rather than app-authored `$t:`
 * content. The engine ships English and French; any other language falls back
 * to English rather than rendering blank.
 */
export interface AiChatLabels {
  readonly failure: string
  readonly retry: string
  readonly notConfigured: string
}

const EN: AiChatLabels = {
  failure: 'The assistant is unavailable.',
  retry: 'Retry',
  notConfigured:
    'AI chat is not configured here. Set AI_PROVIDER, and AI_API_KEY for a hosted provider, to turn it on.',
}

const FR: AiChatLabels = {
  failure: 'L’assistant est indisponible.',
  retry: 'Réessayer',
  notConfigured:
    'Le chat IA n’est pas configuré ici. Définissez AI_PROVIDER, et AI_API_KEY pour un fournisseur hébergé, pour l’activer.',
}

/**
 * Locale → labels. An open `Record<string, …>` so a supported language with no
 * entry resolves to the English default via {@link getAiChatLabels}.
 */
const AI_CHAT_LABELS: Readonly<Record<string, AiChatLabels>> = {
  en: EN,
  fr: FR,
}

/**
 * Resolve the chat notices for the document language. A regional tag resolves
 * through its primary subtag (`fr-FR` → `fr`); `undefined` and any unmapped
 * language fall back to English.
 */
export const getAiChatLabels = (lang: string | undefined): AiChatLabels =>
  resolveForLanguage(AI_CHAT_LABELS, lang, EN)
