/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { valueCard, principleItem } from './about-components'
import {
  docsBadgeItem,
  docsCallout,
  docsCodeBlock,
  docsInfoCard,
  docsInfoCardIcon,
  docsNavLink,
  docsPropertyCard,
  docsPropertyRow,
  docsScreenshot,
  docsSectionHeader,
  docsStep,
} from './docs-components'
import {
  testimonialCard,
  processStep,
  methodologyCard,
  statCard,
  marqueeLogoItem,
} from './partner-components'
import { sovriumBadge } from './shared-components'
import type { ComponentTemplate } from '@/index'

export const components: readonly ComponentTemplate[] = [
  // About page
  valueCard,
  principleItem,
  // Docs page
  docsBadgeItem,
  docsCallout,
  docsCodeBlock,
  docsInfoCard,
  docsInfoCardIcon,
  docsNavLink,
  docsPropertyCard,
  docsPropertyRow,
  docsScreenshot,
  docsSectionHeader,
  docsStep,
  // Partner page
  testimonialCard,
  processStep,
  methodologyCard,
  statCard,
  marqueeLogoItem,
  // Shared
  sovriumBadge,
]
