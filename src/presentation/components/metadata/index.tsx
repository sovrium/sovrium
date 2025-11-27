/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Metadata components barrel export
 *
 * This module exports all metadata rendering components:
 * - OpenGraphMeta: Facebook/LinkedIn Open Graph tags
 * - TwitterCardMeta: Twitter/X card tags
 * - StructuredDataScript: Schema.org JSON-LD
 * - AnalyticsHead: Analytics provider scripts
 * - DnsPrefetchLinks: DNS prefetch link tags
 * - CustomElementsHead: Custom head elements
 * - FaviconLink: Simple favicon link
 * - FaviconSetLinks: Multi-device favicon set
 * - PreloadLinks: Resource preload hints
 *
 * @see Individual component files for detailed documentation
 */

export { OpenGraphMeta } from './open-graph-meta'
export { TwitterCardMeta } from './twitter-card-meta'
export { StructuredDataScript } from './structured-data'
export { AnalyticsHead } from './analytics-head'
export {
  DnsPrefetchLinks,
  CustomElementsHead,
  FaviconLink,
  FaviconSetLinks,
  PreloadLinks,
} from './head-elements'
