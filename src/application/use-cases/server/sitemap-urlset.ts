/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** Wrap entries in a `<urlset>` document. */
export const renderUrlset = (entries: readonly string[], hasHreflang: boolean): string => {
  const xmlnsAttr = hasHreflang
    ? ' xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:xhtml="http://www.w3.org/1999/xhtml"'
    : ' xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset${xmlnsAttr}>
${entries.join('\n')}
</urlset>`
}
