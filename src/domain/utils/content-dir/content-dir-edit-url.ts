/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


interface BuildContentDirEditUrlInput {
  readonly template: string
  readonly slug: string
  readonly lang?: string
}

export const buildContentDirEditUrl = ({
  template,
  slug,
  lang,
}: BuildContentDirEditUrlInput): string =>
  template
    .replaceAll('{slug}', slug)
    .replaceAll('{path}', `${slug}.md`)
    .replaceAll('{lang}', lang ?? '')
