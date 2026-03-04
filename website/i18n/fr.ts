/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { about } from './fr/about'
import { badge } from './fr/badge'
import { dataDeletion } from './fr/data-deletion'
import { docs } from './fr/docs'
import { footer } from './fr/footer'
import { home } from './fr/home'
import { nav } from './fr/nav'
import { partner } from './fr/partner'
import { privacy } from './fr/privacy'
import { terms } from './fr/terms'

export const fr: Record<string, string> = {
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
