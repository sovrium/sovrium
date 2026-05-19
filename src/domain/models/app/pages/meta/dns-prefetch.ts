/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { HttpUrlSchema } from '@/domain/types/url'


export const DnsPrefetchDomainSchema = HttpUrlSchema.annotations({
  title: 'DNS Prefetch Domain',
  description: 'Domain to prefetch DNS for',
})

export const DnsPrefetchSchema = Schema.Array(DnsPrefetchDomainSchema).annotations({
  title: 'DNS Prefetch',
  description: 'DNS prefetch hints for external domains',
})

export type DnsPrefetchDomain = Schema.Schema.Type<typeof DnsPrefetchDomainSchema>
export type DnsPrefetch = Schema.Schema.Type<typeof DnsPrefetchSchema>
