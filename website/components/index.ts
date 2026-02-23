/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { valueCard, principleItem } from './company-components'
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
  // Company page
  valueCard,
  principleItem,
  // Partners page
  testimonialCard,
  processStep,
  methodologyCard,
  statCard,
  marqueeLogoItem,
  // Shared
  sovriumBadge,
]
