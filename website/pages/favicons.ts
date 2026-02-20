/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { FaviconSet } from '@/domain/models/app/page/meta/favicon-set'

/**
 * Shared favicon configuration for all website pages
 *
 * References real favicon files from website/assets/favicon/
 * These are served via publicDir at /favicon/* paths
 */
export const favicons: FaviconSet = [
  {
    rel: 'icon',
    type: 'image/x-icon',
    href: './favicon/favicon.ico',
  },
  {
    rel: 'icon',
    type: 'image/png',
    sizes: '32x32',
    href: './favicon/favicon-32x32.png',
  },
  {
    rel: 'icon',
    type: 'image/png',
    sizes: '16x16',
    href: './favicon/favicon-16x16.png',
  },
  {
    rel: 'apple-touch-icon',
    sizes: '180x180',
    href: './favicon/apple-touch-icon.png',
  },
  {
    rel: 'icon',
    type: 'image/png',
    sizes: '192x192',
    href: './favicon/android-chrome-192x192.png',
  },
  {
    rel: 'icon',
    type: 'image/png',
    sizes: '512x512',
    href: './favicon/android-chrome-512x512.png',
  },
  {
    rel: 'manifest',
    href: './favicon/site.webmanifest',
  },
]
