/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { HttpUrlSchema } from '../common/url'

/**
 * DNS prefetch domain URL
 *
 * Absolute URL to external domain for DNS prefetching.
 * - Pattern: ^https?:// (must start with http:// or https://)
 * - Examples: https://fonts.googleapis.com, https://www.google-analytics.com
 * - Format: uri (valid URL)
 */
export const DnsPrefetchDomainSchema = HttpUrlSchema.annotations({
  title: 'DNS Prefetch Domain',
  description: 'Domain to prefetch DNS for',
})

/**
 * DNS prefetch hints for external domains
 *
 * Array of external domain URLs to perform DNS resolution early in page load.
 * Reduces connection latency by resolving domain names before resources are requested.
 *
 * How DNS prefetch works:
 * 1. Browser receives <link rel="dns-prefetch" href="..."> in <head>
 * 2. Browser resolves domain name to IP address in the background
 * 3. When resource is later requested, DNS is already resolved (faster connection)
 * 4. Reduces latency by 20-120ms per domain (DNS lookup time)
 *
 * Common use cases:
 * - **Fonts**: https://fonts.googleapis.com, https://fonts.gstatic.com
 * - **Analytics**: https://www.google-analytics.com, https://plausible.io
 * - **CDNs**: https://unpkg.com, https://cdn.jsdelivr.net, https://cdnjs.cloudflare.com
 * - **Social**: https://www.facebook.com, https://platform.twitter.com
 * - **APIs**: https://api.example.com (backend API domains)
 *
 * Performance impact:
 * - DNS resolution: typically 20-120ms per domain
 * - Mobile networks: DNS can take 200-500ms (critical optimization)
 * - First request: DNS + TCP + TLS handshake (300-1000ms total)
 * - With DNS prefetch: Only TCP + TLS (100-400ms total)
 *
 * Best practices:
 * - Only prefetch domains with high certainty of use (avoid wasting bandwidth)
 * - Limit to 4-6 domains (too many = diminishing returns)
 * - Include domains for critical resources (fonts, analytics, CDN)
 * - Combine with preconnect for even faster connections (DNS + TCP + TLS)
 *
 * @example
 * ```typescript
 * const dnsPrefetch = [
 *   // Google Fonts (most common external resource)
 *   'https://fonts.googleapis.com',
 *   'https://fonts.gstatic.com',
 *   // Analytics
 *   'https://www.google-analytics.com',
 *   // CDN
 *   'https://cdn.example.com',
 *   // API backend
 *   'https://api.example.com'
 * ]
 * ```
 *
 * @see specs/app/pages/meta/performance/dns-prefetch.schema.json
 */
export const DnsPrefetchSchema = Schema.Array(DnsPrefetchDomainSchema).annotations({
  title: 'DNS Prefetch',
  description: 'DNS prefetch hints for external domains',
})

export type DnsPrefetchDomain = Schema.Schema.Type<typeof DnsPrefetchDomainSchema>
export type DnsPrefetch = Schema.Schema.Type<typeof DnsPrefetchSchema>
