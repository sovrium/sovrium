/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { about } from './en/about'
import { badge } from './en/badge'
import { dataDeletion } from './en/data-deletion'
import { docs } from './en/docs'
import { footer } from './en/footer'
import { home } from './en/home'
import { nav } from './en/nav'
import { partner } from './en/partner'
import { privacy } from './en/privacy'
import { terms } from './en/terms'

export const en: Record<string, string> = {
  ...badge,
  ...nav,
  ...footer,
  ...home,
  ...partner,
  ...about,
  ...terms,
  ...privacy,
  ...dataDeletion,
  ...docs,
}
