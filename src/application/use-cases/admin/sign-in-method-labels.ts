/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What the console calls a way an account signs in, per console language.
 *
 * The directory read stores each method as the provider id its sign-in
 * account carries (`credential`, `google`, `[internal ref]`), which a person
 * should not have to decode. The password method is the console's words; a
 * provider is its brand, written as the brand writes it; any other id reads
 * made readable. Kept beside the other console words for engine names, which
 * no app config declares and so no app dictionary can translate.
 */

import { readableName } from '@/domain/models/app/auth/readable-name-service'
import type { ConsoleLanguage } from './operator-language'

/** The password method, the one a console must phrase. */
const PASSWORD_WORDS: Readonly<Record<ConsoleLanguage, string>> = {
  en: 'Email and password',
  fr: 'E-mail et mot de passe',
}

/** The providers whose brand is not their id made readable. */
const PROVIDER_BRANDS: Readonly<Record<string, string>> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  linkedin: 'LinkedIn',
  'sovrium-cloud': 'Sovrium Cloud',
  tiktok: 'TikTok',
  vk: 'VK',
}

/** What the console prints for the sign-in method `id`, in `language`. */
export const signInMethodLabelOf = (id: string, language: ConsoleLanguage): string =>
  id === 'credential' ? PASSWORD_WORDS[language] : (PROVIDER_BRANDS[id] ?? readableName(id))
