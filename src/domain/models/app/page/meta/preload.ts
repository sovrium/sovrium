/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Resource type hint for preloading
 *
 * 8 standard resource types for <link rel="preload" as="...">:
 * - style: CSS stylesheets (critical CSS for above-the-fold content)
 * - script: JavaScript files (critical scripts needed for initial render)
 * - font: Web fonts (WOFF2, WOFF, TTF) - requires crossorigin attribute
 * - image: Images (hero images, above-the-fold images)
 * - video: Video files
 * - audio: Audio files
 * - document: HTML documents (iframes, embeds)
 * - fetch: API data (XHR, Fetch API responses) - prefetch critical API data
 */
export const PreloadResourceTypeSchema = Schema.Literal(
  'style',
  'script',
  'font',
  'image',
  'video',
  'audio',
  'document',
  'fetch'
).annotations({
  description: 'Resource type hint',
})

/**
 * CORS setting for preloaded resources
 *
 * 3 options:
 * - true: Anonymous CORS (no credentials) - most common for fonts
 * - false: No CORS (same-origin)
 * - 'anonymous': Explicit anonymous CORS (same as true)
 * - 'use-credentials': CORS with credentials (cookies, auth)
 *
 * Important for fonts:
 * - Web fonts MUST have crossorigin attribute (even from same origin)
 * - Without crossorigin: font downloads twice (preload + actual request)
 * - With crossorigin: font downloads once (preload is reused)
 */
export const PreloadCrossOriginSchema = Schema.Union(
  Schema.Boolean,
  Schema.Literal('anonymous', 'use-credentials')
).annotations({
  description: 'CORS setting for the resource',
})

/**
 * Preload resource configuration
 *
 * Defines a single resource to preload early in page load for performance optimization.
 *
 * Required properties:
 * - href: Resource URL to preload (absolute or relative path)
 * - as: Resource type hint (style, script, font, image, video, audio, document, fetch)
 *
 * Optional properties:
 * - type: MIME type (font/woff2, image/webp, text/css, etc.) - helps browser prioritize
 * - crossorigin: CORS setting (true/false/'anonymous'/'use-credentials') - required for fonts
 * - media: Media query for conditional loading (e.g., "(min-width: 768px)")
 *
 * Common preload patterns:
 * 1. **Critical CSS**: Preload main stylesheet for faster first paint
 *    ```typescript
 *    { href: './output.css', as: 'style' }
 *    ```
 *
 * 2. **Web fonts**: Preload fonts used above-the-fold (crossorigin required!)
 *    ```typescript
 *    { href: './fonts/MyFont.woff2', as: 'font', type: 'font/woff2', crossorigin: true }
 *    ```
 *
 * 3. **Hero images**: Preload above-the-fold images for faster LCP
 *    ```typescript
 *    { href: './hero.jpg', as: 'image', type: 'image/jpeg' }
 *    ```
 *
 * 4. **Critical API data**: Prefetch data needed for initial render
 *    ```typescript
 *    { href: '/api/posts', as: 'fetch', crossorigin: 'use-credentials' }
 *    ```
 *
 * 5. **Responsive images**: Preload images conditionally based on screen size
 *    ```typescript
 *    { href: './hero-mobile.jpg', as: 'image', media: '(max-width: 767px)' }
 *    ```
 *
 * Performance impact:
 * - Preload critical resources before parser discovers them
 * - Reduces time to First Contentful Paint (FCP) by 200-500ms
 * - Reduces Largest Contentful Paint (LCP) by 300-800ms (hero images, fonts)
 * - Improves Core Web Vitals (FCP, LCP, CLS)
 *
 * @example
 * ```typescript
 * const preloadItem = {
 *   href: './fonts/Inter.woff2',
 *   as: 'font',
 *   type: 'font/woff2',
 *   crossorigin: true
 * }
 * ```
 *
 * @see specs/app/pages/meta/performance/preload.schema.json
 */
export const PreloadItemSchema = Schema.Struct({
  href: Schema.String.annotations({
    description: 'Resource URL to preload',
  }),
  as: PreloadResourceTypeSchema,
  type: Schema.optional(
    Schema.String.annotations({
      description: 'MIME type for the resource',
    })
  ),
  crossorigin: Schema.optional(PreloadCrossOriginSchema),
  media: Schema.optional(
    Schema.String.annotations({
      description: 'Media query for conditional loading',
    })
  ),
}).annotations({
  description: 'Preload resource',
})

/**
 * Resource preloading for performance optimization
 *
 * Array of critical resources to preload early in page load.
 * Improves First Contentful Paint (FCP) and Largest Contentful Paint (LCP)
 * by fetching resources before the browser parser discovers them.
 *
 * How preload works:
 * 1. Browser receives <link rel="preload" ...> in <head>
 * 2. Browser downloads resource immediately (high priority)
 * 3. Resource is cached in browser
 * 4. When parser discovers resource later, it's already downloaded (instant load)
 *
 * What to preload:
 * - **Critical CSS**: Main stylesheet for above-the-fold content
 * - **Web fonts**: Fonts used above-the-fold (prevent FOIT/FOUT)
 * - **Hero images**: Largest Contentful Paint (LCP) images
 * - **Critical scripts**: JavaScript needed for initial render
 * - **API data**: Critical data needed for first render
 *
 * What NOT to preload:
 * - Resources below the fold (defer or lazy load instead)
 * - Non-critical resources (wasted bandwidth, slows critical resources)
 * - Too many resources (limit to 3-5 items, prioritize most critical)
 *
 * Performance metrics improved:
 * - First Contentful Paint (FCP): 200-500ms faster
 * - Largest Contentful Paint (LCP): 300-800ms faster
 * - Cumulative Layout Shift (CLS): Reduced by preventing font swaps
 * - Time to Interactive (TTI): Faster by preloading critical scripts
 *
 * @example
 * ```typescript
 * const preload = [
 *   // Critical CSS
 *   { href: './output.css', as: 'style' },
 *   // Web font (crossorigin required!)
 *   { href: './fonts/Inter-Bold.woff2', as: 'font', type: 'font/woff2', crossorigin: true },
 *   // Hero image (LCP)
 *   { href: './hero.jpg', as: 'image', type: 'image/jpeg' },
 *   // Critical API data
 *   { href: '/api/posts', as: 'fetch', crossorigin: true }
 * ]
 * ```
 *
 * @see specs/app/pages/meta/performance/preload.schema.json
 */
export const PreloadSchema = Schema.Array(PreloadItemSchema).annotations({
  title: 'Resource Preloading',
  description: 'Preload critical resources for performance optimization',
})

export type PreloadResourceType = Schema.Schema.Type<typeof PreloadResourceTypeSchema>
export type PreloadCrossOrigin = Schema.Schema.Type<typeof PreloadCrossOriginSchema>
export type PreloadItem = Schema.Schema.Type<typeof PreloadItemSchema>
export type Preload = Schema.Schema.Type<typeof PreloadSchema>
