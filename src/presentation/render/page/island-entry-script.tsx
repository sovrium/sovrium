/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { hasCommandPaletteHost } from './command-palette-capture'
import { hasIslandComponents } from './page-island-detection'
import type { Components } from '@/domain/models/app/components'
import type { Page } from '@/domain/models/app/pages'
import type { ReactElement } from 'react'

/**
 * The island runtime's entry, in one of two forms.
 *
 * A page with islands loads it: one module script at the end of `<body>`.
 *
 * A page whose only island is the built-in ⌘K palette does NOT load it. That
 * palette is on nearly every page and is opened on a few of them, so loading
 * the island runtime for it would put the whole client closure on every page a
 * reader merely looks at. The page carries an inert `<template>` naming the
 * entry instead, and the head capture script loads it on the first open
 * (`COMMAND_PALETTE_CAPTURE_SCRIPT`). A template fetches nothing and renders
 * nothing.
 */
export function IslandEntryScript({
  page,
  components,
  islandEntryFile,
}: {
  readonly page: Page
  readonly components?: Components
  readonly islandEntryFile?: string
}): ReactElement | undefined {
  if (islandEntryFile === undefined) return undefined
  const src = `/assets/islands/${islandEntryFile}`
  if (hasIslandComponents(page, components)) {
    return (
      <script
        src={src}
        type="module"
      />
    )
  }
  if (!hasCommandPaletteHost(page.components)) return undefined
  return <template data-island-entry={src} />
}
